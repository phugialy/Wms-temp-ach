// Test SKU generation
const testItems = [
  {
    imei: 'TEST_COMPLETE_001',
    name: 'iPhone 15 Pro Max',
    brand: 'Apple',
    model: 'iPhone 15 Pro Max',
    storage: '256GB',
    color: 'Titanium',
    carrier: 'Unlocked',
    working: 'YES',
    batteryHealth: 95,
    location: 'Test Location',
    notes: 'Complete test item'
  },
  {
    imei: 'TEST_PARTIAL_002',
    name: 'Samsung Galaxy S24',
    brand: 'Samsung',
    working: 'YES',
    location: 'Test Location'
  },
  {
    imei: 'TEST_MINIMAL_003',
    name: 'Unknown Device',
    location: 'Test Location'
  },
  {
    IMEI: 'TEST_ALT_NAMES_004',
    deviceName: 'Google Pixel 8',
    manufacturer: 'Google',
    deviceModel: 'Pixel 8',
    capacity: '128GB',
    deviceColor: 'Obsidian',
    network: 'Verizon',
    status: 'YES',
    battery: 88,
    comments: 'Alternative field names test'
  }
];

console.log('🧪 Testing SKU Generation');
console.log('========================\n');

testItems.forEach((item, index) => {
  // Extract data with fallbacks
  const imei = item.imei || item.IMEI || item.serialNumber || `UNKNOWN_${Date.now()}`;
  const name = item.name || item.deviceName || item.model || 'Unknown Device';
  const brand = item.brand || item.manufacturer || 'Unknown';
  const model = item.model || item.deviceModel || 'Unknown Model';
  const storage = item.storage || item.capacity || 'Unknown';
  const color = item.color || item.deviceColor || 'Unknown';
  const carrier = item.carrier || item.network || 'Unlocked';
  const location = item.location || 'Default Location';
  const working = item.working || item.status || 'PENDING';
  const failed = item.failed || item.defects || 'NO';
  const batteryHealth = item.batteryHealth || item.battery || null;
  const screenCondition = item.screenCondition || item.screen || 'Unknown';
  const bodyCondition = item.bodyCondition || item.condition || 'Unknown';
  const notes = item.notes || item.comments || '';
  const quantity = item.quantity || 1;

  // Generate SKU
  const sku = `${brand.substring(0, 3).toUpperCase()}${model.substring(0, 3).toUpperCase()}`.replace(/\s+/g, '').substring(0, 15);

  console.log(`📱 Item ${index + 1}:`);
  console.log(`   IMEI: ${imei}`);
  console.log(`   Brand: ${brand}`);
  console.log(`   Model: ${model}`);
  console.log(`   Generated SKU: "${sku}" (length: ${sku.length})`);
  console.log('');
});
