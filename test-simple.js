// Simple test for data transformation
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

// Test with actual data
const testData = {
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
    failed: "N/A"
};

console.log('🧪 Testing Data Transformation with Real Data\n');

console.log('📊 Original Data:');
console.log('  - originalFailed:', testData.originalFailed, 'Type:', typeof testData.originalFailed);
console.log('  - failed:', testData.failed, 'Type:', typeof testData.failed);
console.log('  - condition:', testData.condition, 'Type:', typeof testData.condition);

console.log('\n🔧 Transformed Data:');
console.log('  - originalFailed (converted):', convertToBoolean(testData.originalFailed), 'Type:', typeof convertToBoolean(testData.originalFailed));
console.log('  - failed (converted):', convertToBoolean(testData.failed), 'Type:', typeof convertToBoolean(testData.failed));
console.log('  - condition (cleaned):', cleanCondition(testData.condition), 'Type:', typeof cleanCondition(testData.condition));

console.log('\n✅ Data transformation completed successfully!');
