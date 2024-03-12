import { tmpdir } from 'os';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import {
  mkdir, writeFile, stat, existsSync, realpath,
} from 'fs';
import { contentType } from 'mime-types';
import Queue from 'bull/lib/queue';
import { join as joinPath } from 'path';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import getUser from '../utils/getUser';

const statAsync = promisify(stat);
const realpathAsync = promisify(realpath);

const VALID_FILE_TYPES = {
  folder: 'folder',
  file: 'file',
  image: 'image',
};
const ROOT_FOLDER_ID = 0;
const DEFAULT_ROOT_FOLDER = 'files_manager';
const mkDirAsync = promisify(mkdir);
const writeFileAsync = promisify(writeFile);
const NULL_ID = Buffer.alloc(24, '0').toString('utf-8');
const MAX_FILES_PER_PAGE = 20;
const fileQueue = new Queue('thumbnail generation');

class FilesController {
  /**
   * creates file upload.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   * @returns {Response}
   */
  static async postUpload(req, res) {
    try {
      const { user } = req;
      const { name, type } = req.body;
      let { parentId, isPublic, data: base64Data } = req.body;
      const fileCollection = await dbClient.filesCollection();

      parentId = parentId || ROOT_FOLDER_ID;
      isPublic = isPublic || false;
      base64Data = base64Data || '';

      if (!name) {
        return res.status(400).json({ error: 'Missing name' });
      }
      if (!type || !Object.values(VALID_FILE_TYPES).includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }
      if (!base64Data && type !== VALID_FILE_TYPES.folder) {
        return res.status(400).json({ error: 'Missing data' });
      }
      if (
        parentId !== ROOT_FOLDER_ID
        && parentId !== ROOT_FOLDER_ID.toString()
      ) {
        const file = await fileCollection.findOne({
          _id: ObjectId(ObjectId.isValid(parentId) ? parentId : NULL_ID),
        });

        if (!file) {
          return res.status(400).json({ error: 'Parent not found' });
        }
        if (file.type !== VALID_FILE_TYPES.folder) {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      const userId = user._id.toString();
      const baseDir = (process.env.FOLDER_PATH || '').trim()
        || joinPath(tmpdir(), DEFAULT_ROOT_FOLDER);
      // default baseDir == '/tmp/files_manager'
      // or (on Windows) '%USERPROFILE%/AppData/Local/Temp/files_manager';
      const newFile = {
        userId: ObjectId(userId),
        name,
        type,
        isPublic,
        parentId:
          parentId === ROOT_FOLDER_ID || parentId === ROOT_FOLDER_ID.toString()
            ? 0
            : ObjectId(parentId),
      };
      await mkDirAsync(baseDir, { recursive: true });

      if (type !== VALID_FILE_TYPES.folder) {
        const localPath = joinPath(baseDir, uuidv4());
        await writeFileAsync(localPath, Buffer.from(base64Data, 'base64'));
        newFile.localPath = localPath;
      }

      const { insertedId } = await fileCollection.insertOne(newFile);
      const fileId = insertedId.toString();
      // start thumbnail generation worker
      if (type === VALID_FILE_TYPES.image) {
        const jobName = `Image thumbnail [${userId}-${fileId}]`;
        fileQueue.add({ userId, fileId, name: jobName });
      }
      return res.status(201).json({
        id: fileId,
        userId,
        name,
        type,
        isPublic,
        parentId:
          parentId === ROOT_FOLDER_ID || parentId === ROOT_FOLDER_ID.toString()
            ? 0
            : parentId,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Retrieves a file associated with a specific user by id.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   * @returns {Response}
   */
  static async getShow(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const userId = user._id.toString();
      const filesCollection = await dbClient.filesCollection();
      const file = await filesCollection.findOne({
        _id: ObjectId(ObjectId.isValid(id) ? id : NULL_ID),
        userId: ObjectId(ObjectId.isValid(userId) ? userId : NULL_ID),
      });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.status(200).json({
        id,
        userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Retrieves files associated with a specific user.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async getIndex(req, res) {
    try {
      const { user } = req;
      const { parentId } = req.query;
      const page = parseInt(req.query.page, 10) || 0;
      const filesFilter = {
        userId: ObjectId(user._id),
      };
      if (parentId) {
        if (parentId === '0') {
          filesFilter.parentId = parseInt(parentId, 10);
        } else {
          filesFilter.parentId = ObjectId(
            ObjectId.isValid(parentId) ? parentId : NULL_ID,
          );
        }
      }

      const filesCollection = await dbClient.filesCollection();
      const files = await filesCollection
        .aggregate([
          { $match: filesFilter },
          { $skip: page * MAX_FILES_PER_PAGE },
          { $limit: MAX_FILES_PER_PAGE },
          {
            $project: {
              _id: 0,
              id: '$_id',
              userId: '$userId',
              name: '$name',
              type: '$type',
              isPublic: '$isPublic',
              parentId: '$parentId',
            },
          },
        ])
        .toArray();

      return res.json(files);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Updates a file by setting publish to true.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async putPublish(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const userId = user._id.toString();
      const fileFilter = {
        _id: ObjectId(ObjectId.isValid(id) ? id : NULL_ID),
        userId: ObjectId(userId),
      };
      const filesCollection = await dbClient.filesCollection();
      const file = await filesCollection.findOne(fileFilter);

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }
      await filesCollection.updateOne(fileFilter, {
        $set: { isPublic: true },
      });
      return res.status(200).json({
        id,
        userId,
        name: file.name,
        type: file.type,
        isPublic: true,
        parentId: file.parentId,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Updates a file by setting publish to false.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async putUnpublish(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const userId = user._id.toString();
      const fileFilter = {
        _id: ObjectId(ObjectId.isValid(id) ? id : NULL_ID),
        userId: ObjectId(userId),
      };
      const filesCollection = await dbClient.filesCollection();
      const file = await filesCollection.findOne(fileFilter);

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }
      await filesCollection.updateOne(fileFilter, {
        $set: { isPublic: false },
      });
      return res.status(200).json({
        id,
        userId,
        name: file.name,
        type: file.type,
        isPublic: false,
        parentId: file.parentId,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Retrieves the content of a file.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async getFile(req, res) {
    try {
      const user = await getUser(req);
      const userId = user ? user._id.toString() : '';
      const { id } = req.params;
      const size = req.query.size || null;

      const fileFilter = {
        _id: ObjectId(ObjectId.isValid(id) ? id : NULL_ID),
      };

      const filesCollection = await dbClient.filesCollection();
      const file = await filesCollection.findOne(fileFilter);

      if (!file || (!file.isPublic && file.userId.toString() !== userId)) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (file.type === VALID_FILE_TYPES.folder) {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }

      let filePath = file.localPath;
      if (size) {
        filePath = `${file.localPath}_${size}`;
      }

      if (!existsSync(filePath)) {
        return res.status(404).json({ error: 'Not found' });
      }

      const fileInfo = await statAsync(filePath);
      if (!fileInfo.isFile()) {
        return res.status(404).json({ error: 'Not found' });
      }

      const absoluteFilePath = await realpathAsync(filePath);
      res.setHeader(
        'Content-Type',
        contentType(file.name) || 'text/plain; charset=utf-8',
      );
      return res.status(200).sendFile(absoluteFilePath);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default FilesController;
