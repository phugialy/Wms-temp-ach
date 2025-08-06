interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

const LOG_LEVELS: LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

const LOG_LEVEL = process.env['LOG_LEVEL'] || 'info';

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = this.getTimestamp();
    const metaString = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
  }

  private shouldLog(level: string): boolean {
    const levels = Object.values(LOG_LEVELS);
    const currentLevelIndex = levels.indexOf(LOG_LEVEL as keyof LogLevel);
    const messageLevelIndex = levels.indexOf(level as keyof LogLevel);
    return messageLevelIndex <= currentLevelIndex;
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(this.formatMessage(LOG_LEVELS.ERROR, message, meta));
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(this.formatMessage(LOG_LEVELS.WARN, message, meta));
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.info(this.formatMessage(LOG_LEVELS.INFO, message, meta));
    }
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.debug(this.formatMessage(LOG_LEVELS.DEBUG, message, meta));
    }
  }

  // Specialized logging methods for WMS operations
  logInventoryChange(productId: string, warehouseId: string, change: number, reason: string): void {
    this.info('Inventory change logged', {
      productId,
      warehouseId,
      change,
      reason,
      timestamp: this.getTimestamp()
    });
  }

  logOrderStatusChange(orderId: string, oldStatus: string, newStatus: string): void {
    this.info('Order status changed', {
      orderId,
      oldStatus,
      newStatus,
      timestamp: this.getTimestamp()
    });
  }

  logShipmentCreated(shipmentId: string, orderId: string, warehouseId: string): void {
    this.info('Shipment created', {
      shipmentId,
      orderId,
      warehouseId,
      timestamp: this.getTimestamp()
    });
  }
}

export const logger = new Logger(); 