const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testDatabaseConnection() {
    console.log('🔍 Testing Database Connection\n');

    // Test 1: Health check
    console.log('1. Testing health check...');
    try {
        const response = await fetch(`${BASE_URL}/health`);
        const result = await response.json();
        
        if (result.status === 'OK') {
            console.log('✅ Health check successful');
            console.log(`   Environment: ${result.environment}`);
            console.log(`   Timestamp: ${result.timestamp}`);
        } else {
            console.log('❌ Health check failed');
        }
    } catch (error) {
        console.log('❌ Health check request failed:', error.message);
    }

    // Test 2: Test inventory endpoint (should work even with empty tables)
    console.log('\n2. Testing inventory endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/admin/inventory`);
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Inventory endpoint working');
            console.log(`   Found ${result.data?.length || 0} inventory items`);
        } else {
            console.log('❌ Inventory endpoint failed:', result.error);
        }
    } catch (error) {
        console.log('❌ Inventory request failed:', error.message);
    }

    // Test 3: Test search with a simple term
    console.log('\n3. Testing search with simple term...');
    try {
        const response = await fetch(`${BASE_URL}/api/admin/search-imei?searchTerm=test`);
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Search endpoint working');
            console.log(`   Found ${result.data.totalRecords} records`);
            console.log('   Table breakdown:');
            Object.entries(result.data).forEach(([tableType, records]) => {
                if (tableType !== 'totalRecords' && Array.isArray(records)) {
                    console.log(`   - ${tableType}: ${records.length} records`);
                }
            });
        } else {
            console.log('❌ Search endpoint failed:', result.error);
            console.log('   This might indicate missing database tables or connection issues');
        }
    } catch (error) {
        console.log('❌ Search request failed:', error.message);
    }

    console.log('\n🎯 Database Connection Testing Complete!');
    console.log('\nIf search is failing, you may need to:');
    console.log('1. Apply database migrations: npm run db:migrate');
    console.log('2. Check Supabase connection in .env file');
    console.log('3. Verify database tables exist');
}

// Run the test
testDatabaseConnection().catch(console.error);
