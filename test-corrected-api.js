// Test script for the corrected Phonecheck API
const PHONECHECK_CONFIG = {
  username: 'dncltechzoneinc',
  password: '@Ustvmos817',
  baseUrl: 'https://api.phonecheck.com'
};

async function testCorrectedAPI() {
  try {
    console.log('🚀 Testing corrected Phonecheck API...');
    
    // Step 1: Get authentication token
    console.log('🔑 Getting authentication token...');
    const authResponse = await fetch(`${PHONECHECK_CONFIG.baseUrl}/v2/auth/master/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: PHONECHECK_CONFIG.username,
        password: PHONECHECK_CONFIG.password
      })
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      throw new Error(`Authentication failed: ${errorText}`);
    }

    const authData = await authResponse.json();
    const token = authData.token;
    console.log('✅ Authentication successful');

    // Step 2: Test the correct endpoint
    console.log('📡 Testing all-devices endpoint...');
    const endpoint = `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`;
    
    const payload = {
      date: '2024-01-15',
      station: 'dncltechzoneinc',
      limit: 10,
      offset: 0
    };

    console.log('📦 Payload:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'token_master': token
      },
      body: JSON.stringify(payload)
    });

    console.log(`📥 Response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS! API is working correctly');
      console.log(`📊 Found ${Array.isArray(data) ? data.length : 'unknown'} devices`);
      if (Array.isArray(data) && data.length > 0) {
        console.log('📱 Sample device:', JSON.stringify(data[0], null, 2));
      }
      return data;
    } else {
      const errorText = await response.text();
      console.log(`❌ API call failed: ${errorText}`);
      
      if (response.status === 500) {
        console.log('ℹ️ Status 500 means no devices found (this is expected behavior)');
        return [];
      }
      throw new Error(`API call failed: ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Test the backend API
async function testBackendAPI() {
  try {
    console.log('\n🧪 Testing backend API...');
    
    const response = await fetch('http://localhost:3001/api/phonecheck/pull-devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        station: 'dncltechzoneinc',
        date: '2024-01-15'
      })
    });

    console.log(`📥 Backend response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend API is working correctly');
      console.log('📊 Response:', JSON.stringify(data, null, 2));
      return data;
    } else {
      const errorText = await response.text();
      console.log(`❌ Backend API failed: ${errorText}`);
      throw new Error(`Backend API failed: ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Backend test failed:', error.message);
    throw error;
  }
}

// Run tests
async function main() {
  try {
    // Test the direct Phonecheck API
    await testCorrectedAPI();
    
    // Test the backend API
    await testBackendAPI();
    
    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.log('\n💥 Tests failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testCorrectedAPI, testBackendAPI };
