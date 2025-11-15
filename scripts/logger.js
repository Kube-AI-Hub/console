const chalk = require('chalk');

/**
 * Log level enum
 */
const LogLevel = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  SUCCESS: 'success',
};

/**
 * Logger class
 */
class Logger {
  /**
   * Output info log
   * @param {string} message 日志消息
   */
  info(message) {
    console.log(chalk.blue(`[INFO] ${message}`));
  }

  /**
   * Output warning log
   * @param {string} message 日志消息
   */
  warn(message) {
    console.log(chalk.yellow(`[WARN] ${message}`));
  }

  /**
   * Output error log
   * @param {string} message 日志消息
   */
  error(message) {
    console.log(chalk.red(`[ERROR] ${message}`));
  }

  /**
   * Output success log
   * @param {string} message 日志消息
   */
  success(message) {
    console.log(chalk.green(`[SUCCESS] ${message}`));
  }

  /**
   * Output log with timestamp
   * @param {string} level 日志级别
   * @param {string} message 日志消息
   */
  log(level, message) {
    const timestamp = new Date().toLocaleString();
    let coloredMessage;

    switch (level) {
      case LogLevel.INFO:
        coloredMessage = chalk.blue(`[${timestamp}] [INFO] ${message}`);
        break;
      case LogLevel.WARN:
        coloredMessage = chalk.yellow(`[${timestamp}] [WARN] ${message}`);
        break;
      case LogLevel.ERROR:
        coloredMessage = chalk.red(`[${timestamp}] [ERROR] ${message}`);
        break;
      case LogLevel.SUCCESS:
        coloredMessage = chalk.green(`[${timestamp}] [SUCCESS] ${message}`);
        break;
      default:
        throw new Error(`Invalid log level: ${level}, must be one of ${Object.values(LogLevel).join(', ')}`);
    }

    console.log(coloredMessage);
  }
}

// Export singleton instance and log level
module.exports = {
  default: new Logger(),
  LogLevel
};