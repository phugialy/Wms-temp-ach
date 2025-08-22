const fetch = require('node-fetch');

// Test data that matches what bulk-add.html would send
const testItem = {
    name: "Samsung Galaxy Z Fold4",
    brand: "Samsung",
    model: "Galaxy Z Fold4",
    storage: "512GB",
    color: "Gray green",
    carrier: "UNLOCKED",
    type: "phone",
    imei: "TEST123456789",
    serialNumber: "RFCT71CL8QK",
    condition: "SEVEN",
    working: "YES",
    quantity: 1,
    location: "DNCL-Inspection",
    batteryHealth: 95,
    batteryCycle: 150,
    mdm: "N/A",
    notes: "Test device",
    failed: false,
    workingStatus: "YES",
    testerName: "Test User",
    repairNotes: "No repairs needed",
    firstReceived: "2024-01-01",
    lastUpdate: "2024-01-15",
    checkDate: "2024-01-15",
    dataQuality: "HIGH",
    processingLevel: "FULL",
    source: "PHONECHECK",
    defects: "None",
    custom1: "Test data",
    testResults: {
        batteryHealth: 95,
        condition: "SEVEN"
    },
    originalWorking: "YES",
    originalWorkingStatus: "YES",
    originalFailed: false
};

async function testBulkAddFix() {
    console.log('🧪 Testing Bulk Add Fix');
    console.log('📊 Test Item Data:', {
        imei: testItem.imei,
        name: testItem.name,
        working: testItem.working,
        originalFailed: testItem.originalFailed,
        originalWorking: testItem.originalWorking
    });

    try {
        const response = await fetch('http://localhost:3001/api/admin/inventory-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testItem)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Test PASSED - Item added successfully:', {
                itemId: result.data?.itemId,
                sku: result.data?.sku,
                location: result.data?.location
            });
        } else {
            const errorData = await response.json();
            console.error('❌ Test FAILED:', {
                status: response.status,
                error: errorData
            });
        }
    } catch (error) {
        console.error('❌ Test ERROR:', error.message);
    }
}

testBulkAddFix();
