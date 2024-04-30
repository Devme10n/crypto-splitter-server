const winston = require('winston');
const path = require('path');

const getCallerInfo = function() {
  const originalFunc = Error.prepareStackTrace;

  Error.prepareStackTrace = function(_, stack) {
    return stack;
  };

  const err = new Error();
  Error.captureStackTrace(err, this);

  const caller = err.stack[11];

  Error.prepareStackTrace = originalFunc;

  return {
    filePath: path.basename(caller.getFileName()),
    functionName: caller.getFunctionName(),
    lineNumber: caller.getLineNumber(),
  };
};

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(info => {
      const callerInfo = getCallerInfo();
      return `${info.timestamp} [${callerInfo.filePath}:${callerInfo.lineNumber} (${callerInfo.functionName})] ${info.level}: ${info.message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({ level: 'info' })
  ]
});

module.exports = { logger };