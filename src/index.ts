import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import routes
// import itemsRoutes from './routes/items.route'; // Temporarily disabled - schema mismatches
// import inventoryRoutes from './routes/inventory.route'; // Temporarily disabled - will be redesigned
// import logsRoutes from './routes/logs.route';
// import adminRoutes from './routes/admin.route'; // Temporarily disabled - schema mismatches
// import phonecheckRoutes from './routes/phonecheck.route'; // Temporarily disabled - schema mismatches
// import enhancedInventoryRoutes from './routes/enhanced-inventory.route'; // Temporarily disabled - schema mismatches
// import bulkInventoryRoutes from './routes/bulk-inventory.route'; // Temporarily disabled - schema mismatches
import imeiQueueRoutes from './routes/imei-queue.route';
import imeiArchivalRoutes from './routes/imei-archival.route';
// import hybridQueueRoutes from './routes/hybrid-queue.route'; // Temporarily disabled - schema mismatches
import operatorRoutes from './routes/operator.route';
import skuMatchingRoutes from './routes/sku-matching.route';
import enhancedSkuMasterRoutes from './api/enhancedSkuMasterApi';

// Import utilities
import { errorHandler } from './utils/errorHandler';
import { logger } from './utils/logger';
import prisma from './prisma/client';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env['PORT'] || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static('public'));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] 
  });
});

// API Routes
// app.use('/items', itemsRoutes); // Temporarily disabled - schema mismatches
// app.use('/inventory', inventoryRoutes); // Temporarily disabled - will be redesigned
// app.use('/logs', logsRoutes);
// app.use('/api/admin', adminRoutes); // Temporarily disabled - schema mismatches
// app.use('/api/phonecheck', phonecheckRoutes); // Temporarily disabled - schema mismatches
// app.use('/api/enhanced-inventory', enhancedInventoryRoutes); // Temporarily disabled - schema mismatches
// app.use('/api/bulk-inventory', bulkInventoryRoutes); // Temporarily disabled - schema mismatches
app.use('/api/imei-queue', imeiQueueRoutes);
app.use('/api/imei-archival', imeiArchivalRoutes);
// app.use('/api/hybrid-queue', hybridQueueRoutes); // Temporarily disabled - schema mismatches
app.use('/api/operator', operatorRoutes);
app.use('/api/sku-matching', skuMatchingRoutes);
app.use('/api/enhanced-sku-master', enhancedSkuMasterRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 WMS Backend server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env['NODE_ENV']}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app; 