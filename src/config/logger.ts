import winston from "winston";

// ============================================================================
// WINSTON LOGGER CONFIGURATION
// ============================================================================

// Custom format for console output (colorful and readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `[${timestamp}] ${level}: ${message}`;

    // Append metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    return log;
  }),
);

// Create Winston logger instance
export const logger = winston.createLogger({
  level: "debug", // Capture all levels, let transports filter
  levels: winston.config.npm.levels,
  transports: [
    new winston.transports.Console({
      level: process.env.LOG_LEVEL,
      format: consoleFormat,
    }),
  ],
  // Prevent Winston from exiting on error
  exitOnError: false,
});
