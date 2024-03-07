import redisClient from '../utils/redis';
import dbClient from '../utils/db';

/**
 * Controller handling API endpoints related to application status and statistics.
 */
class AppController {
  /**
   * Get the status of Redis and the database.
   * @param {Request} req The request object.
   * @param {Response} res The response object.
   * @returns {void}
   */
  static getStatus(req, res) {
    try {
      const redisStatus = redisClient.isAlive();
      const dbStatus = dbClient.isAlive();

      // Check the status of Redis and the database
      if (redisStatus && dbStatus) {
        res.status(200).json({ redis: true, db: true });
      } else {
        res
          .status(500)
          .json({ error: 'Either Redis or the database is not connected' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Get the number of users and files.
   * @param {Request} req The request object.
   * @param {Response} res The response object.
   * @returns {void}
   */
  static async getStats(req, res) {
    try {
      const [usersCount, filesCount] = await Promise.all([
        dbClient.nbUsers(),
        dbClient.nbFiles(),
      ]);
      res.status(200).json({ users: usersCount, files: filesCount });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default AppController;
