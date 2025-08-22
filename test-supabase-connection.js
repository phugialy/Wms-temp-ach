const fetch = require('node-fetch');

async function testSupabaseConnection() {
    console.log('🔍 Testing Supabase Connection');

    try {
        // Test if the server is running
        console.log('\n📡 Testing server connection...');
        const serverResponse = await fetch('http://localhost:3001/api/admin/inventory');
        
        if (serverResponse.ok) {
            console.log('✅ Server is running');
            const inventory = await serverResponse.json();
            console.log(`📊 Current inventory count: ${inventory.length}`);
        } else {
            console.log('❌ Server error:', serverResponse.status);
            return;
        }

        // Test a simple database operation
        console.log('\n📡 Testing database connection...');
        const testResponse = await fetch('http://localhost:3001/api/admin/locations');
        
        if (testResponse.ok) {
            console.log('✅ Database connection working');
            const locations = await testResponse.json();
            console.log(`📊 Available locations: ${locations.length}`);
        } else {
            console.log('❌ Database connection failed:', testResponse.status);
            const errorText = await testResponse.text();
            console.log('Error details:', errorText);
        }

    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
    }
}

testSupabaseConnection();
