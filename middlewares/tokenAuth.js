import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
/**
 * Middleware for token-based authentication.
 * It validates the token and attaches the user to the request object.
 * If the token is invalid or missing, it sends a 401 Unauthorized response.
 * @param {Request} req The request object.
 * @param {Response} res The response object.
 * @param {Function} next The next middleware function.
 * @returns {void}
 */
async function tokenAuth(req, res, next) {
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

    // Attach user to request object for further processing
    req.user = user;

    return next(); // Call the next middleware function
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export default tokenAuth;
