import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import basicAuth from '../middlewares/basicAuth';
import tokenAuth from '../middlewares/tokenAuth';

const router = express.Router();

// Define routes
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);
router.post('/users', UsersController.postNew);
router.get('/connect', basicAuth, AuthController.getConnect);
router.get('/disconnect', tokenAuth, AuthController.getDisconnect);
router.get('/users/me', tokenAuth, UsersController.getMe);

export default router;
