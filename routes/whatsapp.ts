import express from 'express';
import { storage } from '../storage';

const router = express.Router();

  // ========== WhatsApp Business API Demo ==========
  
  // Contacts CRM
  router.post('/whatsapp/contacts', async (req, res) => {
    try {
      const { phoneNumber, name, tags, notes } = req.body || {};
      
      if (!phoneNumber || !name) {
        return res.status(400).json({ error: 'Phone number and name required' });
      }

      const contact = await storage.createWhatsappContact({
        phoneNumber,
        name,
        tags: tags || [],
        notes: notes || null,
        lastContactedAt: new Date(),
      });

      res.json(contact);
    } catch (error) {
      console.error('Create contact error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/whatsapp/contacts', async (_req, res) => {
    try {
      const contacts = await storage.getAllWhatsappContacts();
      res.json(contacts);
    } catch (error) {
      console.error('Get contacts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/whatsapp/contacts/:id', async (req, res) => {
    try {
      const contact = await storage.getWhatsappContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      res.json(contact);
    } catch (error) {
      console.error('Get contact error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/whatsapp/contacts/:id', async (req, res) => {
    try {
      const updated = await storage.updateWhatsappContact(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Update contact error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Conversations
  router.post('/whatsapp/conversations', async (req, res) => {
    try {
      const { contactId } = req.body || {};
      
      if (!contactId) {
        return res.status(400).json({ error: 'Contact ID required' });
      }

      const conversation = await storage.createWhatsappConversation({
        contactId,
        status: 'active',
        lastMessageAt: new Date(),
      });

      res.json(conversation);
    } catch (error) {
      console.error('Create conversation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/whatsapp/conversations', async (_req, res) => {
    try {
      const conversations = await storage.getAllWhatsappConversations();
      res.json(conversations);
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/whatsapp/conversations/:id', async (req, res) => {
    try {
      const conversation = await storage.getWhatsappConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      res.json(conversation);
    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Messages
  router.post('/whatsapp/messages', async (req, res) => {
    try {
      const { conversationId, content, sender, messageType } = req.body || {};
      
      if (!conversationId || !content || !sender) {
        return res.status(400).json({ error: 'Conversation ID, content, and sender required' });
      }

      const message = await storage.createWhatsappMessage({
        conversationId,
        content,
        sender,
        messageType: messageType || 'text',
        status: 'sent',
      });

      // Update conversation last message time
      await storage.updateWhatsappConversation(conversationId, {
        lastMessageAt: new Date(),
      });

      res.json(message);
    } catch (error) {
      console.error('Create message error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/whatsapp/messages/:conversationId', async (req, res) => {
    try {
      const messages = await storage.getWhatsappMessagesByConversation(req.params.conversationId);
      res.json(messages);
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // AI Chatbot simulation
  router.post('/whatsapp/chatbot', async (req, res) => {
    try {
      const { conversationId, userMessage } = req.body || {};
      
      if (!conversationId || !userMessage) {
        return res.status(400).json({ error: 'Conversation ID and user message required' });
      }

      // Simple AI response logic (demo)
      let botResponse = '';
      const lowerMsg = userMessage.toLowerCase();
      
      if (lowerMsg.includes('donate') || lowerMsg.includes('donation')) {
        botResponse = 'To make a donation, simply scan the QR code of a Freedom Tag or visit our website. You can donate using crypto or fiat currency. Would you like to know more about our verified charities?';
      } else if (lowerMsg.includes('tag') || lowerMsg.includes('freedom tag')) {
        botResponse = 'Freedom Tags are blockchain-verified donation cards that help beneficiaries receive transparent, traceable support. Each tag has a unique QR code for instant donations. Want to create a tag for someone in need?';
      } else if (lowerMsg.includes('charity') || lowerMsg.includes('organization')) {
        botResponse = 'We work with smart contract-verified charities to ensure 100% transparency. Every donation is tracked on the blockchain. You can see all verified charities on our website. Would you like to see the list?';
      } else if (lowerMsg.includes('help') || lowerMsg.includes('support')) {
        botResponse = 'I can help you with:\n• Making donations\n• Creating Freedom Tags\n• Finding verified charities\n• Understanding blockchain verification\n• Ticket support\n\nWhat would you like to know more about?';
      } else if (lowerMsg.includes('ticket') || lowerMsg.includes('issue')) {
        botResponse = 'I can create a support ticket for you. Please provide details about your issue and our team will assist you within 24 hours.';
      } else {
        botResponse = 'Thanks for your message! I\'m the Blockkoin Freedom Tag assistant. I can help you with donations, Freedom Tags, verified charities, and support. How can I assist you today?';
      }

      const message = await storage.createWhatsappMessage({
        conversationId,
        content: botResponse,
        sender: 'bot',
        messageType: 'text',
        status: 'sent',
      });

      await storage.updateWhatsappConversation(conversationId, {
        lastMessageAt: new Date(),
      });

      res.json(message);
    } catch (error) {
      console.error('Chatbot error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Tickets
  router.post('/whatsapp/tickets', async (req, res) => {
    try {
      const { contactId, subject, description, priority } = req.body || {};
      
      if (!contactId || !subject || !description) {
        return res.status(400).json({ error: 'Contact ID, subject, and description required' });
      }

      const ticket = await storage.createWhatsappTicket({
        contactId,
        subject,
        description,
        priority: priority || 'medium',
        status: 'open',
      });

      res.json(ticket);
    } catch (error) {
      console.error('Create ticket error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/whatsapp/tickets', async (_req, res) => {
    try {
      const tickets = await storage.getAllWhatsappTickets();
      res.json(tickets);
    } catch (error) {
      console.error('Get tickets error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/whatsapp/tickets/:id', async (req, res) => {
    try {
      const ticket = await storage.getWhatsappTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      res.json(ticket);
    } catch (error) {
      console.error('Get ticket error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/whatsapp/tickets/:id', async (req, res) => {
    try {
      const updated = await storage.updateWhatsappTicket(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Update ticket error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

export default router;
