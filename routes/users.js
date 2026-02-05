import express from 'express';
const router = express.Router();
import History from '../../models/History.js';
import User from '../../models/User.js';
import File from '../../models/File.js';
import BookMark from '../../models/BookMark.js';

router.put('/history', async (req, res) => {
  const { user } = req;
  const { fileId, time } = req.body;

  await History.findOneAndUpdate(
    {
      user: user._id,
      file: fileId
    },
    {
      $set: { time }
    },
    { upsert: true }
  ).exec();

  await User.updateOne({ _id: user._id }, { $set: { lastFile: fileId } }).exec();

  res.send({
    status: 'ok'
  });
});

router.get('/history', async (req, res) => {
  const { user } = req;
  const { fileId } = req.query;

  if (!fileId) {
    return res.send({
      err: 'no file'
    });
  }

  const userO = await User.findOne({ _id: user._id }).lean();
  const history = await History.findOne({
    user: user._id,
    file: fileId
  }).lean();

  const file = await File.findOne({ _id: fileId }).lean();

  res.send({
    history,
    file
  });
});

router.get('/history/last', async (req, res) => {
  const { user } = req;
  const userO = await User.findOne({ _id: user._id }).lean();
  let lastFile = userO.lastFile;
  let history = null;
  let file = null;

  if (lastFile) {
    history = await History.findOne({
      user: user._id,
      file: lastFile
    }).lean();
    file = await File.findOne({ _id: lastFile }).lean();
  }

  res.send({
    history,
    file
  });
});

router.post('/history/bookMark', async (req, res) => {
  const { user, body } = req || {};
  const { fileId, time } = body || {};
  if (!fileId || !time) {
    res.send({
      status: 'error'
    });
  }
  let bookMark = new BookMark({
    user: user._id,
    time,
    file: fileId
  });

  await bookMark.save();

  res.send({
    bookMark
  });
});

router.get('/history/bookMark', async (req, res) => {
  const { user, query } = req || {};
  const { fileId } = query || {};
  if (!fileId) {
    return res.send({
      status: 'error'
    });
  }
  let bookMarks = await BookMark.find({
    user: user._id,
    file: fileId
  }).lean();

  res.send({
    bookMarks
  });
});

export default router;
