import express from 'express';
import cookieParser from 'cookie-parser';
import { connectToMongo } from '../models/lib/mongoose.js';

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
import apiLogger from './utils/apiLogger.js';

process.on('unhandledRejection', (reason) => {
  apiLogger.error(`unhandled rejection: ${reason?.stack || reason?.message || reason}`);
});

process.on('uncaughtException', (error) => {
  apiLogger.error(`uncaught exception: ${error?.stack || error?.message || error}`);
  process.exit(1);
});

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    apiLogger.info(
      `request method=${req.method} url=${req.originalUrl} status=${res.statusCode} durationMs=${Date.now() - startedAt}`
    );
  });

  next();
});

app.use('/auth', authRouter);

app.use('/user', auth(service_name), userRouter);
app.use('/action', auth(service_name), actionRouter);
app.use('/books', auth(service_name), booksRouter);
app.use('/forum', auth(service_name), forumRouter);

async function bootstrap() {
  try {
    await connectToMongo();

    app.listen(port, () => {
      apiLogger.info(`abook api listening on port ${port}`);
    });
  } catch (error) {
    apiLogger.error(`failed to connect to mongodb: ${error?.stack || error?.message || error}`);
    process.exit(1);
  }
}

bootstrap();
