import { MongoClient } from 'mongodb';
/**
 * Represents a MongoDB database client.
 * @module DBClient
 */

class DBClient {
  /**
   * Creates a new DBClient instance.
   * @constructor
   */
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    const uri = `mongodb://${host}:${port}/${database}`;

    this.client = new MongoClient(uri, { useUnifiedTopology: true });
    this.isConnected = false; // Initially assume disconnected

    this.client
      .connect()
      .then(() => {
        // console.log("Connected to MongoDB");
        this.isConnected = true;
      })
      .catch((error) => {
        console.error(`Error connecting to MongoDB: ${error}`);
        this.isConnected = false;
      });
  }

  /**
   * Checks if the database client is connected to the MongoDB server.
   * @returns {boolean} Returns true if connected, false otherwise.
   */
  isAlive() {
    return this.isConnected;
  }

  /**
   * Retrieves the number of users in the 'users' collection.
   * @returns {Promise<number>} A Promise that resolves to the number of users.
   * @throws {Error} Throws an error if the database is not connected.
   */
  async nbUsers() {
    if (!this.isConnected) {
      throw new Error('Database is not connected');
    }
    const usersCollection = this.client.db().collection('users');
    const count = await usersCollection.countDocuments();
    return count;
  }

  /**
   * Retrieves the number of files in the 'files' collection.
   * @returns {Promise<number>} A Promise that resolves to the number of files.
   * @throws {Error} Throws an error if the database is not connected.
   */
  async nbFiles() {
    if (!this.isConnected) {
      throw new Error('Database is not connected');
    }
    const filesCollection = this.client.db().collection('files');
    const count = await filesCollection.countDocuments();
    return count;
  }

  /**
   * Retrieves a reference to the users collection in the database.
   * @returns {Promise<Collection>} A promise that resolves to the users collection.
   * @throws {Error} Throws an error if the database is not connected.
   */
  async usersCollection() {
    if (!this.isConnected) {
      throw new Error('Database is not connected');
    }
    return this.client.db().collection('users');
  }

  /**
   * Retrieves a reference to the files collection in the database.
   * @returns {Promise<Collection>} A promise that resolves to the files collection.
   * @throws {Error} Throws an error if the database is not connected.
   */
  async filesCollection() {
    if (!this.isConnected) {
      throw new Error('Database is not connected');
    }
    return this.client.db().collection('files');
  }
}

const dbClient = new DBClient();

export default dbClient;
