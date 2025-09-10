import { Router } from 'express';
import { FlexibleSkuMatchingService } from '../services/FlexibleSkuMatchingService';
import { CompleteSkuMatchingService } from '../services/CompleteSkuMatchingService';
import { logger } from '../utils/logger';

const router = Router();

// Initialize services
const flexibleService = new FlexibleSkuMatchingService();
const originalService = new CompleteSkuMatchingService();

// Sample test data to show match results
const SAMPLE_TEST_DEVICES = [
  {
    imei: '357123456789001',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    original_sku: 'TEST-S23-001'
  },
  {
    imei: '357123456789002',
    brand: 'Samsung',
    model: 'Galaxy S23 Ultra',
    capacity: '256GB',
    color: 'Green',
    carrier: 'VERIZON',
    device_notes: 'Verizon locked device',
    original_sku: 'TEST-S23U-002'
  },
  {
    imei: '357123456789003',
    brand: 'Apple',
    model: 'iPhone 14',
    capacity: '128GB',
    color: 'Blue',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    original_sku: 'TEST-IP14-003'
  },
  {
    imei: '357123456789004',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '64GB',
    color: 'Rainbow',
    carrier: 'SPRINT',
    device_notes: 'Sprint locked device - uncommon capacity and color',
    original_sku: 'TEST-S23-004'
  },
  {
    imei: '357123456789005',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Missing capacity data',
    original_sku: 'TEST-S23-005'
  }
];

// GET /api/sample-match-results - Show sample match results for easy inspection
router.get('/', async (req, res) => {
  try {
    logger.info('🔍 Generating sample match results for inspection');
    
    // Initialize services
    await flexibleService.initialize();
    await originalService.initialize();
    
    const results = {
      summary: {
        total_samples: SAMPLE_TEST_DEVICES.length,
        flexible_matches: 0,
        original_matches: 0,
        flexible_better: 0,
        original_better: 0,
        ties: 0,
        flexible_match_rate: '0.0',
        original_match_rate: '0.0',
        flexible_win_rate: '0.0',
        original_win_rate: '0.0'
      },
      sample_results: [] as any[]
    };
    
    // Test each sample device
    for (const device of SAMPLE_TEST_DEVICES) {
      try {
        logger.info(`🔍 Testing sample device: ${device.brand} ${device.model} (${device.imei})`);
        
        // Test with flexible service
        const flexibleResult = await flexibleService.matchImeiToSku(device, {
          minScore: 30,
          maxResults: 5,
          useFuzzyMatching: true,
          allowPartialMatches: true,
          strictMode: false
        });
        
        // Test with original service
        const originalResult = await originalService.matchImeiToSku(device, {
          filterPostfix: true,
          minScore: 50,
          maxResults: 5
        });
        
        // Count matches
        const flexibleHasMatches = (flexibleResult.matches?.length || 0) > 0;
        const originalHasMatches = (originalResult.matches?.length || 0) > 0;
        
        if (flexibleHasMatches) results.summary.flexible_matches++;
        if (originalHasMatches) results.summary.original_matches++;
        
        // Determine which is better
        let comparison = 'tie';
        if (flexibleHasMatches && !originalHasMatches) {
          comparison = 'flexible_wins';
          results.summary.flexible_better++;
        } else if (!flexibleHasMatches && originalHasMatches) {
          comparison = 'original_wins';
          results.summary.original_better++;
        } else if (flexibleHasMatches && originalHasMatches) {
          const flexibleScore = flexibleResult.matches?.[0]?.totalScore || 0;
          const originalScore = originalResult.matches?.[0]?.totalScore || 0;
          if (flexibleScore > originalScore) {
            comparison = 'flexible_better_score';
            results.summary.flexible_better++;
          } else if (originalScore > flexibleScore) {
            comparison = 'original_better_score';
            results.summary.original_better++;
          } else {
            comparison = 'tie';
            results.summary.ties++;
          }
        } else {
          results.summary.ties++;
        }
        
        // Create detailed result
        const sampleResult = {
          device_info: {
            imei: device.imei,
            brand: device.brand,
            model: device.model,
            capacity: device.capacity,
            color: device.color,
            carrier: device.carrier,
            device_notes: device.device_notes,
            original_sku: device.original_sku
          },
          flexible_service_result: {
            has_matches: flexibleHasMatches,
            total_matches: flexibleResult.matches?.length || 0,
            best_match: flexibleResult.matches?.[0] || null,
            best_score: flexibleResult.matches?.[0]?.totalScore || 0,
            confidence: flexibleResult.confidence,
            requires_attention: flexibleResult.requiresAttention || false,
            no_match_reason: flexibleResult.noMatchReason,
            all_matches: flexibleResult.matches || []
          },
          original_service_result: {
            has_matches: originalHasMatches,
            total_matches: originalResult.matches?.length || 0,
            best_match: originalResult.matches?.[0] || null,
            best_score: originalResult.matches?.[0]?.totalScore || 0,
            confidence: originalResult.matches?.[0]?.confidence || 'unknown',
            requires_attention: originalResult.requiresAttention || false,
            no_match_reason: (originalResult as any).noMatchReason,
            all_matches: originalResult.matches || []
          },
          comparison: {
            winner: comparison,
            flexible_advantages: [] as string[],
            original_advantages: [] as string[],
            analysis: [] as string[]
          }
        };
        
        // Analyze advantages
        if (flexibleHasMatches && !originalHasMatches) {
          sampleResult.comparison.flexible_advantages.push('Found matches where original service found none');
        }
        if (!flexibleHasMatches && originalHasMatches) {
          sampleResult.comparison.original_advantages.push('Found matches where flexible service found none');
        }
        if (flexibleHasMatches && originalHasMatches) {
          const flexibleScore = flexibleResult.matches?.[0]?.totalScore || 0;
          const originalScore = originalResult.matches?.[0]?.totalScore || 0;
          if (flexibleScore > originalScore) {
            sampleResult.comparison.flexible_advantages.push(`Better score: ${flexibleScore} vs ${originalScore}`);
          } else if (originalScore > flexibleScore) {
            sampleResult.comparison.original_advantages.push(`Better score: ${originalScore} vs ${flexibleScore}`);
          }
        }
        if (!flexibleResult.requiresAttention && originalResult.requiresAttention) {
          sampleResult.comparison.flexible_advantages.push('Requires less manual attention');
        }
        if (flexibleResult.requiresAttention && !originalResult.requiresAttention) {
          sampleResult.comparison.original_advantages.push('Requires less manual attention');
        }
        
        // Add analysis
        if (flexibleResult.confidence) {
          sampleResult.comparison.analysis.push(`Flexible confidence: ${flexibleResult.confidence}`);
        }
        if (originalResult.matches?.[0]?.confidence) {
          sampleResult.comparison.analysis.push(`Original confidence: ${originalResult.matches[0].confidence}`);
        }
        
        results.sample_results.push(sampleResult);
        
      } catch (error) {
        logger.error(`❌ Error testing sample device ${device.imei}:`, error);
        results.sample_results.push({
          device_info: {
            imei: device.imei,
            brand: device.brand,
            model: device.model,
            capacity: device.capacity,
            color: device.color,
            carrier: device.carrier,
            device_notes: device.device_notes,
            original_sku: device.original_sku
          },
          error: error instanceof Error ? error.message : 'Unknown error',
          flexible_service_result: null,
          original_service_result: null,
          comparison: null
        });
      }
    }
    
    // Calculate percentages
    const total = results.summary.total_samples;
    results.summary.flexible_match_rate = total > 0 ? (results.summary.flexible_matches / total * 100).toFixed(1) : '0.0';
    results.summary.original_match_rate = total > 0 ? (results.summary.original_matches / total * 100).toFixed(1) : '0.0';
    results.summary.flexible_win_rate = total > 0 ? (results.summary.flexible_better / total * 100).toFixed(1) : '0.0';
    results.summary.original_win_rate = total > 0 ? (results.summary.original_better / total * 100).toFixed(1) : '0.0';
    
    logger.info(`📊 Sample results generated: Flexible ${results.summary.flexible_match_rate}% vs Original ${results.summary.original_match_rate}%`);
    
    res.json({
      success: true,
      message: 'Sample match results generated successfully',
      results: results,
      instructions: {
        how_to_read: {
          device_info: 'Input device data that was tested',
          flexible_service_result: 'Results from the flexible SKU matching service',
          original_service_result: 'Results from the original SKU matching service',
          comparison: 'Side-by-side comparison and analysis'
        },
        key_fields: {
          has_matches: 'Whether the service found any matching SKUs',
          total_matches: 'Number of SKU matches found',
          best_match: 'The highest scoring SKU match (null if no matches)',
          best_score: 'Score of the best match (0-100)',
          confidence: 'Confidence level: high, medium, low, very_low',
          requires_attention: 'Whether manual review is needed',
          all_matches: 'Complete list of all matches found'
        },
        match_structure: {
          sku_code: 'The matched SKU code from sku_master',
          brand: 'Brand from the matched SKU',
          model: 'Model from the matched SKU',
          capacity: 'Capacity from the matched SKU',
          color: 'Color from the matched SKU',
          carrier: 'Carrier from the matched SKU',
          match_score: 'How well this SKU matches the input device',
          match_method: 'How the match was found (exact, fuzzy, etc.)'
        }
      }
    });
    
  } catch (error) {
    logger.error('❌ Error generating sample match results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate sample match results',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/sample-match-results/test-custom - Test a custom device and show results
router.post('/test-custom', async (req, res) => {
  try {
    const { 
      imei, 
      brand, 
      model, 
      capacity, 
      color, 
      carrier, 
      device_notes 
    } = req.body;
    
    if (!imei || !brand || !model) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: imei, brand, model'
      });
      return;
    }
    
    logger.info(`🔍 Testing custom device: ${brand} ${model} (${imei})`);
    
    // Initialize services
    await flexibleService.initialize();
    await originalService.initialize();
    
    const device = {
      imei,
      brand,
      model,
      capacity: capacity || '',
      color: color || '',
      carrier: carrier || '',
      device_notes: device_notes || '',
      original_sku: `CUSTOM-${imei}`
    };
    
    // Test with flexible service
    const flexibleResult = await flexibleService.matchImeiToSku(device, {
      minScore: 30,
      maxResults: 5,
      useFuzzyMatching: true,
      allowPartialMatches: true,
      strictMode: false
    });
    
    // Test with original service
    const originalResult = await originalService.matchImeiToSku(device, {
      filterPostfix: true,
      minScore: 50,
      maxResults: 5
    });
    
    // Create detailed result
    const result = {
      device_info: {
        imei: device.imei,
        brand: device.brand,
        model: device.model,
        capacity: device.capacity,
        color: device.color,
        carrier: device.carrier,
        device_notes: device.device_notes,
        original_sku: device.original_sku
      },
      flexible_service_result: {
        has_matches: (flexibleResult.matches?.length || 0) > 0,
        total_matches: flexibleResult.matches?.length || 0,
        best_match: flexibleResult.matches?.[0] || null,
        best_score: flexibleResult.matches?.[0]?.totalScore || 0,
        confidence: flexibleResult.confidence,
        requires_attention: flexibleResult.requiresAttention || false,
        no_match_reason: flexibleResult.noMatchReason,
        all_matches: flexibleResult.matches || []
      },
      original_service_result: {
        has_matches: (originalResult.matches?.length || 0) > 0,
        total_matches: originalResult.matches?.length || 0,
        best_match: originalResult.matches?.[0] || null,
        best_score: originalResult.matches?.[0]?.totalScore || 0,
        confidence: originalResult.matches?.[0]?.confidence || 'unknown',
        requires_attention: originalResult.requiresAttention || false,
        no_match_reason: (originalResult as any).noMatchReason,
        all_matches: originalResult.matches || []
      },
      comparison: {
        flexible_advantages: [] as string[],
        original_advantages: [] as string[],
        analysis: [] as string[]
      }
    };
    
    // Analyze results
    const flexibleHasMatches = result.flexible_service_result.has_matches;
    const originalHasMatches = result.original_service_result.has_matches;
    
    if (flexibleHasMatches && !originalHasMatches) {
      result.comparison.flexible_advantages.push('Found matches where original service found none');
    }
    if (!flexibleHasMatches && originalHasMatches) {
      result.comparison.original_advantages.push('Found matches where flexible service found none');
    }
    if (flexibleHasMatches && originalHasMatches) {
      const flexibleScore = result.flexible_service_result.best_score;
      const originalScore = result.original_service_result.best_score;
      if (flexibleScore > originalScore) {
        result.comparison.flexible_advantages.push(`Better score: ${flexibleScore} vs ${originalScore}`);
      } else if (originalScore > flexibleScore) {
        result.comparison.original_advantages.push(`Better score: ${originalScore} vs ${flexibleScore}`);
      }
    }
    if (!result.flexible_service_result.requires_attention && result.original_service_result.requires_attention) {
      result.comparison.flexible_advantages.push('Requires less manual attention');
    }
    if (result.flexible_service_result.requires_attention && !result.original_service_result.requires_attention) {
      result.comparison.original_advantages.push('Requires less manual attention');
    }
    
    // Add analysis
    if (result.flexible_service_result.confidence) {
      result.comparison.analysis.push(`Flexible confidence: ${result.flexible_service_result.confidence}`);
    }
    if (result.original_service_result.confidence) {
      result.comparison.analysis.push(`Original confidence: ${result.original_service_result.confidence}`);
    }
    
    res.json({
      success: true,
      message: 'Custom device test completed',
      result: result,
      instructions: {
        how_to_read: {
          device_info: 'Your input device data',
          flexible_service_result: 'Results from the flexible SKU matching service',
          original_service_result: 'Results from the original SKU matching service',
          comparison: 'Side-by-side comparison and analysis'
        },
        key_fields: {
          has_matches: 'Whether the service found any matching SKUs',
          total_matches: 'Number of SKU matches found',
          best_match: 'The highest scoring SKU match (null if no matches)',
          best_score: 'Score of the best match (0-100)',
          confidence: 'Confidence level: high, medium, low, very_low',
          requires_attention: 'Whether manual review is needed',
          all_matches: 'Complete list of all matches found'
        }
      }
    });
    
  } catch (error) {
    logger.error('❌ Error testing custom device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test custom device',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
