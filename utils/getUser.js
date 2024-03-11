import { ObjectId } from 'mongodb';
import dbClient from './db';
import redisClient from './redis';
/**
 * Retrieves the user associated with the X-Token header in the provided request object.
 * @param {Request} req The Express request object containing the X-Token header.
 * @returns {Promise<Object>} A Promise that resolves to the user object if found, otherwise null.
 */
const getUser = async (req) => {
  const token = req.headers['x-token'];
  if (!token) {
    return null;
  }

  try {
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return null;
    }
    const usersCollection = await dbClient.usersCollection();
    const user = await usersCollection.findOne({ _id: ObjectId(userId) });

    return user || null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

export default getUser;
