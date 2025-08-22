const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseApiKey = process.env['SUPABASE_API_KEY'];

if (!supabaseUrl || !supabaseApiKey) {
  console.error('❌ Supabase URL or API Key not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseApiKey);

async function setupTables() {
  console.log('🔧 Setting up Supabase tables...\n');

  try {
    // Test connection
    console.log('📡 Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('_supabase_migrations')
      .select('*')
      .limit(1);

    if (testError && testError.code !== 'PGRST116') {
      console.error('❌ Supabase connection failed:', testError);
      return;
    }
    console.log('✅ Supabase connection successful\n');

    // Check if tables exist
    console.log('🔍 Checking existing tables...');
    
    // Try to query the Item table
    const { data: items, error: itemsError } = await supabase
      .from('Item')
      .select('count')
      .limit(1);

    if (itemsError) {
      console.log('❌ Item table does not exist, creating basic structure...');
      
      // Since we can't create tables via the API, let's create some sample data
      // to test if the basic structure exists
      console.log('📝 Attempting to create sample warehouse...');
      
      const { data: warehouse, error: warehouseError } = await supabase
        .from('Warehouse')
        .insert({
          name: 'DNCL Warehouse',
          description: 'Default warehouse for DNCL operations',
          isActive: true
        })
        .select()
        .single();

      if (warehouseError) {
        console.error('❌ Warehouse table error:', warehouseError);
        console.log('💡 The database tables may not exist yet.');
        console.log('💡 You may need to run the Prisma migrations manually or create the tables in Supabase dashboard.');
        return;
      }

      console.log('✅ Warehouse created:', warehouse);

      // Create a sample location
      console.log('📝 Creating sample location...');
      const { data: location, error: locationError } = await supabase
        .from('Location')
        .insert({
          name: 'DNCL-Inspection',
          warehouseId: warehouse.id,
          description: 'Default inspection location',
          isActive: true
        })
        .select()
        .single();

      if (locationError) {
        console.error('❌ Location table error:', locationError);
        return;
      }

      console.log('✅ Location created:', location);

    } else {
      console.log('✅ Item table exists');
      
      // Get existing data
      const { data: existingItems, error: existingError } = await supabase
        .from('Item')
        .select('*')
        .limit(5);

      if (!existingError && existingItems) {
        console.log(`📊 Found ${existingItems.length} existing items`);
      }
    }

    // Test locations endpoint
    console.log('\n🔍 Testing locations endpoint...');
    const { data: locations, error: locationsError } = await supabase
      .from('Location')
      .select('*')
      .eq('isActive', true);

    if (locationsError) {
      console.error('❌ Locations query error:', locationsError);
    } else {
      console.log(`✅ Found ${locations.length} active locations`);
      locations.forEach(loc => {
        console.log(`   - ${loc.name} (ID: ${loc.id})`);
      });
    }

    console.log('\n✅ Setup complete!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupTables();
