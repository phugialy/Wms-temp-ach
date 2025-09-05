const { Pool } = require('pg');
require('dotenv').config();

class DeviceTypeDetectionService {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        
        // Brand-specific patterns
        this.brandPatterns = new Map();
        
        // Device type indicators
        this.deviceIndicators = {
            PHONE: [
                'PHONE', 'MOBILE', 'CELLULAR', 'SMARTPHONE', 'GALAXY', 'IPHONE', 'PIXEL',
                'S22', 'S23', 'S24', 'NOTE', 'ULTRA', 'PLUS', 'MINI', 'SE', 'PRO'
            ],
            TABLET: [
                'TABLET', 'IPAD', 'TAB', 'GALAXY TAB', 'SURFACE', 'FIRE', 'KINDLE',
                'PRO', 'AIR', 'MINI', 'PLUS', 'ULTRA'
            ],
            WATCH: [
                'WATCH', 'AW', 'APPLE WATCH', 'GALAXY WATCH', 'GEAR', 'SMARTWATCH',
                'SERIES', 'ULTRA', 'SE', 'HERMES', 'NIKE'
            ],
            DESKTOP: [
                'DESKTOP', 'COMPUTER', 'PC', 'MAC', 'IMAC', 'MACBOOK', 'MAC MINI',
                'MAC PRO', 'IMAC PRO', 'STUDIO', 'PRO', 'AIR'
            ],
            LAPTOP: [
                'LAPTOP', 'NOTEBOOK', 'MACBOOK', 'SURFACE', 'CHROMEBOOK', 'ULTRABOOK',
                'PRO', 'AIR', 'PLUS', 'ULTRA'
            ]
        };
        
        // Brand-specific device type mappings
        this.brandDeviceMappings = {
            'APPLE': {
                'IPHONE': 'PHONE',
                'IPAD': 'TABLET',
                'WATCH': 'WATCH',
                'MAC': 'DESKTOP',
                'IMAC': 'DESKTOP',
                'MACBOOK': 'LAPTOP',
                'MAC MINI': 'DESKTOP',
                'MAC PRO': 'DESKTOP',
                'STUDIO': 'DESKTOP'
            },
            'SAMSUNG': {
                'GALAXY': 'PHONE',
                'GALAXY TAB': 'TABLET',
                'TAB': 'TABLET',
                'WATCH': 'WATCH',
                'GEAR': 'WATCH',
                'NOTE': 'PHONE',
                'S': 'PHONE',
                'Z': 'PHONE',
                'FOLD': 'PHONE',
                'FLIP': 'PHONE'
            },
            'GOOGLE': {
                'PIXEL': 'PHONE',
                'PIXEL TABLET': 'TABLET',
                'CHROMEBOOK': 'LAPTOP'
            },
            'MICROSOFT': {
                'SURFACE': 'LAPTOP',
                'SURFACE PRO': 'TABLET',
                'SURFACE GO': 'TABLET',
                'SURFACE STUDIO': 'DESKTOP'
            },
            'LG': {
                'G': 'PHONE',
                'V': 'PHONE',
                'Q': 'PHONE',
                'STYLO': 'PHONE',
                'TAB': 'TABLET'
            },
            'MOTO': {
                'MOTO': 'PHONE',
                'EDGE': 'PHONE',
                'G': 'PHONE',
                'ONE': 'PHONE',
                'TAB': 'TABLET'
            },
            'ONEPLUS': {
                'ONEPLUS': 'PHONE',
                'NORD': 'PHONE'
            }
        };
        
        // Capacity patterns for validation
        this.capacityPatterns = [
            /^\d+GB$/i,
            /^\d+TB$/i,
            /^\d+MB$/i,
            /^\d+KB$/i,
            /^\d+$/  // Plain numbers (assumed to be GB)
        ];
        
        // Color patterns for validation
        this.colorPatterns = [
            'BLACK', 'WHITE', 'BLUE', 'RED', 'GREEN', 'GOLD', 'SILVER', 'ROSE', 
            'PURPLE', 'ORANGE', 'YELLOW', 'PINK', 'BROWN', 'GRAY', 'GREY',
            'PHANTOM', 'MIDNIGHT', 'ALPINE', 'SIERRA', 'STARLIGHT', 'SPACE',
            'NATURAL', 'TITANIUM', 'GRAPHITE', 'PACIFIC', 'COSMIC'
        ];
        
        // Carrier patterns for validation
        this.carrierPatterns = [
            '4G', '5G', 'LTE', 'CDMA', 'GSM', 'WIFI', 'GLOBAL', 'INTERNATIONAL',
            'VERIZON', 'AT&T', 'T-MOBILE', 'SPRINT', 'UNLOCKED', 'CARRIER'
        ];
    }

    async initialize() {
        try {
            // Verify tables exist
            await this.verifyTablesExist();
            
            // Initialize brand patterns from database
            await this.initializeBrandPatterns();
            
            console.log('✅ Device Type Detection Service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Device Type Detection Service:', error);
            throw error;
        }
    }

    async verifyTablesExist() {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('sku_master', 'sku_tags', 'sku_master_tags')
            `);
            
            if (result.rows.length < 1) {
                throw new Error('Required tables do not exist. Please run Phase 1 migration first.');
            }
        } finally {
            client.release();
        }
    }

    async initializeBrandPatterns() {
        try {
            const client = await this.pool.connect();
            
            // Get all unique brands from sku_master
            const result = await client.query(`
                SELECT DISTINCT brand 
                FROM sku_master 
                WHERE brand IS NOT NULL AND brand != ''
                ORDER BY brand
            `);
            
            client.release();
            
            // Analyze each brand's patterns
            for (const row of result.rows) {
                const brand = row.brand.toUpperCase();
                await this.analyzeBrandPatterns(brand);
            }
            
            console.log(`🔍 Analyzed patterns for ${this.brandPatterns.size} brands`);
            
        } catch (error) {
            console.error('❌ Failed to initialize brand patterns:', error);
            throw error;
        }
    }

    async analyzeBrandPatterns(brand) {
        try {
            const client = await this.pool.connect();
            
            // Get sample SKUs for this brand
            const result = await client.query(`
                SELECT sku_code, model, capacity, color, carrier, post_fix
                FROM sku_master 
                WHERE UPPER(brand) = $1
                ORDER BY id 
                LIMIT 100
            `, [brand]);
            
            client.release();
            
            if (result.rows.length === 0) return;
            
            const brandInfo = {
                totalSkus: result.rows.length,
                patterns: new Map(),
                commonModels: new Map(),
                commonCapacities: new Map(),
                commonColors: new Map(),
                commonCarriers: new Map(),
                deviceTypeDistribution: new Map()
            };
            
            // Analyze each SKU
            for (const row of result.rows) {
                const deviceType = this.detectDeviceTypeFromSku(row, brand);
                const pattern = this.generateSkuPattern(row.sku_code);
                
                // Track device type distribution
                brandInfo.deviceTypeDistribution.set(
                    deviceType, 
                    (brandInfo.deviceTypeDistribution.get(deviceType) || 0) + 1
                );
                
                // Track patterns
                if (!brandInfo.patterns.has(pattern)) {
                    brandInfo.patterns.set(pattern, []);
                }
                brandInfo.patterns.get(pattern).push(row.sku_code);
                
                // Track common values
                if (row.model) {
                    brandInfo.commonModels.set(
                        row.model.toUpperCase(), 
                        (brandInfo.commonModels.get(row.model.toUpperCase()) || 0) + 1
                    );
                }
                
                if (row.capacity) {
                    brandInfo.commonCapacities.set(
                        row.capacity.toUpperCase(), 
                        (brandInfo.commonCapacities.get(row.capacity.toUpperCase()) || 0) + 1
                    );
                }
                
                if (row.color) {
                    brandInfo.commonColors.set(
                        row.color.toUpperCase(), 
                        (brandInfo.commonColors.get(row.color.toUpperCase()) || 0) + 1
                    );
                }
                
                if (row.carrier) {
                    brandInfo.commonCarriers.set(
                        row.carrier.toUpperCase(), 
                        (brandInfo.commonCarriers.get(row.carrier.toUpperCase()) || 0) + 1
                    );
                }
            }
            
            this.brandPatterns.set(brand, brandInfo);
            
        } catch (error) {
            console.error(`❌ Failed to analyze patterns for brand ${brand}:`, error);
        }
    }

    detectDeviceTypeFromSku(skuData, brand) {
        const sku = skuData.sku_code.toUpperCase();
        const model = skuData.model?.toUpperCase() || '';
        
        // Brand-specific detection first
        if (this.brandDeviceMappings[brand]) {
            for (const [modelPattern, deviceType] of Object.entries(this.brandDeviceMappings[brand])) {
                if (sku.includes(modelPattern) || model.includes(modelPattern)) {
                    return deviceType;
                }
            }
        }
        
        // Generic pattern detection
        for (const [deviceType, indicators] of Object.entries(this.deviceIndicators)) {
            for (const indicator of indicators) {
                if (sku.includes(indicator) || model.includes(indicator)) {
                    return deviceType;
                }
            }
        }
        
        // Fallback based on SKU structure
        return this.detectDeviceTypeByStructure(sku);
    }

    detectDeviceTypeByStructure(sku) {
        const segments = this.parseSkuIntoSegments(sku);
        const segmentCount = segments.length;
        
        // Analyze segment characteristics
        const hasNumericSegments = segments.some(seg => /^\d+$/.test(seg));
        const hasAlphaSegments = segments.some(seg => /^[A-Z]+$/.test(seg));
        const hasMixedSegments = segments.some(seg => /^[A-Z0-9]+$/.test(seg));
        
        // Pattern-based detection
        if (segmentCount <= 3 && hasNumericSegments && hasAlphaSegments) {
            return 'PHONE'; // Simple structure like "S22-256-BLK"
        }
        
        if (segmentCount >= 4 && hasMixedSegments) {
            return 'TABLET'; // Complex structure like "IPAD-PRO-9.7-256-ROSE-4G"
        }
        
        if (segmentCount >= 5 && hasAlphaSegments) {
            return 'LAPTOP'; // Very complex structure
        }
        
        // Default fallback
        return 'PHONE';
    }

    generateSkuPattern(sku) {
        const segments = this.parseSkuIntoSegments(sku);
        
        // Generate pattern based on segment types and count
        const segmentTypes = segments.map(segment => {
            if (/^\d+$/.test(segment)) return 'N'; // Number
            if (/^\d+[A-Z]$/.test(segment)) return 'NA'; // Number + Alpha
            if (/^[A-Z]+\d+$/.test(segment)) return 'AN'; // Alpha + Number
            if (/^[A-Z]+$/.test(segment)) return 'A'; // Alpha only
            return 'M'; // Mixed
        });
        
        return `${segments.length}:${segmentTypes.join('')}`;
    }

    parseSkuIntoSegments(sku) {
        // Split by common delimiters but preserve certain patterns
        const segments = [];
        let currentSegment = '';
        
        for (let i = 0; i < sku.length; i++) {
            const char = sku[i];
            
            if (char === '-' || char === '_' || char === ' ') {
                if (currentSegment) {
                    segments.push(currentSegment);
                    currentSegment = '';
                }
            } else if (char === '/' && sku[i + 1] === 'A') {
                // Handle /A suffix as part of segment
                if (currentSegment) {
                    currentSegment += char + sku[i + 1];
                    segments.push(currentSegment);
                    currentSegment = '';
                    i++; // Skip next character
                }
            } else {
                currentSegment += char;
            }
        }
        
        if (currentSegment) {
            segments.push(currentSegment);
        }
        
        return segments.filter(segment => segment.length > 0);
    }

    // Main device type detection method
    async detectDeviceType(skuData) {
        try {
            const brand = skuData.brand?.toUpperCase();
            const sku = skuData.sku_code.toUpperCase();
            const model = skuData.model?.toUpperCase() || '';
            
            // 1. Brand-specific detection (highest priority)
            if (brand && this.brandDeviceMappings[brand]) {
                for (const [modelPattern, deviceType] of Object.entries(this.brandDeviceMappings[brand])) {
                    if (sku.includes(modelPattern) || model.includes(modelPattern)) {
                        return {
                            deviceType,
                            confidence: 'HIGH',
                            method: 'BRAND_SPECIFIC',
                            brand,
                            modelPattern
                        };
                    }
                }
            }
            
            // 2. Pattern-based detection using brand analysis
            if (brand && this.brandPatterns.has(brand)) {
                const brandInfo = this.brandPatterns.get(brand);
                const pattern = this.generateSkuPattern(sku);
                
                if (brandInfo.patterns.has(pattern)) {
                    // Find most common device type for this pattern
                    const patternSkus = brandInfo.patterns.get(pattern);
                    const deviceTypes = patternSkus.map(skuCode => 
                        this.detectDeviceTypeFromSku({ sku_code: skuCode }, brand)
                    );
                    
                    const deviceTypeCounts = {};
                    deviceTypes.forEach(type => deviceTypeCounts[type] = (deviceTypeCounts[type] || 0) + 1);
                    
                    const mostCommonType = Object.keys(deviceTypeCounts).reduce(
                        (a, b) => deviceTypeCounts[a] > deviceTypeCounts[b] ? a : b
                    );
                    
                    return {
                        deviceType: mostCommonType,
                        confidence: 'MEDIUM',
                        method: 'BRAND_PATTERN',
                        brand,
                        pattern
                    };
                }
            }
            
            // 3. Generic indicator detection
            for (const [deviceType, indicators] of Object.entries(this.deviceIndicators)) {
                for (const indicator of indicators) {
                    if (sku.includes(indicator) || model.includes(indicator)) {
                        return {
                            deviceType,
                            confidence: 'MEDIUM',
                            method: 'GENERIC_INDICATOR',
                            indicator
                        };
                    }
                }
            }
            
            // 4. Structural analysis (lowest priority)
            const deviceType = this.detectDeviceTypeByStructure(sku);
            return {
                deviceType,
                confidence: 'LOW',
                method: 'STRUCTURAL_ANALYSIS',
                segmentCount: this.parseSkuIntoSegments(sku).length
            };
            
        } catch (error) {
            console.error('❌ Error in device type detection:', error);
            return {
                deviceType: 'UNKNOWN',
                confidence: 'NONE',
                method: 'ERROR',
                error: error.message
            };
        }
    }

    // Validation methods
    validateCapacity(capacity) {
        if (!capacity) return false;
        
        const upperCapacity = capacity.toUpperCase();
        
        // Check against known patterns
        for (const pattern of this.capacityPatterns) {
            if (pattern.test(upperCapacity)) {
                return true;
            }
        }
        
        // Check if it's a reasonable number (1-2048)
        if (/^\d+$/.test(upperCapacity)) {
            const num = parseInt(upperCapacity);
            return num >= 1 && num <= 2048;
        }
        
        return false;
    }

    validateColor(color) {
        if (!color) return false;
        
        const upperColor = color.toUpperCase();
        
        // Check against known color patterns
        return this.colorPatterns.some(pattern => 
            upperColor.includes(pattern) || pattern.includes(upperColor)
        );
    }

    validateCarrier(carrier) {
        if (!carrier) return false;
        
        const upperCarrier = carrier.toUpperCase();
        
        // Check against known carrier patterns
        return this.carrierPatterns.some(pattern => 
            upperCarrier.includes(pattern) || pattern.includes(upperCarrier)
        );
    }

    // Analysis and reporting methods
    async getDeviceTypeDistribution() {
        try {
            const client = await this.pool.connect();
            
            const result = await client.query(`
                SELECT 
                    device_type,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM sku_master), 2) as percentage
                FROM sku_master 
                WHERE device_type IS NOT NULL
                GROUP BY device_type 
                ORDER BY count DESC
            `);
            
            client.release();
            return result.rows;
            
        } catch (error) {
            console.error('❌ Failed to get device type distribution:', error);
            return [];
        }
    }

    async getBrandDeviceTypeAnalysis() {
        try {
            const client = await this.pool.connect();
            
            const result = await client.query(`
                SELECT 
                    brand,
                    device_type,
                    COUNT(*) as count
                FROM sku_master 
                WHERE brand IS NOT NULL AND device_type IS NOT NULL
                GROUP BY brand, device_type 
                ORDER BY brand, count DESC
            `);
            
            client.release();
            
            // Group by brand
            const analysis = {};
            for (const row of result.rows) {
                if (!analysis[row.brand]) {
                    analysis[row.brand] = [];
                }
                analysis[row.brand].push({
                    deviceType: row.device_type,
                    count: parseInt(row.count)
                });
            }
            
            return analysis;
            
        } catch (error) {
            console.error('❌ Failed to get brand device type analysis:', error);
            return {};
        }
    }

    async getDetectionAccuracyReport() {
        try {
            const client = await this.pool.connect();
            
            // Get SKUs with device types
            const result = await client.query(`
                SELECT 
                    id, sku_code, brand, model, device_type, tag_count
                FROM sku_master 
                WHERE device_type IS NOT NULL
                ORDER BY id
                LIMIT 1000
            `);
            
            client.release();
            
            let totalProcessed = 0;
            let highConfidence = 0;
            let mediumConfidence = 0;
            let lowConfidence = 0;
            let errors = 0;
            
            // Re-run detection to analyze confidence
            for (const row of result.rows) {
                try {
                    const detection = await this.detectDeviceType(row);
                    totalProcessed++;
                    
                    switch (detection.confidence) {
                        case 'HIGH':
                            highConfidence++;
                            break;
                        case 'MEDIUM':
                            mediumConfidence++;
                            break;
                        case 'LOW':
                            lowConfidence++;
                            break;
                        default:
                            errors++;
                    }
                } catch (error) {
                    errors++;
                }
            }
            
            return {
                totalProcessed,
                highConfidence,
                mediumConfidence,
                lowConfidence,
                errors,
                highConfidencePercentage: Math.round((highConfidence / totalProcessed) * 100),
                mediumConfidencePercentage: Math.round((mediumConfidence / totalProcessed) * 100),
                lowConfidencePercentage: Math.round((lowConfidence / totalProcessed) * 100),
                errorPercentage: Math.round((errors / totalProcessed) * 100)
            };
            
        } catch (error) {
            console.error('❌ Failed to get detection accuracy report:', error);
            return null;
        }
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = DeviceTypeDetectionService;

