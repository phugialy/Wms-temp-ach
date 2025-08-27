const express = require('express');
const { Client } = require('pg');
require('dotenv').config();

const router = express.Router();

// Database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Connect to database
client.connect().catch(console.error);

// Admin API endpoints

// GET /api/admin/locations - Get available locations
router.get('/locations', async (req, res) => {
  try {
    console.log('👨‍💼 Admin API: Getting available locations');
    
    const mockLocations = [
      { id: 'DNCL-Inspection', name: 'DNCL Inspection', type: 'Inspection' },
      { id: 'DNCL-SHIPOUT', name: 'DNCL Ship Out', type: 'Shipping' },
      { id: 'DNCL-REPAIR', name: 'DNCL Repair', type: 'Repair' },
      { id: 'DNCL-STORAGE', name: 'DNCL Storage', type: 'Storage' },
      { id: 'DNCL-TESTING', name: 'DNCL Testing', type: 'Testing' },
      { id: 'DNCL-QUALITY', name: 'DNCL Quality Control', type: 'Quality' }
    ];
    
    console.log(`✅ Admin API: Found ${mockLocations.length} locations`);
    
    res.json({
      success: true,
      locations: mockLocations,
      count: mockLocations.length
    });
    
  } catch (error) {
    console.error('❌ Error getting locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get locations',
      details: error.message
    });
  }
});

// GET /api/admin/stations - Get available stations
router.get('/stations', async (req, res) => {
  try {
    console.log('👨‍💼 Admin API: Getting available stations');
    
    const mockStations = [
      { id: 'dncltz8', name: 'DNCL Station TZ8', location: 'Main Facility', status: 'active' },
      { id: 'dncltz9', name: 'DNCL Station TZ9', location: 'Main Facility', status: 'active' },
      { id: 'dncltz10', name: 'DNCL Station TZ10', location: 'Secondary Facility', status: 'active' },
      { id: 'dncltz11', name: 'DNCL Station TZ11', location: 'Secondary Facility', status: 'maintenance' }
    ];
    
    console.log(`✅ Admin API: Found ${mockStations.length} stations`);
    
    res.json({
      success: true,
      stations: mockStations,
      count: mockStations.length
    });
    
  } catch (error) {
    console.error('❌ Error getting stations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stations',
      details: error.message
    });
  }
});

// GET /api/admin/dashboard - Get admin dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    console.log('👨‍💼 Admin API: Getting dashboard data');
    
    const mockDashboardData = {
      totalDevices: 156,
      activeDevices: 142,
      pendingDevices: 8,
      failedDevices: 6,
      totalLocations: 6,
      totalStations: 4,
      recentActivity: [
        { action: 'Device Added', device: 'iPhone 15 Pro', time: new Date().toISOString() },
        { action: 'Device Moved', device: 'Samsung S24', time: new Date(Date.now() - 300000).toISOString() },
        { action: 'Device Tested', device: 'Google Pixel 8', time: new Date(Date.now() - 600000).toISOString() }
      ]
    };
    
    console.log('✅ Admin API: Dashboard data retrieved');
    
    res.json({
      success: true,
      data: mockDashboardData
    });
    
  } catch (error) {
    console.error('❌ Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data',
      details: error.message
    });
  }
});

// GET /api/admin/settings - Get admin settings
router.get('/settings', async (req, res) => {
  try {
    console.log('👨‍💼 Admin API: Getting admin settings');
    
    const mockSettings = {
      systemName: 'WMS - Warehouse Management System',
      version: '1.0.0',
      maxQueueSize: 1000,
      autoProcessing: true,
      notifications: {
        email: true,
        slack: false,
        sms: false
      },
      phonecheck: {
        enabled: true,
        apiKey: '***hidden***',
        baseUrl: 'https://api.phonecheck.com'
      }
    };
    
    console.log('✅ Admin API: Settings retrieved');
    
    res.json({
      success: true,
      settings: mockSettings
    });
    
  } catch (error) {
    console.error('❌ Error getting settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get settings',
      details: error.message
    });
  }
});

// POST /api/admin/recalculate-inventory - Recalculate all inventory counts
router.post('/recalculate-inventory', async (req, res) => {
  try {
    console.log('🔄 Recalculating all inventory counts...');
    
    // Call the database function to recalculate all inventory
    await client.query('SELECT recalculate_all_inventory()');
    
    console.log('✅ Inventory recalculation completed');
    res.json({
      success: true,
      message: 'Inventory counts recalculated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error recalculating inventory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recalculate inventory',
      details: error.message
    });
  }
});

// POST /api/admin/recalculate-inventory/:sku - Recalculate inventory for specific SKU
router.post('/recalculate-inventory/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    console.log(`🔄 Recalculating inventory for SKU: ${sku}`);
    
    // Call the database function to recalculate inventory for specific SKU
    await client.query('SELECT recalculate_inventory_for_sku($1)', [sku]);
    
    console.log(`✅ Inventory recalculation completed for SKU: ${sku}`);
    res.json({
      success: true,
      message: `Inventory counts recalculated for SKU: ${sku}`,
      sku: sku,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error recalculating inventory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recalculate inventory',
      details: error.message
    });
  }
});

module.exports = router;
