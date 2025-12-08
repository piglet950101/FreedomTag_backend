import crypto from 'crypto';

export interface SumsubConfig {
  appToken: string;
  secretKey: string;
  baseUrl?: string;
  levelName?: string;
}

export interface CreateApplicantRequest {
  externalUserId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface SumsubApplicant {
  id: string;
  externalUserId: string;
  inspectionId?: string;
  reviewStatus?: string;
  reviewResult?: {
    reviewAnswer?: string;
  };
}

export class SumsubClient {
  private config: SumsubConfig;

  constructor(config: SumsubConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://api.sumsub.com',
      levelName: config.levelName || 'basic-kyc-level',
    };
  }

  private generateSignature(method: string, url: string, timestamp: number, body?: string): string {
    const signatureString = timestamp + method.toUpperCase() + url + (body || '');
    return crypto
      .createHmac('sha256', this.config.secretKey)
      .update(signatureString)
      .digest('hex');
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000);
    const url = `/resources${endpoint}`;
    const bodyString = body ? JSON.stringify(body) : undefined;
    
    const signature = this.generateSignature(method, url, timestamp, bodyString);

    const headers: Record<string, string> = {
      'X-App-Token': this.config.appToken,
      'X-App-Access-Ts': timestamp.toString(),
      'X-App-Access-Sig': signature,
      'Content-Type': 'application/json',
    };

    const fullUrl = `${this.config.baseUrl}${url}`;
    
    const response = await fetch(fullUrl, {
      method,
      headers,
      body: bodyString,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sumsub API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async createApplicant(request: CreateApplicantRequest): Promise<SumsubApplicant> {
    const body = {
      externalUserId: request.externalUserId,
      info: {
        firstName: request.firstName,
        lastName: request.lastName,
        country: 'ZAF',
      },
      email: request.email,
      phone: request.phone,
    };

    return this.makeRequest('POST', `/applicants?levelName=${this.config.levelName}`, body);
  }

  async getApplicant(applicantId: string): Promise<SumsubApplicant> {
    return this.makeRequest('GET', `/applicants/${applicantId}/one`);
  }

  async generateAccessToken(
    applicantId: string,
    externalUserId: string,
    ttlInSeconds: number = 600
  ): Promise<{ token: string; userId: string }> {
    const body = {
      userId: externalUserId,
      ttlInSecs: ttlInSeconds,
    };

    const result = await this.makeRequest(
      'POST',
      `/accessTokens?userId=${externalUserId}&ttlInSecs=${ttlInSeconds}`,
      body
    );

    return {
      token: result.token,
      userId: externalUserId,
    };
  }

  async getApplicantStatus(applicantId: string): Promise<{
    reviewStatus: string;
    reviewResult?: string;
  }> {
    const applicant = await this.getApplicant(applicantId);
    
    return {
      reviewStatus: applicant.reviewStatus || 'pending',
      reviewResult: applicant.reviewResult?.reviewAnswer,
    };
  }

  getSdkUrl(applicantId: string, accessToken: string): string {
    return `https://cockpit.sumsub.com/idensic/index.html?app=${this.config.appToken}&applicantId=${applicantId}&accessToken=${accessToken}`;
  }
}

// Demo mode client that simulates Sumsub without API credentials
export class DemoSumsubClient {
  async createApplicant(request: CreateApplicantRequest): Promise<SumsubApplicant> {
    // Generate a mock applicant ID
    const mockApplicantId = `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    return {
      id: mockApplicantId,
      externalUserId: request.externalUserId,
      reviewStatus: 'pending',
    };
  }

  async getApplicant(applicantId: string): Promise<SumsubApplicant> {
    return {
      id: applicantId,
      externalUserId: applicantId,
      reviewStatus: 'completed',
      reviewResult: {
        reviewAnswer: 'GREEN',
      },
    };
  }

  async generateAccessToken(
    applicantId: string,
    externalUserId: string
  ): Promise<{ token: string; userId: string }> {
    return {
      token: `demo_token_${Date.now()}`,
      userId: externalUserId,
    };
  }

  async getApplicantStatus(applicantId: string): Promise<{
    reviewStatus: string;
    reviewResult?: string;
  }> {
    // In demo mode, always return approved after a short delay
    return {
      reviewStatus: 'completed',
      reviewResult: 'GREEN',
    };
  }

  getSdkUrl(applicantId: string, accessToken: string): string {
    // Return a demo URL that explains this is demo mode
    // Use REPLIT_DOMAINS if available (production), otherwise localhost
    const replitDomains = process.env.REPLIT_DOMAINS;
    const baseUrl = replitDomains 
      ? `https://${replitDomains.split(',')[0]}`
      : 'http://localhost:3000';
    return `${baseUrl}/demo-verification?applicantId=${applicantId}&token=${accessToken}`;
  }
}

export function createSumsubClient(): SumsubClient | DemoSumsubClient {
  const rawAppToken = process.env.SUMSUB_APP_TOKEN || '';
  const rawSecretKey = process.env.SUMSUB_SECRET_KEY || '';
  const mask = (s: string | undefined) => s ? `${s.slice(0,6)}...${s.slice(-6)} (${s.length})` : '<empty>';
  console.log('[Sumsub] tokens (masked):', mask(rawAppToken), mask(rawSecretKey));
  
  // Sanitize values: remove common prefixes like 'Bearer ' and trim whitespace/newlines
  const appToken = rawAppToken.replace(/^Bearer\s+/i, '').trim();
  const secretKey = rawSecretKey.trim();

  if (!appToken || !secretKey) {
    console.warn('Sumsub credentials not configured or empty. Set SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY environment variables.');
    console.log('[Sumsub DEMO API] Using DEMO MODE - verification will be simulated for development');
    return new DemoSumsubClient();
  }

  // Basic validation for common misconfigurations
  if (appToken.toLowerCase().startsWith('bearer')) {
    console.warn('SUMSUB_APP_TOKEN appears to contain a "Bearer" prefix which should be removed. Stripping it automatically.');
  }

  if (appToken.length < 10 || secretKey.length < 10) {
    console.warn('SUMSUB_APP_TOKEN or SUMSUB_SECRET_KEY look unusually short; double-check the values you configured.');
  }

  // Warn if tokens appear swapped or both are secret-like
  const bothLookSecret = appToken.startsWith('sb_secret') && secretKey.startsWith('sb_secret');
  const identical = appToken === secretKey;
  if (bothLookSecret) {
    console.warn('Both SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY appear to be secret-like strings (start with "sb_secret..."). Confirm you copied the correct App token into SUMSUB_APP_TOKEN (App token is different from the Secret key)');
  }
  if (identical) {
    console.warn('SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY are identical — this is likely incorrect; check your env values and from the Sumsub dashboard.');
  }

  // If the values are identically suspicious (e.g., both secret-like or identical), fallback to demo to avoid hard failures
  if (bothLookSecret || identical) {
    console.warn('Potential Sumsub misconfiguration detected; falling back to DemoSumsubClient to avoid API errors. Fix your env or Supabase values to use the correct App Token and Secret Key.');
    return new DemoSumsubClient();
  }
  return new SumsubClient({
    appToken,
    secretKey,
    levelName: process.env.SUMSUB_LEVEL_NAME || 'basic-kyc-level',
  });
}
