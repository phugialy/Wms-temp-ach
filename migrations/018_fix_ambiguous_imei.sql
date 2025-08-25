-- ========================================
-- FIX AMBIGUOUS IMEI COLUMN REFERENCES
-- ========================================

-- Fixed function to process all pending queue items and create actual database records
-- This version fixes all ambiguous column references
CREATE OR REPLACE FUNCTION process_all_pending_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    processed_count INTEGER := 0;
    queue_item RECORD;
    raw_data JSONB;
    imei TEXT;
    name TEXT;
    brand TEXT;
    model TEXT;
    storage TEXT;
    color TEXT;
    carrier TEXT;
    device_type TEXT;
    serial_number TEXT;
    quantity INTEGER;
    location TEXT;
    working TEXT;
    failed TEXT;
    battery_health TEXT;
    screen_condition TEXT;
    body_condition TEXT;
    notes TEXT;
    sku TEXT;
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
            
            -- Extract data from raw_data
            imei := raw_data->>'imei';
            name := raw_data->>'name';
            brand := raw_data->>'brand';
            model := raw_data->>'model';
            storage := raw_data->>'storage';
            color := raw_data->>'color';
            carrier := raw_data->>'carrier';
            device_type := raw_data->>'type';
            serial_number := raw_data->>'serialNumber';
            quantity := COALESCE((raw_data->>'quantity')::INTEGER, 1);
            location := raw_data->>'location';
            working := raw_data->>'working';
            failed := raw_data->>'failed';
            battery_health := raw_data->>'batteryHealth';
            screen_condition := raw_data->>'screenCondition';
            body_condition := raw_data->>'bodyCondition';
            notes := raw_data->>'notes';
            
            -- Validate required fields
            IF imei IS NULL OR imei = '' THEN
                RAISE EXCEPTION 'IMEI is required but was null or empty';
            END IF;
            
            IF name IS NULL OR name = '' THEN
                RAISE EXCEPTION 'Name is required but was null or empty';
            END IF;
            
            IF brand IS NULL OR brand = '' THEN
                RAISE EXCEPTION 'Brand is required but was null or empty';
            END IF;
            
            IF model IS NULL OR model = '' THEN
                RAISE EXCEPTION 'Model is required but was null or empty';
            END IF;
            
            -- Generate SKU if not provided
            IF raw_data->>'sku' IS NULL OR raw_data->>'sku' = '' THEN
                sku := UPPER(brand || '-' || model || '-' || COALESCE(storage, '') || '-' || COALESCE(color, '') || '-' || COALESCE(carrier, 'UNLOCKED'));
            ELSE
                sku := raw_data->>'sku';
            END IF;
            
            -- Determine working status
            IF working = 'YES' OR working = 'true' OR working = 'TRUE' THEN
                working_status := 'YES';
                test_result := 'PASSED';
            ELSIF failed = 'YES' OR failed = 'true' OR failed = 'TRUE' THEN
                working_status := 'NO';
                test_result := 'FAILED';
            ELSE
                working_status := 'PENDING';
                test_result := 'PENDING';
            END IF;
            
            -- Find or create location
            SELECT l.id INTO location_id FROM "Location" l WHERE l.name = location LIMIT 1;
            IF location_id IS NULL THEN
                -- Create default location if not found
                INSERT INTO "Location" (name, warehouse_id, description) 
                VALUES (location, 1, 'Auto-created location for ' || location)
                RETURNING id INTO location_id;
            END IF;
            
            -- Create or update Item record
            SELECT i.id INTO item_id FROM "Item" i WHERE i.imei = imei;
            IF item_id IS NULL THEN
                -- Create new item
                INSERT INTO "Item" (imei, name, sku, description, status)
                VALUES (
                    imei,
                    name,
                    sku,
                    brand || ' ' || model || ' ' || COALESCE(storage, '') || ' ' || COALESCE(color, '') || ' ' || COALESCE(carrier, ''),
                    'active'
                )
                RETURNING id INTO item_id;
            ELSE
                -- Update existing item
                UPDATE "Item" 
                SET 
                    name = name,
                    sku = sku,
                    description = brand || ' ' || model || ' ' || COALESCE(storage, '') || ' ' || COALESCE(color, '') || ' ' || COALESCE(carrier, '')
                WHERE id = item_id;
            END IF;
            
            -- Create or update Inventory record
            SELECT inv.id INTO inventory_id FROM "Inventory" inv WHERE inv.item_id = item_id AND inv.location_id = location_id;
            IF inventory_id IS NULL THEN
                -- Create new inventory record
                INSERT INTO "Inventory" (item_id, location_id, quantity, status)
                VALUES (item_id, location_id, quantity, 'in_stock')
                RETURNING id INTO inventory_id;
            ELSE
                -- Update existing inventory
                UPDATE "Inventory" 
                SET quantity = quantity + (SELECT inv2.quantity FROM "Inventory" inv2 WHERE inv2.id = inventory_id)
                WHERE id = inventory_id;
            END IF;
            
            -- Create DeviceTest record
            INSERT INTO "DeviceTest" (item_id, test_type, test_result, notes)
            VALUES (
                item_id,
                'PHONECHECK',
                test_result,
                'PhoneCheck test for ' || brand || ' ' || model || ' - Status: ' || working_status
            )
            RETURNING id INTO device_test_id;
            
            -- Create IMEI-related records
            -- imei_sku_info
            INSERT INTO imei_sku_info (imei, sku)
            VALUES (imei, sku)
            ON CONFLICT (imei) DO UPDATE SET sku = EXCLUDED.sku
            RETURNING id INTO imei_sku_id;
            
            -- imei_inspect_data
            INSERT INTO imei_inspect_data (imei, test_type, test_result)
            VALUES (
                imei,
                'PHONECHECK',
                jsonb_build_object(
                    'rawStatus', jsonb_build_object(
                        'failed', failed,
                        'working', working,
                        'status', test_result
                    ),
                    'batteryHealth', battery_health,
                    'screenCondition', screen_condition,
                    'bodyCondition', body_condition,
                    'notes', notes,
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
                imei,
                'PHONECHECK_UNIT',
                jsonb_build_object(
                    'deviceName', name,
                    'brand', brand,
                    'model', model,
                    'storage', storage,
                    'color', color,
                    'carrier', carrier,
                    'working', working_status,
                    'batteryHealth', battery_health,
                    'notes', notes
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
