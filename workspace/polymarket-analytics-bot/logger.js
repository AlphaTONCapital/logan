// Simple but effective logging system
const fs = require('fs');
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.level = options.level || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
    this.logDir = options.logDir || './logs';
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    
    this.levels = {
      error: 0,
      warn: 1, 
      info: 2,
      debug: 3
    };

    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}\n`;
  }

  writeToFile(level, formattedMessage) {
    const filename = path.join(this.logDir, `${level}.log`);
    
    try {
      // Rotate file if too large
      if (fs.existsSync(filename) && fs.statSync(filename).size > this.maxFileSize) {
        this.rotateFile(filename);
      }
      
      fs.appendFileSync(filename, formattedMessage);
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  rotateFile(filename) {
    try {
      for (let i = this.maxFiles - 1; i > 0; i--) {
        const oldFile = `${filename}.${i}`;
        const newFile = `${filename}.${i + 1}`;
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxFiles - 1) {
            fs.unlinkSync(oldFile);
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      if (fs.existsSync(filename)) {
        fs.renameSync(filename, `${filename}.1`);
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error.message);
    }
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, message, meta);
    
    // Always write to console
    if (level === 'error') {
      console.error(formatted.trim());
    } else {
      console.log(formatted.trim());
    }

    // Write to file
    this.writeToFile(level, formatted);
  }

  error(message, meta = {}) { this.log('error', message, meta); }
  warn(message, meta = {}) { this.log('warn', message, meta); }
  info(message, meta = {}) { this.log('info', message, meta); }
  debug(message, meta = {}) { this.log('debug', message, meta); }
}

module.exports = Logger;
