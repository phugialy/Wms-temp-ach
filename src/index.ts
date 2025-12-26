import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

// Import routes
import itemsRoutes from './routes/items.route';
import inventoryRoutes from './routes/inventory.route';
import logsRoutes from './routes/logs.route';
import adminRoutes from './routes/admin.route';
import phonecheckRoutes from './routes/phonecheck.route';
import enhancedInventoryRoutes from './routes/enhanced-inventory.route';
import bulkInventoryRoutes from './routes/bulk-inventory.route';
import imeiQueueRoutes from './routes/imei-queue.route';
import imeiArchivalRoutes from './routes/imei-archival.route';
import hybridQueueRoutes from './routes/hybrid-queue.route';
// import operatorRoutes from './routes/operator.route'; // Disabled - using focused inventory system
import skuMatchingRoutes from './routes/sku-matching.route';
import enhancedSkuMasterRoutes from './api/enhancedSkuMasterApi';
import skuManualUpdateRoutes from './api/skuManualUpdateApi';
import databaseCleanupRoutes from './api/databaseCleanupApi';
import inventoryApiRoutes from './api/inventoryApi';
import synchronousWorkflowRoutes from './routes/synchronous-workflow.route';
import cleanupRoutes from './api/cleanupApi';
import comprehensiveSkuTestRoutes from './routes/comprehensive-sku-test.route';
import sampleMatchResultsRoutes from './routes/sample-match-results.route';
import skuMatchingAnalysisRoutes from './routes/sku-matching-analysis.route';
import hybridSkuMatchingRoutes from './routes/hybrid-sku-matching.route';
import inventoryManagementRoutes from './routes/inventory-management.route';
import skuMasterRoutes from './routes/sku-master.route';
import skuInventoryRoutes from './routes/sku-inventory.route';
import genericModelTestRoutes from './routes/generic-model-test.route';
import bulkOperationsRoutes from './routes/bulk-operations.route';
import performanceTestRoutes from './routes/performance-test.route';
import cleanInputRoutes from './routes/clean-input.route';
import workflowRoutes from './routes/workflow.route';
import cronScheduleRoutes from './routes/cron-schedule.route';
import emailRoutes from './routes/email.route';
import emailSubscriptionRoutes from './routes/email-subscription.route';
import app1ImeiProcessingRoutes from './routes/app1-imei-processing.route';
import simpleImeiRoutes from './routes/simple-imei.route';
import inventoryAddRoutes from './routes/inventory-add.route';
import dbIntegrityCheckRoutes from './routes/db-integrity-check.route';
import authRoutes from './routes/auth.route';
import verificationRoutes from './routes/verification.route';
import dashboardRoutes from './routes/dashboard.route';

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

// Serve frontend build files (if they exist in production)
// Using CommonJS-compatible approach
const frontendDistPath = path.join(process.cwd(), 'frontend', 'dist');
app.use(express.static(frontendDistPath));

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
app.use('/items', itemsRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/logs', logsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/phonecheck', phonecheckRoutes);
app.use('/api/enhanced-inventory', enhancedInventoryRoutes);
app.use('/api/bulk-inventory', bulkInventoryRoutes);
app.use('/api/imei-queue', imeiQueueRoutes);
app.use('/api/imei-archival', imeiArchivalRoutes);
app.use('/api/hybrid-queue', hybridQueueRoutes);
// app.use('/api/operator', operatorRoutes); // Disabled - using focused inventory system
app.use('/api/sku-matching', skuMatchingRoutes);
app.use('/api/enhanced-sku-master', enhancedSkuMasterRoutes);
app.use('/api/sku-manual-update', skuManualUpdateRoutes);
app.use('/api/database-cleanup', databaseCleanupRoutes);
app.use('/api/cleanup', cleanupRoutes);
app.use('/api', inventoryApiRoutes);
app.use('/api/workflow', synchronousWorkflowRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/workflows/schedules', cronScheduleRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/email/subscriptions', emailSubscriptionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/comprehensive-sku-test', comprehensiveSkuTestRoutes);
app.use('/api/sample-match-results', sampleMatchResultsRoutes);
app.use('/api/sku-matching-analysis', skuMatchingAnalysisRoutes);
app.use('/api/hybrid-sku-matching', hybridSkuMatchingRoutes);
app.use('/api/inventory-management', inventoryManagementRoutes);
app.use('/api/sku-master', skuMasterRoutes);
app.use('/api/sku-inventory', skuInventoryRoutes);
app.use('/api/generic-model-test', genericModelTestRoutes);
app.use('/api/bulk-operations', bulkOperationsRoutes);
app.use('/api/performance-test', performanceTestRoutes);
app.use('/api/input', cleanInputRoutes);
app.use('/api/imei', app1ImeiProcessingRoutes);
app.use('/api/simple-imei', simpleImeiRoutes);
app.use('/api/inventory', inventoryAddRoutes);
app.use('/api/db-integrity-check', dbIntegrityCheckRoutes);

// Serve React app for all non-API routes (SPA fallback)
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api')) {
    return next();
  }
  
  // Skip static asset requests (they should be handled by express.static above)
  // This prevents the catch-all from serving index.html for JS/CSS/image files
  if (req.path.startsWith('/assets/') || 
      req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    return next(); // Let express.static handle it, or return 404 if file doesn't exist
  }
  
  // Serve index.html for React Router (SPA fallback)
  const indexPath = path.join(process.cwd(), 'frontend', 'dist', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // If frontend not built, return JSON error
      res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl,
        message: 'Frontend not built. Run "npm run build" in the frontend folder, or access the dev server at http://localhost:3000'
      });
    }
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API route not found',
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

// Initialize cron schedules on server start
import { CronScheduleService } from './services/cron-schedule.service';
import { emailSubscriptionService } from './services/email-subscription.service';
import * as cron from 'node-cron';

const cronScheduleService = new CronScheduleService();

// Start server
app.listen(PORT, async () => {
  logger.info(`🚀 WMS Backend server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env['NODE_ENV']}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  
  // Initialize active cron schedules
  try {
    await cronScheduleService.initializeAllSchedules();
    logger.info('✅ Cron schedules initialized');
  } catch (error) {
    logger.error('Failed to initialize cron schedules:', error);
  }

  // Initialize scheduled email delivery cron job
  // Runs every hour to check for scheduled email subscriptions
  try {
    cron.schedule('0 * * * *', async () => {
      logger.info('[ScheduledEmailCron] Checking for scheduled email subscriptions');
      await emailSubscriptionService.handleScheduledEmails();
    });
    logger.info('✅ Scheduled email delivery cron job initialized (runs every hour)');
  } catch (error) {
    logger.error('Failed to initialize scheduled email cron job:', error);
  }
});

export default app; 