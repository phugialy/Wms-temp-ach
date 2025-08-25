const fetch = require('node-fetch');

async function testDataCleanup() {
    console.log('🧪 Testing Data Cleanup Functionality');
    console.log('=====================================');
    console.log('');

    const baseUrl = 'http://localhost:3001';

    try {
        // Test 1: Try to cleanup a non-existent IMEI (should work but return 0 archived)
        console.log('📋 Test 1: Cleanup non-existent IMEI');
        const testImei = '123456789012345';
        
        const response = await fetch(`${baseUrl}/api/admin/cleanup-imei`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imei: testImei })
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Success:', result.message);
            console.log(`   Archived count: ${result.archivedCount}`);
        } else {
            console.log('❌ Error:', result.error);
        }
        console.log('');

        // Test 2: Try with invalid IMEI format
        console.log('📋 Test 2: Invalid IMEI format');
        const invalidImei = '12345'; // Too short
        
        const response2 = await fetch(`${baseUrl}/api/admin/cleanup-imei`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imei: invalidImei })
        });

        const result2 = await response2.json();
        
        if (!response2.ok) {
            console.log('✅ Expected error:', result2.error);
        } else {
            console.log('❌ Unexpected success with invalid IMEI');
        }
        console.log('');

        // Test 3: Try with missing IMEI
        console.log('📋 Test 3: Missing IMEI');
        
        const response3 = await fetch(`${baseUrl}/api/admin/cleanup-imei`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });

        const result3 = await response3.json();
        
        if (!response3.ok) {
            console.log('✅ Expected error:', result3.error);
        } else {
            console.log('❌ Unexpected success with missing IMEI');
        }
        console.log('');

        console.log('🎉 All tests completed!');
        console.log('');
        console.log('📝 Next steps:');
        console.log('1. Apply the migration: migrations/007_fix_recursive_triggers.sql');
        console.log('2. Visit http://localhost:3001/data-cleanup.html');
        console.log('3. Test with real IMEI data from your database');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('');
        console.log('💡 Make sure the server is running: npm run dev');
    }
}

// Run the test
testDataCleanup();
