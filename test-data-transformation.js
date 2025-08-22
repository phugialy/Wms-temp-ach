// Test script to verify data transformation logic
const BASE_URL = 'http://localhost:3001';

// Helper function to convert various formats to boolean (same as frontend)
const convertToBoolean = (value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        // Handle "N/A" and other non-boolean strings
        if (lower === 'n/a' || lower === 'na' || lower === 'unknown' || lower === '') return undefined;
        if (lower === 'true' || lower === 'yes' || lower === 'pass' || lower === 'passed') return true;
        if (lower === 'false' || lower === 'no' || lower === 'fail' || lower === 'failed') return false;
    }
    if (typeof value === 'number') {
        return value === 1;
    }
    return undefined;
};

// Helper function to clean up condition field (same as frontend)
const cleanCondition = (value) => {
    if (!value || value === 'N/A' || value === 'n/a') return 'UNKNOWN';
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        // Map common condition values
        if (lower === 'seven' || lower === '7') return 'SEVEN';
        if (lower === 'six' || lower === '6') return 'SIX';
        if (lower === 'five' || lower === '5') return 'FIVE';
        if (lower === 'four' || lower === '4') return 'FOUR';
        if (lower === 'three' || lower === '3') return 'THREE';
        if (lower === 'two' || lower === '2') return 'TWO';
        if (lower === 'one' || lower === '1') return 'ONE';
        if (lower === 'new' || lower === 'brand new') return 'NEW';
        if (lower === 'used' || lower === 'pre-owned') return 'USED';
        if (lower === 'refurbished' || lower === 'refurb') return 'REFURBISHED';
        if (lower === 'damaged' || lower === 'broken') return 'DAMAGED';
        return value.toUpperCase();
    }
    return 'UNKNOWN';
};

// Test data transformation
async function testDataTransformation() {
    console.log('🧪 Testing Data Transformation Logic\n');

    // Test cases for boolean conversion
    const testCases = [
        { input: 'true', expected: true, description: 'String "true"' },
        { input: 'false', expected: false, description: 'String "false"' },
        { input: 'yes', expected: true, description: 'String "yes"' },
        { input: 'no', expected: false, description: 'String "no"' },
        { input: 'pass', expected: true, description: 'String "pass"' },
        { input: 'fail', expected: false, description: 'String "fail"' },
        { input: true, expected: true, description: 'Boolean true' },
        { input: false, expected: false, description: 'Boolean false' },
        { input: 1, expected: true, description: 'Number 1' },
        { input: 0, expected: false, description: 'Number 0' },
        { input: undefined, expected: undefined, description: 'Undefined' },
        { input: null, expected: undefined, description: 'Null' },
        { input: 'unknown', expected: undefined, description: 'Unknown string' },
        { input: 'N/A', expected: undefined, description: 'String "N/A"' },
        { input: 'n/a', expected: undefined, description: 'String "n/a"' },
        { input: 'na', expected: undefined, description: 'String "na"' },
        { input: '', expected: undefined, description: 'Empty string' }
    ];

    console.log('📊 Boolean Conversion Test Results:');
    testCases.forEach(testCase => {
        const result = convertToBoolean(testCase.input);
        const passed = result === testCase.expected;
        console.log(`  ${passed ? '✅' : '❌'} ${testCase.description}: ${testCase.input} -> ${result} (expected: ${testCase.expected})`);
    });

    // Test condition cleaning
    console.log('\n📊 Condition Cleaning Test Results:');
    const conditionTestCases = [
        { input: 'Seven', expected: 'SEVEN', description: 'String "Seven"' },
        { input: 'seven', expected: 'SEVEN', description: 'String "seven"' },
        { input: '7', expected: 'SEVEN', description: 'String "7"' },
        { input: 'N/A', expected: 'UNKNOWN', description: 'String "N/A"' },
        { input: 'n/a', expected: 'UNKNOWN', description: 'String "n/a"' },
        { input: '', expected: 'UNKNOWN', description: 'Empty string' },
        { input: undefined, expected: 'UNKNOWN', description: 'Undefined' },
        { input: 'New', expected: 'NEW', description: 'String "New"' },
        { input: 'Used', expected: 'USED', description: 'String "Used"' },
        { input: 'Refurbished', expected: 'REFURBISHED', description: 'String "Refurbished"' }
    ];

    conditionTestCases.forEach(testCase => {
        const result = cleanCondition(testCase.input);
        const passed = result === testCase.expected;
        console.log(`  ${passed ? '✅' : '❌'} ${testCase.description}: ${testCase.input} -> ${result} (expected: ${testCase.expected})`);
    });

    // Test API endpoint with sample data
    console.log('\n🌐 Testing API Endpoint with Sample Data:');
    
    const sampleData = {
        name: 'GALAXY Z FOLD4 DUOS 512GB',
        brand: 'Samsung',
        model: 'Galaxy Z Fold4 Duos',
        storage: '512GB',
        color: 'Gray Green',
        carrier: 'Unlocked',
        type: 'phone',
        imei: '354178324760558',
        serialNumber: 'RFCT80G2GRY',
        quantity: 1,
        location: 'DNCL-Testing',
        working: 'YES',
        originalWorking: 'YES',
        originalWorkingStatus: 'PASSED',
        originalFailed: undefined, // "N/A" should be converted to undefined
        condition: 'SEVEN', // "Seven" should be converted to "SEVEN"
        batteryHealth: 92,
        failed: undefined, // "N/A" should be converted to undefined
        notes: 'N/A',
        batteryCycle: 320,
        mdm: 'N/A',
        testerName: 'Ramsis',
        repairNotes: 'N/A',
        firstReceived: '2025-08-21 13:17',
        lastUpdate: '2025-08-21 13:25',
        checkDate: '2025-08-22 14:05',
        source: 'comprehensive',
        dataQuality: 'comprehensive',
        processingLevel: 'minimal'
    };

    console.log('📤 Sending sample data to API:');
    console.log('  Sample data:', JSON.stringify(sampleData, null, 2));

    try {
        const response = await fetch(`${BASE_URL}/api/admin/inventory-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sampleData)
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ API call successful:');
            console.log('  Response:', JSON.stringify(result, null, 2));
        } else {
            console.log('❌ API call failed:');
            console.log('  Status:', response.status);
            console.log('  Error:', JSON.stringify(result, null, 2));
        }
    } catch (error) {
        console.log('❌ Network error:', error.message);
    }
}

// Test with different data formats
async function testDifferentDataFormats() {
    console.log('\n🔄 Testing Different Data Formats:');
    
    const testFormats = [
        {
            name: 'String boolean format',
            data: {
                name: 'Test Device 1',
                brand: 'Samsung',
                model: 'Galaxy S21',
                storage: '256GB',
                color: 'Blue',
                carrier: 'Verizon',
                type: 'phone',
                imei: '987654321098765',
                quantity: 1,
                location: 'DNCL-Testing',
                working: 'YES',
                originalWorking: 'YES',
                originalWorkingStatus: 'PASSED',
                originalFailed: 'false' // String format
            }
        },
        {
            name: 'Boolean format',
            data: {
                name: 'Test Device 2',
                brand: 'Apple',
                model: 'iPhone 13',
                storage: '128GB',
                color: 'White',
                carrier: 'AT&T',
                type: 'phone',
                imei: '111222333444555',
                quantity: 1,
                location: 'DNCL-Testing',
                working: 'YES',
                originalWorking: 'YES',
                originalWorkingStatus: 'PASSED',
                originalFailed: false // Boolean format
            }
        },
        {
            name: 'Mixed format',
            data: {
                name: 'Test Device 3',
                brand: 'Google',
                model: 'Pixel 6',
                storage: '128GB',
                color: 'Black',
                carrier: 'T-Mobile',
                type: 'phone',
                imei: '555666777888999',
                quantity: 1,
                location: 'DNCL-Testing',
                working: 'NO',
                originalWorking: 'NO',
                originalWorkingStatus: 'FAILED',
                originalFailed: 'true' // String format
            }
        }
    ];

    for (const testFormat of testFormats) {
        console.log(`\n📱 Testing: ${testFormat.name}`);
        console.log('  Data:', JSON.stringify(testFormat.data, null, 2));

        try {
            const response = await fetch(`${BASE_URL}/api/admin/inventory-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testFormat.data)
            });

            const result = await response.json();
            
            if (response.ok) {
                console.log('  ✅ Success');
            } else {
                console.log('  ❌ Failed:', result.error);
            }
        } catch (error) {
            console.log('  ❌ Network error:', error.message);
        }
    }
}

// Run tests
async function runTests() {
    console.log('🚀 Starting Data Transformation Tests\n');
    
    try {
        await testDataTransformation();
        await testDifferentDataFormats();
        
        console.log('\n🎉 All tests completed!');
    } catch (error) {
        console.log('\n💥 Test execution failed:', error.message);
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        convertToBoolean, 
        testDataTransformation, 
        testDifferentDataFormats,
        runTests 
    };
} else {
    // Run tests if executed directly
    runTests();
}
