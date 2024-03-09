import sha1 from 'sha1';
import dbClient from '../utils/db';

/**
 * Middleware for handling Basic Authorization.
 * It validates the Authorization header and attaches the user to the request object.
 * If the authorization fails, it sends a 401 Unauthorized response.
 * @param {Request} req The request object.
 * @param {Response} res The response object.
 * @param {Function} next The next middleware function.
 * @returns {Response or next Func}
 */
async function basicAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const authHeaderParts = authHeader.split(' ');
    if (
      !authHeader
      || authHeaderParts.length !== 2
      || authHeaderParts[0] !== 'Basic'
    ) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const credentials = Buffer.from(authHeaderParts[1], 'base64')
      .toString()
      .split(':');
    const email = credentials[0];
    const password = credentials[1];

    const usersCollection = await dbClient.usersCollection();
    const user = await usersCollection.findOne({ email });
    if (!user || user.password !== sha1(password)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Attach user to request object for further processing
    req.user = user;

    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export default basicAuth;
