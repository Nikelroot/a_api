import { QBittorrentClient } from './../utils/client.js';

import express from 'express';
const router = express.Router();

import Library from '../../models/Library.js';
import Forum from '../../models/Forum.js';
import '../../models/File.js';

router.post('/book', async (req, res) => {
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
        { user: user._id },
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
      await Library.updateOne({ user: user._id }, { $pull: { books: forumId } });
      break;
    case 'UPDATE_TIME':
      break;
  }

  res.send({ status: 'ok' });
});
export default router;
