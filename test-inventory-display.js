const fetch = require('node-fetch');

async function testInventoryDisplay() {
    console.log('🔍 Testing Inventory Display Issue');
    
    try {
        // Test the inventory API
        const response = await fetch('http://localhost:3001/api/admin/inventory');
        const inventory = await response.json();
        
        console.log('\n📊 Inventory API Results:');
        console.log(`Total items returned: ${inventory.length}`);
        
        // Check for any items that might be filtered out
        const activeItems = inventory.filter(item => item.isActive !== false);
        console.log(`Active items: ${activeItems.length}`);
        
        // Check for items with isActive = true
        const explicitlyActive = inventory.filter(item => item.isActive === true);
        console.log(`Explicitly active items: ${explicitlyActive.length}`);
        
        // Check for items with isActive = null/undefined
        const noActiveFlag = inventory.filter(item => item.isActive === null || item.isActive === undefined);
        console.log(`Items with no isActive flag: ${noActiveFlag.length}`);
        
        // Show first few items
        console.log('\n📱 First 5 items:');
        inventory.slice(0, 5).forEach((item, index) => {
            console.log(`  ${index + 1}. ID: ${item.id}, Name: ${item.name}, IMEI: ${item.imei}, isActive: ${item.isActive}`);
        });
        
        // Check if there are any filters being applied
        console.log('\n🔍 Checking for potential filter issues:');
        
        // Check for items with different working statuses
        const workingStatuses = {};
        inventory.forEach(item => {
            const status = item.working || 'UNKNOWN';
            workingStatuses[status] = (workingStatuses[status] || 0) + 1;
        });
        console.log('Working status distribution:', workingStatuses);
        
        // Check for items with different conditions
        const conditions = {};
        inventory.forEach(item => {
            const condition = item.condition || 'UNKNOWN';
            conditions[condition] = (conditions[condition] || 0) + 1;
        });
        console.log('Condition distribution:', conditions);
        
        // Check if any items have null/undefined values that might cause display issues
        const itemsWithNulls = inventory.filter(item => 
            !item.name || !item.brand || !item.model
        );
        console.log(`Items with null/undefined critical fields: ${itemsWithNulls.length}`);
        
        if (itemsWithNulls.length > 0) {
            console.log('Sample items with nulls:');
            itemsWithNulls.slice(0, 3).forEach(item => {
                console.log(`  - ID: ${item.id}, Name: ${item.name}, Brand: ${item.brand}, Model: ${item.model}`);
            });
        }
        
        // Test the frontend calculation logic
        console.log('\n🧮 Frontend Calculation Test:');
        const stats = {
            total: inventory.length,
            brands: {},
            carriers: {},
            conditions: {},
            workingStatus: {
                YES: 0,
                NO: 0,
                PENDING: 0
            },
            phonecheckData: {
                withDefects: 0,
                withNotes: 0,
                withCustom1: 0
            }
        };

        inventory.forEach(item => {
            // Brand stats
            const brand = item.brand || 'Unknown';
            stats.brands[brand] = (stats.brands[brand] || 0) + 1;

            // Carrier stats
            const carrier = item.carrier || 'Unknown';
            stats.carriers[carrier] = (stats.carriers[carrier] || 0) + 1;

            // Condition stats
            const condition = item.condition || 'Unknown';
            stats.conditions[condition] = (stats.conditions[condition] || 0) + 1;

            // Working status stats
            const working = item.working || 'PENDING';
            stats.workingStatus[working] = (stats.workingStatus[working] || 0) + 1;

            // PhoneCheck data stats - check both testResults and direct fields
            const hasPhoneCheckData = item.testResults || item.defects || item.notes || item.custom1;
            if (hasPhoneCheckData) {
                if (item.testResults?.defects || item.defects) stats.phonecheckData.withDefects++;
                if (item.testResults?.notes || item.notes) stats.phonecheckData.withNotes++;
                if (item.testResults?.custom1 || item.custom1) stats.phonecheckData.withCustom1++;
            }
        });
        
        console.log('Calculated stats:', stats);
        console.log(`PhoneCheck data count: ${inventory.filter(item => item.testResults || item.defects || item.notes || item.custom1).length}`);
        
    } catch (error) {
        console.error('❌ Test Error:', error.message);
    }
}

testInventoryDisplay();
