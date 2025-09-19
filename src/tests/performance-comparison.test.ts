import OptimizedDirectQueueService from '../services/optimized-direct-queue.service';
import SuperOptimizedQueueService from '../services/super-optimized-queue.service';
import { logger } from '../utils/logger';

interface TestResult {
  service: string;
  itemCount: number;
  processingTime: number;
  recordsPerSecond: number;
  success: boolean;
  errors: number;
}

export class PerformanceComparisonTest {
  
  /**
   * Generate test data
   */
  private generateTestData(count: number): any[] {
    const testData = [];
    
    for (let i = 0; i < count; i++) {
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
    
    return testData;
  }

  /**
   * Test optimized service
   */
  private async testOptimizedService(items: any[]): Promise<TestResult> {
    const startTime = performance.now();
    
    try {
      const result = await OptimizedDirectQueueService.addToQueue(items);
      const endTime = performance.now();
      
      return {
        service: 'OptimizedDirectQueueService',
        itemCount: items.length,
        processingTime: endTime - startTime,
        recordsPerSecond: items.length / ((endTime - startTime) / 1000),
        success: result.success,
        errors: result.errors.length
      };
    } catch (error) {
      logger.error('Error testing optimized service', { error });
      return {
        service: 'OptimizedDirectQueueService',
        itemCount: items.length,
        processingTime: 0,
        recordsPerSecond: 0,
        success: false,
        errors: 1
      };
    }
  }

  /**
   * Test super optimized service
   */
  private async testSuperOptimizedService(items: any[]): Promise<TestResult> {
    const startTime = performance.now();
    
    try {
      const result = await SuperOptimizedQueueService.addToQueue(items);
      const endTime = performance.now();
      
      return {
        service: 'SuperOptimizedQueueService',
        itemCount: items.length,
        processingTime: endTime - startTime,
        recordsPerSecond: items.length / ((endTime - startTime) / 1000),
        success: result.success,
        errors: result.errors.length
      };
    } catch (error) {
      logger.error('Error testing super optimized service', { error });
      return {
        service: 'SuperOptimizedQueueService',
        itemCount: items.length,
        processingTime: 0,
        recordsPerSecond: 0,
        success: false,
        errors: 1
      };
    }
  }

  /**
   * Run comprehensive performance comparison
   */
  async runPerformanceComparison(): Promise<void> {
    logger.info('🚀 Starting comprehensive performance comparison');
    
    const testSizes = [1, 10, 50, 100, 200, 500];
    const results: TestResult[] = [];
    
    for (const size of testSizes) {
      logger.info(`📊 Testing with ${size} items`);
      
      // Generate test data
      const testData = this.generateTestData(size);
      
      // Test optimized service
      logger.info(`Testing OptimizedDirectQueueService with ${size} items`);
      const optimizedResult = await this.testOptimizedService(testData);
      results.push(optimizedResult);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test super optimized service
      logger.info(`Testing SuperOptimizedQueueService with ${size} items`);
      const superOptimizedResult = await this.testSuperOptimizedService(testData);
      results.push(superOptimizedResult);
      
      // Delay between different sizes
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Analyze results
    this.analyzeResults(results);
  }

  /**
   * Analyze and display results
   */
  private analyzeResults(results: TestResult[]): void {
    logger.info('📈 Performance Comparison Results');
    logger.info('=====================================');
    
    const optimizedResults = results.filter(r => r.service === 'OptimizedDirectQueueService');
    const superOptimizedResults = results.filter(r => r.service === 'SuperOptimizedQueueService');
    
    logger.info('\n📊 OPTIMIZED SERVICE RESULTS:');
    optimizedResults.forEach(result => {
      logger.info(`${result.itemCount} items: ${result.processingTime.toFixed(2)}ms (${result.recordsPerSecond.toFixed(2)} records/sec)`);
    });
    
    logger.info('\n🚀 SUPER OPTIMIZED SERVICE RESULTS:');
    superOptimizedResults.forEach(result => {
      logger.info(`${result.itemCount} items: ${result.processingTime.toFixed(2)}ms (${result.recordsPerSecond.toFixed(2)} records/sec)`);
    });
    
    // Calculate improvements
    logger.info('\n📈 PERFORMANCE IMPROVEMENTS:');
    for (let i = 0; i < optimizedResults.length; i++) {
      const optimized = optimizedResults[i];
      const superOptimized = superOptimizedResults[i];
      
      if (optimized && superOptimized) {
        const timeImprovement = ((optimized.processingTime - superOptimized.processingTime) / optimized.processingTime) * 100;
        const speedImprovement = ((superOptimized.recordsPerSecond - optimized.recordsPerSecond) / optimized.recordsPerSecond) * 100;
        
        logger.info(`${optimized.itemCount} items: ${timeImprovement.toFixed(1)}% faster, ${speedImprovement.toFixed(1)}% more records/sec`);
      }
    }
    
    // Check if we achieved the target
    const targetMsPerRecord = 50;
    logger.info('\n🎯 TARGET ACHIEVEMENT ANALYSIS:');
    superOptimizedResults.forEach(result => {
      const msPerRecord = result.processingTime / result.itemCount;
      const achieved = msPerRecord <= targetMsPerRecord;
      logger.info(`${result.itemCount} items: ${msPerRecord.toFixed(2)}ms/record ${achieved ? '✅ TARGET ACHIEVED' : '❌ TARGET MISSED'}`);
    });
  }

  /**
   * Run quick performance test
   */
  async runQuickTest(): Promise<void> {
    logger.info('⚡ Running quick performance test');
    
    const testSizes = [10, 50, 100];
    
    for (const size of testSizes) {
      const testData = this.generateTestData(size);
      
      // Test super optimized service only
      const result = await this.testSuperOptimizedService(testData);
      
      const msPerRecord = result.processingTime / result.itemCount;
      const achieved = msPerRecord <= 50;
      
      logger.info(`${size} items: ${msPerRecord.toFixed(2)}ms/record ${achieved ? '✅' : '❌'}`);
    }
  }
}

// Export for use in other files
export const performanceTest = new PerformanceComparisonTest();
