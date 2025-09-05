const { Pool } = require('pg');
require('dotenv').config();

async function fixSkuParsing() {
    console.log('🔧 Fixing SKU parsing by extracting data from SKU codes...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Get SKUs that need parsing (where brand is NULL)
        const result = await client.query(`
            SELECT id, sku_code 
            FROM sku_master 
            WHERE brand IS NULL OR model IS NULL
            ORDER BY id
            LIMIT 10
        `);
        
        console.log(`📋 Found ${result.rows.length} SKUs to fix:`);
        
        for (let i = 0; i < result.rows.length; i++) {
            const skuData = result.rows[i];
            console.log(`\n🔍 Processing SKU ${i + 1}: ${skuData.sku_code}`);
            
            try {
                // Extract data from SKU code
                const extractedData = extractDataFromSku(skuData.sku_code);
                console.log(`  📝 Extracted:`, extractedData);
                
                // Update database with extracted data
                await client.query(`
                    UPDATE sku_master 
                    SET 
                        brand = $1,
                        model = $2,
                        capacity = $3,
                        color = $4,
                        carrier = $5,
                        post_fix = $6
                    WHERE id = $7
                `, [
                    extractedData.brand,
                    extractedData.model,
                    extractedData.capacity,
                    extractedData.color,
                    extractedData.carrier,
                    extractedData.post_fix,
                    skuData.id
                ]);
                
                console.log(`  ✅ Updated database`);
                
            } catch (error) {
                console.error(`  ❌ Error processing SKU ${skuData.sku_code}:`, error.message);
            }
        }
        
        client.release();
        await pool.end();
        
        console.log('\n✅ SKU parsing fix completed!');
        
    } catch (error) {
        console.error('❌ Fix failed:', error.message);
    }
}

function extractDataFromSku(skuCode) {
    const sku = skuCode.toUpperCase();
    const segments = parseSkuIntoSegments(sku);
    
    console.log(`    Segments: [${segments.join(', ')}]`);
    
    // Initialize extracted data
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
    } else if (sku.includes('GALAXY') || sku.includes('SAMSUNG')) {
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
    const colors = ['BLACK', 'WHITE', 'BLUE', 'RED', 'GREEN', 'GOLD', 'SILVER', 'ROSE', 'PURPLE', 'ORANGE', 'SLV', 'SG'];
    for (const color of colors) {
        if (sku.includes(color)) {
            if (color === 'SLV') extracted.color = 'SILVER';
            else if (color === 'SG') extracted.color = 'SILVER';
            else extracted.color = color;
            break;
        }
    }
    
    // Carrier detection
    const carriers = ['WIFI', '4G', '5G', 'LTE', 'CDMA', 'GSM', 'GLOBAL', 'INTERNATIONAL', 'VG'];
    for (const carrier of carriers) {
        if (sku.includes(carrier)) {
            if (carrier === 'VG') extracted.carrier = 'VERIZON';
            else extracted.carrier = carrier;
            break;
        }
    }
    
    // Post fix detection (anything after the last dash that's not a recognized category)
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

// Run the fix
fixSkuParsing();

