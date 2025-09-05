
const ApiProcessingLogger = require('./src/services/ApiProcessingLogger.js');

async function showProcessingDashboard() {
  console.log('📊 API Processing Dashboard');
  console.log('============================');
  
  try {
    // Get recent logs
    const recentLogs = await ApiProcessingLogger.getRecentLogs(10);
    
    console.log('\n📋 Recent Processing Logs:');
    console.log('Batch ID | Source | Items | Status | Triggered | Duration');
    console.log('---------|--------|-------|--------|-----------|---------');
    
    recentLogs.forEach(log => {
      const duration = log.processing_duration_ms ? `${log.processing_duration_ms}ms` : 'N/A';
      console.log(`${log.batch_id} | ${log.request_source} | ${log.items_count} | ${log.status} | ${log.processing_triggered ? 'YES' : 'NO'} | ${duration}`);
    });
    
    // Get statistics
    const stats = await ApiProcessingLogger.getProcessingStats();
    
    if (stats) {
      console.log('\n📊 Processing Statistics (Last 24 Hours):');
      console.log(`Total Requests: ${stats.total_requests}`);
      console.log(`Completed: ${stats.completed_requests}`);
      console.log(`Failed: ${stats.failed_requests}`);
      console.log(`Processing: ${stats.processing_requests}`);
      console.log(`Triggered: ${stats.triggered_requests}`);
      console.log(`Avg Processing Time: ${Math.round(stats.avg_processing_time_ms || 0)}ms`);
      console.log(`Total Items Processed: ${stats.total_items_processed || 0}`);
      console.log(`Total Items Failed: ${stats.total_items_failed || 0}`);
    }
    
  } catch (error) {
    console.error('❌ Error showing dashboard:', error.message);
  }
}

// Run dashboard
showProcessingDashboard();
