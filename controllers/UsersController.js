import { ObjectId } from 'mongodb';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

/**
 * Controller for handling user-related operations.
 */
class UsersController {
  /**
   * Handles the creation of a new user.
   * @param {Request} req The request object.
   * @param {Response} res The response object.
   * @returns {void}
   */
  static async postNew(req, res) {
    const email = req.body ? req.body.email : null;
    const password = req.body ? req.body.password : null;

    if (!email) {
      res.status(400).json({ error: 'Missing email' });
      return;
    }
    if (!password) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }
    const user = await (await dbClient.usersCollection()).findOne({ email });

    if (user) {
      res.status(400).json({ error: 'Already exist' });
      return;
    }
    const insertionInfo = await (
      await dbClient.usersCollection()
    ).insertOne({ email, password: sha1(password) });
    const userId = insertionInfo.insertedId.toString();

    res.status(201).json({ email, id: userId });
  }

  /**
   * Handles retrieving of a user in session.
   * @param {Request} req The request object.
   * @param {Response} res The response object.
   * @returns {void}
   */
  static async getMe(req, res) {
    try {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const usersCollection = await dbClient.usersCollection();
      const user = await usersCollection.findOne({ _id: ObjectId(userId) });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      res.status(200).json({ id: user._id.toString(), email: user.email });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default UsersController;
