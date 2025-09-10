import { Router } from 'express';
import { FlexibleSkuMatchingService } from '../services/FlexibleSkuMatchingService';
import { CompleteSkuMatchingService } from '../services/CompleteSkuMatchingService';
import { logger } from '../utils/logger';

const router = Router();

// Initialize services
const flexibleService = new FlexibleSkuMatchingService();
const originalService = new CompleteSkuMatchingService();

// Test cases to analyze different scenarios
const ANALYSIS_TEST_CASES = [
  {
    name: 'Standard Samsung S23',
    imei: '357123456789001',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Carrier unlocked device',
    expected_behavior: 'Both services should find matches',
    test_category: 'standard_case'
  },
  {
    name: 'Samsung S23 with Uncommon Capacity',
    imei: '357123456789002',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '64GB',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Uncommon capacity - might not be in SKU master',
    expected_behavior: 'Flexible should handle better than original',
    test_category: 'uncommon_data'
  },
  {
    name: 'Samsung S23 with Missing Capacity',
    imei: '357123456789003',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '',
    color: 'Black',
    carrier: 'UNLOCKED',
    device_notes: 'Missing capacity data',
    expected_behavior: 'Flexible should handle partial data better',
    test_category: 'partial_data'
  },
  {
    name: 'Samsung S23 with Uncommon Color',
    imei: '357123456789004',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Rainbow',
    carrier: 'UNLOCKED',
    device_notes: 'Uncommon color - might not be in SKU master',
    expected_behavior: 'Flexible should handle better than original',
    test_category: 'uncommon_data'
  },
  {
    name: 'Samsung S23 with Legacy Carrier',
    imei: '357123456789005',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '128GB',
    color: 'Black',
    carrier: 'SPRINT',
    device_notes: 'Legacy carrier - might not be in SKU master',
    expected_behavior: 'Flexible should handle legacy carriers better',
    test_category: 'legacy_data'
  },
  {
    name: 'Samsung S23 with Multiple Missing Fields',
    imei: '357123456789006',
    brand: 'Samsung',
    model: 'Galaxy S23',
    capacity: '',
    color: '',
    carrier: '',
    device_notes: 'Multiple missing fields',
    expected_behavior: 'Both should handle insufficient data',
    test_category: 'insufficient_data'
  },
  {
    name: 'iPhone 14 Standard',
    imei: '357123456789007',
    brand: 'Apple',
    model: 'iPhone 14',
    capacity: '128GB',
    color: 'Blue',
    carrier: 'UNLOCKED',
    device_notes: 'Standard iPhone case',
    expected_behavior: 'Both services should find matches',
    test_category: 'standard_case'
  },
  {
    name: 'Google Pixel 7',
    imei: '357123456789008',
    brand: 'Google',
    model: 'Pixel 7',
    capacity: '128GB',
    color: 'Obsidian',
    carrier: 'UNLOCKED',
    device_notes: 'Google Pixel device',
    expected_behavior: 'Both services should find matches',
    test_category: 'standard_case'
  }
];

// GET /api/sku-matching-analysis/compare-methods - Compare the two SKU matching methods
router.get('/compare-methods', async (req, res) => {
  try {
    logger.info('🔍 Starting SKU matching method comparison analysis');
    
    // Initialize services
    await flexibleService.initialize();
    await originalService.initialize();
    
    const analysis = {
      summary: {
        total_tests: ANALYSIS_TEST_CASES.length,
        flexible_wins: 0,
        original_wins: 0,
        ties: 0,
        flexible_improvements: 0,
        original_improvements: 0,
        no_matches_both: 0
      },
      method_comparison: {
        flexible_approach: {
          name: 'Flexible SKU Matching Service',
          description: 'Enhanced matching with fuzzy logic, partial matching, and flexible scoring',
          key_features: [
            'Fuzzy matching for model names',
            'Partial data handling',
            'Flexible scoring system',
            'Multiple matching strategies',
            'Lower minimum score threshold (30)',
            'Tag-based matching',
            'Normalization cache'
          ],
          strengths: [
            'Handles partial data better',
            'More flexible with uncommon values',
            'Better at finding matches for edge cases',
            'Lower threshold for matching'
          ],
          weaknesses: [
            'May produce more false positives',
            'Complex logic might be harder to debug',
            'Performance might be slower'
          ]
        },
        original_approach: {
          name: 'Complete SKU Matching Service',
          description: 'Traditional exact matching with strict criteria and higher thresholds',
          key_features: [
            'Exact matching for most fields',
            'Strict data validation',
            'Higher minimum score threshold (50)',
            'CTE-based SQL queries',
            'Confidence-based filtering',
            'Postfix filtering'
          ],
          strengths: [
            'High accuracy for exact matches',
            'Clear, predictable results',
            'Better performance',
            'Lower false positive rate'
          ],
          weaknesses: [
            'Strict with partial data',
            'May miss matches for edge cases',
            'Higher threshold might exclude valid matches'
          ]
        }
      },
      detailed_results: [] as any[],
      improvements_analysis: {
        flexible_improvements: [] as string[],
        original_improvements: [] as string[],
        common_issues: [] as string[]
      }
    };
    
    // Test each case
    for (const testCase of ANALYSIS_TEST_CASES) {
      try {
        logger.info(`🔍 Analyzing: ${testCase.name}`);
        
        const deviceData = {
          imei: testCase.imei,
          brand: testCase.brand,
          model: testCase.model,
          capacity: testCase.capacity,
          color: testCase.color,
          carrier: testCase.carrier,
          device_notes: testCase.device_notes,
          original_sku: `TEST-${testCase.imei}`
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
        
        // Analyze results
        const flexibleHasMatches = (flexibleResult.matches?.length || 0) > 0;
        const originalHasMatches = (originalResult.matches?.length || 0) > 0;
        const flexibleBestScore = flexibleResult.matches?.[0]?.totalScore || 0;
        const originalBestScore = originalResult.matches?.[0]?.totalScore || 0;
        
        // Determine winner
        let winner = 'tie';
        let improvement_reason = '';
        
        if (flexibleHasMatches && !originalHasMatches) {
          winner = 'flexible';
          improvement_reason = 'Found matches where original service found none';
          analysis.summary.flexible_wins++;
          analysis.summary.flexible_improvements++;
        } else if (!flexibleHasMatches && originalHasMatches) {
          winner = 'original';
          improvement_reason = 'Found matches where flexible service found none';
          analysis.summary.original_wins++;
          analysis.summary.original_improvements++;
        } else if (flexibleHasMatches && originalHasMatches) {
          if (flexibleBestScore > originalBestScore) {
            winner = 'flexible';
            improvement_reason = `Better score: ${flexibleBestScore} vs ${originalBestScore}`;
            analysis.summary.flexible_wins++;
            analysis.summary.flexible_improvements++;
          } else if (originalBestScore > flexibleBestScore) {
            winner = 'original';
            improvement_reason = `Better score: ${originalBestScore} vs ${flexibleBestScore}`;
            analysis.summary.original_wins++;
            analysis.summary.original_improvements++;
          } else {
            winner = 'tie';
            improvement_reason = 'Similar scores';
            analysis.summary.ties++;
          }
        } else {
          winner = 'no_matches';
          improvement_reason = 'Neither service found matches';
          analysis.summary.no_matches_both++;
        }
        
        // Create detailed result
        const result = {
          test_case: {
            name: testCase.name,
            category: testCase.test_category,
            expected_behavior: testCase.expected_behavior,
            input_data: deviceData
          },
          flexible_result: {
            has_matches: flexibleHasMatches,
            total_matches: flexibleResult.matches?.length || 0,
            best_score: flexibleBestScore,
            confidence: flexibleResult.confidence,
            requires_attention: flexibleResult.requiresAttention || false,
            no_match_reason: flexibleResult.noMatchReason,
            best_match: flexibleResult.matches?.[0] || null,
            all_matches: flexibleResult.matches || []
          },
          original_result: {
            has_matches: originalHasMatches,
            total_matches: originalResult.matches?.length || 0,
            best_score: originalBestScore,
            confidence: originalResult.matches?.[0]?.confidence || 'unknown',
            requires_attention: originalResult.requiresAttention || false,
            no_match_reason: (originalResult as any).noMatchReason,
            best_match: originalResult.matches?.[0] || null,
            all_matches: originalResult.matches || []
          },
          analysis: {
            winner: winner,
            improvement_reason: improvement_reason,
            flexible_advantages: [] as string[],
            original_advantages: [] as string[],
            issues_identified: [] as string[],
            recommendations: [] as string[]
          }
        };
        
        // Analyze advantages and issues
        if (flexibleHasMatches && !originalHasMatches) {
          result.analysis.flexible_advantages.push('Found matches where original service found none');
          result.analysis.issues_identified.push('Original service too strict for this case');
          result.analysis.recommendations.push('Consider lowering original service threshold or improving fuzzy matching');
        }
        
        if (!flexibleHasMatches && originalHasMatches) {
          result.analysis.original_advantages.push('Found matches where flexible service found none');
          result.analysis.issues_identified.push('Flexible service may be too permissive or has logic issues');
          result.analysis.recommendations.push('Review flexible service matching logic');
        }
        
        if (flexibleHasMatches && originalHasMatches) {
          if (flexibleBestScore > originalBestScore) {
            result.analysis.flexible_advantages.push(`Better matching score: ${flexibleBestScore} vs ${originalBestScore}`);
          } else if (originalBestScore > flexibleBestScore) {
            result.analysis.original_advantages.push(`Better matching score: ${originalBestScore} vs ${flexibleBestScore}`);
          }
        }
        
        if (!flexibleResult.requiresAttention && originalResult.requiresAttention) {
          result.analysis.flexible_advantages.push('Requires less manual attention');
        }
        
        if (flexibleResult.requiresAttention && !originalResult.requiresAttention) {
          result.analysis.original_advantages.push('Requires less manual attention');
        }
        
        // Check for specific issues
        if (testCase.test_category === 'partial_data' && !flexibleHasMatches && !originalHasMatches) {
          result.analysis.issues_identified.push('Both services struggle with partial data');
          result.analysis.recommendations.push('Implement better partial data handling');
        }
        
        if (testCase.test_category === 'uncommon_data' && !flexibleHasMatches && !originalHasMatches) {
          result.analysis.issues_identified.push('Both services struggle with uncommon data values');
          result.analysis.recommendations.push('Add more flexible matching for uncommon values');
        }
        
        if (testCase.test_category === 'legacy_data' && !flexibleHasMatches && !originalHasMatches) {
          result.analysis.issues_identified.push('Both services struggle with legacy data');
          result.analysis.recommendations.push('Add support for legacy carriers and data formats');
        }
        
        analysis.detailed_results.push(result);
        
      } catch (error) {
        logger.error(`❌ Error analyzing ${testCase.name}:`, error);
        analysis.detailed_results.push({
          test_case: {
            name: testCase.name,
            category: testCase.test_category,
            expected_behavior: testCase.expected_behavior,
            input_data: {
              imei: testCase.imei,
              brand: testCase.brand,
              model: testCase.model,
              capacity: testCase.capacity,
              color: testCase.color,
              carrier: testCase.carrier,
              device_notes: testCase.device_notes,
              original_sku: `TEST-${testCase.imei}`
            }
          },
          error: error instanceof Error ? error.message : 'Unknown error',
          flexible_result: null,
          original_result: null,
          analysis: null
        });
      }
    }
    
    // Generate overall improvements analysis
    const flexibleWins = analysis.detailed_results.filter(r => r.analysis?.winner === 'flexible').length;
    const originalWins = analysis.detailed_results.filter(r => r.analysis?.winner === 'original').length;
    
    if (flexibleWins > originalWins) {
      analysis.improvements_analysis.flexible_improvements.push(`Flexible service wins ${flexibleWins} vs ${originalWins} cases`);
    } else if (originalWins > flexibleWins) {
      analysis.improvements_analysis.original_improvements.push(`Original service wins ${originalWins} vs ${flexibleWins} cases`);
    }
    
    // Analyze common issues
    const partialDataIssues = analysis.detailed_results.filter(r => 
      r.analysis?.issues_identified?.some((issue: string) => issue.includes('partial data'))
    ).length;
    
    if (partialDataIssues > 0) {
      analysis.improvements_analysis.common_issues.push(`${partialDataIssues} cases had partial data handling issues`);
    }
    
    const uncommonDataIssues = analysis.detailed_results.filter(r => 
      r.analysis?.issues_identified?.some((issue: string) => issue.includes('uncommon data'))
    ).length;
    
    if (uncommonDataIssues > 0) {
      analysis.improvements_analysis.common_issues.push(`${uncommonDataIssues} cases had uncommon data handling issues`);
    }
    
    const legacyDataIssues = analysis.detailed_results.filter(r => 
      r.analysis?.issues_identified?.some((issue: string) => issue.includes('legacy data'))
    ).length;
    
    if (legacyDataIssues > 0) {
      analysis.improvements_analysis.common_issues.push(`${legacyDataIssues} cases had legacy data handling issues`);
    }
    
    logger.info(`📊 Analysis completed: Flexible ${flexibleWins} wins vs Original ${originalWins} wins`);
    
    res.json({
      success: true,
      message: 'SKU matching method comparison completed',
      analysis: analysis,
      recommendations: {
        overall: flexibleWins > originalWins ? 
          'Flexible service shows better performance overall' : 
          'Original service shows better performance overall',
        specific_improvements: [
          'Review cases where neither service found matches',
          'Consider hybrid approach combining both methods',
          'Implement better partial data handling',
          'Add support for legacy data formats',
          'Optimize performance for both services'
        ]
      }
    });
    
  } catch (error) {
    logger.error('❌ Error in SKU matching method comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare SKU matching methods',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sku-matching-analysis/query-comparison - Compare the actual SQL queries used
router.get('/query-comparison', async (req, res) => {
  try {
    logger.info('🔍 Analyzing SQL query differences between services');
    
    const queryAnalysis = {
      flexible_service_queries: {
        description: 'Flexible service uses multiple query strategies',
        main_approach: 'Tag-based matching with fuzzy logic',
        key_features: [
          'Normalization cache for performance',
          'Multiple matching strategies',
          'Fuzzy matching for model names',
          'Partial data handling',
          'Lower score thresholds'
        ],
        advantages: [
          'More flexible matching',
          'Better handling of edge cases',
          'Faster with cached normalization data'
        ],
        disadvantages: [
          'More complex logic',
          'May produce false positives',
          'Requires more memory for caching'
        ]
      },
      original_service_queries: {
        description: 'Original service uses CTE-based exact matching',
        main_approach: 'Common Table Expression (CTE) with strict criteria',
        key_features: [
          'CTE-based SQL queries',
          'Exact matching for most fields',
          'Higher score thresholds',
          'Confidence-based filtering',
          'Postfix filtering'
        ],
        advantages: [
          'Clear, predictable results',
          'High accuracy for exact matches',
          'Better performance for standard cases',
          'Lower false positive rate'
        ],
        disadvantages: [
          'Strict with partial data',
          'May miss matches for edge cases',
          'Higher threshold might exclude valid matches'
        ]
      },
      query_differences: {
        flexible_vs_original: [
          'Flexible uses tag-based matching vs Original uses CTE queries',
          'Flexible has lower minScore (30) vs Original has higher minScore (50)',
          'Flexible uses fuzzy matching vs Original uses exact matching',
          'Flexible handles partial data vs Original requires complete data',
          'Flexible uses normalization cache vs Original queries database directly'
        ],
        performance_implications: [
          'Flexible may be slower due to complex logic but faster with cache hits',
          'Original may be faster for standard cases but slower for edge cases',
          'Flexible uses more memory for caching',
          'Original uses more database queries'
        ]
      }
    };
    
    res.json({
      success: true,
      message: 'SQL query comparison completed',
      query_analysis: queryAnalysis
    });
    
  } catch (error) {
    logger.error('❌ Error in query comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare queries',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
