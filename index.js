import express from 'express';
import Forum from '../models/Forum.js';
import authRouter from './routes/auth.js';
import { auth } from './middlewares/auth.js';
import Library from '../models/Library.js';
import File from '../models/File.js';
import History from '../models/History.js';

const app = express();
const port = 3001;

import { QBittorrentClient } from './utils/client.js';
import User from '../models/User.js';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth', authRouter);

app.get('/forum', auth(), async (req, res) => {
  const collection = await Forum.find().sort({ title: 1 }).skip(0).limit(10).lean();
  res.json({
    collection
  });
});

app.post('/forum/search', auth(), async (req, res) => {
  const { search, limit = 100, skip = 0 } = req.body;
  const q = {
    title: RegExp(search, 'i')
  };
  let collection = await Forum.find(q)
    .sort({ title: 1 })
    .skip(Number(skip))
    .limit(Number(limit))
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
    count
  });
});

app.get('/books', auth(), async (req, res) => {
  const { user } = req;
  const { search, limit = 100, skip = 0 } = req.query;

  const q = {
    user: user.id
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
  const collection = lib.books;
  const count = lib.books.length;

  res.json({
    collection,
    count
  });
});

app.post('/action/book', auth(), async (req, res) => {
  const { user } = req;
  const { payload, action } = req.body;
  const { forumId } = payload;

  const qb = new QBittorrentClient({
    baseUrl: 'http://abook_qbittorrent:9999',
    username: 'Nikelroot',
    password: '&8b3yn%$sxwTl$GWx^^45X#v'
  });

  switch (action) {
    case 'ADD_TO_LIBRARY':
      await Library.findOneAndUpdate(
        { user: user.id },
        { $addToSet: { books: forumId } },
        { upsert: true }
      );
      await Forum.updateOne({ _id: forumId }, { $set: { inLibrary: true } }).exec();
      const forum = await Forum.findOne({ _id: forumId }).lean();

      if (forum.magnet_link) {
        const resp = await qb.addMagnet(forum.magnet_link, {
          savepath: '/downloads',
          category: '',
          tags: `${forum._id.toString()}`,
          paused: false
        });
        console.log(forum.title, resp);
      }

      break;
    case 'REMOVE_TO_LIBRARY':
      await Library.updateOne({ user: user.id }, { $pull: { books: forumId } });
      break;
    case 'UPDATE_TIME':
      break;
  }

  res.send({ status: 'ok' });
});

app.put('/user/history', auth(), async (req, res) => {
  const { user } = req;
  const { fileId, time } = req.body;

  await History.findOneAndUpdate(
    {
      user: user.id,
      file: fileId
    },
    {
      $set: { time }
    },
    { upsert: true }
  ).exec();

  await User.updateOne({ _id: user.id }, { $set: { lastFile: fileId } }).exec();

  res.send({
    status: 'ok'
  });
});

app.get('/user/history', auth(), async (req, res) => {
  const { user } = req;
  const { fileId } = req.query;

  const userO = await User.findOne({ _id: user.id }).lean();
  console.log(userO);
  const fid = fileId ?? userO.lastFile;
  const history = await History.findOne({
    user: user.id,
    file: fid
  }).lean();

  const file = await File.findOne({ _id: userO.lastFile }).lean();

  res.send({
    history,
    file
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
