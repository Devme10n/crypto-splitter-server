const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'backend/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'backend/combined.log' }),
    new winston.transports.Console({ level: 'info' })
  ]
});

module.exports = { logger };
