import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';

/**
 * Controller for handling Authorization.
 */
class AuthController {
  /**
   * Handles the authentication of a user and generates an authentication token.
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   * @returns {Response}
   */
  static async getConnect(req, res) {
    try {
      const { user } = req;

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
   * @returns {Response}
   */
  static async getDisconnect(req, res) {
    try {
      const token = req.headers['x-token'];

      await redisClient.del(`auth_${token}`);

      return res.status(204).send();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default AuthController;
