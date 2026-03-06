import fs from 'fs';
import path from 'path';
import winston from 'winston';

const logsDir = '/usr/app/logs';
fs.mkdirSync(logsDir, { recursive: true });

const apiLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `[${timestamp}] ${level}: ${stack || message}`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, `abook-api-${Date.now()}.log`)
    })
  ]
});

export default apiLogger;
