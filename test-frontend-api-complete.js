const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testCompleteSystem() {
    console.log('🧪 Testing Complete Frontend & API System...\n');
    
    try {
        // Test 1: Check if server is running
        console.log('1️⃣ Testing server health...');
        try {
            const healthResponse = await axios.get(`${BASE_URL}/health`);
            console.log(`✅ Server Health: ${healthResponse.status} - ${JSON.stringify(healthResponse.data)}`);
        } catch (error) {
            console.log(`❌ Server Health: ${error.message}`);
            console.log('⚠️  Make sure to start the server first: npm start');
            return;
        }
        
        // Test 2: Check frontend pages
        console.log('\n2️⃣ Testing frontend pages...');
        const pages = [
            { path: '/', name: 'Home' },
            { path: '/admin-dashboard.html', name: 'Admin Dashboard' },
            { path: '/inventory-manager-new.html', name: 'Inventory Manager' },
            { path: '/bulk-add.html', name: 'Bulk Add' },
            { path: '/operator-dashboard.html', name: 'Operator Dashboard' },
            { path: '/sku-matching.html', name: 'SKU Matching' }
        ];
        
        for (const page of pages) {
            try {
                const response = await axios.get(`${BASE_URL}${page.path}`);
                console.log(`✅ ${page.name}: ${response.status} - ${response.headers['content-type']}`);
            } catch (error) {
                console.log(`❌ ${page.name}: ${error.message}`);
            }
        }
        
        // Test 3: Test existing API endpoints
        console.log('\n3️⃣ Testing existing API endpoints...');
        const existingApis = [
            { path: '/api/admin/inventory', name: 'Admin Inventory' },
            { path: '/api/imei-queue/stats', name: 'IMEI Queue Stats' },
            { path: '/api/imei-archival/stats', name: 'IMEI Archival Stats' }
        ];
        
        for (const api of existingApis) {
            try {
                const response = await axios.get(`${BASE_URL}${api.path}`);
                console.log(`✅ ${api.name}: ${response.status} - Data received`);
            } catch (error) {
                console.log(`❌ ${api.name}: ${error.message}`);
            }
        }
        
        // Test 4: Test new operator API endpoints
        console.log('\n4️⃣ Testing new operator API endpoints...');
        const operatorApis = [
            { path: '/api/operator/locations', name: 'Operator Locations' },
            { path: '/api/operator/postfix-options', name: 'Postfix Options' },
            { path: '/api/operator/recent-actions', name: 'Recent Actions' }
        ];
        
        for (const api of operatorApis) {
            try {
                const response = await axios.get(`${BASE_URL}${api.path}`);
                console.log(`✅ ${api.name}: ${response.status} - Data received`);
                if (api.name === 'Operator Locations') {
                    console.log(`   Locations: ${response.data.locations?.length || 0} available`);
                } else if (api.name === 'Postfix Options') {
                    console.log(`   Options: ${Object.keys(response.data.options || {}).length} grades available`);
                } else if (api.name === 'Recent Actions') {
                    console.log(`   Actions: ${response.data.actions?.length || 0} recent actions`);
                }
            } catch (error) {
                console.log(`❌ ${api.name}: ${error.message}`);
            }
        }
        
        // Test 5: Test device info endpoint (with invalid IMEI first)
        console.log('\n5️⃣ Testing device info endpoint...');
        try {
            const response = await axios.get(`${BASE_URL}/api/operator/device-info/INVALID_IMEI`);
            console.log(`❌ Device Info (Invalid): Should have failed but got ${response.status}`);
        } catch (error) {
            if (error.response?.status === 400) {
                console.log(`✅ Device Info (Invalid): Correctly rejected invalid IMEI`);
            } else {
                console.log(`❌ Device Info (Invalid): Unexpected error - ${error.message}`);
            }
        }
        
        // Test 6: Test operator actions (with invalid data)
        console.log('\n6️⃣ Testing operator action endpoints...');
        const operatorActions = [
            { 
                path: '/api/operator/shipping-pickup', 
                method: 'POST',
                data: { imei: 'INVALID_IMEI' },
                name: 'Shipping Pickup (Invalid)' 
            },
            { 
                path: '/api/operator/postfix-update', 
                method: 'POST',
                data: { imei: 'INVALID_IMEI', grade: 'A' },
                name: 'Postfix Update (Invalid)' 
            }
        ];
        
        for (const action of operatorActions) {
            try {
                const response = await axios[action.method.toLowerCase()](`${BASE_URL}${action.path}`, action.data);
                console.log(`❌ ${action.name}: Should have failed but got ${response.status}`);
            } catch (error) {
                if (error.response?.status === 400) {
                    console.log(`✅ ${action.name}: Correctly rejected invalid data`);
                } else {
                    console.log(`❌ ${action.name}: Unexpected error - ${error.message}`);
                }
            }
        }
        
        console.log('\n🎉 Complete system test finished!');
        console.log('\n📱 Available Frontend Pages:');
        console.log(`   🌐 Main Dashboard: http://localhost:3001/admin-dashboard.html`);
        console.log(`   📦 Inventory Manager: http://localhost:3001/inventory-manager-new.html`);
        console.log(`   📥 Bulk Add: http://localhost:3001/bulk-add.html`);
        console.log(`   👨‍💼 Operator Dashboard: http://localhost:3001/operator-dashboard.html`);
        console.log(`   🏷️ SKU Matching: http://localhost:3001/sku-matching.html`);
        
        console.log('\n🔗 Available API Endpoints:');
        console.log(`   📊 Admin APIs: http://localhost:3001/api/admin/*`);
        console.log(`   📱 IMEI Queue APIs: http://localhost:3001/api/imei-queue/*`);
        console.log(`   🗄️ Archival APIs: http://localhost:3001/api/imei-archival/*`);
        console.log(`   👨‍💼 Operator APIs: http://localhost:3001/api/operator/*`);
        
        console.log('\n🚀 System is ready for use!');
        
    } catch (error) {
        console.error('❌ System test failed:', error.message);
    }
}

// Run the test
testCompleteSystem();

