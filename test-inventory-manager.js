const fetch = require('node-fetch');

async function testInventoryManager() {
    console.log('🧪 Testing Inventory Manager Data Display');
    
    try {
        // Get inventory data
        const response = await fetch('http://localhost:3001/api/admin/inventory');
        
        if (response.ok) {
            const inventory = await response.json();
            console.log(`\n📊 Inventory Summary:`);
            console.log(`  - Total items: ${inventory.length}`);
            
            // Count items with PhoneCheck data
            const withPhoneCheckData = inventory.filter(item => item.testResults || item.defects || item.notes || item.custom1);
            console.log(`  - Items with PhoneCheck data: ${withPhoneCheckData.length}`);
            
            // Count working status
            const workingStatus = {
                YES: inventory.filter(item => item.working === 'YES').length,
                NO: inventory.filter(item => item.working === 'NO').length,
                PENDING: inventory.filter(item => item.working === 'PENDING').length
            };
            console.log(`  - Working status breakdown:`);
            console.log(`    * PASS (YES): ${workingStatus.YES}`);
            console.log(`    * FAILED (NO): ${workingStatus.NO}`);
            console.log(`    * PENDING: ${workingStatus.PENDING}`);
            
            // Show sample items with PhoneCheck data
            console.log(`\n📱 Sample Items with PhoneCheck Data:`);
            withPhoneCheckData.slice(0, 3).forEach((item, index) => {
                console.log(`  Item ${index + 1}:`);
                console.log(`    - Name: ${item.name}`);
                console.log(`    - IMEI: ${item.imei}`);
                console.log(`    - Working: ${item.working}`);
                console.log(`    - Has testResults: ${!!item.testResults}`);
                if (item.testResults) {
                    console.log(`    - PhoneCheck Status: ${item.testResults.status}`);
                    console.log(`    - Notes: ${item.testResults.notes || 'N/A'}`);
                    console.log(`    - Defects: ${item.testResults.defects || 'N/A'}`);
                    console.log(`    - Battery Cycles: ${item.testResults.batteryCycle || 'N/A'}`);
                    console.log(`    - Tester: ${item.testResults.testerName || 'N/A'}`);
                }
                console.log('');
            });
            
            // Test the frontend URL
            console.log(`\n🌐 Frontend Test:`);
            console.log(`  - Inventory Manager URL: http://localhost:3001/inventory-manager.html`);
            console.log(`  - Expected PhoneCheck Data count: ${withPhoneCheckData.length}`);
            console.log(`  - Expected Total Items: ${inventory.length}`);
            
        } else {
            const errorData = await response.json();
            console.error('❌ API Error:', errorData);
        }
        
    } catch (error) {
        console.error('❌ Test Error:', error.message);
    }
}

testInventoryManager();
