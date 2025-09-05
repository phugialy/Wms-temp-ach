const SimpleSkuParser = require('./src/services/SimpleSkuParser');

async function testSimpleParser() {
    console.log('🧪 Testing Simple SKU Parser...');
    
    try {
        const parser = new SimpleSkuParser();
        await parser.initialize();
        
        console.log('✅ Parser initialized successfully');
        
        // Test with just 5 SKUs to verify the logic works
        const testSkus = [
            {
                id: 1,
                sku_code: 'IPAD-PRO-9.7-32-ROSE-WIFI',
                brand: 'APPLE',
                model: 'IPAD PRO',
                capacity: '32GB',
                color: 'ROSE',
                carrier: 'WIFI',
                post_fix: null
            },
            {
                id: 2,
                sku_code: 'MQDD2LL/A',
                brand: 'APPLE',
                model: 'IPHONE',
                capacity: '128GB',
                color: 'BLACK',
                carrier: null,
                post_fix: null
            },
            {
                id: 3,
                sku_code: 'FOLD3-256-GREEN-TMO',
                brand: 'SAMSUNG',
                model: 'GALAXY FOLD',
                capacity: '256GB',
                color: 'GREEN',
                carrier: 'T-MOBILE',
                post_fix: null
            },
            {
                id: 4,
                sku_code: 'PIXEL-8-128-BLACK-UNLOCKED',
                brand: 'GOOGLE',
                model: 'PIXEL 8',
                capacity: '128GB',
                color: 'BLACK',
                carrier: null,
                post_fix: 'UNLOCKED'
            },
            {
                id: 5,
                sku_code: 'ONEPLUS-11-256-SILVER-VG',
                brand: 'ONEPLUS',
                model: '11',
                capacity: '256GB',
                color: 'SILVER',
                carrier: 'VERIZON',
                post_fix: null
            }
        ];
        
        console.log(`\n📋 Testing with ${testSkus.length} SKUs:`);
        
        for (let i = 0; i < testSkus.length; i++) {
            const skuData = testSkus[i];
            console.log(`\n🔍 Testing SKU ${i + 1}: ${skuData.sku_code}`);
            
            try {
                const skuTags = parser.generateSimpleSkuTags(skuData);
                console.log(`  🏷️  Generated tags (${skuTags.length}): [${skuTags.join(', ')}]`);
                
                // Validate tags
                if (skuTags.length === 0) {
                    console.log(`  ❌ No tags generated`);
                } else {
                    console.log(`  ✅ Tags generated successfully`);
                }
                
            } catch (error) {
                console.error(`  ❌ Error processing SKU ${skuData.sku_code}:`, error.message);
            }
        }
        
        await parser.close();
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testSimpleParser();

