import express from 'express';
import Forum from '../models/Forum.js';

const app = express();
const port = 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/forum', async (req, res) => {
  const collection = await Forum.find().skip(0).limit(10).lean();
  res.json({
    collection
  });
});

app.post('/forum/search', async (req, res) => {
  const { search } = req.body;
  const collection = await Forum.find({ title: RegExp(search, 'i') })
    .skip(0)
    .limit(10)
    .lean();
  res.json({
    collection
  });
});

app.post('/action/book', async (req, res) => {
  const { forumId } = req.body;

  res.send({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
