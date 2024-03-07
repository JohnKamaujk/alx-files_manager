import redis from 'redis';
import { promisify } from 'util';
/**
 * RedisClient class provides an interface for interacting with a Redis server.
 * It allows performing operations like getting, setting, and deleting keys in Redis.
 */
class RedisClient {
  /**
   * Creates a new instance of RedisClient and establishes a connection to the Redis server.
   */
  constructor() {
    this.client = redis.createClient();
    this.isConnected = true; // Initially assume connected

    this.client.on('error', (error) => {
      console.error(`Redis error: ${error}`);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      this.isConnected = true;
    });

    // Promisify get, set, and del methods
    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.set).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  /**
   * Checks if the connection to the Redis server is alive.
   * @returns {boolean} True if the connection is alive, otherwise false.
   */
  isAlive() {
    return this.isConnected;
  }

  /**
   * Gets the value associated with the specified key from Redis.
   * @param {string} key - The key to retrieve the value for.
   * @returns {Promise<any>} A promise that resolves to the value
   * stored in Redis for the specified key.
   * @throws {Error} If an error occurs while getting the value from Redis.
   */
  async get(key) {
    try {
      return await this.getAsync(key);
    } catch (error) {
      console.error(`Error getting value from Redis: ${error}`);
      throw error;
    }
  }

  /**
   * Sets the value associated with the specified key in Redis.
   * @param {string} key - The key to set the value for.
   * @param {any} value - The value to set.
   * @param {number} duration - The duration in seconds for which the value will be stored in Redis.
   * @returns {Promise<void>} A promise that resolves when the value is successfully set in Redis.
   * @throws {Error} If an error occurs while setting the value in Redis.
   */
  async set(key, value, duration) {
    try {
      await this.setAsync(key, value, 'EX', duration);
    } catch (error) {
      console.error(`Error setting value in Redis: ${error}`);
      throw error;
    }
  }

  /**
   * Deletes the value associated with the specified key from Redis.
   * @param {string} key - The key to delete.
   * @returns {Promise<void>} A promise that resolves when the value is
   * successfully deleted from Redis.
   * @throws {Error} If an error occurs while deleting the value from Redis.
   */
  async del(key) {
    try {
      await this.delAsync(key);
    } catch (error) {
      console.error(`Error deleting key in Redis: ${error}`);
      throw error;
    }
  }
}

const redisClient = new RedisClient();

export default redisClient;
