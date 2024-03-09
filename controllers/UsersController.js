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
    try {
      const { email, password } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Missing email' });
      }
      if (!password) {
        return res.status(400).json({ error: 'Missing password' });
      }

      const usersCollection = await dbClient.usersCollection();
      const userExists = await usersCollection.findOne({ email });

      if (userExists) {
        return res.status(400).json({ error: 'Already exist' });
      }

      const hashedPassword = sha1(password);

      const newUser = {
        email,
        password: hashedPassword,
      };

      const { insertedId } = await usersCollection.insertOne(newUser);

      const createdUser = { id: insertedId.toString(), email };
      return res.status(201).json(createdUser);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
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

      return res.status(200).json({ id: user._id.toString(), email: user.email });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default UsersController;
