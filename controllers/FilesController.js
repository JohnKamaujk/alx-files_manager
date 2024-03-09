const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const dbClient = require('../utils/db');

class FilesController {
  /**
   * Uploads a file.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async postUpload(req, res) {
    try {
      const { user } = req;

      // Specifiy the file information
      const acceptedTypes = ['folder', 'file', 'image'];

      const {
        name, type, parentId = 0, isPublic = false, data,
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Missing name' });
      }
      if (!type || !acceptedTypes.includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }
      if (!data && type !== 'folder') {
        return res.status(400).json({ error: 'Missing data' });
      }

      if (parentId !== 0) {
        const filesCollection = await dbClient.filesCollection();
        const parentFile = filesCollection.findOne({ _id: ObjectId(parentId) });

        if (!parentFile) {
          return res.status(400).json({ error: 'Parent not found' });
        }
        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      // Add the user ID to the document
      //  Prepare file document
      const fileDocument = {
        userId: ObjectId(user._id),
        name,
        type,
        isPublic,
        parentId: parentId === 0 ? parentId : ObjectId(parentId),
      };

      if (type === 'folder') {
        const filesCollection = await dbClient.filesCollection();
        const newFile = await filesCollection.insertOne(fileDocument);

        return res.status(201).json(newFile.ops[0]);
      }
      if (type === 'file' || type === 'image') {
        // Save file to disk
        const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
        const fileUUIDV4 = uuidv4();
        const localPath = path.join(folderPath, fileUUIDV4);

        // Decode base64 data and write to file
        fs.writeFileSync(localPath, Buffer.from(data, 'base64'));
      }

      // Add the new file document in the collection files
      const filesCollection = await dbClient.filesCollection();
      const newFile = await filesCollection.insertOne(fileDocument);

      return res.status(201).json(newFile.ops[0]);
    } catch (err) {
      console.log(`Error: ${err}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default FilesController;
