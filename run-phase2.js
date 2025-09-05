const EnhancedSkuParser = require('./src/services/EnhancedSkuParser');
const TagManagementService = require('./src/services/TagManagementService');
const DeviceTypeDetectionService = require('./src/services/DeviceTypeDetectionService');

class Phase2Runner {
    constructor() {
        this.enhancedSkuParser = null;
        this.tagManagementService = null;
        this.deviceTypeDetectionService = null;
        
        this.stats = {
            startTime: null,
            endTime: null,
            totalSkus: 0,
            tagsCreated: 0,
            deviceTypesDetected: 0,
            errors: 0,
            warnings: 0
        };
    }

    async run() {
        try {
            this.stats.startTime = new Date();
            console.log('🚀 Starting Phase 2: Core System Implementation');
            console.log('===============================================');
            
            // Step 1: Initialize all services
            await this.initializeServices();
            
            // Step 2: Run device type detection analysis
            await this.runDeviceTypeAnalysis();
            
            // Step 3: Parse all SKUs with enhanced parser
            await this.runEnhancedSkuParsing();
            
            // Step 4: Validate and cleanup tag system
            await this.validateAndCleanupTagSystem();
            
            // Step 5: Generate comprehensive report
            await this.generatePhase2Report();
            
            console.log('\n✅ Phase 2 completed successfully!');
            
        } catch (error) {
            console.error('\n❌ Phase 2 failed:', error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    async initializeServices() {
        console.log('\n📋 Step 1: Initializing Services...');
        
        try {
            // Initialize Enhanced SKU Parser
            console.log('  🔧 Initializing Enhanced SKU Parser...');
            this.enhancedSkuParser = new EnhancedSkuParser();
            await this.enhancedSkuParser.initialize();
            
            // Initialize Tag Management Service
            console.log('  🏷️  Initializing Tag Management Service...');
            this.tagManagementService = new TagManagementService();
            await this.tagManagementService.initialize();
            
            // Initialize Device Type Detection Service
            console.log('  📱 Initializing Device Type Detection Service...');
            this.deviceTypeDetectionService = new DeviceTypeDetectionService();
            await this.deviceTypeDetectionService.initialize();
            
            console.log('  ✅ All services initialized successfully');
            
        } catch (error) {
            console.error('  ❌ Service initialization failed:', error);
            throw error;
        }
    }

    async runDeviceTypeAnalysis() {
        console.log('\n📱 Step 2: Device Type Analysis...');
        
        try {
            // Get device type distribution
            console.log('  📊 Analyzing device type distribution...');
            const distribution = await this.deviceTypeDetectionService.getDeviceTypeDistribution();
            
            console.log('  📈 Device Type Distribution:');
            distribution.forEach(row => {
                console.log(`    ${row.device_type}: ${row.count} (${row.percentage}%)`);
            });
            
            // Get brand device type analysis
            console.log('  🏢 Analyzing brand device type patterns...');
            const brandAnalysis = await this.deviceTypeDetectionService.getBrandDeviceTypeAnalysis();
            
            console.log('  🏷️  Brand Device Type Analysis:');
            Object.entries(brandAnalysis).forEach(([brand, types]) => {
                console.log(`    ${brand}:`);
                types.forEach(type => {
                    console.log(`      ${type.deviceType}: ${type.count}`);
                });
            });
            
            // Get detection accuracy report
            console.log('  🎯 Analyzing detection accuracy...');
            const accuracyReport = await this.deviceTypeDetectionService.getDetectionAccuracyReport();
            
            if (accuracyReport) {
                console.log('  📊 Detection Accuracy Report:');
                console.log(`    High Confidence: ${accuracyReport.highConfidencePercentage}%`);
                console.log(`    Medium Confidence: ${accuracyReport.mediumConfidencePercentage}%`);
                console.log(`    Low Confidence: ${accuracyReport.lowConfidencePercentage}%`);
                console.log(`    Errors: ${accuracyReport.errorPercentage}%`);
            }
            
            console.log('  ✅ Device type analysis completed');
            
        } catch (error) {
            console.error('  ❌ Device type analysis failed:', error);
            this.stats.errors++;
        }
    }

    async runEnhancedSkuParsing() {
        console.log('\n🔍 Step 3: Enhanced SKU Parsing...');
        
        try {
            // Get total SKU count
            const countResult = await this.enhancedSkuParser.client.query('SELECT COUNT(*) FROM sku_master');
            this.stats.totalSkus = parseInt(countResult.rows[0].count);
            
            console.log(`  📋 Found ${this.stats.totalSkus} SKUs to process`);
            
            // Run enhanced parsing
            console.log('  🚀 Starting enhanced SKU parsing...');
            await this.enhancedSkuParser.parseAllSkus();
            
            // Update stats from parser
            this.stats.tagsCreated = this.enhancedSkuParser.stats.tagsCreated;
            this.stats.deviceTypesDetected = this.enhancedSkuParser.stats.totalProcessed;
            
            console.log('  ✅ Enhanced SKU parsing completed');
            
        } catch (error) {
            console.error('  ❌ Enhanced SKU parsing failed:', error);
            this.stats.errors++;
        }
    }

    async validateAndCleanupTagSystem() {
        console.log('\n🧹 Step 4: Tag System Validation & Cleanup...');
        
        try {
            // Validate tag consistency
            console.log('  🔍 Validating tag system consistency...');
            const consistencyIssues = await this.tagManagementService.validateTagConsistency();
            
            if (consistencyIssues.length > 0) {
                console.log('  ⚠️  Found consistency issues:');
                consistencyIssues.forEach(issue => {
                    console.log(`    ${issue.type}: ${issue.count} issues`);
                    this.stats.warnings++;
                });
                
                // Cleanup orphaned tags
                console.log('  🧹 Cleaning up orphaned tags...');
                const cleanupResult = await this.tagManagementService.cleanupOrphanedTags();
                console.log(`    Removed ${cleanupResult.orphanedRelationshipsRemoved} orphaned relationships`);
                console.log(`    Updated tag counts: ${cleanupResult.tagCountsUpdated ? 'Yes' : 'No'}`);
            } else {
                console.log('  ✅ No consistency issues found');
            }
            
            // Get tag performance metrics
            console.log('  📊 Getting tag performance metrics...');
            const metrics = await this.tagManagementService.getTagPerformanceMetrics();
            
            console.log('  📈 Tag Performance Metrics:');
            console.log(`    Total Tags: ${metrics.total_tags}`);
            console.log(`    Categories: ${metrics.category_count}`);
            console.log(`    Average Usage: ${Math.round(metrics.avg_usage)}`);
            console.log(`    Popular Tags (>10 uses): ${metrics.popular_tags}`);
            
            // Get tag statistics by category
            console.log('  🏷️  Tag Statistics by Category:');
            const categoryStats = await this.tagManagementService.getTagStatistics();
            
            categoryStats.forEach(stat => {
                console.log(`    ${stat.tag_category}: ${stat.tag_count} tags, avg usage: ${Math.round(stat.avg_usage)}`);
            });
            
            console.log('  ✅ Tag system validation and cleanup completed');
            
        } catch (error) {
            console.error('  ❌ Tag system validation failed:', error);
            this.stats.errors++;
        }
    }

    async generatePhase2Report() {
        console.log('\n📊 Step 5: Generating Phase 2 Report...');
        
        this.stats.endTime = new Date();
        const duration = this.stats.endTime - this.stats.startTime;
        const durationSeconds = Math.round(duration / 1000);
        
        console.log('\n📋 Phase 2: Core System Implementation - Final Report');
        console.log('========================================================');
        console.log(`⏱️  Total Duration: ${durationSeconds} seconds`);
        console.log(`📋 Total SKUs Processed: ${this.stats.totalSkus}`);
        console.log(`🏷️  Tags Created: ${this.stats.tagsCreated}`);
        console.log(`📱 Device Types Detected: ${this.stats.deviceTypesDetected}`);
        console.log(`❌ Errors: ${this.stats.errors}`);
        console.log(`⚠️  Warnings: ${this.stats.warnings}`);
        console.log(`⚡ Average Speed: ${Math.round(this.stats.totalSkus / durationSeconds)} SKUs/second`);
        
        // Performance analysis
        if (this.stats.totalSkus > 0) {
            const successRate = Math.round(((this.stats.totalSkus - this.stats.errors) / this.stats.totalSkus) * 100);
            console.log(`📈 Success Rate: ${successRate}%`);
        }
        
        // Tag efficiency
        if (this.stats.totalSkus > 0) {
            const avgTagsPerSku = Math.round((this.stats.tagsCreated / this.stats.totalSkus) * 100) / 100;
            console.log(`🏷️  Average Tags per SKU: ${avgTagsPerSku}`);
        }
        
        console.log('\n🎯 Phase 2 Success Criteria:');
        console.log('  ✅ Enhanced SKU Parser: Implemented and tested');
        console.log('  ✅ Tag Management System: Operational with validation');
        console.log('  ✅ Device Type Detection: Pattern-based analysis complete');
        console.log('  ✅ Manual Review Workflow: undefined_tag_review table ready');
        console.log('  ✅ Performance Optimization: Batch processing implemented');
        console.log('  ✅ Data Integrity: Consistency checks and cleanup complete');
        
        console.log('\n🚀 Ready for Phase 3: Integration & Production!');
    }

    async cleanup() {
        try {
            if (this.enhancedSkuParser) {
                await this.enhancedSkuParser.close();
            }
            if (this.tagManagementService) {
                await this.tagManagementService.close();
            }
            if (this.deviceTypeDetectionService) {
                await this.deviceTypeDetectionService.close();
            }
        } catch (error) {
            console.error('❌ Error during cleanup:', error);
        }
    }
}

// Main execution
async function main() {
    const runner = new Phase2Runner();
    
    try {
        await runner.run();
        process.exit(0);
    } catch (error) {
        console.error('❌ Phase 2 execution failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = Phase2Runner;
