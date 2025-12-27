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

// Serve static files from public folder (but exclude index.html - React app handles root)
// This allows other static files (like test HTML files) to be accessible
app.use(express.static('public', {
  index: false, // Don't serve index.html from public folder
}));

// Serve frontend build files (React app)
// This should come AFTER public static files so React app takes precedence
const frontendDistPath = path.join(process.cwd(), 'frontend', 'dist');
app.use(express.static(frontendDistPath));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Health check endpoint (public)
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] 
  });
});

// Import authentication middleware
import { authenticate } from './middleware/auth.middleware';

// Public routes (no authentication required) - MUST be registered BEFORE auth middleware
app.use('/api/auth', authRoutes);

// DEPRECATED/DEACTIVATED ROUTES - Commented out but kept for reference
// These legacy routes are no longer used. All functionality moved to /api/* routes.
// app.use('/items', itemsRoutes); // Legacy - use /api/* routes instead
// app.use('/inventory', inventoryRoutes); // Legacy - use /api/inventory/* instead
// app.use('/logs', logsRoutes); // Legacy - consider implementing proper logging API

// Protected API Routes (all require authentication)
// Apply authentication middleware to each route group individually
app.use('/api/admin', authenticate, adminRoutes);
app.use('/api/phonecheck', authenticate, phonecheckRoutes);
// DEPRECATED/DEACTIVATED ROUTES - Possibly duplicate or unused routes
// Review these routes - they may be duplicates of other active routes
// app.use('/api/enhanced-inventory', authenticate, enhancedInventoryRoutes); // Possibly duplicate
// app.use('/api/bulk-inventory', authenticate, bulkInventoryRoutes); // Possibly duplicate
// app.use('/api/imei-queue', authenticate, imeiQueueRoutes); // Possibly unused
// app.use('/api/imei-archival', authenticate, imeiArchivalRoutes); // Possibly unused
// app.use('/api/hybrid-queue', authenticate, hybridQueueRoutes); // Possibly unused
// app.use('/api/operator', authenticate, operatorRoutes); // Disabled - using focused inventory system
app.use('/api/sku-matching', authenticate, skuMatchingRoutes);
app.use('/api/enhanced-sku-master', authenticate, enhancedSkuMasterRoutes);
app.use('/api/sku-manual-update', authenticate, skuManualUpdateRoutes);
app.use('/api/database-cleanup', authenticate, databaseCleanupRoutes);
app.use('/api/cleanup', authenticate, cleanupRoutes);
app.use('/api/workflow', authenticate, synchronousWorkflowRoutes);
app.use('/api/workflows', authenticate, workflowRoutes);
app.use('/api/workflows/schedules', authenticate, cronScheduleRoutes);
app.use('/api/email', authenticate, emailRoutes);
app.use('/api/email/subscriptions', authenticate, emailSubscriptionRoutes);
// Note: /api/auth is already registered above as public route (line 94)
app.use('/api/verification', authenticate, verificationRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
// Note: inventoryApiRoutes uses /api prefix, apply auth to it
app.use('/api', authenticate, inventoryApiRoutes);
// DEPRECATED/DEACTIVATED ROUTES - Test/Development routes commented out
// These routes were used for testing/development and are no longer needed in production
// app.use('/api/comprehensive-sku-test', authenticate, comprehensiveSkuTestRoutes); // Test route
// app.use('/api/sample-match-results', authenticate, sampleMatchResultsRoutes); // Test route
// app.use('/api/sku-matching-analysis', authenticate, skuMatchingAnalysisRoutes); // Test route
// app.use('/api/hybrid-sku-matching', authenticate, hybridSkuMatchingRoutes); // Test route
// app.use('/api/generic-model-test', authenticate, genericModelTestRoutes); // Test route
// app.use('/api/performance-test', authenticate, performanceTestRoutes); // Test route
// app.use('/api/input', authenticate, cleanInputRoutes); // Test/utility route

// ACTIVE ROUTES - Keep these as they may be used
app.use('/api/inventory-management', authenticate, inventoryManagementRoutes);
app.use('/api/sku-master', authenticate, skuMasterRoutes);
app.use('/api/sku-inventory', authenticate, skuInventoryRoutes);
app.use('/api/bulk-operations', authenticate, bulkOperationsRoutes);
app.use('/api/imei', authenticate, app1ImeiProcessingRoutes);
app.use('/api/simple-imei', authenticate, simpleImeiRoutes);
app.use('/api/inventory', authenticate, inventoryAddRoutes);
app.use('/api/db-integrity-check', authenticate, dbIntegrityCheckRoutes);

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
  
  // Skip HTML files in public folder (they should be served as static files)
  // Only serve React app's index.html for SPA routing
  // This ensures public/*.html files are accessible, but root route uses React app
  if (req.path.endsWith('.html') && req.path !== '/index.html' && req.path !== '/') {
    return next(); // Let express.static handle HTML files from public folder
  }
  
  // Serve React app's index.html for all other routes (SPA fallback)
  // This ensures React Router handles routing, including root route
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