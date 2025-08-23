-- Fix Cascade Deletion for IMEI Tables
-- This migration ensures that when an IMEI is deleted from any table, 
-- it cascades to all related tables and archives the data

-- ========================================
-- STEP 1: UPDATE ARCHIVE FUNCTION FOR COMPLETE CASCADE
-- ========================================

CREATE OR REPLACE FUNCTION archive_imei_data()
RETURNS TRIGGER AS $$
DECLARE
    archived_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Archive the deleted record
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
        'cascade_delete'
    );
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Always cascade to all related tables regardless of which table triggered the deletion
    -- Archive and delete from imei_sku_info
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
        'cascade_delete'
    FROM imei_sku_info 
    WHERE imei = OLD.imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Archive and delete from imei_inspect_data
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
        'cascade_delete'
    FROM imei_inspect_data 
    WHERE imei = OLD.imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Archive and delete from imei_units
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
        'cascade_delete'
    FROM imei_units 
    WHERE imei = OLD.imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Archive and delete from imei_data_queue (if any pending items)
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
        'cascade_delete'
    FROM imei_data_queue 
    WHERE raw_data->>'imei' = OLD.imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Now delete from all related tables
    DELETE FROM imei_sku_info WHERE imei = OLD.imei;
    DELETE FROM imei_inspect_data WHERE imei = OLD.imei;
    DELETE FROM imei_units WHERE imei = OLD.imei;
    DELETE FROM imei_data_queue WHERE raw_data->>'imei' = OLD.imei;
    
    -- Also delete from Item table
    DELETE FROM "Item" WHERE imei = OLD.imei;
    
    -- Log the cascade operation
    RAISE NOTICE 'Cascade deletion completed for IMEI %: % records archived', OLD.imei, archived_count;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 2: CREATE A MANUAL CASCADE FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION manual_cascade_delete_imei(target_imei VARCHAR(15))
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
        'manual_cascade_delete'
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
        'manual_cascade_delete'
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
        'manual_cascade_delete'
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
        'manual_cascade_delete'
    FROM imei_data_queue 
    WHERE raw_data->>'imei' = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Delete from all tables
    DELETE FROM imei_sku_info WHERE imei = target_imei;
    DELETE FROM imei_inspect_data WHERE imei = target_imei;
    DELETE FROM imei_units WHERE imei = target_imei;
    DELETE FROM imei_data_queue WHERE raw_data->>'imei' = target_imei;
    DELETE FROM "Item" WHERE imei = target_imei;
    
    RAISE NOTICE 'Manual cascade deletion completed for IMEI %: % records archived', target_imei, archived_count;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 3: ENSURE TRIGGERS ARE ACTIVE
-- ========================================

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_archive_imei_sku_info ON imei_sku_info;
DROP TRIGGER IF EXISTS trigger_archive_imei_inspect_data ON imei_inspect_data;
DROP TRIGGER IF EXISTS trigger_archive_imei_units ON imei_units;

-- Create triggers for all IMEI tables
CREATE TRIGGER trigger_archive_imei_sku_info
    BEFORE DELETE ON imei_sku_info
    FOR EACH ROW
    EXECUTE FUNCTION archive_imei_data();

CREATE TRIGGER trigger_archive_imei_inspect_data
    BEFORE DELETE ON imei_inspect_data
    FOR EACH ROW
    EXECUTE FUNCTION archive_imei_data();

CREATE TRIGGER trigger_archive_imei_units
    BEFORE DELETE ON imei_units
    FOR EACH ROW
    EXECUTE FUNCTION archive_imei_data();

-- ========================================
-- STEP 4: TEST THE CASCADE DELETION
-- ========================================

-- Log the migration
INSERT INTO imei_data_log (
    imei, source, raw_data, processing_status, error_message, processing_time_ms
) VALUES (
    'MIGRATION', 
    'fix-cascade-deletion', 
    ('{"migration": "006_fix_cascade_deletion", "timestamp": "' || NOW() || '"}')::jsonb,
    'success',
    'Cascade deletion fix completed successfully',
    0
);

-- Success message
SELECT 'Cascade deletion fix completed successfully!' as status;
