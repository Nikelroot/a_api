import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const port = 3001;

import userRouter from './routes/users.js';
import actionRouter from './routes/action.js';
import booksRouter from './routes/books.js';
import forumRouter from './routes/forum.js';

import { auth } from './auth.js';
import authRouter from './auth.js';
app.use('/auth', authRouter);

app.use('/user', auth(), userRouter);
app.use('/action', auth(), actionRouter);
app.use('/books', auth(), booksRouter);
app.use('/forum', auth(), forumRouter);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
