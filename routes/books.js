import express from 'express';
const router = express.Router();
import Library from '../../models/Library.js';
import '../../models/File.js';

router.get('/', async (req, res) => {
  const { user } = req;
  const { search, limit = 100, skip = 0 } = req.query;

  const q = {
    user: user._id
  };

  const lib = await Library.findOne(q)
    .populate({
      path: 'books',
      populate: {
        path: 'files',
        options: {
          sort: { name: 1 } // 1 — по возрастанию, -1 — по убыванию
        }
      }
    })
    .lean();
  const collection = lib?.books || [];
  const count = lib?.books?.length || 0;

  res.json({
    collection,
    count
  });
});
export default router;
