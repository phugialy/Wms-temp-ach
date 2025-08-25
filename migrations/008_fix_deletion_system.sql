-- Migration 008: Fix Deletion System
-- This migration creates a comprehensive deletion system that works both via API and direct database access

-- 1. Create the missing cleanup_imei_data function
CREATE OR REPLACE FUNCTION public.cleanup_imei_data(target_imei TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    archived_count INTEGER := 0;
    temp_count INTEGER := 0;
    item_id INTEGER;
BEGIN
    -- Log the cleanup attempt
    RAISE NOTICE 'Starting cleanup for IMEI: %', target_imei;
    
    -- Find the item ID for this IMEI
    SELECT id INTO item_id FROM "Item" WHERE imei = target_imei LIMIT 1;
    
    -- Archive and delete from imei_sku_info
    INSERT INTO imei_sku_info_archive (imei, sku, created_at, archived_at, archive_reason)
    SELECT imei, sku, created_at, NOW(), 'Manual cleanup via API'
    FROM imei_sku_info 
    WHERE imei = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    DELETE FROM imei_sku_info WHERE imei = target_imei;
    
    -- Archive and delete from imei_inspect_data
    INSERT INTO imei_inspect_data_archive (imei, test_type, passed, created_at, archived_at, archive_reason)
    SELECT imei, test_type, passed, created_at, NOW(), 'Manual cleanup via API'
    FROM imei_inspect_data 
    WHERE imei = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    DELETE FROM imei_inspect_data WHERE imei = target_imei;
    
    -- Archive and delete from imei_units
    INSERT INTO imei_units_archive (imei, location, created_at, archived_at, archive_reason)
    SELECT imei, location, created_at, NOW(), 'Manual cleanup via API'
    FROM imei_units 
    WHERE imei = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    DELETE FROM imei_units WHERE imei = target_imei;
    
    -- Archive and delete from imei_data_queue
    INSERT INTO imei_data_queue_archive (imei, status, created_at, archived_at, archive_reason)
    SELECT imei, status, created_at, NOW(), 'Manual cleanup via API'
    FROM imei_data_queue 
    WHERE imei = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    DELETE FROM imei_data_queue WHERE imei = target_imei;
    
    -- Archive and delete from DeviceTest
    INSERT INTO device_test_archive (item_id, test_type, test_results, passed, notes, tested_by, created_at, archived_at, archive_reason)
    SELECT item_id, test_type, test_results, passed, notes, tested_by, created_at, NOW(), 'Manual cleanup via API'
    FROM "DeviceTest" 
    WHERE item_id = item_id;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    DELETE FROM "DeviceTest" WHERE item_id = item_id;
    
    -- Archive and delete from Inventory
    INSERT INTO inventory_archive (item_id, location_id, sku, quantity, reserved, available, created_at, archived_at, archive_reason)
    SELECT item_id, location_id, sku, quantity, reserved, available, created_at, NOW(), 'Manual cleanup via API'
    FROM "Inventory" 
    WHERE item_id = item_id;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    DELETE FROM "Inventory" WHERE item_id = item_id;
    
    -- Archive and delete from Item (main table)
    INSERT INTO item_archive (id, name, brand, model, storage, color, carrier, type, imei, serial_number, sku, condition, battery_health, screen_condition, body_condition, test_results, working, is_active, created_at, archived_at, archive_reason)
    SELECT id, name, brand, model, storage, color, carrier, type, imei, serial_number, sku, condition, battery_health, screen_condition, body_condition, test_results, working, is_active, created_at, NOW(), 'Manual cleanup via API'
    FROM "Item" 
    WHERE imei = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    DELETE FROM "Item" WHERE imei = target_imei;
    
    RAISE NOTICE 'Cleanup completed for IMEI: %. Archived % records', target_imei, archived_count;
    
    RETURN archived_count;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during cleanup for IMEI %: %', target_imei, SQLERRM;
        RETURN -1;
END;
$$;

-- 2. Create bulk deletion function for multiple IMEIs
CREATE OR REPLACE FUNCTION public.cleanup_multiple_imei_data(imei_list TEXT[])
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_archived INTEGER := 0;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
    imei TEXT;
    archived_count INTEGER;
BEGIN
    -- Initialize result structure
    result := '{"success": true, "total_processed": 0, "success_count": 0, "error_count": 0, "total_archived": 0, "errors": []}'::JSON;
    
    -- Process each IMEI
    FOREACH imei IN ARRAY imei_list
    LOOP
        BEGIN
            archived_count := public.cleanup_imei_data(imei);
            IF archived_count >= 0 THEN
                success_count := success_count + 1;
                total_archived := total_archived + archived_count;
            ELSE
                error_count := error_count + 1;
                result := jsonb_set(result::jsonb, '{errors}', 
                    (result->'errors')::jsonb || jsonb_build_object('imei', imei, 'error', 'Cleanup failed'));
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                error_count := error_count + 1;
                result := jsonb_set(result::jsonb, '{errors}', 
                    (result->'errors')::jsonb || jsonb_build_object('imei', imei, 'error', SQLERRM));
        END;
    END LOOP;
    
    -- Update result with final counts
    result := jsonb_set(result::jsonb, '{total_processed}', to_jsonb(array_length(imei_list, 1)));
    result := jsonb_set(result::jsonb, '{success_count}', to_jsonb(success_count));
    result := jsonb_set(result::jsonb, '{error_count}', to_jsonb(error_count));
    result := jsonb_set(result::jsonb, '{total_archived}', to_jsonb(total_archived));
    
    RETURN result;
END;
$$;

-- 3. Create function to delete all data (nuclear option)
CREATE OR REPLACE FUNCTION public.cleanup_all_imei_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_archived INTEGER := 0;
    temp_count INTEGER := 0;
BEGIN
    -- Archive all data before deletion
    -- Archive imei_sku_info
    INSERT INTO imei_sku_info_archive (imei, sku, created_at, archived_at, archive_reason)
    SELECT imei, sku, created_at, NOW(), 'Bulk cleanup all data'
    FROM imei_sku_info;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    DELETE FROM imei_sku_info;
    
    -- Archive imei_inspect_data
    INSERT INTO imei_inspect_data_archive (imei, test_type, passed, created_at, archived_at, archive_reason)
    SELECT imei, test_type, passed, created_at, NOW(), 'Bulk cleanup all data'
    FROM imei_inspect_data;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    DELETE FROM imei_inspect_data;
    
    -- Archive imei_units
    INSERT INTO imei_units_archive (imei, location, created_at, archived_at, archive_reason)
    SELECT imei, location, created_at, NOW(), 'Bulk cleanup all data'
    FROM imei_units;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    DELETE FROM imei_units;
    
    -- Archive imei_data_queue
    INSERT INTO imei_data_queue_archive (imei, status, created_at, archived_at, archive_reason)
    SELECT imei, status, created_at, NOW(), 'Bulk cleanup all data'
    FROM imei_data_queue;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    DELETE FROM imei_data_queue;
    
    -- Archive DeviceTest
    INSERT INTO device_test_archive (item_id, test_type, test_results, passed, notes, tested_by, created_at, archived_at, archive_reason)
    SELECT item_id, test_type, test_results, passed, notes, tested_by, created_at, NOW(), 'Bulk cleanup all data'
    FROM "DeviceTest";
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    DELETE FROM "DeviceTest";
    
    -- Archive Inventory
    INSERT INTO inventory_archive (item_id, location_id, sku, quantity, reserved, available, created_at, archived_at, archive_reason)
    SELECT item_id, location_id, sku, quantity, reserved, available, created_at, NOW(), 'Bulk cleanup all data'
    FROM "Inventory";
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    DELETE FROM "Inventory";
    
    -- Archive Item
    INSERT INTO item_archive (id, name, brand, model, storage, color, carrier, type, imei, serial_number, sku, condition, battery_health, screen_condition, body_condition, test_results, working, is_active, created_at, archived_at, archive_reason)
    SELECT id, name, brand, model, storage, color, carrier, type, imei, serial_number, sku, condition, battery_health, screen_condition, body_condition, test_results, working, is_active, created_at, NOW(), 'Bulk cleanup all data'
    FROM "Item";
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    DELETE FROM "Item";
    
    result := jsonb_build_object(
        'success', true,
        'message', 'All IMEI data has been archived and deleted',
        'total_archived', total_archived,
        'timestamp', NOW()
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        result := jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'timestamp', NOW()
        );
        RETURN result;
END;
$$;

-- 4. Create archive tables if they don't exist
CREATE TABLE IF NOT EXISTS imei_sku_info_archive (
    id SERIAL PRIMARY KEY,
    imei TEXT,
    sku TEXT,
    created_at TIMESTAMP,
    archived_at TIMESTAMP DEFAULT NOW(),
    archive_reason TEXT
);

CREATE TABLE IF NOT EXISTS imei_inspect_data_archive (
    id SERIAL PRIMARY KEY,
    imei TEXT,
    test_type TEXT,
    passed BOOLEAN,
    created_at TIMESTAMP,
    archived_at TIMESTAMP DEFAULT NOW(),
    archive_reason TEXT
);

CREATE TABLE IF NOT EXISTS imei_units_archive (
    id SERIAL PRIMARY KEY,
    imei TEXT,
    location TEXT,
    created_at TIMESTAMP,
    archived_at TIMESTAMP DEFAULT NOW(),
    archive_reason TEXT
);

CREATE TABLE IF NOT EXISTS imei_data_queue_archive (
    id SERIAL PRIMARY KEY,
    imei TEXT,
    status TEXT,
    created_at TIMESTAMP,
    archived_at TIMESTAMP DEFAULT NOW(),
    archive_reason TEXT
);

CREATE TABLE IF NOT EXISTS device_test_archive (
    id SERIAL PRIMARY KEY,
    item_id INTEGER,
    test_type TEXT,
    test_results JSONB,
    passed BOOLEAN,
    notes TEXT,
    tested_by TEXT,
    created_at TIMESTAMP,
    archived_at TIMESTAMP DEFAULT NOW(),
    archive_reason TEXT
);

CREATE TABLE IF NOT EXISTS inventory_archive (
    id SERIAL PRIMARY KEY,
    item_id INTEGER,
    location_id INTEGER,
    sku TEXT,
    quantity INTEGER,
    reserved INTEGER,
    available INTEGER,
    created_at TIMESTAMP,
    archived_at TIMESTAMP DEFAULT NOW(),
    archive_reason TEXT
);

CREATE TABLE IF NOT EXISTS item_archive (
    id INTEGER,
    name TEXT,
    brand TEXT,
    model TEXT,
    storage TEXT,
    color TEXT,
    carrier TEXT,
    type TEXT,
    imei TEXT,
    serial_number TEXT,
    sku TEXT,
    condition TEXT,
    battery_health INTEGER,
    screen_condition TEXT,
    body_condition TEXT,
    test_results JSONB,
    working TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMP,
    archived_at TIMESTAMP DEFAULT NOW(),
    archive_reason TEXT
);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_imei_sku_info_archive_imei ON imei_sku_info_archive(imei);
CREATE INDEX IF NOT EXISTS idx_imei_inspect_data_archive_imei ON imei_inspect_data_archive(imei);
CREATE INDEX IF NOT EXISTS idx_imei_units_archive_imei ON imei_units_archive(imei);
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_archive_imei ON imei_data_queue_archive(imei);
CREATE INDEX IF NOT EXISTS idx_device_test_archive_item_id ON device_test_archive(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_archive_item_id ON inventory_archive(item_id);
CREATE INDEX IF NOT EXISTS idx_item_archive_imei ON item_archive(imei);

-- 6. Create view for easy access to archived data
CREATE OR REPLACE VIEW archived_imei_data AS
SELECT 
    'imei_sku_info' as table_name,
    imei,
    archived_at,
    archive_reason
FROM imei_sku_info_archive
UNION ALL
SELECT 
    'imei_inspect_data' as table_name,
    imei,
    archived_at,
    archive_reason
FROM imei_inspect_data_archive
UNION ALL
SELECT 
    'imei_units' as table_name,
    imei,
    archived_at,
    archive_reason
FROM imei_units_archive
UNION ALL
SELECT 
    'imei_data_queue' as table_name,
    imei,
    archived_at,
    archive_reason
FROM imei_data_queue_archive
UNION ALL
SELECT 
    'item' as table_name,
    imei,
    archived_at,
    archive_reason
FROM item_archive;

-- 7. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.cleanup_imei_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_multiple_imei_data(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_all_imei_data() TO authenticated;
GRANT SELECT ON archived_imei_data TO authenticated;

-- 8. Create a function to restore archived data (optional)
CREATE OR REPLACE FUNCTION public.restore_imei_data(target_imei TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    restored_count INTEGER := 0;
    temp_count INTEGER := 0;
BEGIN
    -- Restore from item_archive
    INSERT INTO "Item" (id, name, brand, model, storage, color, carrier, type, imei, serial_number, sku, condition, battery_health, screen_condition, body_condition, test_results, working, is_active, created_at)
    SELECT id, name, brand, model, storage, color, carrier, type, imei, serial_number, sku, condition, battery_health, screen_condition, body_condition, test_results, working, is_active, created_at
    FROM item_archive 
    WHERE imei = target_imei
    ON CONFLICT (id) DO NOTHING;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    restored_count := restored_count + temp_count;
    
    -- Restore from imei_sku_info_archive
    INSERT INTO imei_sku_info (imei, sku, created_at)
    SELECT imei, sku, created_at
    FROM imei_sku_info_archive 
    WHERE imei = target_imei
    ON CONFLICT (imei) DO NOTHING;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    restored_count := restored_count + temp_count;
    
    -- Restore from imei_inspect_data_archive
    INSERT INTO imei_inspect_data (imei, test_type, passed, created_at)
    SELECT imei, test_type, passed, created_at
    FROM imei_inspect_data_archive 
    WHERE imei = target_imei
    ON CONFLICT (imei) DO NOTHING;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    restored_count := restored_count + temp_count;
    
    result := jsonb_build_object(
        'success', true,
        'message', 'IMEI data restored successfully',
        'restored_count', restored_count,
        'imei', target_imei
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        result := jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'imei', target_imei
        );
        RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_imei_data(TEXT) TO authenticated;

-- 9. Add comments for documentation
COMMENT ON FUNCTION public.cleanup_imei_data(TEXT) IS 'Deletes and archives all data for a specific IMEI. Returns the number of archived records.';
COMMENT ON FUNCTION public.cleanup_multiple_imei_data(TEXT[]) IS 'Deletes and archives data for multiple IMEIs. Returns detailed results including success/error counts.';
COMMENT ON FUNCTION public.cleanup_all_imei_data() IS 'Nuclear option: Deletes and archives ALL IMEI data from the database. Use with extreme caution.';
COMMENT ON FUNCTION public.restore_imei_data(TEXT) IS 'Restores archived data for a specific IMEI.';
COMMENT ON VIEW archived_imei_data IS 'View showing all archived IMEI data across all tables.';

-- 10. Create a function to get deletion statistics
CREATE OR REPLACE FUNCTION public.get_deletion_stats()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT jsonb_build_object(
        'current_data', jsonb_build_object(
            'items', (SELECT COUNT(*) FROM "Item"),
            'imei_sku_info', (SELECT COUNT(*) FROM imei_sku_info),
            'imei_inspect_data', (SELECT COUNT(*) FROM imei_inspect_data),
            'imei_units', (SELECT COUNT(*) FROM imei_units),
            'imei_data_queue', (SELECT COUNT(*) FROM imei_data_queue),
            'device_tests', (SELECT COUNT(*) FROM "DeviceTest"),
            'inventory', (SELECT COUNT(*) FROM "Inventory")
        ),
        'archived_data', jsonb_build_object(
            'items', (SELECT COUNT(*) FROM item_archive),
            'imei_sku_info', (SELECT COUNT(*) FROM imei_sku_info_archive),
            'imei_inspect_data', (SELECT COUNT(*) FROM imei_inspect_data_archive),
            'imei_units', (SELECT COUNT(*) FROM imei_units_archive),
            'imei_data_queue', (SELECT COUNT(*) FROM imei_data_queue_archive),
            'device_tests', (SELECT COUNT(*) FROM device_test_archive),
            'inventory', (SELECT COUNT(*) FROM inventory_archive)
        ),
        'recent_deletions', (
            SELECT jsonb_agg(jsonb_build_object(
                'imei', imei,
                'table_name', table_name,
                'archived_at', archived_at,
                'archive_reason', archive_reason
            ))
            FROM archived_imei_data 
            WHERE archived_at > NOW() - INTERVAL '24 hours'
            ORDER BY archived_at DESC
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_deletion_stats() TO authenticated;

COMMENT ON FUNCTION public.get_deletion_stats() IS 'Returns statistics about current and archived data, plus recent deletions.';
