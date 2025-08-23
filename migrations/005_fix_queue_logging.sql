-- Fix Queue Logging and Item Sync
-- This migration fixes the queue processing and ensures proper data flow

-- ========================================
-- STEP 1: UPDATE LOG PROCESSED QUEUE FUNCTION
-- ========================================

-- Update the function to actually move completed items to log
CREATE OR REPLACE FUNCTION log_processed_queue_item()
RETURNS TRIGGER AS $$
DECLARE
    processing_start_time TIMESTAMPTZ;
    processing_time_ms INTEGER;
    imei_value VARCHAR(15);
BEGIN
    -- Only process when status changes to 'completed' or 'failed'
    IF NEW.status IN ('completed', 'failed') AND OLD.status != NEW.status THEN
        -- Extract IMEI from raw_data
        imei_value := COALESCE(NEW.raw_data->>'imei', 'UNKNOWN');
        
        -- Calculate processing time
        processing_start_time := OLD.created_at;
        processing_time_ms := EXTRACT(EPOCH FROM (NEW.processed_at - processing_start_time)) * 1000;
        
        -- Insert into log
        INSERT INTO imei_data_log (
            queue_id,
            imei,
            source,
            raw_data,
            processing_status,
            error_message,
            processing_time_ms,
            processed_at
        ) VALUES (
            NEW.id,
            imei_value,
            NEW.source,
            NEW.raw_data,
            NEW.status,
            NEW.error_message,
            processing_time_ms,
            NEW.processed_at
        );
        
        -- Delete from queue after logging (as requested)
        DELETE FROM imei_data_queue WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 2: MANUALLY PROCESS EXISTING COMPLETED ITEMS
-- ========================================

-- Move all existing completed items to log (handle duplicates)
INSERT INTO imei_data_log (
    queue_id,
    imei,
    source,
    raw_data,
    processing_status,
    error_message,
    processing_time_ms,
    processed_at
)
SELECT DISTINCT ON (id)
    id,
    COALESCE(raw_data->>'imei', 'UNKNOWN'),
    source,
    raw_data,
    status,
    error_message,
    EXTRACT(EPOCH FROM (processed_at - created_at)) * 1000,
    processed_at
FROM imei_data_queue 
WHERE status = 'completed'
ORDER BY id, created_at DESC;

-- Delete completed items from queue
DELETE FROM imei_data_queue WHERE status = 'completed';

-- ========================================
-- STEP 3: ENSURE ITEM SYNC IS WORKING
-- ========================================

-- Check if sync functions exist and recreate if needed
CREATE OR REPLACE FUNCTION sync_imei_to_item()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update Item table when IMEI data changes
    INSERT INTO "Item" (
        imei, sku, name, description, brand, model, "modelNumber", 
        storage, color, carrier, type, "serialNumber", "isActive",
        "createdAt", "updatedAt", condition, "batteryHealth", "testResults"
    ) VALUES (
        NEW.imei,
        NEW.sku,
        COALESCE(NEW.brand || ' ' || NEW.model, 'Unknown Device'),
        COALESCE(NEW.brand || ' ' || NEW.model || ' ' || NEW.storage || ' ' || NEW.color, ''),
        NEW.brand,
        NEW.model,
        NEW.model_number,
        NEW.storage,
        NEW.color,
        NEW.carrier,
        'phone',
        NULL, -- serial_number will be updated from imei_units
        true,
        NEW.created_at,
        NEW.updated_at,
        'UNKNOWN',
        NULL, -- battery_health will be updated from imei_inspect_data
        NULL  -- test_results will be updated from imei_inspect_data
    )
    ON CONFLICT (imei) DO UPDATE SET
        sku = EXCLUDED.sku,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        "modelNumber" = EXCLUDED."modelNumber",
        storage = EXCLUDED.storage,
        color = EXCLUDED.color,
        carrier = EXCLUDED.carrier,
        "updatedAt" = EXCLUDED."updatedAt";
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_inspect_to_item()
RETURNS TRIGGER AS $$
BEGIN
    -- Update Item table with inspection data
    UPDATE "Item" SET
        "batteryHealth" = NEW.battery_health,
        "testResults" = NEW.test_results,
        working = CASE WHEN NEW.passed THEN 'YES' ELSE 'NO' END,
        "updatedAt" = NOW()
    WHERE imei = NEW.imei;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_unit_to_item()
RETURNS TRIGGER AS $$
BEGIN
    -- Update Item table with unit data
    UPDATE "Item" SET
        "serialNumber" = NEW.serial_number,
        condition = NEW.condition,
        "updatedAt" = NOW()
    WHERE imei = NEW.imei;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 4: ENSURE TRIGGERS ARE ACTIVE
-- ========================================

-- Drop and recreate triggers to ensure they're active
DROP TRIGGER IF EXISTS trigger_sync_imei_to_item ON imei_sku_info;
DROP TRIGGER IF EXISTS trigger_sync_inspect_to_item ON imei_inspect_data;
DROP TRIGGER IF EXISTS trigger_sync_unit_to_item ON imei_units;
DROP TRIGGER IF EXISTS trigger_log_processed_queue ON imei_data_queue;

-- Create triggers for automatic sync
CREATE TRIGGER trigger_sync_imei_to_item
    AFTER INSERT OR UPDATE ON imei_sku_info
    FOR EACH ROW
    EXECUTE FUNCTION sync_imei_to_item();

CREATE TRIGGER trigger_sync_inspect_to_item
    AFTER INSERT OR UPDATE ON imei_inspect_data
    FOR EACH ROW
    EXECUTE FUNCTION sync_inspect_to_item();

CREATE TRIGGER trigger_sync_unit_to_item
    AFTER INSERT OR UPDATE ON imei_units
    FOR EACH ROW
    EXECUTE FUNCTION sync_unit_to_item();

-- Create trigger for queue logging
CREATE TRIGGER trigger_log_processed_queue
    AFTER UPDATE ON imei_data_queue
    FOR EACH ROW
    EXECUTE FUNCTION log_processed_queue_item();

-- ========================================
-- STEP 5: MANUALLY SYNC EXISTING DATA (FIXED)
-- ========================================

-- First, let's see what data we have
DO $$
DECLARE
    imei_count INTEGER;
    item_count INTEGER;
BEGIN
    -- Count existing data
    SELECT COUNT(*) INTO imei_count FROM imei_sku_info;
    SELECT COUNT(*) INTO item_count FROM "Item";
    
    RAISE NOTICE 'Found % IMEI records and % Item records', imei_count, item_count;
END $$;

-- Sync existing IMEI data to Item table (handle duplicates properly)
WITH unique_imei_data AS (
    SELECT DISTINCT ON (isi.imei)
        isi.imei,
        isi.sku,
        COALESCE(isi.brand || ' ' || isi.model, 'Unknown Device') as name,
        COALESCE(isi.brand || ' ' || isi.model || ' ' || isi.storage || ' ' || isi.color, '') as description,
        isi.brand,
        isi.model,
        isi.model_number,
        isi.storage,
        isi.color,
        isi.carrier,
        iu.serial_number,
        isi.created_at,
        isi.updated_at,
        COALESCE(iu.condition, 'UNKNOWN') as condition,
        iid.battery_health,
        iid.test_results
    FROM imei_sku_info isi
    LEFT JOIN imei_units iu ON isi.imei = iu.imei
    LEFT JOIN imei_inspect_data iid ON isi.imei = iid.imei
    ORDER BY isi.imei, isi.updated_at DESC
)
INSERT INTO "Item" (
    imei, sku, name, description, brand, model, "modelNumber", 
    storage, color, carrier, type, "serialNumber", "isActive",
    "createdAt", "updatedAt", condition, "batteryHealth", "testResults"
)
SELECT 
    imei,
    sku,
    name,
    description,
    brand,
    model,
    model_number,
    storage,
    color,
    carrier,
    'phone',
    serial_number,
    true,
    created_at,
    updated_at,
    condition,
    battery_health,
    test_results
FROM unique_imei_data
WHERE NOT EXISTS (
    SELECT 1 FROM "Item" i WHERE i.imei = unique_imei_data.imei
)
ON CONFLICT (imei) DO UPDATE SET
    sku = EXCLUDED.sku,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    brand = EXCLUDED.brand,
    model = EXCLUDED.model,
    "modelNumber" = EXCLUDED."modelNumber",
    storage = EXCLUDED.storage,
    color = EXCLUDED.color,
    carrier = EXCLUDED.carrier,
    "serialNumber" = EXCLUDED."serialNumber",
    condition = EXCLUDED.condition,
    "batteryHealth" = EXCLUDED."batteryHealth",
    "testResults" = EXCLUDED."testResults",
    "updatedAt" = NOW();

-- ========================================
-- STEP 6: VERIFICATION QUERIES
-- ========================================

-- Log the migration
INSERT INTO imei_data_log (
    imei, source, raw_data, processing_status, error_message, processing_time_ms
) VALUES (
    'MIGRATION', 
    'fix-queue-logging', 
    ('{"migration": "005_fix_queue_logging", "timestamp": "' || NOW() || '"}')::jsonb,
    'success',
    'Queue logging fix completed successfully',
    0
);

-- Success message
SELECT 'Queue logging fix completed successfully!' as status;
