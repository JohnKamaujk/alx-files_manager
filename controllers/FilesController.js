import { tmpdir } from 'os';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { mkdir, writeFile } from 'fs';
import { join as joinPath } from 'path';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';

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
            ? '0'
            : ObjectId(parentId),
      };
      await mkDirAsync(baseDir, { recursive: true });

      if (type !== VALID_FILE_TYPES.folder) {
        const localPath = joinPath(baseDir, uuidv4());
        await writeFileAsync(localPath, Buffer.from(base64Data, 'base64'));
        newFile.localPath = localPath;
      }

      const { insertedId } = await fileCollection.insertOne(newFile);
      return res.status(201).json({
        id: insertedId.toString(),
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
        parentId:
          file.parentId === ROOT_FOLDER_ID.toString()
            ? 0
            : file.parentId.toString(),
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
        userId: user._id,
      };
      if (parentId) {
        if (parentId === ROOT_FOLDER_ID.toString()) {
          filesFilter.parentId = ROOT_FOLDER_ID.toString();
        } else if (ObjectId.isValid(parentId)) {
          filesFilter.parentId = ObjectId(parentId);
        } else {
          filesFilter.parentId = ObjectId(NULL_ID);
        }
      }

      const filesCollection = await dbClient.filesCollection();
      const files = await filesCollection
        .aggregate([
          { $match: filesFilter },
          { $sort: { _id: 1 } },
          { $skip: page * MAX_FILES_PER_PAGE },
          { $limit: MAX_FILES_PER_PAGE },
          {
            $project: {
              _id: undefined,
              id: '$_id',
              userId: '$userId',
              name: '$name',
              type: '$type',
              isPublic: '$isPublic',
              parentId: {
                $cond: {
                  if: { $eq: ['$parentId', '0'] },
                  then: 0,
                  else: '$parentId',
                },
              },
            },
          },
        ])
        .toArray();

      return res.status(200).json(files);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default FilesController;
