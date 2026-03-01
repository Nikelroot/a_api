import express from 'express';
const router = express.Router();
import Library from '../../models/Library.js';
import '../../models/File.js';
import History from '../../models/History.js';

/**
 * Получение списка книг пользователя с историей просмотра
 * @param {Object} req - HTTP запрос
 * @param {Object} res - HTTP ответ
 */
router.get('/', async (req, res) => {
  try {
    const { user } = req;
    const { search, limit = 100, skip = 0 } = req.query;

    // Валидация параметров
    const parsedLimit = Math.min(parseInt(limit) || 100, 1000);
    const parsedSkip = Math.max(parseInt(skip) || 0, 0);

    const q = {
      user: user._id
    };

    // Оптимизированный запрос с populate вместо множественных find
    const lib = await Library.findOne(q)
      .populate({
        path: 'books',
        populate: {
          path: 'files',
          options: {
            sort: { name: 1 }
          }
        }
      })
      .lean();

    let collection = lib?.books || [];

    // Получаем всю историю одним запросом
    if (collection.length > 0) {
      const fileIds = collection.flatMap((book) => book.files).map((file) => file._id);

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

    const count = lib?.books?.length || 0;

    res.json({
      collection,
      count
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;