const { Pool } = require('pg');
require('dotenv').config();

async function test10Skus() {
    console.log('🧪 Testing SKU parsing with 10 SKUs only...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Get just 10 SKUs for testing
        const result = await client.query(`
            SELECT id, sku_code, brand, model, capacity, color, carrier, post_fix
            FROM sku_master 
            ORDER BY id
            LIMIT 10
        `);
        
        console.log(`📋 Testing with ${result.rows.length} SKUs:`);
        result.rows.forEach((sku, index) => {
            console.log(`  ${index + 1}. ${sku.sku_code} (${sku.brand || 'No brand'})`);
        });
        
        // Test parsing logic step by step
        for (let i = 0; i < result.rows.length; i++) {
            const skuData = result.rows[i];
            console.log(`\n🔍 Testing SKU ${i + 1}: ${skuData.sku_code}`);
            
            try {
                // Test 1: Parse segments
                const segments = parseSkuIntoSegments(skuData.sku_code);
                console.log(`  📝 Segments: [${segments.join(', ')}]`);
                
                // Test 2: Detect device type
                const deviceType = detectDeviceType(skuData, segments);
                console.log(`  📱 Device Type: ${deviceType}`);
                
                // Test 3: Parse tags
                const tags = parseTagsByDeviceType(skuData, segments, deviceType);
                console.log(`  🏷️  Tags (${tags.length}):`);
                tags.forEach((tag, tagIndex) => {
                    console.log(`    ${tagIndex + 1}. ${tag.tag_name} (${tag.tag_category}) = ${tag.tag_value}`);
                });
                
                // Test 4: Validate tag structure
                const invalidTags = tags.filter(tag => !tag.tag_name || !tag.tag_category || !tag.tag_value);
                if (invalidTags.length > 0) {
                    console.log(`  ❌ Invalid tags found:`, invalidTags);
                } else {
                    console.log(`  ✅ All tags are valid`);
                }
                
            } catch (error) {
                console.error(`  ❌ Error processing SKU ${skuData.sku_code}:`, error.message);
            }
        }
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Copy the parsing methods from EnhancedSkuParser for testing
function parseSkuIntoSegments(sku) {
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
            if (currentSegment) {
                currentSegment += char + sku[i + 1];
                segments.push(currentSegment);
                currentSegment = '';
                i++;
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

function detectDeviceType(skuData, segments) {
    const brand = skuData.brand?.toUpperCase();
    const sku = skuData.sku_code.toUpperCase();
    
    if (brand === 'APPLE') {
        if (sku.includes('IPAD')) return 'TABLET';
        if (sku.includes('WATCH') || sku.includes('AW')) return 'WATCH';
        if (sku.includes('MAC') || sku.includes('IMAC') || sku.includes('MACBOOK')) return 'DESKTOP';
        return 'PHONE';
    }
    
    if (brand === 'SAMSUNG') {
        if (sku.includes('TAB') || sku.includes('GALAXY TAB')) return 'TABLET';
        if (sku.includes('WATCH') || sku.includes('GEAR')) return 'WATCH';
        return 'PHONE';
    }
    
    return 'PHONE'; // Default fallback
}

function parseTagsByDeviceType(skuData, segments, deviceType) {
    const tags = [];
    const brand = skuData.brand?.toUpperCase();
    
    // Brand tag
    if (brand) {
        tags.push({
            tag_name: brand,
            tag_category: 'BRAND',
            tag_value: brand
        });
    }
    
    // Device type tag
    tags.push({
        tag_name: deviceType,
        tag_category: 'DEVICE_TYPE',
        tag_value: deviceType
    });
    
    // Model segments (first few segments)
    const modelSegments = segments.slice(0, 3).filter(segment => 
        !isCapacity(segment) && !isColor(segment) && !isCarrier(segment)
    );
    
    modelSegments.forEach(segment => {
        tags.push({
            tag_name: segment,
            tag_category: 'MODEL',
            tag_value: segment
        });
    });
    
    // Capacity, Color, Carrier from skuData
    if (skuData.capacity) {
        tags.push({
            tag_name: skuData.capacity,
            tag_category: 'CAPACITY',
            tag_value: skuData.capacity
        });
    }
    
    if (skuData.color) {
        tags.push({
            tag_name: skuData.color,
            tag_category: 'COLOR',
            tag_value: skuData.color
        });
    }
    
    if (skuData.carrier) {
        tags.push({
            tag_name: skuData.carrier,
            tag_category: 'CARRIER',
            tag_value: skuData.carrier
        });
    }
    
    if (skuData.post_fix) {
        tags.push({
            tag_name: skuData.post_fix,
            tag_category: 'POSTFIX',
            tag_value: skuData.post_fix
        });
    }
    
    return tags;
}

function isCapacity(segment) {
    return /^\d+[GM]B?$|^\d+TB?$/i.test(segment) || 
           /^\d+$/.test(segment) && parseInt(segment) <= 2048;
}

function isColor(segment) {
    const colorKeywords = ['BLACK', 'WHITE', 'BLUE', 'RED', 'GREEN', 'GOLD', 'SILVER', 'ROSE', 'PURPLE', 'ORANGE'];
    return colorKeywords.some(color => segment.toUpperCase().includes(color));
}

function isCarrier(segment) {
    const carrierKeywords = ['4G', '5G', 'LTE', 'CDMA', 'GSM', 'WIFI', 'GLOBAL', 'INTERNATIONAL'];
    return carrierKeywords.some(carrier => segment.toUpperCase().includes(carrier));
}

// Run the test
test10Skus();

