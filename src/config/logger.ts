import winston from "winston";
import { mkdirSync } from "fs";

// ============================================================================
// WINSTON LOGGER CONFIGURATION
// ============================================================================

// Ensure test-reports directory exists
const LOG_DIR = "./test-reports";
mkdirSync(LOG_DIR, { recursive: true });

// Custom format for console output (colorful and readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss.SSS" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `[${timestamp}] ${level}: ${message}`;

    // Append metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    return log;
  }),
);

// Custom format for file output (JSON with full context)
const fileFormat = winston.format.combine(winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }), winston.format.errors({ stack: true }), winston.format.json());

// Create Winston logger instance
export const logger = winston.createLogger({
  level: "debug", // Capture all levels: debug, info, warn, error
  levels: winston.config.npm.levels,
  transports: [
    // Console transport: only info and error (cleaner output during test runs)
    new winston.transports.Console({
      level: "info",
      format: consoleFormat,
    }),

    // Combined file transport: all levels (debug, info, warn, error)
    new winston.transports.File({
      filename: `${LOG_DIR}/test-execution.log`,
      level: "debug",
      format: fileFormat,
      options: { flags: "w" },
    }),
  ],
  // Prevent Winston from exiting on error
  exitOnError: false,
});

export default logger;
