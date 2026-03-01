import express from 'express';
const router = express.Router();
import History from '../../models/History.js';
import User from '../../models/User.js';
import File from '../../models/File.js';
import BookMark from '../../models/BookMark.js';
import moment from 'moment';

router.put('/history', async (req, res) => {
  const { user } = req;
  const { fileId, time } = req.body;

  const history = await History.findOneAndUpdate(
    {
      user: user.id,
      file: fileId
    },
    {
      $set: { time, lastUpdate: moment().unix() }
    },
    { upsert: true, new: true }
  ).lean();

  await User.updateOne({ _id: user._id }, { $set: { lastFile: fileId } }).exec();

  res.send({
    status: 'ok',
    history
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

  const history = await History.findOne({
    user: user.id,
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
  console.log('user', user);

  let history =
    (await History.findOne({ user: user.id }).sort({ lastUpdate: -1 }).populate('file').lean()) ||
    null;
  const lastFile = history?.file || null;

  res.send({
    history,
    file: lastFile
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
