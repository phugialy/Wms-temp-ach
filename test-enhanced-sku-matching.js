require('dotenv').config();
const EnhancedSkuMatchingService = require('./src/services/enhancedSkuMatchingService');

async function testEnhancedSkuMatching() {
    const skuService = new EnhancedSkuMatchingService();
    
    console.log('🧪 Testing Enhanced SKU Matching Logic\n');
    
    // Test cases for different product types
    const testCases = [
        // Phone cases
        {
            name: 'Samsung Galaxy S22 Ultra',
            data: {
                model: 'Galaxy S22 Ultra',
                capacity: '512GB',
                color: 'Phantom Black',
                carrier: 'AT&T',
                brand: 'Samsung',
                description: 'Samsung Galaxy S22 Ultra smartphone'
            }
        },
        {
            name: 'iPhone 13 Pro Max',
            data: {
                model: 'iPhone 13 Pro Max',
                capacity: '1TB',
                color: 'Sierra Blue',
                carrier: 'Verizon',
                brand: 'Apple',
                description: 'Apple iPhone 13 Pro Max'
            }
        },
        // Watch cases
        {
            name: 'Galaxy Watch Ultra',
            data: {
                model: 'Galaxy Watch Ultra',
                size: '47mm',
                color: 'Silver',
                carrier: 'Unlocked',
                brand: 'Samsung',
                description: 'Samsung Galaxy Watch Ultra smartwatch'
            }
        },
        {
            name: 'Apple Watch Series 5',
            data: {
                model: 'Apple Watch Series 5',
                size: '40mm',
                color: 'Pink',
                carrier: 'WiFi',
                brand: 'Apple',
                description: 'Apple Watch Series 5 WiFi only'
            }
        },
        // Tablet cases
        {
            name: 'iPad Air',
            data: {
                model: 'iPad Air',
                capacity: '256GB',
                color: 'Silver',
                carrier: 'WiFi',
                brand: 'Apple',
                description: 'Apple iPad Air tablet'
            }
        },
        {
            name: 'Galaxy Tab S8',
            data: {
                model: 'Galaxy Tab S8',
                capacity: '128GB',
                color: 'Black',
                carrier: '5G',
                brand: 'Samsung',
                description: 'Samsung Galaxy Tab S8 5G tablet'
            }
        },
        // Computer cases
        {
            name: 'Dell XPS Laptop',
            data: {
                model: 'Dell XPS',
                capacity: '512GB',
                color: 'Silver',
                carrier: null,
                brand: 'Dell',
                description: 'Dell XPS 13 laptop computer'
            }
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`📱 Testing: ${testCase.name}`);
        console.log(`   Model: ${testCase.data.model}`);
        console.log(`   Capacity: ${testCase.data.capacity}`);
        console.log(`   Color: ${testCase.data.color}`);
        console.log(`   Carrier: ${testCase.data.carrier}`);
        
        try {
            // Generate SKU from device data
            const generatedSku = skuService.generateSkuFromDevice(testCase.data);
            console.log(`   Generated SKU: ${generatedSku}`);
            
            // Parse the generated SKU
            const parsedSku = skuService.parseMasterSku(generatedSku);
            console.log(`   Category: ${parsedSku.category}`);
            console.log(`   Model: ${parsedSku.model}`);
            console.log(`   Capacity: ${parsedSku.capacity}`);
            console.log(`   Color: ${parsedSku.color}`);
            console.log(`   Carrier: ${parsedSku.carrier}`);
            
            // Test with some sample master SKUs
            const sampleMasterSkus = [
                'S22-ULTRA-512GB-BLACK-AT&T',
                'IPHONE-13-PRO-MAX-1TB-BLUE-VERIZON',
                'WATCH-ULTRA-47-SILVER',
                'WATCH-5-40-WIFI-PINK',
                'TAB-IPAD-AIR-256GB-SILVER-WIFI',
                'TAB-GALAXY-S8-128GB-BLACK-5G',
                'DESKTOP-DELL-XPS-512GB-SILVER'
            ];
            
            console.log(`   Testing against master SKUs:`);
            for (const masterSku of sampleMasterSkus) {
                const masterSkuInfo = skuService.parseMasterSku(masterSku);
                const score = skuService.calculateMatchScore(parsedSku, masterSkuInfo, testCase.data);
                const method = skuService.getMatchMethod(parsedSku, masterSkuInfo);
                
                console.log(`     ${masterSku} -> Score: ${(score * 100).toFixed(1)}%, Method: ${method}`);
            }
            
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
        }
        
        console.log(''); // Empty line for readability
    }
    
    // Test with real data from database
    console.log('🔍 Testing with real database data...\n');
    
    try {
        const client = skuService.createClient();
        await client.connect();
        
        // Get a sample device from the database
        const deviceResult = await client.query(`
            SELECT * FROM sku_matching_view LIMIT 1
        `);
        
        if (deviceResult.rows.length > 0) {
            const deviceData = deviceResult.rows[0];
            console.log(`📱 Real device: ${deviceData.model} (${deviceData.imei})`);
            
            const generatedSku = skuService.generateSkuFromDevice(deviceData);
            console.log(`   Generated SKU: ${generatedSku}`);
            
            const parsedSku = skuService.parseMasterSku(generatedSku);
            console.log(`   Category: ${parsedSku.category}`);
            console.log(`   Model: ${parsedSku.model}`);
            console.log(`   Capacity: ${parsedSku.capacity}`);
            console.log(`   Color: ${parsedSku.color}`);
            console.log(`   Carrier: ${parsedSku.carrier}`);
            
            // Test the full matching process
            const matchResult = await skuService.findBestMatchingSku(deviceData);
            console.log(`   Best match: ${matchResult.matchedSku}`);
            console.log(`   Match score: ${(matchResult.matchScore * 100).toFixed(1)}%`);
            console.log(`   Match method: ${matchResult.matchMethod}`);
        }
        
        await client.end();
        
    } catch (error) {
        console.error(`❌ Database test error: ${error.message}`);
    }
    
    console.log('\n✅ Enhanced SKU matching test completed!');
}

testEnhancedSkuMatching().catch(console.error);
