const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '../split_file/backend/error.log', level: 'error' }),
    new winston.transports.Console({ level: 'info' })
  ]
});

module.exports = { logger };
