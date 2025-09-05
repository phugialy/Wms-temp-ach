const EnhancedSkuParser = require('./src/services/EnhancedSkuParser');

async function testUpdatedParser() {
    console.log('🧪 Testing updated EnhancedSkuParser with flexible parsing...');
    
    try {
        const parser = new EnhancedSkuParser();
        await parser.initialize();
        
        console.log('✅ Parser initialized successfully');
        
        // Test with just 3 SKUs to verify the logic works
        const testSkus = [
            {
                id: 1,
                sku_code: 'IPAD-PRO-9.7-32-ROSE-WIFI',
                brand: null,
                model: null,
                capacity: null,
                color: null,
                carrier: null,
                post_fix: null
            },
            {
                id: 2,
                sku_code: 'MQDD2LL/A',
                brand: null,
                model: null,
                capacity: null,
                color: null,
                carrier: null,
                post_fix: null
            },
            {
                id: 3,
                sku_code: 'FOLD3-256-GREEN-TMO',
                brand: null,
                model: null,
                capacity: null,
                color: null,
                carrier: null,
                post_fix: null
            }
        ];
        
        console.log(`\n📋 Testing with ${testSkus.length} SKUs:`);
        
        for (let i = 0; i < testSkus.length; i++) {
            const skuData = testSkus[i];
            console.log(`\n🔍 Testing SKU ${i + 1}: ${skuData.sku_code}`);
            
            try {
                const segments = parser.parseSkuIntoSegments(skuData.sku_code);
                const deviceType = parser.detectDeviceType(skuData, segments);
                const tags = await parser.parseTagsByDeviceType(skuData, segments, deviceType);
                
                console.log(`  📱 Device Type: ${deviceType}`);
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
        
        await parser.close();
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testUpdatedParser();

