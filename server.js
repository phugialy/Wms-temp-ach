const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Import API routes
const inventoryApi = require('./src/api/inventoryApi');
const cleanupApi = require('./src/api/cleanupApi');
const bulkDataApi = require('./src/api/bulkDataApi');
const phonecheckApi = require('./src/api/phonecheckApi');
const adminApi = require('./src/api/adminApi');
const imeiQueueApi = require('./src/api/imeiQueueApi');
const skuMasterApi = require('./src/api/skuMasterApi');
const skuMatchingApi = require('./src/api/skuMatchingApi');
const skuTestApi = require('./src/routes/skuTest');
const workflowApi = require('./src/api/workflowApi');

// API routes - Order matters! More specific routes first
app.use('/api/cleanup', cleanupApi);
app.use('/api/phonecheck', phonecheckApi);
app.use('/api/admin', adminApi);
app.use('/api/imei-queue', imeiQueueApi);
app.use('/api/sku-master', skuMasterApi);
app.use('/api/sku-matching', skuMatchingApi);
app.use('/api/sku-test', skuTestApi);
app.use('/api/workflows', workflowApi);
app.use('/api', bulkDataApi);
app.use('/api', inventoryApi); // This should be last as it catches all /api/* routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'WMS API Server is running'
  });
});

// Serve frontend build files (React app)
const frontendDistPath = path.join(__dirname, 'frontend', 'dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');

// Check if frontend is built
const fs = require('fs');
const frontendBuilt = fs.existsSync(frontendIndexPath);

if (frontendBuilt) {
  // Serve static files from frontend/dist
  app.use(express.static(frontendDistPath));
  console.log('✅ Frontend build found - serving React app');
} else {
  console.log('⚠️  Frontend not built - run "pnpm build:frontend" to build the UI');
}

// Legacy static HTML files (fallback)
app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

app.get('/inventory-manager', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'inventory-manager.html'));
});

app.get('/data-cleanup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'data-cleanup.html'));
});

app.get('/sku-matching', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sku-matching.html'));
});

app.get('/sku-test', (req, res) => {
  res.redirect('/api/sku-test');
});

// Serve React app for all non-API routes (SPA fallback)
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api')) {
    return next();
  }
  
  // If frontend is built, serve React app
  if (frontendBuilt) {
    return res.sendFile(frontendIndexPath);
  }
  
  // Fallback to legacy index.html
  const legacyIndexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(legacyIndexPath)) {
    return res.sendFile(legacyIndexPath);
  }
  
  // No frontend available
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  // If it's an API route, return JSON
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      path: req.path
    });
  }
  
  // For non-API routes, try to serve frontend or return error
  if (frontendBuilt) {
    return res.sendFile(frontendIndexPath);
  }
  
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    message: 'Frontend not built. Run "pnpm build:frontend" to build the UI'
  });
});

// Only start server if not in Vercel environment
// Vercel will use the api/index.js entry point instead
if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  app.listen(PORT, () => {
    console.log(`🚀 WMS API Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📦 Inventory API: http://localhost:${PORT}/api/inventory`);
    console.log(`👨‍💼 Admin API: http://localhost:${PORT}/api/admin/inventory`);
  });
}

module.exports = app;
