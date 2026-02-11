import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const port = 3001;
const service_name = 'abook';

import userRouter from './routes/users.js';
import actionRouter from './routes/action.js';
import booksRouter from './routes/books.js';
import forumRouter from './routes/forum.js';

import { auth } from './auth.js';
import authRouter from './auth.js';
app.use('/auth', authRouter);

app.use('/user', auth(service_name), userRouter);
app.use('/action', auth(service_name), actionRouter);
app.use('/books', auth(service_name), booksRouter);
app.use('/forum', auth(service_name), forumRouter);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
