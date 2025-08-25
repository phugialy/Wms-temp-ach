-- ========================================
-- FINAL WORKING QUEUE PROCESSING FUNCTION
-- ========================================

-- Final working function to process all pending queue items and create actual database records
-- This version uses unique variable names to avoid ambiguous column references
CREATE OR REPLACE FUNCTION process_all_pending_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    processed_count INTEGER := 0;
    queue_item RECORD;
    raw_data JSONB;
    device_imei TEXT;
    device_name TEXT;
    device_brand TEXT;
    device_model TEXT;
    device_storage TEXT;
    device_color TEXT;
    device_carrier TEXT;
    device_type TEXT;
    device_serial TEXT;
    device_quantity INTEGER;
    device_location TEXT;
    device_working TEXT;
    device_failed TEXT;
    device_battery TEXT;
    device_screen TEXT;
    device_body TEXT;
    device_notes TEXT;
    device_sku TEXT;
    item_id INTEGER;
    location_id INTEGER;
    inventory_id INTEGER;
    device_test_id INTEGER;
    imei_sku_id INTEGER;
    imei_inspect_id INTEGER;
    imei_unit_id INTEGER;
    working_status TEXT;
    test_result TEXT;
    error_msg TEXT;
BEGIN
    -- Update status to processing
    UPDATE imei_data_queue 
    SET status = 'processing' 
    WHERE status = 'pending';
    
    -- Process each item
    FOR queue_item IN 
        SELECT q.id, q.raw_data 
        FROM imei_data_queue q
        WHERE q.status = 'processing'
    LOOP
        BEGIN
            raw_data := queue_item.raw_data;
            
            -- Extract data from raw_data with unique variable names
            device_imei := raw_data->>'imei';
            device_name := raw_data->>'name';
            device_brand := raw_data->>'brand';
            device_model := raw_data->>'model';
            device_storage := raw_data->>'storage';
            device_color := raw_data->>'color';
            device_carrier := raw_data->>'carrier';
            device_type := raw_data->>'type';
            device_serial := raw_data->>'serialNumber';
            device_quantity := COALESCE((raw_data->>'quantity')::INTEGER, 1);
            device_location := raw_data->>'location';
            device_working := raw_data->>'working';
            device_failed := raw_data->>'failed';
            device_battery := raw_data->>'batteryHealth';
            device_screen := raw_data->>'screenCondition';
            device_body := raw_data->>'bodyCondition';
            device_notes := raw_data->>'notes';
            
            -- Validate required fields
            IF device_imei IS NULL OR device_imei = '' THEN
                RAISE EXCEPTION 'IMEI is required but was null or empty';
            END IF;
            
            IF device_name IS NULL OR device_name = '' THEN
                RAISE EXCEPTION 'Name is required but was null or empty';
            END IF;
            
            IF device_brand IS NULL OR device_brand = '' THEN
                RAISE EXCEPTION 'Brand is required but was null or empty';
            END IF;
            
            IF device_model IS NULL OR device_model = '' THEN
                RAISE EXCEPTION 'Model is required but was null or empty';
            END IF;
            
            -- Generate SKU if not provided
            IF raw_data->>'sku' IS NULL OR raw_data->>'sku' = '' THEN
                device_sku := UPPER(device_brand || '-' || device_model || '-' || COALESCE(device_storage, '') || '-' || COALESCE(device_color, '') || '-' || COALESCE(device_carrier, 'UNLOCKED'));
            ELSE
                device_sku := raw_data->>'sku';
            END IF;
            
            -- Determine working status
            IF device_working = 'YES' OR device_working = 'true' OR device_working = 'TRUE' THEN
                working_status := 'YES';
                test_result := 'PASSED';
            ELSIF device_failed = 'YES' OR device_failed = 'true' OR device_failed = 'TRUE' THEN
                working_status := 'NO';
                test_result := 'FAILED';
            ELSE
                working_status := 'PENDING';
                test_result := 'PENDING';
            END IF;
            
            -- Find or create location
            SELECT l.id INTO location_id FROM "Location" l WHERE l.name = device_location LIMIT 1;
            IF location_id IS NULL THEN
                -- Create default location if not found
                INSERT INTO "Location" (name, warehouse_id, description) 
                VALUES (device_location, 1, 'Auto-created location for ' || device_location)
                RETURNING id INTO location_id;
            END IF;
            
            -- Create or update Item record
            SELECT i.id INTO item_id FROM "Item" i WHERE i.imei = device_imei;
            IF item_id IS NULL THEN
                -- Create new item
                INSERT INTO "Item" (imei, name, sku, description, status)
                VALUES (
                    device_imei,
                    device_name,
                    device_sku,
                    device_brand || ' ' || device_model || ' ' || COALESCE(device_storage, '') || ' ' || COALESCE(device_color, '') || ' ' || COALESCE(device_carrier, ''),
                    'active'
                )
                RETURNING id INTO item_id;
            ELSE
                -- Update existing item
                UPDATE "Item" 
                SET 
                    name = device_name,
                    sku = device_sku,
                    description = device_brand || ' ' || device_model || ' ' || COALESCE(device_storage, '') || ' ' || COALESCE(device_color, '') || ' ' || COALESCE(device_carrier, '')
                WHERE id = item_id;
            END IF;
            
            -- Create or update Inventory record
            SELECT inv.id INTO inventory_id FROM "Inventory" inv WHERE inv.item_id = item_id AND inv.location_id = location_id;
            IF inventory_id IS NULL THEN
                -- Create new inventory record
                INSERT INTO "Inventory" (item_id, location_id, quantity, status)
                VALUES (item_id, location_id, device_quantity, 'in_stock')
                RETURNING id INTO inventory_id;
            ELSE
                -- Update existing inventory
                UPDATE "Inventory" 
                SET quantity = device_quantity + (SELECT inv2.quantity FROM "Inventory" inv2 WHERE inv2.id = inventory_id)
                WHERE id = inventory_id;
            END IF;
            
            -- Create DeviceTest record
            INSERT INTO "DeviceTest" (item_id, test_type, test_result, notes)
            VALUES (
                item_id,
                'PHONECHECK',
                test_result,
                'PhoneCheck test for ' || device_brand || ' ' || device_model || ' - Status: ' || working_status
            )
            RETURNING id INTO device_test_id;
            
            -- Create IMEI-related records
            -- imei_sku_info
            INSERT INTO imei_sku_info (imei, sku)
            VALUES (device_imei, device_sku)
            ON CONFLICT (imei) DO UPDATE SET sku = EXCLUDED.sku
            RETURNING id INTO imei_sku_id;
            
            -- imei_inspect_data
            INSERT INTO imei_inspect_data (imei, test_type, test_result)
            VALUES (
                device_imei,
                'PHONECHECK',
                jsonb_build_object(
                    'rawStatus', jsonb_build_object(
                        'failed', device_failed,
                        'working', device_working,
                        'status', test_result
                    ),
                    'batteryHealth', device_battery,
                    'screenCondition', device_screen,
                    'bodyCondition', device_body,
                    'notes', device_notes,
                    'workingStatus', working_status
                )
            )
            ON CONFLICT (imei) DO UPDATE SET 
                test_result = EXCLUDED.test_result,
                updated_at = NOW()
            RETURNING id INTO imei_inspect_id;
            
            -- imei_units
            INSERT INTO imei_units (imei, unit_name, unit_data)
            VALUES (
                device_imei,
                'PHONECHECK_UNIT',
                jsonb_build_object(
                    'deviceName', device_name,
                    'brand', device_brand,
                    'model', device_model,
                    'storage', device_storage,
                    'color', device_color,
                    'carrier', device_carrier,
                    'working', working_status,
                    'batteryHealth', device_battery,
                    'notes', device_notes
                )
            )
            ON CONFLICT (imei) DO UPDATE SET 
                unit_data = EXCLUDED.unit_data,
                updated_at = NOW()
            RETURNING id INTO imei_unit_id;
            
            -- Mark queue item as completed
            UPDATE imei_data_queue 
            SET 
                status = 'completed',
                processed_at = NOW(),
                error_message = NULL
            WHERE id = queue_item.id;
            
            processed_count := processed_count + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Capture the error message
                error_msg := SQLERRM;
                
                -- Mark as failed if processing fails
                UPDATE imei_data_queue 
                SET 
                    status = 'failed',
                    processed_at = NOW(),
                    error_message = error_msg
                WHERE id = queue_item.id;
                
                -- Log the error
                RAISE NOTICE 'Failed to process queue item %: %', queue_item.id, error_msg;
        END;
    END LOOP;
    
    RETURN processed_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_all_pending_queue() TO authenticated;
