const fetch = require('node-fetch');

// Sample data structure from your bulk-add (you can replace this with actual data)
const sampleBulkData = [
    {
        name: "Samsung Galaxy Z Fold4",
        brand: "Samsung",
        model: "Galaxy Z Fold4",
        storage: "512GB",
        color: "Gray green",
        carrier: "UNLOCKED",
        type: "phone",
        imei: "354178324474531",
        serialNumber: "RFCT80G2GRY",
        condition: "SEVEN",
        working: "YES",
        quantity: 1,
        location: "DNCL-Inspection",
        batteryHealth: 92,
        batteryCycle: 320,
        mdm: "N/A",
        notes: "N/A",
        failed: false,
        workingStatus: "YES",
        testerName: "Ramsis",
        repairNotes: "N/A",
        firstReceived: "2025-08-21 13:17",
        lastUpdate: "2025-08-21 13:25",
        checkDate: "2025-08-22 14:05",
        dataQuality: "comprehensive",
        processingLevel: "minimal",
        source: "comprehensive",
        defects: "None",
        custom1: "Test data",
        testResults: {
            batteryHealth: 92,
            condition: "SEVEN",
            status: "success"
        },
        originalWorking: "YES",
        originalWorkingStatus: "YES",
        originalFailed: false
    }
    // Add more sample items here to test
];

function generateSku(item) {
    const brand = (item.brand || 'UNKNOWN').toUpperCase();
    const model = (item.model || 'UNKNOWN').toUpperCase();
    const storage = (item.storage || 'UNKNOWN').toUpperCase();
    const color = item.color ? item.color.charAt(0).toUpperCase() + item.color.slice(1).toLowerCase() : 'Unknown';
    const carrier = (item.carrier || 'UNKNOWN').toUpperCase();
    
    return `${brand}-${model}-${storage}-${color}-${carrier}`;
}

function analyzeBulkData(data) {
    console.log('🔍 Analyzing Bulk Data Structure');
    console.log(`📊 Total items in bulk data: ${data.length}`);
    
    // Generate SKUs and check for duplicates
    const skuCounts = {};
    const imeiCounts = {};
    const serialCounts = {};
    
    data.forEach((item, index) => {
        const sku = generateSku(item);
        skuCounts[sku] = (skuCounts[sku] || 0) + 1;
        
        if (item.imei) {
            imeiCounts[item.imei] = (imeiCounts[item.imei] || 0) + 1;
        }
        
        if (item.serialNumber) {
            serialCounts[item.serialNumber] = (serialCounts[item.serialNumber] || 0) + 1;
        }
        
        if (index < 3) {
            console.log(`\n📱 Item ${index + 1}:`);
            console.log(`  - Name: ${item.name}`);
            console.log(`  - IMEI: ${item.imei}`);
            console.log(`  - Serial: ${item.serialNumber}`);
            console.log(`  - SKU: ${sku}`);
            console.log(`  - Brand: ${item.brand}`);
            console.log(`  - Model: ${item.model}`);
            console.log(`  - Storage: ${item.storage}`);
            console.log(`  - Color: ${item.color}`);
            console.log(`  - Carrier: ${item.carrier}`);
        }
    });
    
    // Check for duplicates
    const duplicateSkus = Object.entries(skuCounts).filter(([sku, count]) => count > 1);
    const duplicateImeis = Object.entries(imeiCounts).filter(([imei, count]) => count > 1);
    const duplicateSerials = Object.entries(serialCounts).filter(([serial, count]) => count > 1);
    
    console.log('\n📊 Duplicate Analysis:');
    console.log(`  - Duplicate SKUs: ${duplicateSkus.length}`);
    console.log(`  - Duplicate IMEIs: ${duplicateImeis.length}`);
    console.log(`  - Duplicate Serial Numbers: ${duplicateSerials.length}`);
    
    if (duplicateSkus.length > 0) {
        console.log('\n⚠️ Duplicate SKUs found:');
        duplicateSkus.slice(0, 5).forEach(([sku, count]) => {
            console.log(`  - ${sku}: ${count} times`);
        });
    }
    
    if (duplicateImeis.length > 0) {
        console.log('\n⚠️ Duplicate IMEIs found:');
        duplicateImeis.slice(0, 5).forEach(([imei, count]) => {
            console.log(`  - ${imei}: ${count} times`);
        });
    }
    
    // Estimate how many unique items would be created
    const uniqueSkus = Object.keys(skuCounts).length;
    const uniqueImeis = Object.keys(imeiCounts).length;
    const uniqueSerials = Object.keys(serialCounts).length;
    
    console.log('\n📊 Unique Item Estimation:');
    console.log(`  - Unique SKUs: ${uniqueSkus}`);
    console.log(`  - Unique IMEIs: ${uniqueImeis}`);
    console.log(`  - Unique Serial Numbers: ${uniqueSerials}`);
    console.log(`  - Expected new items (by IMEI): ${uniqueImeis}`);
    console.log(`  - Expected new items (by SKU): ${uniqueSkus}`);
    
    return {
        totalItems: data.length,
        uniqueSkus,
        uniqueImeis,
        duplicateSkus: duplicateSkus.length,
        duplicateImeis: duplicateImeis.length
    };
}

// Test with sample data
console.log('🧪 Testing Bulk Data Analysis');
const analysis = analyzeBulkData(sampleBulkData);

console.log('\n💡 Recommendations:');
if (analysis.duplicateSkus > 0) {
    console.log('  - Consider using IMEI as primary identifier instead of SKU');
    console.log('  - Check if items with same specs should be treated as separate items');
}
if (analysis.duplicateImeis > 0) {
    console.log('  - Duplicate IMEIs detected - these will be treated as updates, not new items');
}
