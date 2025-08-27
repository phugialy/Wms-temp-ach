const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testApiEndpoints() {
  console.log('🧪 Testing API Endpoints...\n');
  
  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check:', healthResponse.data);
    
    // Test 2: Admin inventory endpoint
    console.log('\n2️⃣ Testing admin inventory endpoint...');
    const adminResponse = await axios.get(`${BASE_URL}/admin/inventory`);
    console.log('✅ Admin inventory response:');
    console.log('   Summary:', adminResponse.data.summary);
    console.log('   Inventory items:', adminResponse.data.inventory.length);
    if (adminResponse.data.inventory.length > 0) {
      console.log('   Sample item:', adminResponse.data.inventory[0]);
    }
    
    // Test 3: Inventory stats endpoint
    console.log('\n3️⃣ Testing inventory stats endpoint...');
    const statsResponse = await axios.get(`${BASE_URL}/inventory/stats`);
    console.log('✅ Inventory stats:', statsResponse.data.stats);
    
    // Test 4: Inventory endpoint with search
    console.log('\n4️⃣ Testing inventory endpoint with search...');
    const inventoryResponse = await axios.get(`${BASE_URL}/inventory?search=iPhone&limit=5`);
    console.log('✅ Inventory response:');
    console.log('   Total items:', inventoryResponse.data.pagination.total);
    console.log('   Items returned:', inventoryResponse.data.data.length);
    if (inventoryResponse.data.data.length > 0) {
      console.log('   Sample item:', inventoryResponse.data.data[0]);
    }
    
    console.log('\n🎉 All API endpoints are working correctly!');
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

// Wait a moment for server to start, then test
setTimeout(testApiEndpoints, 2000);
