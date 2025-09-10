import { Router } from 'express';
import { ImprovedSkuMatchingService } from '../services/ImprovedSkuMatchingService';
import { CompleteSkuMatchingService } from '../services/CompleteSkuMatchingService';
import { logger } from '../utils/logger';

const router = Router();

// Initialize both services for comparison
const improvedService = new ImprovedSkuMatchingService();
const originalService = new CompleteSkuMatchingService();

// Test data for comparison
const COMPARISON_TEST_DATA = [
  {
    imei: 'COMP001',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Samsung S23 - Standard Case'
  },
  {
    imei: 'COMP002',
    brand: 'Samsung',
    model: 'Galaxy S23 Ultra',
    capacity: '256GB',
    color: 'Green',
    carrier: 'VERIZON',
    device_notes: 'Verizon locked device',
    test_name: 'Samsung S23 Ultra - Carrier Locked'
  },
  {
    imei: 'COMP003',
    brand: 'Samsung',
    model: 'Galaxy S24',
    capacity: '512GB',
    color: 'Titanium',
    carrier: 'T-MOBILE',
    device_notes: 'T-Mobile locked device',
    test_name: 'Samsung S24 - New Model'
  },
  {
    imei: 'COMP004',
    brand: 'Samsung',
    model: 'Galaxy S25',
    capacity: '256GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Samsung S25 - Latest Model'
  },
  {
    imei: 'COMP005',
    brand: 'Samsung',
    model: 'Galaxy Tab S8',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'WiFi only tablet',
    test_name: 'Samsung Tab S8 - Tablet'
  },
  {
    imei: 'COMP006',
    brand: 'Apple',
    model: 'iPhone 14',
    capacity: '128GB',
    color: 'Blue',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'iPhone 14 - Apple Device'
  },
  {
    imei: 'COMP007',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '64GB', // Uncommon capacity
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Samsung S23 - Uncommon Capacity'
  },
  {
    imei: 'COMP008',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Rainbow', // Uncommon color
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Samsung S23 - Uncommon Color'
  },
  {
    imei: 'COMP009',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'SPRINT', // Legacy carrier
    device_notes: 'Sprint locked device',
    test_name: 'Samsung S23 - Legacy Carrier'
  },
  {
    imei: 'COMP010',
    brand: 'Samsung',
    model: '', // Missing model
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    test_name: 'Samsung - Missing Model'
  }
];

// POST /api/improved-sku-matching-test/compare-services - Compare original vs improved service
router.post('/compare-services', async (req, res) => {
  try {
    logger.info('🔄 Starting service comparison test');
    
    // Initialize both services
    await improvedService.initialize();
    await originalService.initialize();
    
    const comparisonResults = {
      summary: {
        totalTests: COMPARISON_TEST_DATA.length,
        improvedWins: 0,
        originalWins: 0,
        ties: 0,
        improvedAccuracy: 0,
        originalAccuracy: 0
      },
      detailedResults: [] as any[],
      improvements: [] as string[],
      issues: [] as string[]
    };
    
    // Test each device with both services
    for (const testDevice of COMPARISON_TEST_DATA) {
      try {
        logger.info(`🔍 Comparing services for: ${testDevice.test_name}`);
        
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
        
        // Test with improved service
        const improvedResult = await improvedService.matchImeiToSku(deviceData, {
          filterPostfix: true,
          minScore: 50,
          maxResults: 5
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
          input_data: deviceData,
          improved_service: {
            matches: improvedResult.matches || [],
            best_match: improvedResult.matches?.[0] || null,
            best_score: improvedResult.matches?.[0]?.totalScore || 0,
            requires_attention: improvedResult.requiresAttention || false,
            no_match_reason: improvedResult.noMatchReason
          },
          original_service: {
            matches: originalResult.matches || [],
            best_match: originalResult.matches?.[0] || null,
            best_score: originalResult.matches?.[0]?.totalScore || 0,
            requires_attention: originalResult.requiresAttention || false,
            no_match_reason: (originalResult as any).noMatchReason
          },
          comparison: {
            improved_has_matches: (improvedResult.matches?.length || 0) > 0,
            original_has_matches: (originalResult.matches?.length || 0) > 0,
            improved_better_score: (improvedResult.matches?.[0]?.totalScore || 0) > (originalResult.matches?.[0]?.totalScore || 0),
            original_better_score: (originalResult.matches?.[0]?.totalScore || 0) > (improvedResult.matches?.[0]?.totalScore || 0),
            improved_less_attention: !improvedResult.requiresAttention && originalResult.requiresAttention,
            original_less_attention: !originalResult.requiresAttention && improvedResult.requiresAttention
          },
          winner: 'tie',
          analysis: [] as string[]
        };
        
        // Determine winner
        if (result.comparison.improved_has_matches && !result.comparison.original_has_matches) {
          result.winner = 'improved';
          result.analysis.push('Improved service found matches where original did not');
          comparisonResults.summary.improvedWins++;
        } else if (!result.comparison.improved_has_matches && result.comparison.original_has_matches) {
          result.winner = 'original';
          result.analysis.push('Original service found matches where improved did not');
          comparisonResults.summary.originalWins++;
        } else if (result.comparison.improved_has_matches && result.comparison.original_has_matches) {
          if (result.comparison.improved_better_score) {
            result.winner = 'improved';
            result.analysis.push(`Improved service has better score: ${result.improved_service.best_score} vs ${result.original_service.best_score}`);
            comparisonResults.summary.improvedWins++;
          } else if (result.comparison.original_better_score) {
            result.winner = 'original';
            result.analysis.push(`Original service has better score: ${result.original_service.best_score} vs ${result.improved_service.best_score}`);
            comparisonResults.summary.originalWins++;
          } else {
            result.winner = 'tie';
            result.analysis.push('Both services have similar scores');
            comparisonResults.summary.ties++;
          }
        } else {
          result.winner = 'tie';
          result.analysis.push('Neither service found matches');
          comparisonResults.summary.ties++;
        }
        
        // Check attention requirements
        if (result.comparison.improved_less_attention) {
          result.analysis.push('Improved service requires less manual attention');
        } else if (result.comparison.original_less_attention) {
          result.analysis.push('Original service requires less manual attention');
        }
        
        comparisonResults.detailedResults.push(result);
        
      } catch (error) {
        logger.error(`❌ Error comparing services for ${testDevice.test_name}:`, error);
        comparisonResults.detailedResults.push({
          test_name: testDevice.test_name,
          error: error instanceof Error ? error.message : 'Unknown error',
          winner: 'error'
        });
      }
    }
    
    // Calculate accuracy
    const improvedAccuracy = (comparisonResults.summary.improvedWins / comparisonResults.summary.totalTests) * 100;
    const originalAccuracy = (comparisonResults.summary.originalWins / comparisonResults.summary.totalTests) * 100;
    
    comparisonResults.summary.improvedAccuracy = improvedAccuracy;
    comparisonResults.summary.originalAccuracy = originalAccuracy;
    
    // Generate analysis
    if (improvedAccuracy > originalAccuracy) {
      comparisonResults.improvements.push(`Improved service shows ${(improvedAccuracy - originalAccuracy).toFixed(1)}% better accuracy`);
    } else if (originalAccuracy > improvedAccuracy) {
      comparisonResults.issues.push(`Original service shows ${(originalAccuracy - improvedAccuracy).toFixed(1)}% better accuracy`);
    }
    
    // Check for specific improvements
    const improvedFoundMoreMatches = comparisonResults.detailedResults.filter(r => 
      r.comparison?.improved_has_matches && !r.comparison?.original_has_matches
    ).length;
    
    if (improvedFoundMoreMatches > 0) {
      comparisonResults.improvements.push(`Improved service found matches for ${improvedFoundMoreMatches} additional cases`);
    }
    
    const improvedBetterScores = comparisonResults.detailedResults.filter(r => 
      r.comparison?.improved_better_score
    ).length;
    
    if (improvedBetterScores > 0) {
      comparisonResults.improvements.push(`Improved service has better scores for ${improvedBetterScores} cases`);
    }
    
    logger.info(`🎯 Comparison completed: Improved ${improvedAccuracy.toFixed(1)}% vs Original ${originalAccuracy.toFixed(1)}%`);
    
    res.json({
      success: true,
      message: 'Service comparison completed',
      comparison_results: comparisonResults,
      recommendation: improvedAccuracy > originalAccuracy ? 
        'Improved service shows better performance' : 
        'Original service shows better performance'
    });
    
  } catch (error) {
    logger.error('❌ Error running service comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run service comparison',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/improved-sku-matching-test/test-improved-only - Test only the improved service
router.post('/test-improved-only', async (req, res): Promise<void> => {
  try {
    const { imei, brand, model, capacity, color, carrier, device_notes } = req.body;
    
    if (!imei || !brand || !model) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: imei, brand, model'
      });
    }
    
    logger.info(`🔍 Testing improved service with device: ${imei}`);
    
    await improvedService.initialize();
    
    const matchResult = await improvedService.matchImeiToSku({
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
    
    res.json({
      success: true,
      message: 'Improved service test completed',
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
        requires_attention: matchResult.requiresAttention || false,
        confidence_level: matchResult.matches?.[0]?.confidence || 'unknown',
        data_completeness: matchResult.matches?.[0]?.dataCompleteness || 0
      }
    });
    
  } catch (error) {
    logger.error('❌ Error testing improved service:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test improved service',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/improved-sku-matching-test/performance-test - Run performance comparison
router.get('/performance-test', async (req, res) => {
  try {
    logger.info('⚡ Starting performance comparison test');
    
    await improvedService.initialize();
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
    
    const iterations = 10;
    const results = {
      improved_service: {
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
    
    // Test improved service
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await improvedService.matchImeiToSku(testDevice, {
        filterPostfix: true,
        minScore: 50,
        maxResults: 5
      });
      const endTime = performance.now();
      results.improved_service.times.push(endTime - startTime);
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
    results.improved_service.average_time = results.improved_service.times.reduce((a, b) => a + b, 0) / iterations;
    results.improved_service.min_time = Math.min(...results.improved_service.times);
    results.improved_service.max_time = Math.max(...results.improved_service.times);
    
    results.original_service.average_time = results.original_service.times.reduce((a, b) => a + b, 0) / iterations;
    results.original_service.min_time = Math.min(...results.original_service.times);
    results.original_service.max_time = Math.max(...results.original_service.times);
    
    const performanceImprovement = ((results.original_service.average_time - results.improved_service.average_time) / results.original_service.average_time) * 100;
    
    res.json({
      success: true,
      message: 'Performance test completed',
      results,
      performance_improvement: performanceImprovement,
      recommendation: performanceImprovement > 0 ? 
        `Improved service is ${performanceImprovement.toFixed(1)}% faster` :
        `Original service is ${Math.abs(performanceImprovement).toFixed(1)}% faster`
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
