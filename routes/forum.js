import express from 'express';
const router = express.Router();
import Forum from '../../models/Forum.js';
import Library from '../../models/Library.js';

router.get('/', async (req, res) => {
  const collection = await Forum.find().sort({ title: 1 }).skip(0).limit(10).lean();
  res.json({
    collection
  });
});

router.post('/search', async (req, res) => {
  const { search, limit = 100, skip = 0 } = req.body;
  const q = {};

  if (search && search.length !== 0) {
    q.title = RegExp(search, 'i');
  } else {
    q.inLibrary = true;
  }

  console.log('q', q);
  let collection = await Forum.find(q)
    .sort({ title: 1 })
    .skip(Number(skip))
    .limit(Number(limit))
    .lean();

  const books = await Library.findOne({ user: req.user._id }).lean();
  const bookIds = (books?.books || []).map((id) => id.toString());

  collection = collection.map((item) => {
    const inLibrary = bookIds.includes(item._id.toString());
    return { ...item, inLibrary };
  });

  const count = await Forum.countDocuments(q);

  res.json({
    collection,
    count
  });
});

export default router;
