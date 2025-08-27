const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testFrontendAccess() {
  console.log('🧪 Testing Frontend Access...\n');
  
  try {
    // Test 1: Check if frontend pages are accessible
    console.log('1️⃣ Testing frontend pages...');
    
    const pages = [
      '/',
      '/admin-dashboard',
      '/inventory-manager-new.html'
    ];
    
    for (const page of pages) {
      try {
        const response = await axios.get(`${BASE_URL}${page}`);
        console.log(`✅ ${page}: ${response.status} - ${response.headers['content-type']}`);
      } catch (error) {
        console.log(`❌ ${page}: ${error.message}`);
      }
    }
    
    // Test 2: Test API endpoints that frontend will use
    console.log('\n2️⃣ Testing API endpoints for frontend...');
    
    const apiEndpoints = [
      '/api/admin/inventory',
      '/api/inventory/stats',
      '/api/inventory?limit=10'
    ];
    
    for (const endpoint of apiEndpoints) {
      try {
        const response = await axios.get(`${BASE_URL}${endpoint}`);
        console.log(`✅ ${endpoint}: ${response.status} - Data received`);
        
        if (endpoint.includes('admin/inventory')) {
          console.log(`   Summary: ${JSON.stringify(response.data.summary)}`);
          console.log(`   Items: ${response.data.inventory.length}`);
        } else if (endpoint.includes('stats')) {
          console.log(`   Stats: ${JSON.stringify(response.data.stats)}`);
        } else if (endpoint.includes('inventory?')) {
          console.log(`   Total: ${response.data.pagination.total}`);
          console.log(`   Items: ${response.data.data.length}`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint}: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Frontend access test completed!');
    console.log('\n📱 You can now access:');
    console.log(`   🌐 Main site: http://localhost:3001`);
    console.log(`   📊 Admin Dashboard: http://localhost:3001/admin-dashboard`);
    console.log(`   📦 Inventory Manager: http://localhost:3001/inventory-manager-new.html`);
    
  } catch (error) {
    console.error('❌ Frontend test failed:', error.message);
  }
}

testFrontendAccess();
