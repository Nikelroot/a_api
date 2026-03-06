import express from 'express';
const router = express.Router();
import Forum from '../../models/Forum.js';
import Library from '../../models/Library.js';
import apiLogger from '../utils/apiLogger.js';

router.get('/', async (req, res) => {
  const collection = await Forum.find().sort({ title: 1 }).skip(0).limit(10).lean();
  res.json({
    collection
  });
});

router.post('/search', async (req, res) => {
  const { search, limit = 25, page = 1 } = req.body;
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const skip = (parsedPage - 1) * parsedLimit;
  const q = {};

  if (search && search.length !== 0) {
    q.title = RegExp(search, 'i');
  } else {
    q.inLibrary = true;
  }

  apiLogger.debug(
    `forum search query=${JSON.stringify(q)} page=${parsedPage} limit=${parsedLimit}`
  );
  let collection = await Forum.find(q)
    .sort({ title: 1 })
    .skip(skip)
    .limit(parsedLimit)
    .lean();

  const books = await Library.findOne({ user: req.user.id }).lean();
  const bookIds = (books?.books || []).map((id) => id.toString());

  collection = collection.map((item) => {
    const inLibrary = bookIds.includes(item._id.toString());
    return { ...item, inLibrary };
  });

  const count = await Forum.countDocuments(q);

  res.json({
    collection,
    count,
    limit: parsedLimit,
    page: parsedPage,
    totalPages: Math.ceil(count / parsedLimit)
  });
});

export default router;
