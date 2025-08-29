const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

class BulkSkuMatcher {
  constructor() {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: false
    });
    this.skuService = new SkuMatchingService();
    this.stats = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      improved: 0,
      unchanged: 0,
      errors: []
    };
  }

  async connect() {
    await this.client.connect();
    console.log('🔗 Connected to database');
  }

  async disconnect() {
    await this.client.end();
    console.log('🔌 Disconnected from database');
  }

  async getDevicesForProcessing(limit = 1000) {
    try {
      // Check if connection is still alive
      if (this.client.connection && this.client.connection.stream.destroyed) {
        console.log('🔄 Reconnecting to database...');
        await this.client.end();
        await this.connect();
      }

      const query = `
        SELECT 
          imei,
          original_sku,
          sku_matched,
          match_score,
          match_method,
          brand,
          model,
          capacity,
          color,
          carrier,
          device_notes,
          data_completeness,
          last_activity
        FROM sku_matching_view 
        WHERE data_completeness = 'complete'
          AND imei IS NOT NULL
          AND brand IS NOT NULL
          AND model IS NOT NULL
        ORDER BY last_activity DESC
        LIMIT $1
      `;
      
      const result = await this.client.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting devices:', error.message);
      throw error;
    }
  }

  async processDevice(device) {
    try {
      // Prepare device data for SKU matching
      const matchingData = {
        brand: device.brand,
        model: device.model,
        capacity: device.capacity,
        color: device.color,
        carrier: device.carrier,
        device_notes: device.device_notes,
        imei: device.imei
      };

      // Find best matching SKU with improved logic
      const newMatch = await this.skuService.findBestMatchingSku(matchingData);
      
      if (!newMatch) {
        this.stats.failed++;
        return {
          imei: device.imei,
          status: 'no_match',
          old_sku: device.sku_matched,
          new_sku: null,
          old_score: device.match_score,
          new_score: 0,
          improvement: false
        };
      }

      // Compare with previous match
      const oldScore = device.match_score || 0;
      const newScore = newMatch.match_score;
      const oldSku = device.sku_matched;
      const newSku = newMatch.sku_code;
      
      const isImproved = newScore > oldScore || 
                        (newScore === oldScore && oldSku !== newSku) ||
                        (!oldSku && newSku);

      // Update database
      await this.updateDeviceMatch(device.imei, newMatch);

      if (isImproved) {
        this.stats.improved++;
      } else {
        this.stats.unchanged++;
      }

      this.stats.successful++;

      return {
        imei: device.imei,
        status: 'success',
        old_sku: oldSku,
        new_sku: newSku,
        old_score: oldScore,
        new_score: newScore,
        improvement: isImproved,
        match_method: newMatch.match_method,
        carrier_override: newMatch.carrier_override
      };

    } catch (error) {
      this.stats.failed++;
      this.stats.errors.push({
        imei: device.imei,
        error: error.message
      });
      
      return {
        imei: device.imei,
        status: 'error',
        error: error.message
      };
    }
  }

  async updateDeviceMatch(imei, match) {
    const query = `
      UPDATE sku_matching_view 
      SET 
        sku_matched = $1,
        match_score = $2,
        match_method = $3,
        match_status = 'matched',
        match_notes = $4,
        match_processed_at = NOW()
      WHERE imei = $5
    `;

    const matchNotes = match.carrier_override ? 
      `Carrier override: ${match.carrier_override.original_carrier} → ${match.carrier_override.effective_carrier}` : 
      'Improved matching logic applied';

    await this.client.query(query, [
      match.sku_code,
      match.match_score,
      match.match_method,
      matchNotes,
      imei
    ]);
  }

  async processBatch(batchSize = 100) {
    console.log(`\n🚀 Starting bulk SKU matching process...`);
    console.log(`📊 Batch size: ${batchSize}`);
    
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const devices = await this.getDevicesForProcessing(batchSize);
      
      if (devices.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`\n📦 Processing batch ${Math.floor(offset / batchSize) + 1} (${devices.length} devices)`);
      
      this.stats.total += devices.length;

      // Process devices in parallel (with concurrency limit)
      const concurrency = 10;
      const results = [];
      
      for (let i = 0; i < devices.length; i += concurrency) {
        const batch = devices.slice(i, i + concurrency);
        const batchPromises = batch.map(device => this.processDevice(device));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Progress update
        this.stats.processed += batch.length;
        const progress = ((this.stats.processed / this.stats.total) * 100).toFixed(1);
        console.log(`   📈 Progress: ${this.stats.processed}/${this.stats.total} (${progress}%)`);
      }

      // Log batch results
      const batchImproved = results.filter(r => r.improvement).length;
      const batchErrors = results.filter(r => r.status === 'error').length;
      
      console.log(`   ✅ Improved: ${batchImproved}`);
      console.log(`   ⚠️  Errors: ${batchErrors}`);

      // Show some examples of improvements
      const improvements = results.filter(r => r.improvement).slice(0, 3);
      if (improvements.length > 0) {
        console.log(`   🎯 Sample improvements:`);
        improvements.forEach(imp => {
          console.log(`      ${imp.imei}: ${imp.old_sku || 'NONE'} → ${imp.new_sku} (${(imp.old_score * 100).toFixed(1)}% → ${(imp.new_score * 100).toFixed(1)}%)`);
        });
      }

      offset += devices.length;
      
      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.stats;
  }

  async generateReport() {
    console.log(`\n📊 BULK PROCESSING COMPLETE`);
    console.log(`================================`);
    console.log(`📈 Total devices processed: ${this.stats.total}`);
    console.log(`✅ Successful matches: ${this.stats.successful}`);
    console.log(`🎯 Improved matches: ${this.stats.improved}`);
    console.log(`➡️  Unchanged matches: ${this.stats.unchanged}`);
    console.log(`❌ Failed matches: ${this.stats.failed}`);
    
    if (this.stats.improved > 0) {
      const improvementRate = ((this.stats.improved / this.stats.total) * 100).toFixed(1);
      console.log(`📈 Improvement rate: ${improvementRate}%`);
    }

    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      this.stats.errors.slice(0, 5).forEach(error => {
        console.log(`   ${error.imei}: ${error.error}`);
      });
      if (this.stats.errors.length > 5) {
        console.log(`   ... and ${this.stats.errors.length - 5} more errors`);
      }
    }

    // Save detailed report to file
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      summary: {
        total_processed: this.stats.total,
        successful_matches: this.stats.successful,
        improved_matches: this.stats.improved,
        unchanged_matches: this.stats.unchanged,
        failed_matches: this.stats.failed,
        improvement_rate: this.stats.total > 0 ? ((this.stats.improved / this.stats.total) * 100).toFixed(1) + '%' : '0%'
      }
    };

    const fs = require('fs');
    const reportFile = `bulk-sku-matching-report-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportFile}`);
  }
}

async function runBulkMatching() {
  const matcher = new BulkSkuMatcher();
  
  try {
    await matcher.connect();
    
    // Get command line arguments
    const args = process.argv.slice(2);
    const batchSize = parseInt(args[0]) || 100;
    const limit = parseInt(args[1]) || 1000;
    
    console.log(`🔧 Bulk SKU Matching Configuration:`);
    console.log(`   Batch size: ${batchSize}`);
    console.log(`   Total limit: ${limit}`);
    
    // Process devices
    const stats = await matcher.processBatch(batchSize);
    
    // Generate report
    await matcher.generateReport();
    
  } catch (error) {
    console.error('❌ Error in bulk processing:', error);
  } finally {
    await matcher.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  runBulkMatching();
}

module.exports = BulkSkuMatcher;
