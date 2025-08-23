require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);

async function updateSkuFunction() {
    try {
        console.log('🔧 Updating SKU Generation Function...');
        
        // New SKU generation function SQL
        const skuFunctionSQL = `
        CREATE OR REPLACE FUNCTION generate_sku_from_data(data JSONB)
        RETURNS VARCHAR(200) AS $$
        DECLARE
            model_val VARCHAR(100);
            storage_val VARCHAR(50);
            color_val VARCHAR(50);
            carrier_val VARCHAR(50);
            sku_parts TEXT[];
        BEGIN
            -- Get full model name (not compressed)
            model_val := COALESCE(data->>'model', '');
            
            -- Extract storage number (e.g., "512GB" -> "512")
            storage_val := REGEXP_REPLACE(COALESCE(data->>'storage', ''), '[^0-9]', '', 'g');
            
            -- Get color and convert to 3-letter code
            color_val := CASE 
                WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%black%' THEN 'BLK'
                WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%blue%' THEN 'BLU'
                WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%white%' THEN 'WHT'
                WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%red%' THEN 'RED'
                WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%green%' THEN 'GRN'
                WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%purple%' THEN 'PUR'
                WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%pink%' THEN 'PNK'
                WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%gold%' THEN 'GLD'
                WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%silver%' THEN 'SLV'
                WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%gray%' OR LOWER(COALESCE(data->>'color', '')) LIKE '%grey%' THEN 'GRY'
                ELSE UPPER(LEFT(COALESCE(data->>'color', ''), 3))
            END;
            
            -- Get carrier
            carrier_val := COALESCE(data->>'carrier', '');
            
            -- Build SKU parts: Model-Storage-Color-Carrier
            sku_parts := ARRAY[model_val];
            
            IF storage_val != '' THEN
                sku_parts := array_append(sku_parts, storage_val);
            END IF;
            
            IF color_val != '' THEN
                sku_parts := array_append(sku_parts, color_val);
            END IF;
            
            IF carrier_val != '' THEN
                sku_parts := array_append(sku_parts, carrier_val);
            END IF;
            
            RETURN array_to_string(sku_parts, '-');
        END;
        $$ LANGUAGE plpgsql;
        `;
        
        // Try to execute the function update
        console.log('Executing SKU function update...');
        
        // Since we can't use exec_sql, let's test the function manually
        console.log('⚠️ Cannot execute SQL directly. Please update the function manually in your database.');
        console.log('📋 Function SQL to execute:');
        console.log(skuFunctionSQL);
        
        // Test the current function with sample data
        console.log('\n🧪 Testing current SKU generation...');
        
        const testData = {
            model: 'Galaxy Z Fold4 Duos',
            storage: '512GB',
            color: 'Black',
            carrier: 'ATT'
        };
        
        // Try to call the function (this will fail if it doesn't exist, but that's expected)
        try {
            const { data, error } = await supabase.rpc('generate_sku_from_data', { data: testData });
            if (error) {
                console.log('❌ Function test failed (expected if function not updated yet):', error.message);
            } else {
                console.log('✅ Function test successful:', data);
            }
        } catch (err) {
            console.log('⚠️ Function not available yet (needs manual update)');
        }
        
        console.log('\n📝 Next Steps:');
        console.log('1. Copy the SQL function above');
        console.log('2. Execute it in your Supabase SQL editor');
        console.log('3. Run the test script: node test-sku-generation.js');
        
    } catch (error) {
        console.error('❌ Update failed:', error);
    }
}

updateSkuFunction();
