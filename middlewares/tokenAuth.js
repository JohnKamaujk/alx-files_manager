import getUser from '../utils/getUser';
/**
 * Middleware for token-based authentication.
 * It validates the token and attaches the user to the request object.
 * If the token is invalid or missing, it sends a 401 Unauthorized response.
 * @param {Request} req The request object.
 * @param {Response} res The response object.
 * @param {Function} next The next middleware function.
 * @returns {Response or next Func}
 */
async function tokenAuth(req, res, next) {
  try {
    const user = await getUser(req);
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
