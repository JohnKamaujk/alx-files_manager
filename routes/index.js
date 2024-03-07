import express from 'express';
import AppController from '../controllers/AppController';

const router = express.Router();

// Define routes
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);

export default router;
