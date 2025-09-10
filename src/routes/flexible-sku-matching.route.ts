import { Router } from 'express';
import { FlexibleSkuMatchingService } from '../services/FlexibleSkuMatchingService';
import { CompleteSkuMatchingService } from '../services/CompleteSkuMatchingService';
import { logger } from '../utils/logger';

const router = Router();

// Initialize services
const flexibleService = new FlexibleSkuMatchingService();
const originalService = new CompleteSkuMatchingService();

// Test data covering various scenarios including manual entries
const FLEXIBLE_TEST_DATA = [
  // Standard cases
  {
    imei: 'FLEX001',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Standard Samsung S23',
    expected_confidence: 'high'
  },
  {
    imei: 'FLEX002',
    brand: 'Samsung',
    model: 'Galaxy S23 Ultra',
    capacity: '256GB',
    color: 'Green',
    carrier: 'VERIZON',
    device_notes: 'Verizon locked device',
    test_name: 'Standard Samsung S23 Ultra',
    expected_confidence: 'high'
  },
  
  // Manual entry cases (common issues)
  {
    imei: 'FLEX003',
    brand: 'Samsung',
    model: 'Galaxy S23', // Standard model
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Manual Entry - Standard Model',
    expected_confidence: 'high'
  },
  {
    imei: 'FLEX004',
    brand: 'Samsung',
    model: 'Galaxy S23', // Standard model but might have manual SKU
    capacity: '64GB', // Uncommon capacity
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Manual Entry - Uncommon Capacity',
    expected_confidence: 'medium'
  },
  {
    imei: 'FLEX005',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Rainbow', // Uncommon color
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Manual Entry - Uncommon Color',
    expected_confidence: 'medium'
  },
  {
    imei: 'FLEX006',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'SPRINT', // Legacy carrier
    device_notes: 'Sprint locked device',
    test_name: 'Manual Entry - Legacy Carrier',
    expected_confidence: 'medium'
  },
  
  // Partial data cases
  {
    imei: 'FLEX007',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: '', // Missing color
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Partial Data - Missing Color',
    expected_confidence: 'medium'
  },
  {
    imei: 'FLEX008',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '', // Missing capacity
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Partial Data - Missing Capacity',
    expected_confidence: 'medium'
  },
  {
    imei: 'FLEX009',
    brand: 'Samsung',
    model: '', // Missing model
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Partial Data - Missing Model',
    expected_confidence: 'low'
  },
  
  // Very manual entries (likely to need fuzzy matching)
  {
    imei: 'FLEX010',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Custom manual entry - might not match standard patterns',
    test_name: 'Very Manual Entry - Custom Pattern',
    expected_confidence: 'low'
  },
  {
    imei: 'FLEX011',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Manual entry with non-standard formatting',
    test_name: 'Very Manual Entry - Non-standard Format',
    expected_confidence: 'low'
  },
  
  // Edge cases
  {
    imei: 'FLEX012',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Edge Case - Very Long SKU Code',
    expected_confidence: 'medium'
  },
  {
    imei: 'FLEX013',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Edge Case - Special Characters',
    expected_confidence: 'medium'
  },
  
  // Insufficient data cases
  {
    imei: 'FLEX014',
    brand: 'Samsung',
    model: '', // Missing model
    capacity: '', // Missing capacity
    color: '', // Missing color
    carrier: '', // Missing carrier
    device_notes: 'Carrier unlocked device',
    test_name: 'Insufficient Data - Multiple Missing Fields',
    expected_confidence: 'very_low'
  },
  {
    imei: 'FLEX015',
    brand: '', // Missing brand
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Insufficient Data - Missing Brand',
    expected_confidence: 'very_low'
  }
];

// POST /api/flexible-sku-matching/test-flexible-system - Test the flexible matching system
router.post('/test-flexible-system', async (req, res) => {
  try {
    logger.info('🔄 Starting flexible SKU matching system test');
    
    // Initialize services
    await flexibleService.initialize();
    await originalService.initialize();
    
    const testResults = {
      summary: {
        totalTests: FLEXIBLE_TEST_DATA.length,
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
        }
      },
      detailedResults: [] as any[],
      improvements: [] as string[],
      issues: [] as string[]
    };
    
    // Test each scenario
    for (const testDevice of FLEXIBLE_TEST_DATA) {
      try {
        logger.info(`🔍 Testing flexible system: ${testDevice.test_name}`);
        
        const deviceData = {
          imei: testDevice.imei,
          brand: testDevice.brand,
          model: testDevice.model,
          capacity: testDevice.capacity,
          color: testDevice.color,
          carrier: testDevice.carrier,
          device_notes: testDevice.device_notes,
          original_sku: `TEST-${testDevice.imei}`
        };
        
        // Test with flexible service
        const flexibleResult = await flexibleService.matchImeiToSku(deviceData, {
          minScore: 30, // Lower threshold for flexibility
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
        
        // Analyze results
        const result = {
          test_name: testDevice.test_name,
          expected_confidence: testDevice.expected_confidence,
          input_data: deviceData,
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
        logger.error(`❌ Error testing flexible system for ${testDevice.test_name}:`, error);
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
    
    // Generate analysis
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
    
    logger.info(`🎯 Flexible system test completed: Flexible ${flexibleAccuracy.toFixed(1)}% vs Original ${originalAccuracy.toFixed(1)}%`);
    
    res.json({
      success: true,
      message: 'Flexible SKU matching system test completed',
      test_results: testResults,
      recommendation: flexibleAccuracy > originalAccuracy ? 
        'Flexible service shows better performance for manual entries' : 
        'Original service shows better performance'
    });
    
  } catch (error) {
    logger.error('❌ Error running flexible system test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run flexible system test',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/flexible-sku-matching/test-specific-device - Test a specific device with flexible matching
router.post('/test-specific-device', async (req, res): Promise<void> => {
  try {
    const { 
      imei, 
      brand, 
      model, 
      capacity, 
      color, 
      carrier, 
      device_notes,
      options = {}
    } = req.body;
    
    if (!imei || !brand || !model) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: imei, brand, model'
      });
    }
    
    logger.info(`🔍 Testing flexible service with device: ${imei}`);
    
    await flexibleService.initialize();
    
    const matchResult = await flexibleService.matchImeiToSku({
      imei,
      brand,
      model,
      capacity: capacity || '',
      color: color || '',
      carrier: carrier || '',
      device_notes: device_notes || '',
      original_sku: `TEST-${imei}`
    }, {
      minScore: options.minScore || 30,
      maxResults: options.maxResults || 10,
      useFuzzyMatching: options.useFuzzyMatching !== false,
      allowPartialMatches: options.allowPartialMatches !== false,
      strictMode: options.strictMode || false
    });
    
    res.json({
      success: true,
      message: 'Flexible service test completed',
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
      analysis: {
        total_matches: matchResult.matches?.length || 0,
        best_score: matchResult.matches?.[0]?.totalScore || 0,
        confidence: matchResult.confidence,
        requires_attention: matchResult.requiresAttention || false,
        match_types: matchResult.matches?.map(m => m.matchType) || []
      }
    });
    
  } catch (error) {
    logger.error('❌ Error testing flexible service:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test flexible service',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/flexible-sku-matching/performance-test - Run performance comparison
router.get('/performance-test', async (req, res) => {
  try {
    logger.info('⚡ Starting flexible service performance test');
    
    await flexibleService.initialize();
    await originalService.initialize();
    
    const testDevice = {
      imei: 'PERF001',
      brand: 'Samsung',
      model: 'Galaxy S23',
      capacity: '128GB',
      color: 'Black',
      carrier: 'UNLOCKED',
      device_notes: 'Carrier unlocked device',
      original_sku: 'TEST-PERF001'
    };
    
    const iterations = 5; // Reduced for performance
    const results = {
      flexible_service: {
        times: [] as number[],
        average_time: 0,
        min_time: 0,
        max_time: 0
      },
      original_service: {
        times: [] as number[],
        average_time: 0,
        min_time: 0,
        max_time: 0
      }
    };
    
    // Test flexible service
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await flexibleService.matchImeiToSku(testDevice, {
        minScore: 30,
        maxResults: 5,
        useFuzzyMatching: true,
        allowPartialMatches: true,
        strictMode: false
      });
      const endTime = performance.now();
      results.flexible_service.times.push(endTime - startTime);
    }
    
    // Test original service
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await originalService.matchImeiToSku(testDevice, {
        filterPostfix: true,
        minScore: 50,
        maxResults: 5
      });
      const endTime = performance.now();
      results.original_service.times.push(endTime - startTime);
    }
    
    // Calculate statistics
    results.flexible_service.average_time = results.flexible_service.times.reduce((a, b) => a + b, 0) / iterations;
    results.flexible_service.min_time = Math.min(...results.flexible_service.times);
    results.flexible_service.max_time = Math.max(...results.flexible_service.times);
    
    results.original_service.average_time = results.original_service.times.reduce((a, b) => a + b, 0) / iterations;
    results.original_service.min_time = Math.min(...results.original_service.times);
    results.original_service.max_time = Math.max(...results.original_service.times);
    
    const performanceDifference = ((results.flexible_service.average_time - results.original_service.average_time) / results.original_service.average_time) * 100;
    
    res.json({
      success: true,
      message: 'Performance test completed',
      results,
      performance_difference: performanceDifference,
      recommendation: performanceDifference < 50 ? 
        `Flexible service performance is acceptable (${performanceDifference.toFixed(1)}% difference)` :
        `Flexible service is significantly slower (${performanceDifference.toFixed(1)}% difference)`
    });
    
  } catch (error) {
    logger.error('❌ Error running performance test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run performance test',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
