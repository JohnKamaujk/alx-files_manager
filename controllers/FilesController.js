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
const isValidId = (id) => {
  const size = 24;
  let i = 0;
  const charRanges = [
    [48, 57], // 0 - 9
    [97, 102], // a - f
    [65, 70], // A - F
  ];
  if (typeof id !== 'string' || id.length !== size) {
    return false;
  }
  while (i < size) {
    const c = id[i];
    const code = c.charCodeAt(0);

    if (!charRanges.some((range) => code >= range[0] && code <= range[1])) {
      return false;
    }
    i += 1;
  }
  return true;
};

class FilesController {
  /**
   * Uploads a file.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   * @returns {Response}
   */
  static async postUpload(req, res) {
    try {
      const { user } = req;
      const { name, type } = req.body;
      let { parentId, isPublic, data: base64Data } = req.body;

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
        const fileCollection = await dbClient.filesCollection();
        const file = await fileCollection.findOne({
          _id: ObjectId(isValidId(parentId) ? parentId : NULL_ID),
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

      const fileCollection = await dbClient.filesCollection();
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
}

export default FilesController;
