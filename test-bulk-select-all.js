const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testBulkSelectAll() {
    console.log('🧪 Testing Bulk Select All Functionality\n');

    // Test 1: Get all IMEI data
    console.log('1. Testing get all IMEI data...');
    try {
        const response = await fetch(`${BASE_URL}/api/admin/all-imei-data`);
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Get all data successful');
            console.log(`   Found ${result.data.totalRecords} total records`);
            console.log('   Breakdown:');
            Object.entries(result.data).forEach(([tableType, records]) => {
                if (tableType !== 'totalRecords' && Array.isArray(records)) {
                    console.log(`   - ${tableType}: ${records.length} records`);
                }
            });
        } else {
            console.log('❌ Get all data failed:', result.error);
        }
    } catch (error) {
        console.log('❌ Get all data request failed:', error.message);
    }

    // Test 2: Test search with corrected column names
    console.log('\n2. Testing search with corrected column names...');
    try {
        const response = await fetch(`${BASE_URL}/api/admin/search-imei?searchTerm=PHONECHECK`);
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Search with corrected columns successful');
            console.log(`   Found ${result.data.totalRecords} records`);
        } else {
            console.log('❌ Search with corrected columns failed:', result.error);
        }
    } catch (error) {
        console.log('❌ Search request failed:', error.message);
    }

    // Test 3: Test search with IMEI number
    console.log('\n3. Testing search with IMEI number...');
    try {
        const response = await fetch(`${BASE_URL}/api/admin/search-imei?searchTerm=500000000000047`);
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ IMEI search successful');
            console.log(`   Found ${result.data.totalRecords} records`);
        } else {
            console.log('❌ IMEI search failed:', result.error);
        }
    } catch (error) {
        console.log('❌ IMEI search request failed:', error.message);
    }

    console.log('\n🎯 Bulk Select All Testing Complete!');
    console.log('\nNext steps:');
    console.log('1. Open data-cleanup.html in your browser');
    console.log('2. Go to the "Load All Data" tab');
    console.log('3. Click "Load All Data" to fetch all database records');
    console.log('4. Use "Select All" to select all records');
    console.log('5. Click "Delete Selected" to bulk delete all records');
    console.log('6. Test the filtering by table type');
}

// Run the test
testBulkSelectAll().catch(console.error);
