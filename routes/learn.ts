import express from 'express';
import { storage } from '../storage';

const router = express.Router();


  // ========== Learn System (Page-Scoped Help Guides) ==========

  // Get published Learn entry for a specific route (public)
  router.get('/learn/:route(*)', async (req, res) => {
    try {
      const route = `/${req.params.route}`;
      const entry = await storage.getPublishedLearnEntry(route);

      if (!entry) {
        return res.status(404).json({ error: 'Learn guide not found for this page' });
      }

      res.json(entry);
    } catch (error) {
      console.error('Get Learn entry error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get all Learn entries (admin)
  router.get('/admin/learn', async (req, res) => {
    try {
      const entries = await storage.getAllLearnEntries();
      res.json(entries);
    } catch (error) {
      console.error('Get all Learn entries error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create new Learn entry (admin)
  router.post('/admin/learn', async (req, res) => {
    try {
      const entry = await storage.createLearnEntry(req.body);
      res.json(entry);
    } catch (error) {
      console.error('Create Learn entry error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update Learn entry (admin)
  router.patch('/admin/learn/:id', async (req, res) => {
    try {
      const entry = await storage.updateLearnEntry(req.params.id, req.body);
      res.json(entry);
    } catch (error) {
      console.error('Update Learn entry error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Publish Learn entry (admin)
  router.post('/admin/learn/:id/publish', async (req, res) => {
    try {
      const { publishedBy } = req.body;
      const entry = await storage.publishLearnEntry(req.params.id, publishedBy);
      res.json(entry);
    } catch (error) {
      console.error('Publish Learn entry error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

export default router;
