import express from 'express';
import { storage } from '../storage';

const router = express.Router();

  // Story API
  router.post('/stories', async (req, res) => {
    try {
      const { transactionId, authorType, message, photoUrl, isPublic, showAmount, showGiver, showRecipient, sharingPlatforms } = req.body || {};
      
      if (!transactionId || !authorType || !message) {
        return res.status(400).json({ error: 'Transaction ID, author type, and message required' });
      }

      const story = await storage.createStory({
        transactionId: String(transactionId),
        authorType,
        message,
        photoUrl: photoUrl || null,
        isPublic: isPublic !== false ? 1 : 0,
        showAmount: showAmount !== false ? 1 : 0,
        showGiver: showGiver !== false ? 1 : 0,
        showRecipient: showRecipient !== false ? 1 : 0,
        sharingPlatforms: Array.isArray(sharingPlatforms) ? sharingPlatforms : [],
      });

      res.json(story);
    } catch (error) {
      console.error('Create story error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/stories/public', async (req, res) => {
    try {
      const stories = await storage.getAllPublicStories();
      res.json(stories);
    } catch (error) {
      console.error('Get public stories error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/stories/transaction/:transactionId', async (req, res) => {
    try {
      const story = await storage.getStoryByTransaction(String(req.params.transactionId));
      if (!story) {
        return res.status(404).json({ error: 'Story not found' });
      }
      res.json(story);
    } catch (error) {
      console.error('Get story by transaction error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

export default router;
