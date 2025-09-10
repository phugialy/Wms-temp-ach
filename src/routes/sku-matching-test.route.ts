import { Router } from 'express';
import { Pool } from 'pg';
import { CompleteSkuMatchingService } from '../services/CompleteSkuMatchingService';
import { logger } from '../utils/logger';

const router = Router();
const pool = new Pool({
  connectionString: process.env['DIRECT_URL'],
  connectionTimeoutMillis: 10000,
});

// Initialize SKU matching service
const skuMatchingService = new CompleteSkuMatchingService();

// Test data from SKU master for verification
const TEST_DEVICES = [
  // Samsung Galaxy S23 Series
  {
    imei: 'TEST001',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    expected_sku_pattern: 'S23',
    test_category: 'Samsung S23 Series'
  },
  {
    imei: 'TEST002',
    brand: 'Samsung',
    model: 'Galaxy S23 Ultra',
    capacity: '256GB',
    color: 'Green',
    carrier: 'VERIZON',
    device_notes: 'Verizon locked device',
    expected_sku_pattern: 'S23-ULTRA',
    test_category: 'Samsung S23 Ultra'
  },
  {
    imei: 'TEST003',
    brand: 'Samsung',
    model: 'Galaxy S23+',
    capacity: '512GB',
    color: 'White',
    carrier: 'T-MOBILE',
    device_notes: 'T-Mobile locked device',
    expected_sku_pattern: 'S23-PLUS',
    test_category: 'Samsung S23 Plus'
  },
  
  // Samsung Galaxy S24 Series
  {
    imei: 'TEST004',
    brand: 'Samsung',
    model: 'Galaxy S24',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    expected_sku_pattern: 'S24',
    test_category: 'Samsung S24 Series'
  },
  {
    imei: 'TEST005',
    brand: 'Samsung',
    model: 'Galaxy S24 Ultra',
    capacity: '1TB',
    color: 'Titanium',
    carrier: 'AT&T',
    device_notes: 'AT&T locked device',
    expected_sku_pattern: 'S24-ULTRA',
    test_category: 'Samsung S24 Ultra'
  },
  
  // Samsung Galaxy S25 Series (New Models)
  {
    imei: 'TEST006',
    brand: 'Samsung',
    model: 'Galaxy S25',
    capacity: '256GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    expected_sku_pattern: 'S25',
    test_category: 'Samsung S25 Series'
  },
  {
    imei: 'TEST007',
    brand: 'Samsung',
    model: 'Galaxy S25 Ultra',
    capacity: '512GB',
    color: 'Titanium',
    carrier: 'VERIZON',
    device_notes: 'Verizon locked device',
    expected_sku_pattern: 'S25-ULTRA',
    test_category: 'Samsung S25 Ultra'
  },
  
  // Samsung Tablets
  {
    imei: 'TEST008',
    brand: 'Samsung',
    model: 'Galaxy Tab S8',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'WiFi only tablet',
    expected_sku_pattern: 'TAB-S8',
    test_category: 'Samsung Tablets'
  },
  {
    imei: 'TEST009',
    brand: 'Samsung',
    model: 'Galaxy Tab S9 Ultra',
    capacity: '256GB',
    color: 'Silver',
    carrier: 'UNLOCKED',
    device_notes: 'WiFi only tablet',
    expected_sku_pattern: 'TAB-S9-ULTRA',
    test_category: 'Samsung Tablets'
  },
  
  // iPhone Series
  {
    imei: 'TEST010',
    brand: 'Apple',
    model: 'iPhone 14',
    capacity: '128GB',
    color: 'Blue',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    expected_sku_pattern: 'IPHONE-14',
    test_category: 'iPhone Series'
  },
  {
    imei: 'TEST011',
    brand: 'Apple',
    model: 'iPhone 15 Pro',
    capacity: '256GB',
    color: 'Natural Titanium',
    carrier: 'VERIZON',
    device_notes: 'Verizon locked device',
    expected_sku_pattern: 'IPHONE-15-PRO',
    test_category: 'iPhone Series'
  },
  
  // Edge Cases - Problematic Data
  {
    imei: 'TEST012',
    brand: 'Samsung',
    model: 'Galaxy S23', // Exact match but different capacity
    capacity: '64GB', // Uncommon capacity
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    expected_sku_pattern: 'S23',
    test_category: 'Edge Cases - Uncommon Capacity'
  },
  {
    imei: 'TEST013',
    brand: 'Samsung',
    model: 'Galaxy S23', // Exact match but different color
    capacity: '128GB',
    color: 'Rainbow', // Uncommon color
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    expected_sku_pattern: 'S23',
    test_category: 'Edge Cases - Uncommon Color'
  },
  {
    imei: 'TEST014',
    brand: 'Samsung',
    model: 'Galaxy S23', // Exact match but different carrier
    capacity: '128GB',
    color: 'Black',
    carrier: 'SPRINT', // Legacy carrier
    device_notes: 'Sprint locked device',
    expected_sku_pattern: 'S23',
    test_category: 'Edge Cases - Legacy Carrier'
  },
  
  // Insufficient Data Cases
  {
    imei: 'TEST015',
    brand: 'Samsung',
    model: '', // Missing model
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    expected_sku_pattern: null,
    test_category: 'Insufficient Data - Missing Model'
  },
  {
    imei: 'TEST016',
    brand: '', // Missing brand
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    expected_sku_pattern: null,
    test_category: 'Insufficient Data - Missing Brand'
  },
  {
    imei: 'TEST017',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '', // Missing capacity
    color: '', // Missing color
    carrier: '', // Missing carrier
    device_notes: 'Carrier unlocked device',
    expected_sku_pattern: null,
    test_category: 'Insufficient Data - Multiple Missing Fields'
  }
];

// POST /api/sku-matching-test/run-comprehensive-test - Run comprehensive SKU matching test
router.post('/run-comprehensive-test', async (req, res) => {
  try {
    logger.info('🧪 Starting comprehensive SKU matching test');
    
    // Initialize the service if not already done
    await skuMatchingService.initialize();
    
    const testResults = {
      summary: {
        totalTests: TEST_DEVICES.length,
        passed: 0,
        failed: 0,
        warnings: 0,
        errors: 0
      },
      results: [] as any[],
      issues: [] as string[],
      recommendations: [] as string[]
    };
    
    // Test each device
    for (const testDevice of TEST_DEVICES) {
      try {
        logger.info(`🔍 Testing device: ${testDevice.imei} (${testDevice.test_category})`);
        
        const matchResult = await skuMatchingService.matchImeiToSku({
          imei: testDevice.imei,
          brand: testDevice.brand,
          model: testDevice.model,
          capacity: testDevice.capacity,
          color: testDevice.color,
          carrier: testDevice.carrier,
          device_notes: testDevice.device_notes,
          original_sku: `TEST-${testDevice.imei}`
        }, {
          filterPostfix: true,
          minScore: 50,
          maxResults: 5
        });
        
        const result = {
          imei: testDevice.imei,
          test_category: testDevice.test_category,
          input_data: {
            brand: testDevice.brand,
            model: testDevice.model,
            capacity: testDevice.capacity,
            color: testDevice.color,
            carrier: testDevice.carrier,
            device_notes: testDevice.device_notes
          },
          expected_sku_pattern: testDevice.expected_sku_pattern,
          actual_matches: matchResult.matches || [],
          best_match: matchResult.matches?.[0] || null,
          requires_attention: matchResult.requiresAttention || false,
          test_status: 'unknown',
          issues: [] as string[],
          recommendations: [] as string[]
        };
        
        // Analyze the result
        if (testDevice.expected_sku_pattern === null) {
          // Expected no match (insufficient data)
          if (matchResult.matches.length === 0) {
            result.test_status = 'passed';
            result.recommendations.push('Correctly identified as insufficient data');
            testResults.summary.passed++;
          } else {
            result.test_status = 'failed';
            result.issues.push('Expected no match due to insufficient data, but got matches');
            testResults.summary.failed++;
          }
        } else {
          // Expected a match
          if (matchResult.matches.length === 0) {
            result.test_status = 'failed';
            result.issues.push('Expected match but got no results');
            testResults.summary.failed++;
          } else {
            const bestMatch = matchResult.matches[0];
            const skuCode = bestMatch.sku?.sku_code || '';
            const score = bestMatch.totalScore || 0;
            
            // Check if the SKU code contains the expected pattern
            if (skuCode.toLowerCase().includes(testDevice.expected_sku_pattern.toLowerCase())) {
              result.test_status = 'passed';
              result.recommendations.push(`Correctly matched to ${skuCode} with score ${score}`);
              testResults.summary.passed++;
            } else {
              result.test_status = 'failed';
              result.issues.push(`Expected pattern '${testDevice.expected_sku_pattern}' not found in '${skuCode}'`);
              testResults.summary.failed++;
            }
            
            // Check score quality
            if (score < 70) {
              result.test_status = result.test_status === 'passed' ? 'warning' : result.test_status;
              result.issues.push(`Low confidence score: ${score} (expected >= 70)`);
              testResults.summary.warnings++;
            }
            
            // Check for multiple matches (potential ambiguity)
            if (matchResult.matches.length > 1) {
              const scoreDiff = matchResult.matches[0].totalScore - matchResult.matches[1].totalScore;
              if (scoreDiff < 10) {
                result.issues.push(`Ambiguous match: top 2 scores are close (${scoreDiff} difference)`);
              }
            }
          }
        }
        
        // Check for attention requirements
        if (matchResult.requiresAttention) {
          result.issues.push('Requires manual attention');
        }
        
        testResults.results.push(result);
        
      } catch (error) {
        logger.error(`❌ Error testing device ${testDevice.imei}:`, error);
        testResults.results.push({
          imei: testDevice.imei,
          test_category: testDevice.test_category,
          test_status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          issues: ['Test execution failed']
        });
        testResults.summary.errors++;
      }
    }
    
    // Generate overall analysis
    const accuracy = (testResults.summary.passed / testResults.summary.totalTests) * 100;
    
    if (accuracy < 80) {
      testResults.issues.push(`Low accuracy: ${accuracy.toFixed(1)}% (expected >= 80%)`);
    }
    
    if (testResults.summary.warnings > 0) {
      testResults.issues.push(`${testResults.summary.warnings} tests had low confidence scores`);
    }
    
    // Generate recommendations
    testResults.recommendations.push('Review CTE query logic for edge cases');
    testResults.recommendations.push('Consider adjusting confidence thresholds');
    testResults.recommendations.push('Implement fallback matching strategies');
    testResults.recommendations.push('Add more comprehensive test data');
    
    logger.info(`🎯 Test completed: ${testResults.summary.passed}/${testResults.summary.totalTests} passed (${accuracy.toFixed(1)}%)`);
    
    res.json({
      success: true,
      message: 'Comprehensive SKU matching test completed',
      test_results: testResults,
      accuracy_percentage: accuracy
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

// POST /api/sku-matching-test/test-specific-device - Test a specific device
router.post('/test-specific-device', async (req, res): Promise<void> => {
  try {
    const { imei, brand, model, capacity, color, carrier, device_notes } = req.body;
    
    if (!imei || !brand || !model) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: imei, brand, model'
      });
    }
    
    logger.info(`🔍 Testing specific device: ${imei}`);
    
    // Initialize the service if not already done
    await skuMatchingService.initialize();
    
    const matchResult = await skuMatchingService.matchImeiToSku({
      imei,
      brand,
      model,
      capacity: capacity || '',
      color: color || '',
      carrier: carrier || '',
      device_notes: device_notes || '',
      original_sku: `TEST-${imei}`
    }, {
      filterPostfix: true,
      minScore: 50,
      maxResults: 10
    });
    
    // Get SKU master data for comparison
    const skuMasterQuery = await pool.query(`
      SELECT sku_code, brand, model, capacity, color, carrier, device_type, is_active
      FROM sku_master 
      WHERE is_active = true 
      AND (
        LOWER(brand) ILIKE '%' || LOWER($1) || '%' OR
        LOWER(model) ILIKE '%' || LOWER($2) || '%' OR
        LOWER(sku_code) ILIKE '%' || LOWER($2) || '%'
      )
      ORDER BY sku_code
      LIMIT 20
    `, [brand, model]);
    
    res.json({
      success: true,
      message: 'Device test completed',
      input_data: {
        imei,
        brand,
        model,
        capacity,
        color,
        carrier,
        device_notes
      },
      match_result: matchResult,
      available_skus: skuMasterQuery.rows,
      analysis: {
        total_matches: matchResult.matches?.length || 0,
        best_score: matchResult.matches?.[0]?.totalScore || 0,
        requires_attention: matchResult.requiresAttention || false,
        confidence_level: matchResult.matches?.[0]?.confidence || 'unknown'
      }
    });
    
  } catch (error) {
    logger.error('❌ Error testing specific device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test specific device',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sku-matching-test/sku-master-analysis - Analyze SKU master data
router.get('/sku-master-analysis', async (req, res) => {
  try {
    logger.info('📊 Analyzing SKU master data');
    
    // Get comprehensive SKU master analysis
    const analysis = await pool.query(`
      WITH sku_analysis AS (
        SELECT 
          brand,
          model,
          device_type,
          COUNT(*) as sku_count,
          COUNT(DISTINCT capacity) as capacity_variants,
          COUNT(DISTINCT color) as color_variants,
          COUNT(DISTINCT carrier) as carrier_variants,
          MIN(sku_code) as sample_sku,
          MAX(LENGTH(sku_code)) as max_sku_length,
          MIN(LENGTH(sku_code)) as min_sku_length
        FROM sku_master 
        WHERE is_active = true
        GROUP BY brand, model, device_type
      ),
      brand_analysis AS (
        SELECT 
          brand,
          COUNT(*) as total_skus,
          COUNT(DISTINCT model) as model_count,
          COUNT(DISTINCT device_type) as device_type_count
        FROM sku_master 
        WHERE is_active = true
        GROUP BY brand
      ),
      data_quality AS (
        SELECT 
          COUNT(*) as total_skus,
          COUNT(CASE WHEN brand IS NULL OR brand = '' THEN 1 END) as missing_brand,
          COUNT(CASE WHEN model IS NULL OR model = '' THEN 1 END) as missing_model,
          COUNT(CASE WHEN capacity IS NULL OR capacity = '' THEN 1 END) as missing_capacity,
          COUNT(CASE WHEN color IS NULL OR color = '' THEN 1 END) as missing_color,
          COUNT(CASE WHEN carrier IS NULL OR carrier = '' THEN 1 END) as missing_carrier
        FROM sku_master 
        WHERE is_active = true
      )
      SELECT 
        (SELECT json_agg(sku_analysis) FROM sku_analysis) as sku_breakdown,
        (SELECT json_agg(brand_analysis) FROM brand_analysis) as brand_breakdown,
        (SELECT row_to_json(data_quality) FROM data_quality) as data_quality
    `);
    
    const result = analysis.rows[0];
    
    res.json({
      success: true,
      message: 'SKU master analysis completed',
      analysis: result,
      summary: {
        total_skus: result.data_quality.total_skus,
        brands: result.brand_breakdown?.length || 0,
        models: result.sku_breakdown?.length || 0,
        data_quality_score: calculateDataQualityScore(result.data_quality)
      }
    });
    
  } catch (error) {
    logger.error('❌ Error analyzing SKU master data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze SKU master data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to calculate data quality score
function calculateDataQualityScore(dataQuality: any): number {
  const total = dataQuality.total_skus;
  const missing = dataQuality.missing_brand + dataQuality.missing_model + 
                  dataQuality.missing_capacity + dataQuality.missing_color + 
                  dataQuality.missing_carrier;
  
  return Math.round(((total * 5 - missing) / (total * 5)) * 100);
}

export default router;
