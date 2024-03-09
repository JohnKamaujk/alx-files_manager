import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

/**
 * Controller for handling Authorization.
 */
class AuthController {
  /**
   * Handles the authentication of a user and generates an authentication token.
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   * @returns {void}
   */
  static async getConnect(req, res) {
    try {
      const authHeader = req.headers.authorization;
      const authHeaderParts = authHeader.split(' ');
      if (!authHeader || authHeaderParts.length !== 2 || authHeaderParts[0] !== 'Basic') {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const credentials = Buffer.from(authHeaderParts[1], 'base64')
        .toString()
        .split(':');
      const email = credentials[0];
      const password = credentials[1];

      const usersCollection = await dbClient.usersCollection();
      const user = await usersCollection.findOne({ email, password: sha1(password) });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = uuidv4();
      await redisClient.set(`auth_${token}`, user._id.toString(), 24 * 60 * 60);

      return res.status(200).json({ token });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Handles the disconnection of a user and deletes the authentication token.
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   * @returns {void}
   */
  static async getDisconnect(req, res) {
    try {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await redisClient.del(`auth_${token}`);
      return res.status(204).send();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default AuthController;
