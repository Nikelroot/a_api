import express from 'express';
const router = express.Router();
import Library from '../../models/Library.js';
import '../../models/File.js';
import History from '../../models/History.js';
import Forum from '../../models/Forum.js';
import apiLogger from '../utils/apiLogger.js';

/**
 * Получение списка книг пользователя с историей просмотра
 * @param {Object} req - HTTP запрос
 * @param {Object} res - HTTP ответ
 */
router.get('/', async (req, res) => {
  try {
    const { user } = req;

    const { limit = 20, page = 1 } = req.query;

    // Валидация параметров
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const q = {
      user: user.id
    };

    const lib = await Library.findOne(q)
      .select('books')
      .lean();

    apiLogger.debug(
      `books request userId=${user.id} page=${parsedPage} limit=${parsedLimit} count=${lib?.books?.length || 0}`
    );

    const allBookIds = (lib?.books || []).map((bookId) => bookId.toString());
    const count = allBookIds.length;
    const pageBookIds = allBookIds.slice(skip, skip + parsedLimit);

    let collection = [];

    if (pageBookIds.length > 0) {
      const books = await Forum.find({ _id: { $in: pageBookIds } })
        .populate({
          path: 'files',
          options: {
            sort: { name: 1 }
          }
        })
        .lean();

      const booksMap = new Map(books.map((book) => [book._id.toString(), book]));
      collection = pageBookIds
        .map((bookId) => booksMap.get(bookId))
        .filter(Boolean)
        .map((book) => ({
          ...book,
          files: (book.files || []).filter((file) => file?._id)
        }));
    }

    // Получаем всю историю одним запросом
    if (collection.length > 0) {
      const fileIds = collection.flatMap((book) => book.files).map((file) => file._id);

      if (fileIds.length > 0) {
        const histories = await History.find({
          user: user.id,
          file: { $in: fileIds }
        }).lean();

        const historyMap = histories.reduce((acc, history) => {
          acc[history.file.toString()] = history;
          return acc;
        }, {});

        // Присваиваем историю файлам
        for (let book of collection) {
          for (let file of book.files) {
            const history = historyMap[file._id.toString()];
            if (history) {
              file.history = history;
            }
          }
        }
      }
    }

    res.json({
      collection,
      count,
      limit: parsedLimit,
      page: parsedPage,
      totalPages: Math.ceil(count / parsedLimit)
    });
  } catch (error) {
    apiLogger.error(`error fetching books: ${error?.stack || error?.message || error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
