import { Router } from 'express';
import { FlexibleSkuMatchingService } from '../services/FlexibleSkuMatchingService';
import { CompleteSkuMatchingService } from '../services/CompleteSkuMatchingService';
import { logger } from '../utils/logger';

const router = Router();

// Initialize services
const flexibleService = new FlexibleSkuMatchingService();
const originalService = new CompleteSkuMatchingService();

// Comprehensive test data with realistic bulk-add formatting
// Based on actual bulk-add data structure from public/bulk-add.html
const COMPREHENSIVE_TEST_DATA = [
  // ===== SAMSUNG GALAXY S SERIES =====
  {
    // Standard Samsung S23
    imei: '357123456789001',
    name: 'Samsung Galaxy S23',
    brand: 'Samsung',
    model: 'Galaxy S23',
    storage: '128GB',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device',
    test_name: 'Samsung Galaxy S23 - Standard',
    expected_confidence: 'high'
  },
  {
    // Samsung S23 Ultra
    imei: '357123456789002',
    name: 'Samsung Galaxy S23 Ultra',
    brand: 'Samsung',
    model: 'Galaxy S23 Ultra',
    storage: '256GB',
    capacity: '256GB',
    color: 'Green',
    carrier: 'VERIZON',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Verizon locked device',
    test_name: 'Samsung Galaxy S23 Ultra - Verizon',
    expected_confidence: 'high'
  },
  {
    // Samsung S23 Plus
    imei: '357123456789003',
    name: 'Samsung Galaxy S23+',
    brand: 'Samsung',
    model: 'Galaxy S23+',
    storage: '512GB',
    capacity: '512GB',
    color: 'White',
    carrier: 'T-MOBILE',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'T-Mobile locked device',
    test_name: 'Samsung Galaxy S23 Plus - T-Mobile',
    expected_confidence: 'high'
  },
  {
    // Samsung S24
    imei: '357123456789004',
    name: 'Samsung Galaxy S24',
    brand: 'Samsung',
    model: 'Galaxy S24',
    storage: '128GB',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device',
    test_name: 'Samsung Galaxy S24 - Standard',
    expected_confidence: 'high'
  },
  {
    // Samsung S24 Ultra
    imei: '357123456789005',
    name: 'Samsung Galaxy S24 Ultra',
    brand: 'Samsung',
    model: 'Galaxy S24 Ultra',
    storage: '1TB',
    capacity: '1TB',
    color: 'Titanium',
    carrier: 'AT&T',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'AT&T locked device',
    test_name: 'Samsung Galaxy S24 Ultra - AT&T',
    expected_confidence: 'high'
  },
  {
    // Samsung S25 (New Model)
    imei: '357123456789006',
    name: 'Samsung Galaxy S25',
    brand: 'Samsung',
    model: 'Galaxy S25',
    storage: '256GB',
    capacity: '256GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device',
    test_name: 'Samsung Galaxy S25 - New Model',
    expected_confidence: 'medium'
  },
  {
    // Samsung S25 Ultra (New Model)
    imei: '357123456789007',
    name: 'Samsung Galaxy S25 Ultra',
    brand: 'Samsung',
    model: 'Galaxy S25 Ultra',
    storage: '512GB',
    capacity: '512GB',
    color: 'Titanium',
    carrier: 'VERIZON',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Verizon locked device',
    test_name: 'Samsung Galaxy S25 Ultra - New Model',
    expected_confidence: 'medium'
  },

  // ===== SAMSUNG GALAXY NOTE SERIES =====
  {
    // Samsung Note 20
    imei: '357123456789008',
    name: 'Samsung Galaxy Note 20',
    brand: 'Samsung',
    model: 'Galaxy Note 20',
    storage: '128GB',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device',
    test_name: 'Samsung Galaxy Note 20',
    expected_confidence: 'high'
  },
  {
    // Samsung Note 20 Ultra
    imei: '357123456789009',
    name: 'Samsung Galaxy Note 20 Ultra',
    brand: 'Samsung',
    model: 'Galaxy Note 20 Ultra',
    storage: '256GB',
    capacity: '256GB',
    color: 'White',
    carrier: 'VERIZON',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Verizon locked device',
    test_name: 'Samsung Galaxy Note 20 Ultra',
    expected_confidence: 'high'
  },

  // ===== SAMSUNG GALAXY Z SERIES (FOLDABLES) =====
  {
    // Samsung Z Flip 4
    imei: '357123456789010',
    name: 'Samsung Galaxy Z Flip 4',
    brand: 'Samsung',
    model: 'Galaxy Z Flip 4',
    storage: '128GB',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device',
    test_name: 'Samsung Galaxy Z Flip 4',
    expected_confidence: 'high'
  },
  {
    // Samsung Z Flip 5
    imei: '357123456789011',
    name: 'Samsung Galaxy Z Flip 5',
    brand: 'Samsung',
    model: 'Galaxy Z Flip 5',
    storage: '256GB',
    capacity: '256GB',
    color: 'White',
    carrier: 'T-MOBILE',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'T-Mobile locked device',
    test_name: 'Samsung Galaxy Z Flip 5',
    expected_confidence: 'high'
  },
  {
    // Samsung Z Fold 4
    imei: '357123456789012',
    name: 'Samsung Galaxy Z Fold 4',
    brand: 'Samsung',
    model: 'Galaxy Z Fold 4',
    storage: '256GB',
    capacity: '256GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device',
    test_name: 'Samsung Galaxy Z Fold 4',
    expected_confidence: 'high'
  },
  {
    // Samsung Z Fold 5
    imei: '357123456789013',
    name: 'Samsung Galaxy Z Fold 5',
    brand: 'Samsung',
    model: 'Galaxy Z Fold 5',
    storage: '512GB',
    capacity: '512GB',
    color: 'White',
    carrier: 'VERIZON',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Verizon locked device',
    test_name: 'Samsung Galaxy Z Fold 5',
    expected_confidence: 'high'
  },

  // ===== SAMSUNG TABLETS =====
  {
    // Samsung Tab S8
    imei: '357123456789014',
    name: 'Samsung Galaxy Tab S8',
    brand: 'Samsung',
    model: 'Galaxy Tab S8',
    storage: '128GB',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    type: 'tablet',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'WiFi only tablet',
    test_name: 'Samsung Galaxy Tab S8',
    expected_confidence: 'high'
  },
  {
    // Samsung Tab S8 Ultra
    imei: '357123456789015',
    name: 'Samsung Galaxy Tab S8 Ultra',
    brand: 'Samsung',
    model: 'Galaxy Tab S8 Ultra',
    storage: '256GB',
    capacity: '256GB',
    color: 'Silver',
    carrier: 'UNLOCKED',
    type: 'tablet',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'WiFi only tablet',
    test_name: 'Samsung Galaxy Tab S8 Ultra',
    expected_confidence: 'high'
  },
  {
    // Samsung Tab S9
    imei: '357123456789016',
    name: 'Samsung Galaxy Tab S9',
    brand: 'Samsung',
    model: 'Galaxy Tab S9',
    storage: '128GB',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    type: 'tablet',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'WiFi only tablet',
    test_name: 'Samsung Galaxy Tab S9',
    expected_confidence: 'high'
  },
  {
    // Samsung Tab S9 Ultra
    imei: '357123456789017',
    name: 'Samsung Galaxy Tab S9 Ultra',
    brand: 'Samsung',
    model: 'Galaxy Tab S9 Ultra',
    storage: '512GB',
    capacity: '512GB',
    color: 'Silver',
    carrier: 'UNLOCKED',
    type: 'tablet',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'WiFi only tablet',
    test_name: 'Samsung Galaxy Tab S9 Ultra',
    expected_confidence: 'high'
  },

  // ===== APPLE IPHONE SERIES =====
  {
    // iPhone 13
    imei: '357123456789018',
    name: 'iPhone 13',
    brand: 'Apple',
    model: 'iPhone 13',
    storage: '128GB',
    capacity: '128GB',
    color: 'Blue',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device',
    test_name: 'iPhone 13 - Standard',
    expected_confidence: 'high'
  },
  {
    // iPhone 13 Pro
    imei: '357123456789019',
    name: 'iPhone 13 Pro',
    brand: 'Apple',
    model: 'iPhone 13 Pro',
    storage: '256GB',
    capacity: '256GB',
    color: 'Graphite',
    carrier: 'VERIZON',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Verizon locked device',
    test_name: 'iPhone 13 Pro - Verizon',
    expected_confidence: 'high'
  },
  {
    // iPhone 13 Pro Max
    imei: '357123456789020',
    name: 'iPhone 13 Pro Max',
    brand: 'Apple',
    model: 'iPhone 13 Pro Max',
    storage: '512GB',
    capacity: '512GB',
    color: 'Gold',
    carrier: 'AT&T',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'AT&T locked device',
    test_name: 'iPhone 13 Pro Max - AT&T',
    expected_confidence: 'high'
  },
  {
    // iPhone 14
    imei: '357123456789021',
    name: 'iPhone 14',
    brand: 'Apple',
    model: 'iPhone 14',
    storage: '128GB',
    capacity: '128GB',
    color: 'Purple',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device',
    test_name: 'iPhone 14 - Standard',
    expected_confidence: 'high'
  },
  {
    // iPhone 14 Pro
    imei: '357123456789022',
    name: 'iPhone 14 Pro',
    brand: 'Apple',
    model: 'iPhone 14 Pro',
    storage: '256GB',
    capacity: '256GB',
    color: 'Deep Purple',
    carrier: 'T-MOBILE',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'T-Mobile locked device',
    test_name: 'iPhone 14 Pro - T-Mobile',
    expected_confidence: 'high'
  },
  {
    // iPhone 14 Pro Max
    imei: '357123456789023',
    name: 'iPhone 14 Pro Max',
    brand: 'Apple',
    model: 'iPhone 14 Pro Max',
    storage: '1TB',
    capacity: '1TB',
    color: 'Space Black',
    carrier: 'VERIZON',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Verizon locked device',
    test_name: 'iPhone 14 Pro Max - Verizon',
    expected_confidence: 'high'
  },
  {
    // iPhone 15
    imei: '357123456789024',
    name: 'iPhone 15',
    brand: 'Apple',
    model: 'iPhone 15',
    storage: '128GB',
    capacity: '128GB',
    color: 'Pink',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device',
    test_name: 'iPhone 15 - Standard',
    expected_confidence: 'high'
  },
  {
    // iPhone 15 Pro
    imei: '357123456789025',
    name: 'iPhone 15 Pro',
    brand: 'Apple',
    model: 'iPhone 15 Pro',
    storage: '256GB',
    capacity: '256GB',
    color: 'Natural Titanium',
    carrier: 'AT&T',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'AT&T locked device',
    test_name: 'iPhone 15 Pro - AT&T',
    expected_confidence: 'high'
  },
  {
    // iPhone 15 Pro Max
    imei: '357123456789026',
    name: 'iPhone 15 Pro Max',
    brand: 'Apple',
    model: 'iPhone 15 Pro Max',
    storage: '512GB',
    capacity: '512GB',
    color: 'Blue Titanium',
    carrier: 'VERIZON',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Verizon locked device',
    test_name: 'iPhone 15 Pro Max - Verizon',
    expected_confidence: 'high'
  },

  // ===== APPLE IPAD SERIES =====
  {
    // iPad Air 5
    imei: '357123456789027',
    name: 'iPad Air 5',
    brand: 'Apple',
    model: 'iPad Air 5',
    storage: '64GB',
    capacity: '64GB',
    color: 'Space Gray',
    carrier: 'UNLOCKED',
    type: 'tablet',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'WiFi only tablet',
    test_name: 'iPad Air 5',
    expected_confidence: 'high'
  },
  {
    // iPad Pro 12.9
    imei: '357123456789028',
    name: 'iPad Pro 12.9',
    brand: 'Apple',
    model: 'iPad Pro 12.9',
    storage: '256GB',
    capacity: '256GB',
    color: 'Silver',
    carrier: 'UNLOCKED',
    type: 'tablet',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'WiFi only tablet',
    test_name: 'iPad Pro 12.9',
    expected_confidence: 'high'
  },

  // ===== GOOGLE PIXEL SERIES =====
  {
    // Pixel 7
    imei: '357123456789029',
    name: 'Google Pixel 7',
    brand: 'Google',
    model: 'Pixel 7',
    storage: '128GB',
    capacity: '128GB',
    color: 'Obsidian',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device',
    test_name: 'Google Pixel 7',
    expected_confidence: 'high'
  },
  {
    // Pixel 7 Pro
    imei: '357123456789030',
    name: 'Google Pixel 7 Pro',
    brand: 'Google',
    model: 'Pixel 7 Pro',
    storage: '256GB',
    capacity: '256GB',
    color: 'Hazel',
    carrier: 'VERIZON',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Verizon locked device',
    test_name: 'Google Pixel 7 Pro',
    expected_confidence: 'high'
  },
  {
    // Pixel 8
    imei: '357123456789031',
    name: 'Google Pixel 8',
    brand: 'Google',
    model: 'Pixel 8',
    storage: '128GB',
    capacity: '128GB',
    color: 'Obsidian',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device',
    test_name: 'Google Pixel 8',
    expected_confidence: 'high'
  },
  {
    // Pixel 8 Pro
    imei: '357123456789032',
    name: 'Google Pixel 8 Pro',
    brand: 'Google',
    model: 'Pixel 8 Pro',
    storage: '256GB',
    capacity: '256GB',
    color: 'Bay',
    carrier: 'T-MOBILE',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'T-Mobile locked device',
    test_name: 'Google Pixel 8 Pro',
    expected_confidence: 'high'
  },

  // ===== ONEPLUS SERIES =====
  {
    // OnePlus 11
    imei: '357123456789033',
    name: 'OnePlus 11',
    brand: 'OnePlus',
    model: 'OnePlus 11',
    storage: '128GB',
    capacity: '128GB',
    color: 'Titan Black',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device',
    test_name: 'OnePlus 11',
    expected_confidence: 'high'
  },
  {
    // OnePlus 11 Pro
    imei: '357123456789034',
    name: 'OnePlus 11 Pro',
    brand: 'OnePlus',
    model: 'OnePlus 11 Pro',
    storage: '256GB',
    capacity: '256GB',
    color: 'Eternal Green',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device',
    test_name: 'OnePlus 11 Pro',
    expected_confidence: 'high'
  },

  // ===== EDGE CASES - MANUAL ENTRIES =====
  {
    // Uncommon capacity
    imei: '357123456789035',
    name: 'Samsung Galaxy S23',
    brand: 'Samsung',
    model: 'Galaxy S23',
    storage: '64GB',
    capacity: '64GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device - uncommon capacity',
    test_name: 'Samsung S23 - Uncommon Capacity (64GB)',
    expected_confidence: 'medium'
  },
  {
    // Uncommon color
    imei: '357123456789036',
    name: 'Samsung Galaxy S23',
    brand: 'Samsung',
    model: 'Galaxy S23',
    storage: '128GB',
    capacity: '128GB',
    color: 'Rainbow',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device - uncommon color',
    test_name: 'Samsung S23 - Uncommon Color (Rainbow)',
    expected_confidence: 'medium'
  },
  {
    // Legacy carrier
    imei: '357123456789037',
    name: 'Samsung Galaxy S23',
    brand: 'Samsung',
    model: 'Galaxy S23',
    storage: '128GB',
    capacity: '128GB',
    color: 'Black',
    carrier: 'SPRINT',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Sprint locked device - legacy carrier',
    test_name: 'Samsung S23 - Legacy Carrier (Sprint)',
    expected_confidence: 'medium'
  },
  {
    // Partial data - missing color
    imei: '357123456789038',
    name: 'Samsung Galaxy S23',
    brand: 'Samsung',
    model: 'Galaxy S23',
    storage: '128GB',
    capacity: '128GB',
    color: '',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device - missing color',
    test_name: 'Samsung S23 - Missing Color',
    expected_confidence: 'medium'
  },
  {
    // Partial data - missing capacity
    imei: '357123456789039',
    name: 'Samsung Galaxy S23',
    brand: 'Samsung',
    model: 'Galaxy S23',
    storage: '',
    capacity: '',
    color: 'Black',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device - missing capacity',
    test_name: 'Samsung S23 - Missing Capacity',
    expected_confidence: 'medium'
  },
  {
    // Partial data - missing model
    imei: '357123456789040',
    name: 'Samsung Galaxy S23',
    brand: 'Samsung',
    model: '',
    storage: '128GB',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device - missing model',
    test_name: 'Samsung S23 - Missing Model',
    expected_confidence: 'low'
  },
  {
    // Very manual entry - custom pattern
    imei: '357123456789041',
    name: 'Samsung Galaxy S23',
    brand: 'Samsung',
    model: 'Galaxy S23',
    storage: '128GB',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Custom manual entry - might not match standard patterns',
    test_name: 'Samsung S23 - Very Manual Entry',
    expected_confidence: 'low'
  },
  {
    // Insufficient data - multiple missing fields
    imei: '357123456789042',
    name: 'Samsung Galaxy S23',
    brand: 'Samsung',
    model: '',
    storage: '',
    capacity: '',
    color: '',
    carrier: '',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device - multiple missing fields',
    test_name: 'Samsung S23 - Multiple Missing Fields',
    expected_confidence: 'very_low'
  },
  {
    // Insufficient data - missing brand
    imei: '357123456789043',
    name: 'Samsung Galaxy S23',
    brand: '',
    model: 'Galaxy S23',
    storage: '128GB',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    type: 'phone',
    working: 'YES',
    workingStatus: 'PASS',
    condition: 'A',
    location: 'DNCL-Inspection',
    notes: 'Carrier unlocked device - missing brand',
    test_name: 'Samsung S23 - Missing Brand',
    expected_confidence: 'very_low'
  }
];

// POST /api/comprehensive-sku-test/run-full-test - Run comprehensive test with all phone types
router.post('/run-full-test', async (req, res) => {
  try {
    logger.info('🔄 Starting comprehensive SKU matching test with all phone types');
    
    // Initialize services
    await flexibleService.initialize();
    await originalService.initialize();
    
    const testResults = {
      summary: {
        totalTests: COMPREHENSIVE_TEST_DATA.length,
        flexibleWins: 0,
        originalWins: 0,
        ties: 0,
        flexibleAccuracy: 0,
        originalAccuracy: 0,
        confidenceDistribution: {
          high: 0,
          medium: 0,
          low: 0,
          very_low: 0
        },
        phoneTypeDistribution: {
          samsung_s_series: 0,
          samsung_note_series: 0,
          samsung_z_series: 0,
          samsung_tablets: 0,
          iphone_series: 0,
          ipad_series: 0,
          pixel_series: 0,
          oneplus_series: 0,
          edge_cases: 0
        } as Record<string, number>
      },
      detailedResults: [] as any[],
      improvements: [] as string[],
      issues: [] as string[],
      phoneTypeAnalysis: {}
    };
    
    // Test each device
    for (const testDevice of COMPREHENSIVE_TEST_DATA) {
      try {
        logger.info(`🔍 Testing: ${testDevice.test_name}`);
        
        // Convert bulk-add format to SKU matching format
        const deviceData = {
          imei: testDevice.imei,
          brand: testDevice.brand,
          model: testDevice.model,
          capacity: testDevice.capacity || testDevice.storage,
          color: testDevice.color,
          carrier: testDevice.carrier,
          device_notes: testDevice.notes,
          original_sku: `TEST-${testDevice.imei}`
        };
        
        // Test with flexible service
        const flexibleResult = await flexibleService.matchImeiToSku(deviceData, {
          minScore: 30,
          maxResults: 5,
          useFuzzyMatching: true,
          allowPartialMatches: true,
          strictMode: false
        });
        
        // Test with original service
        const originalResult = await originalService.matchImeiToSku(deviceData, {
          filterPostfix: true,
          minScore: 50,
          maxResults: 5
        });
        
        // Determine phone type for analysis
        const phoneType = getPhoneType(testDevice);
        testResults.summary.phoneTypeDistribution[phoneType] = (testResults.summary.phoneTypeDistribution[phoneType] || 0) + 1;
        
        // Analyze results
        const result = {
          test_name: testDevice.test_name,
          phone_type: phoneType,
          expected_confidence: testDevice.expected_confidence,
          input_data: {
            imei: testDevice.imei,
            name: testDevice.name,
            brand: testDevice.brand,
            model: testDevice.model,
            storage: testDevice.storage,
            capacity: testDevice.capacity,
            color: testDevice.color,
            carrier: testDevice.carrier,
            type: testDevice.type,
            working: testDevice.working,
            workingStatus: testDevice.workingStatus,
            condition: testDevice.condition,
            location: testDevice.location,
            notes: testDevice.notes
          },
          flexible_service: {
            matches: flexibleResult.matches || [],
            best_match: flexibleResult.matches?.[0] || null,
            best_score: flexibleResult.matches?.[0]?.totalScore || 0,
            confidence: flexibleResult.confidence,
            requires_attention: flexibleResult.requiresAttention || false,
            no_match_reason: flexibleResult.noMatchReason
          },
          original_service: {
            matches: originalResult.matches || [],
            best_match: originalResult.matches?.[0] || null,
            best_score: originalResult.matches?.[0]?.totalScore || 0,
            confidence: originalResult.matches?.[0]?.confidence || 'unknown',
            requires_attention: originalResult.requiresAttention || false,
            no_match_reason: (originalResult as any).noMatchReason
          },
          comparison: {
            flexible_has_matches: (flexibleResult.matches?.length || 0) > 0,
            original_has_matches: (originalResult.matches?.length || 0) > 0,
            flexible_better_score: (flexibleResult.matches?.[0]?.totalScore || 0) > (originalResult.matches?.[0]?.totalScore || 0),
            original_better_score: (originalResult.matches?.[0]?.totalScore || 0) > (flexibleResult.matches?.[0]?.totalScore || 0),
            flexible_less_attention: !flexibleResult.requiresAttention && originalResult.requiresAttention,
            original_less_attention: !originalResult.requiresAttention && flexibleResult.requiresAttention,
            confidence_match: flexibleResult.confidence === testDevice.expected_confidence
          },
          winner: 'tie',
          analysis: [] as string[]
        };
        
        // Determine winner
        if (result.comparison.flexible_has_matches && !result.comparison.original_has_matches) {
          result.winner = 'flexible';
          result.analysis.push('Flexible service found matches where original did not');
          testResults.summary.flexibleWins++;
        } else if (!result.comparison.flexible_has_matches && result.comparison.original_has_matches) {
          result.winner = 'original';
          result.analysis.push('Original service found matches where flexible did not');
          testResults.summary.originalWins++;
        } else if (result.comparison.flexible_has_matches && result.comparison.original_has_matches) {
          if (result.comparison.flexible_better_score) {
            result.winner = 'flexible';
            result.analysis.push(`Flexible service has better score: ${result.flexible_service.best_score} vs ${result.original_service.best_score}`);
            testResults.summary.flexibleWins++;
          } else if (result.comparison.original_better_score) {
            result.winner = 'original';
            result.analysis.push(`Original service has better score: ${result.original_service.best_score} vs ${result.flexible_service.best_score}`);
            testResults.summary.originalWins++;
          } else {
            result.winner = 'tie';
            result.analysis.push('Both services have similar scores');
            testResults.summary.ties++;
          }
        } else {
          result.winner = 'tie';
          result.analysis.push('Neither service found matches');
          testResults.summary.ties++;
        }
        
        // Check confidence accuracy
        if (result.comparison.confidence_match) {
          result.analysis.push(`Confidence level matches expectation: ${flexibleResult.confidence}`);
        } else {
          result.analysis.push(`Confidence level differs from expectation: ${flexibleResult.confidence} vs ${testDevice.expected_confidence}`);
        }
        
        // Track confidence distribution
        testResults.summary.confidenceDistribution[flexibleResult.confidence as keyof typeof testResults.summary.confidenceDistribution]++;
        
        testResults.detailedResults.push(result);
        
      } catch (error) {
        logger.error(`❌ Error testing ${testDevice.test_name}:`, error);
        testResults.detailedResults.push({
          test_name: testDevice.test_name,
          error: error instanceof Error ? error.message : 'Unknown error',
          winner: 'error'
        });
      }
    }
    
    // Calculate accuracy
    const flexibleAccuracy = (testResults.summary.flexibleWins / testResults.summary.totalTests) * 100;
    const originalAccuracy = (testResults.summary.originalWins / testResults.summary.totalTests) * 100;
    
    testResults.summary.flexibleAccuracy = flexibleAccuracy;
    testResults.summary.originalAccuracy = originalAccuracy;
    
    // Generate phone type analysis
    testResults.phoneTypeAnalysis = generatePhoneTypeAnalysis(testResults.detailedResults);
    
    // Generate overall analysis
    if (flexibleAccuracy > originalAccuracy) {
      testResults.improvements.push(`Flexible service shows ${(flexibleAccuracy - originalAccuracy).toFixed(1)}% better accuracy`);
    } else if (originalAccuracy > flexibleAccuracy) {
      testResults.issues.push(`Original service shows ${(originalAccuracy - flexibleAccuracy).toFixed(1)}% better accuracy`);
    }
    
    // Check for specific improvements
    const flexibleFoundMoreMatches = testResults.detailedResults.filter((r: any) => 
      r.comparison?.flexible_has_matches && !r.comparison?.original_has_matches
    ).length;
    
    if (flexibleFoundMoreMatches > 0) {
      testResults.improvements.push(`Flexible service found matches for ${flexibleFoundMoreMatches} additional cases`);
    }
    
    const flexibleBetterScores = testResults.detailedResults.filter((r: any) => 
      r.comparison?.flexible_better_score
    ).length;
    
    if (flexibleBetterScores > 0) {
      testResults.improvements.push(`Flexible service has better scores for ${flexibleBetterScores} cases`);
    }
    
    const flexibleLessAttention = testResults.detailedResults.filter((r: any) => 
      r.comparison?.flexible_less_attention
    ).length;
    
    if (flexibleLessAttention > 0) {
      testResults.improvements.push(`Flexible service requires less manual attention for ${flexibleLessAttention} cases`);
    }
    
    logger.info(`🎯 Comprehensive test completed: Flexible ${flexibleAccuracy.toFixed(1)}% vs Original ${originalAccuracy.toFixed(1)}%`);
    
    res.json({
      success: true,
      message: 'Comprehensive SKU matching test completed',
      test_results: testResults,
      recommendation: flexibleAccuracy > originalAccuracy ? 
        'Flexible service shows better performance across all phone types' : 
        'Original service shows better performance'
    });
    
  } catch (error) {
    logger.error('❌ Error running comprehensive test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run comprehensive test',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/comprehensive-sku-test/test-bulk-add-format - Test with actual bulk-add data format
router.post('/test-bulk-add-format', async (req, res): Promise<void> => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Missing or invalid items array'
      });
    }
    
    logger.info(`🔍 Testing ${items.length} items with bulk-add format`);
    
    await flexibleService.initialize();
    
    const results = [];
    
    for (const item of items) {
      try {
        // Convert bulk-add format to SKU matching format
        const deviceData = {
          imei: item.imei,
          brand: item.brand,
          model: item.model,
          capacity: item.capacity || item.storage,
          color: item.color,
          carrier: item.carrier,
          device_notes: item.notes,
          original_sku: item.sku || `TEST-${item.imei}`
        };
        
        const matchResult = await flexibleService.matchImeiToSku(deviceData, {
          minScore: 30,
          maxResults: 5,
          useFuzzyMatching: true,
          allowPartialMatches: true,
          strictMode: false
        });
        
        results.push({
          imei: item.imei,
          name: item.name,
          input_data: deviceData,
          match_result: matchResult,
          analysis: {
            total_matches: matchResult.matches?.length || 0,
            best_score: matchResult.matches?.[0]?.totalScore || 0,
            confidence: matchResult.confidence,
            requires_attention: matchResult.requiresAttention || false,
            match_types: matchResult.matches?.map(m => m.matchType) || []
          }
        });
        
      } catch (error) {
        logger.error(`❌ Error testing item ${item.imei}:`, error);
        results.push({
          imei: item.imei,
          name: item.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Bulk-add format test completed',
      results,
      summary: {
        total_items: items.length,
        successful_tests: results.filter(r => !r.error).length,
        failed_tests: results.filter(r => r.error).length,
        confidence_distribution: {
          high: results.filter(r => r.analysis?.confidence === 'high').length,
          medium: results.filter(r => r.analysis?.confidence === 'medium').length,
          low: results.filter(r => r.analysis?.confidence === 'low').length,
          very_low: results.filter(r => r.analysis?.confidence === 'very_low').length
        }
      }
    });
    
  } catch (error) {
    logger.error('❌ Error testing bulk-add format:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test bulk-add format',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to determine phone type
function getPhoneType(device: any): string {
  const model = device.model?.toLowerCase() || '';
  const brand = device.brand?.toLowerCase() || '';
  
  if (brand.includes('samsung')) {
    if (model.includes('s23') || model.includes('s24') || model.includes('s25')) {
      return 'samsung_s_series';
    } else if (model.includes('note')) {
      return 'samsung_note_series';
    } else if (model.includes('z flip') || model.includes('z fold')) {
      return 'samsung_z_series';
    } else if (model.includes('tab')) {
      return 'samsung_tablets';
    }
  } else if (brand.includes('apple')) {
    if (model.includes('iphone')) {
      return 'iphone_series';
    } else if (model.includes('ipad')) {
      return 'ipad_series';
    }
  } else if (brand.includes('google') && model.includes('pixel')) {
    return 'pixel_series';
  } else if (brand.includes('oneplus')) {
    return 'oneplus_series';
  }
  
  return 'edge_cases';
}

// Helper function to generate phone type analysis
function generatePhoneTypeAnalysis(results: any[]): any {
  const analysis: any = {};
  
  const phoneTypes = ['samsung_s_series', 'samsung_note_series', 'samsung_z_series', 'samsung_tablets', 
                     'iphone_series', 'ipad_series', 'pixel_series', 'oneplus_series', 'edge_cases'];
  
  phoneTypes.forEach(type => {
    const typeResults = results.filter(r => r.phone_type === type);
    if (typeResults.length > 0) {
      analysis[type] = {
        total_tests: typeResults.length,
        flexible_wins: typeResults.filter(r => r.winner === 'flexible').length,
        original_wins: typeResults.filter(r => r.winner === 'original').length,
        ties: typeResults.filter(r => r.winner === 'tie').length,
        confidence_distribution: {
          high: typeResults.filter(r => r.flexible_service?.confidence === 'high').length,
          medium: typeResults.filter(r => r.flexible_service?.confidence === 'medium').length,
          low: typeResults.filter(r => r.flexible_service?.confidence === 'low').length,
          very_low: typeResults.filter(r => r.flexible_service?.confidence === 'very_low').length
        }
      };
    }
  });
  
  return analysis;
}

export default router;
