import { Router } from 'express';
import { performanceTest } from '../tests/performance-comparison.test';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Run quick performance test
 */
router.post('/quick-test', async (req, res): Promise<void> => {
  try {
    logger.info('Starting quick performance test');
    
    await performanceTest.runQuickTest();
    
    res.json({
      success: true,
      message: 'Quick performance test completed. Check logs for results.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error in quick performance test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run quick performance test'
    });
  }
});

/**
 * Run comprehensive performance comparison
 */
router.post('/full-comparison', async (req, res): Promise<void> => {
  try {
    logger.info('Starting comprehensive performance comparison');
    
    await performanceTest.runPerformanceComparison();
    
    res.json({
      success: true,
      message: 'Comprehensive performance comparison completed. Check logs for detailed results.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error in comprehensive performance comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run comprehensive performance comparison'
    });
  }
});

/**
 * Test super optimized service with custom data
 */
router.post('/test-super-optimized', async (req, res): Promise<void> => {
  try {
    const { itemCount = 100 } = req.body;
    
    logger.info(`Testing super optimized service with ${itemCount} items`);
    
    // Generate test data
    const testData = [];
    for (let i = 0; i < itemCount; i++) {
      testData.push({
        raw_data: {
          imei: `test_imei_${i}_${Date.now()}`,
          brand: 'Samsung',
          model: `Galaxy S${20 + (i % 5)}`,
          capacity: `${64 + (i % 3) * 64}GB`,
          color: ['Black', 'White', 'Blue'][i % 3],
          carrier: ['Unlocked', 'Verizon', 'AT&T'][i % 3],
          working: 'YES',
          location: 'Test Location'
        },
        source: 'test' as const
      });
    }
    
    const startTime = performance.now();
    
    // Import and test the super optimized service
    const SuperOptimizedQueueService = (await import('../services/super-optimized-queue.service')).default;
    const result = await SuperOptimizedQueueService.addToQueue(testData);
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    const msPerRecord = processingTime / itemCount;
    const recordsPerSecond = itemCount / (processingTime / 1000);
    const targetAchieved = msPerRecord <= 50;
    
    res.json({
      success: true,
      results: {
        itemCount,
        processingTime: Math.round(processingTime),
        msPerRecord: Math.round(msPerRecord * 100) / 100,
        recordsPerSecond: Math.round(recordsPerSecond * 100) / 100,
        targetAchieved,
        method: result.method,
        added: result.added,
        errors: result.errors.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error testing super optimized service:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test super optimized service'
    });
  }
});

export default router;
