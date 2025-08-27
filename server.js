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

// API routes
app.use('/api', inventoryApi);
app.use('/api/cleanup', cleanupApi);
app.use('/api', bulkDataApi);
app.use('/api/phonecheck', phonecheckApi);
app.use('/api/admin', adminApi);
app.use('/api/imei-queue', imeiQueueApi);
app.use('/api/sku-master', skuMasterApi);
app.use('/api/sku-matching', skuMatchingApi);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'WMS API Server is running'
  });
});

// Serve static HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 WMS API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📦 Inventory API: http://localhost:${PORT}/api/inventory`);
  console.log(`👨‍💼 Admin API: http://localhost:${PORT}/api/admin/inventory`);
});

module.exports = app;
