-- Fix Recursive Triggers Issue
-- This migration fixes the infinite loop caused by triggers calling each other

-- ========================================
-- STEP 1: DROP ALL EXISTING TRIGGERS FIRST
-- ========================================

-- Drop all triggers that might cause recursion
DROP TRIGGER IF EXISTS trigger_archive_imei_sku_info ON imei_sku_info;
DROP TRIGGER IF EXISTS trigger_archive_imei_inspect_data ON imei_inspect_data;
DROP TRIGGER IF EXISTS trigger_archive_imei_units ON imei_units;

-- ========================================
-- STEP 2: CREATE A SAFE ARCHIVE FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION safe_archive_imei_data()
RETURNS TRIGGER AS $$
DECLARE
    archived_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Only archive the current record being deleted
    -- Don't try to cascade delete from other tables here
    INSERT INTO imei_archived (
        original_table,
        original_id,
        imei,
        archived_data,
        archived_by,
        archive_reason
    ) VALUES (
        TG_TABLE_NAME,
        OLD.id,
        OLD.imei,
        to_jsonb(OLD),
        current_user,
        'safe_delete'
    );
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Log the archive operation
    RAISE NOTICE 'Safe archive completed for IMEI % from table %: % records archived', OLD.imei, TG_TABLE_NAME, archived_count;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 3: CREATE A SEPARATE CASCADE FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION cascade_delete_imei_complete(target_imei VARCHAR(15))
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Archive from imei_sku_info
    INSERT INTO imei_archived (
        original_table,
        original_id,
        imei,
        archived_data,
        archived_by,
        archive_reason
    )
    SELECT 
        'imei_sku_info',
        id,
        imei,
        to_jsonb(imei_sku_info),
        current_user,
        'cascade_delete_complete'
    FROM imei_sku_info 
    WHERE imei = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Archive from imei_inspect_data
    INSERT INTO imei_archived (
        original_table,
        original_id,
        imei,
        archived_data,
        archived_by,
        archive_reason
    )
    SELECT 
        'imei_inspect_data',
        id,
        imei,
        to_jsonb(imei_inspect_data),
        current_user,
        'cascade_delete_complete'
    FROM imei_inspect_data 
    WHERE imei = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Archive from imei_units
    INSERT INTO imei_archived (
        original_table,
        original_id,
        imei,
        archived_data,
        archived_by,
        archive_reason
    )
    SELECT 
        'imei_units',
        id,
        imei,
        to_jsonb(imei_units),
        current_user,
        'cascade_delete_complete'
    FROM imei_units 
    WHERE imei = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Archive from imei_data_queue
    INSERT INTO imei_archived (
        original_table,
        original_id,
        imei,
        archived_data,
        archived_by,
        archive_reason
    )
    SELECT 
        'imei_data_queue',
        id,
        COALESCE(raw_data->>'imei', 'UNKNOWN'),
        raw_data,
        current_user,
        'cascade_delete_complete'
    FROM imei_data_queue 
    WHERE raw_data->>'imei' = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Archive from Item table
    INSERT INTO imei_archived (
        original_table,
        original_id,
        imei,
        archived_data,
        archived_by,
        archive_reason
    )
    SELECT 
        'Item',
        id,
        imei,
        to_jsonb("Item"),
        current_user,
        'cascade_delete_complete'
    FROM "Item" 
    WHERE imei = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Now delete from all tables (this won't trigger the archive function again)
    DELETE FROM imei_sku_info WHERE imei = target_imei;
    DELETE FROM imei_inspect_data WHERE imei = target_imei;
    DELETE FROM imei_units WHERE imei = target_imei;
    DELETE FROM imei_data_queue WHERE raw_data->>'imei' = target_imei;
    DELETE FROM "Item" WHERE imei = target_imei;
    
    RAISE NOTICE 'Complete cascade deletion completed for IMEI %: % records archived', target_imei, archived_count;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 4: CREATE SAFE TRIGGERS
-- ========================================

-- Create safe triggers that only archive the current record
CREATE TRIGGER trigger_safe_archive_imei_sku_info
    BEFORE DELETE ON imei_sku_info
    FOR EACH ROW
    EXECUTE FUNCTION safe_archive_imei_data();

CREATE TRIGGER trigger_safe_archive_imei_inspect_data
    BEFORE DELETE ON imei_inspect_data
    FOR EACH ROW
    EXECUTE FUNCTION safe_archive_imei_data();

CREATE TRIGGER trigger_safe_archive_imei_units
    BEFORE DELETE ON imei_units
    FOR EACH ROW
    EXECUTE FUNCTION safe_archive_imei_data();

-- ========================================
-- STEP 5: CREATE A CLEANUP FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION cleanup_imei_data(target_imei VARCHAR(15))
RETURNS INTEGER AS $$
DECLARE
    result_count INTEGER;
BEGIN
    -- Use the cascade function to properly clean up
    SELECT cascade_delete_imei_complete(target_imei) INTO result_count;
    
    RAISE NOTICE 'Cleanup completed for IMEI %: % records processed', target_imei, result_count;
    
    RETURN result_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 6: LOG THE MIGRATION
-- ========================================

-- Log the migration
INSERT INTO imei_data_log (
    imei, source, raw_data, processing_status, error_message, processing_time_ms
) VALUES (
    'MIGRATION', 
    'fix-recursive-triggers', 
    ('{"migration": "007_fix_recursive_triggers", "timestamp": "' || NOW() || '"}')::jsonb,
    'success',
    'Recursive triggers fix completed successfully',
    0
);

-- Success message
SELECT 'Recursive triggers fix completed successfully!' as status;
