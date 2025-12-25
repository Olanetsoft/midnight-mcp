import { config } from "./config.js";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFormat = "text" | "json";

// MCP logging callback type
type MCPLogCallback = (
  level: "debug" | "info" | "notice" | "warning" | "error",
  logger: string,
  data: unknown
) => void;

// Global MCP log callback (set by server)
let mcpLogCallback: MCPLogCallback | null = null;

/**
 * Set the MCP log callback to send logs to the client
 */
export function setMCPLogCallback(callback: MCPLogCallback | null): void {
  mcpLogCallback = callback;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: object;
  service?: string;
}

class Logger {
  private level: LogLevel;
  private format: LogFormat;
  private service: string;

  constructor(
    level: LogLevel = "info",
    format: LogFormat = "text",
    service: string = "midnight-mcp"
  ) {
    this.level = level;
    this.format = format;
    this.service = service;
  }

  /**
   * Set log format at runtime
   */
  setFormat(format: LogFormat): void {
    this.format = format;
  }

  /**
   * Set log level at runtime
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatTextMessage(
    level: LogLevel,
    message: string,
    meta?: object
  ): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  private formatJsonMessage(
    level: LogLevel,
    message: string,
    meta?: object
  ): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
    };

    if (meta) {
      entry.meta = meta;
    }

    return JSON.stringify(entry);
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    meta?: object
  ): string {
    if (this.format === "json") {
      return this.formatJsonMessage(level, message, meta);
    }
    return this.formatTextMessage(level, message, meta);
  }

  debug(message: string, meta?: object): void {
    if (this.shouldLog("debug")) {
      console.error(this.formatMessage("debug", message, meta));
    }
    // Also send to MCP client
    mcpLogCallback?.("debug", this.service, { message, ...meta });
  }

  info(message: string, meta?: object): void {
    if (this.shouldLog("info")) {
      console.error(this.formatMessage("info", message, meta));
    }
    // Also send to MCP client
    mcpLogCallback?.("info", this.service, { message, ...meta });
  }

  warn(message: string, meta?: object): void {
    if (this.shouldLog("warn")) {
      console.error(this.formatMessage("warn", message, meta));
    }
    // Also send to MCP client (MCP uses "warning" not "warn")
    mcpLogCallback?.("warning", this.service, { message, ...meta });
  }

  error(message: string, meta?: object): void {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message, meta));
    }
    // Also send to MCP client
    mcpLogCallback?.("error", this.service, { message, ...meta });
  }

  /**
   * Create a child logger with additional context
   */
  child(context: object): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger that includes additional context in all log messages
 */
class ChildLogger {
  private parent: Logger;
  private context: object;

  constructor(parent: Logger, context: object) {
    this.parent = parent;
    this.context = context;
  }

  debug(message: string, meta?: object): void {
    this.parent.debug(message, { ...this.context, ...meta });
  }

  info(message: string, meta?: object): void {
    this.parent.info(message, { ...this.context, ...meta });
  }

  warn(message: string, meta?: object): void {
    this.parent.warn(message, { ...this.context, ...meta });
  }

  error(message: string, meta?: object): void {
    this.parent.error(message, { ...this.context, ...meta });
  }
}

// Determine log format from environment
const logFormat: LogFormat =
  process.env.LOG_FORMAT === "json" ? "json" : "text";

export const logger = new Logger(config.logLevel, logFormat);
