const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testEnhancedSearch() {
    console.log('🧪 Testing Enhanced IMEI Search Functionality\n');

    // Test 1: Search with a valid term
    console.log('1. Testing search with valid term...');
    try {
        const response = await fetch(`${BASE_URL}/api/admin/search-imei?searchTerm=123456789012345`);
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Search successful');
            console.log(`   Found ${result.data.totalRecords} total records`);
            console.log('   Breakdown:');
            Object.entries(result.data).forEach(([tableType, records]) => {
                if (tableType !== 'totalRecords' && Array.isArray(records)) {
                    console.log(`   - ${tableType}: ${records.length} records`);
                }
            });
        } else {
            console.log('❌ Search failed:', result.error);
        }
    } catch (error) {
        console.log('❌ Search request failed:', error.message);
    }

    // Test 2: Search with empty term
    console.log('\n2. Testing search with empty term...');
    try {
        const response = await fetch(`${BASE_URL}/api/admin/search-imei?searchTerm=`);
        const result = await response.json();
        
        if (!result.success && result.error) {
            console.log('✅ Correctly rejected empty search term:', result.error);
        } else {
            console.log('❌ Should have rejected empty search term');
        }
    } catch (error) {
        console.log('❌ Search request failed:', error.message);
    }

    // Test 3: Search with short term
    console.log('\n3. Testing search with short term...');
    try {
        const response = await fetch(`${BASE_URL}/api/admin/search-imei?searchTerm=a`);
        const result = await response.json();
        
        if (!result.success && result.error) {
            console.log('✅ Correctly rejected short search term:', result.error);
        } else {
            console.log('❌ Should have rejected short search term');
        }
    } catch (error) {
        console.log('❌ Search request failed:', error.message);
    }

    // Test 4: Search with missing parameter
    console.log('\n4. Testing search with missing parameter...');
    try {
        const response = await fetch(`${BASE_URL}/api/admin/search-imei`);
        const result = await response.json();
        
        if (!result.success && result.error) {
            console.log('✅ Correctly rejected missing search term:', result.error);
        } else {
            console.log('❌ Should have rejected missing search term');
        }
    } catch (error) {
        console.log('❌ Search request failed:', error.message);
    }

    // Test 5: Search with SKU term
    console.log('\n5. Testing search with SKU term...');
    try {
        const response = await fetch(`${BASE_URL}/api/admin/search-imei?searchTerm=SKU`);
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ SKU search successful');
            console.log(`   Found ${result.data.totalRecords} total records`);
        } else {
            console.log('❌ SKU search failed:', result.error);
        }
    } catch (error) {
        console.log('❌ SKU search request failed:', error.message);
    }

    // Test 6: Search with device name term
    console.log('\n6. Testing search with device name term...');
    try {
        const response = await fetch(`${BASE_URL}/api/admin/search-imei?searchTerm=iPhone`);
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Device name search successful');
            console.log(`   Found ${result.data.totalRecords} total records`);
        } else {
            console.log('❌ Device name search failed:', result.error);
        }
    } catch (error) {
        console.log('❌ Device name search request failed:', error.message);
    }

    console.log('\n🎯 Enhanced Search Testing Complete!');
    console.log('\nNext steps:');
    console.log('1. Open data-cleanup.html in your browser');
    console.log('2. Test the search functionality with various terms');
    console.log('3. Try selecting individual records and bulk deletion');
    console.log('4. Test the filtering by table type');
}

// Run the test
testEnhancedSearch().catch(console.error);
