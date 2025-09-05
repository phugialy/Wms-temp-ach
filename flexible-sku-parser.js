const { Pool } = require('pg');
require('dotenv').config();

async function flexibleSkuParser() {
    console.log('🔄 Running flexible SKU parser (combines DB data + SKU extraction)...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Get SKUs for testing (mix of NULL and populated data)
        const result = await client.query(`
            SELECT id, sku_code, brand, model, capacity, color, carrier, post_fix
            FROM sku_master 
            ORDER BY id
            LIMIT 10
        `);
        
        console.log(`📋 Testing with ${result.rows.length} SKUs:`);
        
        for (let i = 0; i < result.rows.length; i++) {
            const skuData = result.rows[i];
            console.log(`\n🔍 Processing SKU ${i + 1}: ${skuData.sku_code}`);
            
            try {
                // Combine existing DB data with extracted SKU data
                const combinedData = combineDataSources(skuData);
                console.log(`  📝 Combined data:`, combinedData);
                
                // Generate tags from combined data
                const tags = generateTagsFromCombinedData(combinedData, skuData.sku_code);
                console.log(`  🏷️  Generated tags (${tags.length}):`);
                tags.forEach((tag, tagIndex) => {
                    console.log(`    ${tagIndex + 1}. ${tag.tag_name} (${tag.tag_category}) = ${tag.tag_value}`);
                });
                
                // Validate tags
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
        console.error('❌ Flexible parser failed:', error.message);
    }
}

function combineDataSources(skuData) {
    const sku = skuData.sku_code.toUpperCase();
    const segments = parseSkuIntoSegments(sku);
    
    console.log(`    Segments: [${segments.join(', ')}]`);
    
    // Start with existing database data
    const combined = {
        brand: skuData.brand,
        model: skuData.model,
        capacity: skuData.capacity,
        color: skuData.color,
        carrier: skuData.carrier,
        post_fix: skuData.post_fix
    };
    
    // Extract missing data from SKU code
    const extracted = extractDataFromSku(sku, segments);
    
    // Fill in missing values with extracted data
    if (!combined.brand && extracted.brand) {
        combined.brand = extracted.brand;
        console.log(`    🔄 Brand: NULL → ${extracted.brand}`);
    }
    
    if (!combined.model && extracted.model) {
        combined.model = extracted.model;
        console.log(`    🔄 Model: NULL → ${extracted.model}`);
    }
    
    if (!combined.capacity && extracted.capacity) {
        combined.capacity = extracted.capacity;
        console.log(`    🔄 Capacity: NULL → ${extracted.capacity}`);
    }
    
    if (!combined.color && extracted.color) {
        combined.color = extracted.color;
        console.log(`    🔄 Color: NULL → ${extracted.color}`);
    }
    
    if (!combined.carrier && extracted.carrier) {
        combined.carrier = extracted.carrier;
        console.log(`    🔄 Carrier: NULL → ${extracted.carrier}`);
    }
    
    if (!combined.post_fix && extracted.post_fix) {
        combined.post_fix = extracted.post_fix;
        console.log(`    🔄 Post Fix: NULL → ${extracted.post_fix}`);
    }
    
    return combined;
}

function extractDataFromSku(sku, segments) {
    const extracted = {
        brand: null,
        model: null,
        capacity: null,
        color: null,
        carrier: null,
        post_fix: null
    };
    
    // Brand detection
    if (sku.includes('IPAD') || sku.includes('IPHONE') || sku.includes('MAC') || sku.includes('WATCH')) {
        extracted.brand = 'APPLE';
    } else if (sku.includes('GALAXY') || sku.includes('SAMSUNG') || sku.includes('FOLD')) {
        extracted.brand = 'SAMSUNG';
    } else if (sku.includes('PIXEL')) {
        extracted.brand = 'GOOGLE';
    } else if (sku.includes('ONEPLUS')) {
        extracted.brand = 'ONEPLUS';
    }
    
    // Model detection
    if (sku.includes('IPAD')) {
        if (sku.includes('PRO')) {
            extracted.model = 'IPAD PRO';
        } else if (sku.includes('AIR')) {
            extracted.model = 'IPAD AIR';
        } else if (sku.includes('MINI')) {
            extracted.model = 'IPAD MINI';
        } else {
            extracted.model = 'IPAD';
        }
    } else if (sku.includes('IPHONE')) {
        extracted.model = 'IPHONE';
    } else if (sku.includes('MAC')) {
        extracted.model = 'MAC';
    } else if (sku.includes('WATCH')) {
        extracted.model = 'APPLE WATCH';
    } else if (sku.includes('FOLD')) {
        extracted.model = 'GALAXY FOLD';
    }
    
    // Capacity detection
    const capacityMatch = sku.match(/(\d+)(?:GB|TB|MB)/i);
    if (capacityMatch) {
        extracted.capacity = capacityMatch[0];
    } else {
        // Look for just numbers that could be capacity
        const numberMatch = sku.match(/(\d{2,4})/);
        if (numberMatch && parseInt(numberMatch[1]) <= 2048) {
            extracted.capacity = numberMatch[1] + 'GB';
        }
    }
    
    // Color detection
    const colors = ['BLACK', 'WHITE', 'BLUE', 'RED', 'GREEN', 'GOLD', 'SILVER', 'ROSE', 'PURPLE', 'ORANGE', 'SLV', 'SG', 'BLK'];
    for (const color of colors) {
        if (sku.includes(color)) {
            if (color === 'SLV' || color === 'SG') extracted.color = 'SILVER';
            else if (color === 'BLK') extracted.color = 'BLACK';
            else extracted.color = color;
            break;
        }
    }
    
    // Carrier detection
    const carriers = ['WIFI', '4G', '5G', 'LTE', 'CDMA', 'GSM', 'GLOBAL', 'INTERNATIONAL', 'VG', 'TMO'];
    for (const carrier of carriers) {
        if (sku.includes(carrier)) {
            if (carrier === 'VG') extracted.carrier = 'VERIZON';
            else if (carrier === 'TMO') extracted.carrier = 'T-MOBILE';
            else extracted.carrier = carrier;
            break;
        }
    }
    
    // Post fix detection
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && 
        !extracted.capacity && 
        !extracted.color && 
        !extracted.carrier && 
        !extracted.model &&
        lastSegment.length <= 10) {
        extracted.post_fix = lastSegment;
    }
    
    return extracted;
}

function generateTagsFromCombinedData(combinedData, skuCode) {
    const tags = [];
    const segments = parseSkuIntoSegments(skuCode);
    
    // Brand tag
    if (combinedData.brand) {
        tags.push({
            tag_name: combinedData.brand,
            tag_category: 'BRAND',
            tag_value: combinedData.brand
        });
    }
    
    // Device type detection
    const deviceType = detectDeviceType(combinedData, skuCode);
    tags.push({
        tag_name: deviceType,
        tag_category: 'DEVICE_TYPE',
        tag_value: deviceType
    });
    
    // Model tag
    if (combinedData.model) {
        tags.push({
            tag_name: combinedData.model,
            tag_category: 'MODEL',
            tag_value: combinedData.model
        });
    } else {
        // Fallback: use first few segments as model
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
    }
    
    // Capacity tag
    if (combinedData.capacity) {
        tags.push({
            tag_name: combinedData.capacity,
            tag_category: 'CAPACITY',
            tag_value: combinedData.capacity
        });
    }
    
    // Color tag
    if (combinedData.color) {
        tags.push({
            tag_name: combinedData.color,
            tag_category: 'COLOR',
            tag_value: combinedData.color
        });
    }
    
    // Carrier tag
    if (combinedData.carrier) {
        tags.push({
            tag_name: combinedData.carrier,
            tag_category: 'CARRIER',
            tag_value: combinedData.carrier
        });
    }
    
    // Post fix tag
    if (combinedData.post_fix) {
        tags.push({
            tag_name: combinedData.post_fix,
            tag_category: 'POSTFIX',
            tag_value: combinedData.post_fix
        });
    }
    
    return tags;
}

function detectDeviceType(combinedData, skuCode) {
    const sku = skuCode.toUpperCase();
    const brand = combinedData.brand?.toUpperCase();
    
    // Brand-based detection
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
    
    // SKU-based detection (fallback)
    if (sku.includes('IPAD')) return 'TABLET';
    if (sku.includes('WATCH')) return 'WATCH';
    if (sku.includes('MAC') || sku.includes('IMAC')) return 'DESKTOP';
    
    return 'PHONE'; // Default
}

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

// Run the flexible parser
flexibleSkuParser();

