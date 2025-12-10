import express from 'express';
import { storage } from '../storage';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();


// Organization Portal APIs
router.get('/organizations/list', async (_req, res) => {
  try {
    const organizations = await storage.getAllOrganizations();
    
    // Fetch organization tag codes (where beneficiaryType === 'charity' or 'organization')
    const organizationsWithTags = await Promise.all(
      organizations.map(async (org) => {
        try {
          const tags = await storage.getTagsByOrganization(org.id);
          // Check for both 'charity' and 'organization' beneficiary types (as used in other routes)
          const orgTag = tags.find((tag: any) => 
            tag.beneficiaryType === 'charity' || tag.beneficiaryType === 'organization'
          );
          return {
            ...org,
            tagCode: orgTag?.tagCode || null,
          };
        } catch (error) {
          console.error(`Error fetching tags for organization ${org.id}:`, error);
          return {
            ...org,
            tagCode: null,
          };
        }
      })
    );
    
    res.json({ organizations: organizationsWithTags });
  } catch (error) {
    console.error('List organizations error:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/organizations/:id', async (req, res) => {
  try {
    const organization = await storage.getOrganization(String(req.params.id));
    if (!organization) {
      return res.status(404).json({ error: 'organization not found' });
    }
    res.json(organization);
  } catch (error) {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/organizations/:id/tags', async (req, res) => {
  try {
    const tags = await storage.getTagsByOrganization(String(req.params.id));
    const tagsWithBalance = await Promise.all(
      tags.map(async (tag) => {
        const wallet = await storage.getWallet(tag.walletId);
        return {
          tagCode: tag.tagCode,
          walletId: tag.walletId,
          beneficiaryType: tag.beneficiaryType,
          beneficiaryName: tag.beneficiaryName,
          issuedAt: tag.issuedAt,
          balanceZAR: wallet?.balanceZAR || 0,
        };
      })
    );
    res.json({ tags: tagsWithBalance });
  } catch (error) {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/organizations/:id/issue-tag', async (req, res) => {
  try {
    const { tagCode, pin, beneficiaryType, beneficiaryName, beneficiaryEmail, beneficiaryPhone } = req.body || {};
    const organizationId = String(req.params.id);

    if (!tagCode || !pin || !beneficiaryType || !beneficiaryName) {
      return res.status(400).json({ error: 'tagCode, pin, beneficiaryType, and beneficiaryName required' });
    }

    const organization = await storage.getOrganization(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'organization not found' });
    }

    const existingTag = await storage.getTag(String(tagCode));
    if (existingTag) {
      return res.status(400).json({ error: 'tag code already exists' });
    }

    const wallet = await storage.createWallet({
      type: 'TAG',
      name: `Tag ${tagCode}`,
      balanceZAR: 0,
    });

    // Create Sumsub applicant if credentials are configured
    let sumsubData: { applicantId?: string; verificationUrl?: string; accessToken?: string } = {};
    const sumsubClient = router.get('sumsubClient');

    console.log('[Tag Issuance] Sumsub client available:', !!sumsubClient);

    if (sumsubClient) {
      try {
        const [firstName, ...lastNameParts] = String(beneficiaryName).split(' ');
        const lastName = lastNameParts.join(' ') || firstName;

        const applicant = await sumsubClient.createApplicant({
          externalUserId: String(tagCode),
          email: beneficiaryEmail,
          phone: beneficiaryPhone,
          firstName,
          lastName,
        });

        console.log('[Tag Issuance] Applicant created:', applicant.id);

        const tokenData = await sumsubClient.generateAccessToken(
          applicant.id,
          String(tagCode)
        );

        const verificationUrl = sumsubClient.getSdkUrl(applicant.id, tokenData.token);
        console.log('[Tag Issuance] Verification URL:', verificationUrl);

        sumsubData = {
          applicantId: applicant.id,
          accessToken: tokenData.token,
          verificationUrl,
        };
      } catch (sumsubError) {
        console.error('Sumsub error during tag issuance:', sumsubError);
      }
    }

    const tag = await storage.createTag({
      tagCode: String(tagCode),
      walletId: wallet.id,
      pin: String(pin),
      organizationId,
      beneficiaryType: String(beneficiaryType),
      beneficiaryName: String(beneficiaryName),
      sumsubApplicantId: sumsubData.applicantId,
      verificationStatus: sumsubData.applicantId ? 'pending' : undefined,
    });

    res.json({
      ok: true,
      tag: {
        tagCode: tag.tagCode,
        walletId: wallet.id,
        beneficiaryType: tag.beneficiaryType,
        beneficiaryName: tag.beneficiaryName,
        issuedAt: tag.issuedAt,
        balanceZAR: 0,
      },
      sumsub: sumsubData.applicantId ? {
        verificationUrl: sumsubData.verificationUrl,
        accessToken: sumsubData.accessToken,
        applicantId: sumsubData.applicantId,
      } : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/organizations/:id/tree', async (req, res) => {
  try {
    const organizationId = String(req.params.id);
    const organization = await storage.getOrganization(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'organization not found' });
    }

    const buildTree = async (orgId: string): Promise<any> => {
      const org = await storage.getOrganization(orgId);

      if (!org) return null;

      const children = await storage.getOrganizationsByParent(orgId);
      const tags = await storage.getTagsByOrganization(orgId);

      return {
        id: org.id,
        name: org.name,
        type: org.type,
        tagCount: tags.length,
        children: await Promise.all(children.map(child => buildTree(child.id))),
      };
    };

    const tree = await buildTree(organizationId);
    res.json(tree);
  } catch (error) {
    console.error('Get organization tree error:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});


// Initiate PIN recovery with Sumsub verification
router.post('/organizations/:id/recover-pin', async (req, res) => {
  try {
    const { tagCode } = req.body || {};
    const organizationId = String(req.params.id);

    console.log('[PIN Recovery] Request:', { tagCode, organizationId });

    if (!tagCode) {
      return res.status(400).json({ error: 'tagCode required' });
    }

    const tag = await storage.getTag(String(tagCode));
    if (!tag) {
      console.log('[PIN Recovery] Tag not found:', tagCode);
      return res.status(404).json({ error: 'tag not found' });
    }

    console.log('[PIN Recovery] Tag found:', { tagCode: tag.tagCode, orgId: tag.organizationId, applicantId: tag.sumsubApplicantId });

    if (tag.organizationId !== organizationId) {
      return res.status(403).json({ error: 'unauthorized - tag belongs to different organization' });
    }

    const sumsubClient = router.get('sumsubClient');
    if (!sumsubClient) {
      console.log('[PIN Recovery] Sumsub client not available');
      return res.status(503).json({ error: 'Sumsub not configured' });
    }

    if (!tag.sumsubApplicantId) {
      console.log('[PIN Recovery] Tag has no applicant ID');
      return res.status(400).json({ error: 'Tag does not have biometric verification on file' });
    }

    // Generate new access token for re-verification
    const tokenData = await sumsubClient.generateAccessToken(
      tag.sumsubApplicantId,
      tag.tagCode
    );

    const verificationUrl = sumsubClient.getSdkUrl(tag.sumsubApplicantId, tokenData.token);
    console.log('[PIN Recovery] Verification URL generated:', verificationUrl);

    res.json({
      ok: true,
      verificationUrl,
      accessToken: tokenData.token,
      applicantId: tag.sumsubApplicantId,
    });
  } catch (error) {
    console.error('PIN recovery error:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Complete PIN reset after verification
router.post('/organizations/:id/reset-pin', async (req, res) => {
  try {
    const { tagCode, newPin } = req.body || {};
    const organizationId = String(req.params.id);

    if (!tagCode || !newPin) {
      return res.status(400).json({ error: 'tagCode and newPin required' });
    }

    const tag = await storage.getTag(String(tagCode));
    if (!tag) {
      return res.status(404).json({ error: 'tag not found' });
    }

    if (tag.organizationId !== organizationId) {
      return res.status(403).json({ error: 'unauthorized' });
    }

    if (tag.verificationStatus !== 'approved') {
      return res.status(403).json({ error: 'beneficiary must complete verification first' });
    }

    const updatedTag = await storage.updateTagPin(tag.tagCode, String(newPin));

    res.json({
      ok: true,
      message: 'PIN successfully reset',
      tagCode: updatedTag.tagCode,
    });
  } catch (error) {
    console.error('PIN reset error:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Organization gives funds to beneficiary
router.post('/organizations/:id/give-to-tag', async (req, res) => {

  try {
    const { beneficiaryTagCode, amountZAR, donorName } = req.body || {};
    const organizationId = String(req.params.id);
    if (!beneficiaryTagCode || !amountZAR) {
      return res.status(400).json({ error: 'beneficiaryTagCode and amountZAR required' });
    }

    const organization = await storage.getOrganization(organizationId);
    if (organization == null || organization === undefined) {
      return res.status(404).json({ error: 'organization not found' });
    }

    // Find the organization's tag (where beneficiaryType='organization')
    const allTags = await storage.getAllTags();
    const organizationTag = allTags.find(
      tag => tag.organizationId === organizationId && tag.beneficiaryType === 'organization'
    );

    if (!organizationTag) {
      return res.status(404).json({ error: 'organization tag not found' });
    }

    const beneficiaryTag = await storage.getTag(String(beneficiaryTagCode));
    if (beneficiaryTag == null || beneficiaryTag === undefined
    ) {
      return res.status(404).json({ error: 'beneficiary tag not found' });
    }

    const orgWallet = await storage.getWallet(organizationTag.walletId);
    const beneficiaryWallet = await storage.getWallet(beneficiaryTag.walletId);

    if (!orgWallet || !beneficiaryWallet) {
      return res.status(404).json({ error: 'wallet not found' });
    }

    const amountInCents = Math.round(Number(amountZAR) * 100);

    if (orgWallet.balanceZAR < amountInCents) {
      return res.status(400).json({ error: 'insufficient organization balance' });
    }

    // Update balances
    await storage.updateWalletBalance(orgWallet.id, orgWallet.balanceZAR - amountInCents);
    await storage.updateWalletBalance(beneficiaryWallet.id, beneficiaryWallet.balanceZAR + amountInCents);

    // Record transaction
    const reference = donorName
      ? `Distribution from ${organization.name} (${donorName}) to ${beneficiaryTagCode}`
      : `Distribution from ${organization.name} to ${beneficiaryTagCode}`;

    await storage.createTransaction({
      kind: 'DISTRIBUTION',
      fromWalletId: orgWallet.id,
      toWalletId: beneficiaryWallet.id,
      amount: amountInCents,
      reference,
    });

    res.json({
      ok: true,
      newOrgBalance: orgWallet.balanceZAR - amountInCents,
      message: `Successfully transferred R ${amountZAR.toFixed(2)} to ${beneficiaryTag.beneficiaryName}`,
    });
  } catch (error) {
    console.error('Organization give error:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Delete organization (admin only)
router.delete('/organizations/:id', authenticateJWT, async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    const user = await storage.getUser(req.user.userId);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const roles = await storage.getUserRoles(user.id);
    const isAdmin = roles.some(r => r.role === 'ADMIN');
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    await storage.deleteOrganization(req.params.id);
    res.json({ success: true, message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
