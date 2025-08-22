// Test API endpoint with transformed data
const BASE_URL = 'http://localhost:3001';

const convertToBoolean = (value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'n/a' || lower === 'na' || lower === 'unknown' || lower === '') return undefined;
        if (lower === 'true' || lower === 'yes' || lower === 'pass' || lower === 'passed') return true;
        if (lower === 'false' || lower === 'no' || lower === 'fail' || lower === 'failed') return false;
    }
    if (typeof value === 'number') {
        return value === 1;
    }
    return undefined;
};

const cleanCondition = (value) => {
    if (!value || value === 'N/A' || value === 'n/a') return 'UNKNOWN';
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
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

async function testAPI() {
    console.log('🧪 Testing API Endpoint with Transformed Data\n');

    // Original data from Phonecheck
    const originalData = {
        name: "GALAXY Z FOLD4 DUOS 512GB",
        brand: "Samsung",
        model: "Galaxy Z Fold4 Duos",
        storage: "512GB",
        color: "Gray Green",
        carrier: "Unlocked",
        type: "phone",
        imei: "354178324760558",
        serialNumber: "RFCT80G2GRY",
        condition: "Seven",
        working: "YES",
        quantity: 1,
        location: "DNCL-Inspection",
        status: "success",
        source: "comprehensive",
        dataQuality: "comprehensive",
        processingLevel: "minimal",
        originalWorking: "YES",
        originalFailed: "N/A",
        notes: "N/A",
        batteryHealth: "92",
        failed: "N/A",
        batteryCycle: "320",
        mdm: "N/A",
        testerName: "Ramsis",
        repairNotes: "N/A",
        firstReceived: "2025-08-21 13:17",
        lastUpdate: "2025-08-21 13:25",
        checkDate: "2025-08-22 14:05"
    };

    // Transform the data (same as frontend)
    const transformedData = {
        name: originalData.name,
        brand: originalData.brand,
        model: originalData.model,
        storage: originalData.storage,
        color: originalData.color,
        carrier: originalData.carrier,
        type: originalData.type,
        imei: originalData.imei,
        serialNumber: originalData.serialNumber,
        condition: cleanCondition(originalData.condition),
        working: originalData.working,
        quantity: originalData.quantity,
        location: originalData.location,
        batteryHealth: originalData.batteryHealth,
        batteryCycle: originalData.batteryCycle,
        mdm: originalData.mdm,
        notes: originalData.notes,
        failed: convertToBoolean(originalData.failed),
        workingStatus: originalData.workingStatus,
        testerName: originalData.testerName,
        repairNotes: originalData.repairNotes,
        firstReceived: originalData.firstReceived,
        lastUpdate: originalData.lastUpdate,
        checkDate: originalData.checkDate,
        dataQuality: originalData.dataQuality,
        processingLevel: originalData.processingLevel,
        source: originalData.source,
        testResults: originalData,
        originalWorking: originalData.originalWorking ? String(originalData.originalWorking) : undefined,
        originalWorkingStatus: originalData.originalWorkingStatus ? String(originalData.originalWorkingStatus) : undefined,
        originalFailed: convertToBoolean(originalData.originalFailed)
    };

    console.log('📊 Original Data Issues:');
    console.log('  - originalFailed:', originalData.originalFailed, 'Type:', typeof originalData.originalFailed);
    console.log('  - failed:', originalData.failed, 'Type:', typeof originalData.failed);
    console.log('  - condition:', originalData.condition, 'Type:', typeof originalData.condition);

    console.log('\n🔧 Transformed Data:');
    console.log('  - originalFailed:', transformedData.originalFailed, 'Type:', typeof transformedData.originalFailed);
    console.log('  - failed:', transformedData.failed, 'Type:', typeof transformedData.failed);
    console.log('  - condition:', transformedData.condition, 'Type:', typeof transformedData.condition);

    console.log('\n🌐 Testing API Endpoint...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/inventory-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transformedData)
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ API call successful!');
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

testAPI();
