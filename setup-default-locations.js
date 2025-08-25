const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function setupDefaultLocations() {
  console.log('🏢 Setting up default locations...');
  console.log('=====================================\n');

  try {
    // First, create the default warehouse
    console.log('1️⃣ Creating default warehouse...');
    let { data: warehouse, error: warehouseError } = await supabase
      .from('Warehouse')
      .insert({
        name: 'DNCL Warehouse',
        address: 'Default warehouse for DNCL operations'
      })
      .select()
      .single();

    if (warehouseError) {
      if (warehouseError.code === '23505') { // Unique constraint violation
        console.log('✅ Warehouse already exists, fetching existing...');
        const { data: existingWarehouse } = await supabase
          .from('Warehouse')
          .select('*')
          .eq('name', 'DNCL Warehouse')
          .single();
        warehouse = existingWarehouse;
      } else {
        throw warehouseError;
      }
    } else {
      console.log('✅ Default warehouse created:', warehouse.name);
    }

    // Define default locations
    const defaultLocations = [
      'Station 1',
      'Station 2', 
      'Station 3',
      'Station 4',
      'Station 5',
      'Station 6',
      'Station 7',
      'Station 8',
      'Station 9',
      'Station 10',
      'Station 11',
      'Station 12',
      'Station 13',
      'Station 14',
      'Station 15',
      'Station 16',
      'Station 17',
      'Station 18',
      'Station 19',
      'Station 20',
      'Station 21',
      'Station 22',
      'Station 23',
      'Station 24',
      'Station 25',
      'Station 26',
      'Station 27',
      'Station 28',
      'Station 29',
      'Station 30',
      'Receiving Area',
      'Testing Area',
      'Quality Control',
      'Shipping Area',
      'Storage Area A',
      'Storage Area B',
      'Storage Area C',
      'Repair Station',
      'Packaging Station',
      'Inspection Station'
    ];

    console.log('2️⃣ Creating default locations...');
    let createdCount = 0;
    let existingCount = 0;

    for (const locationName of defaultLocations) {
      try {
        const { data: location, error: locationError } = await supabase
          .from('Location')
          .insert({
            name: locationName,
            warehouse_id: warehouse.id,
            description: `Location: ${locationName}`
          })
          .select()
          .single();

        if (locationError) {
          if (locationError.code === '23505') { // Unique constraint violation
            existingCount++;
            console.log(`   ⚠️  Location "${locationName}" already exists`);
          } else {
            console.log(`   ❌ Error creating location "${locationName}":`, locationError.message);
          }
        } else {
          createdCount++;
          console.log(`   ✅ Created location: ${locationName}`);
        }
      } catch (error) {
        console.log(`   ❌ Error with location "${locationName}":`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Created: ${createdCount} new locations`);
    console.log(`   Already existed: ${existingCount} locations`);
    console.log(`   Total locations: ${createdCount + existingCount}`);

    // Verify all locations are accessible
    console.log('\n3️⃣ Verifying locations are accessible...');
    const { data: allLocations, error: fetchError } = await supabase
      .from('Location')
      .select('*')
      .order('name');

    if (fetchError) {
      console.log('❌ Error fetching locations:', fetchError.message);
    } else {
      console.log(`✅ Successfully fetched ${allLocations.length} locations`);
      console.log('\n📋 Available locations:');
      allLocations.forEach(location => {
        console.log(`   • ${location.name}`);
      });
    }

    console.log('\n🎉 Default locations setup complete!');
    console.log('The location dropdown should now be populated in the UI.');

  } catch (error) {
    console.error('❌ Error setting up default locations:', error);
  }
}

// Run the setup
setupDefaultLocations().catch(console.error);
