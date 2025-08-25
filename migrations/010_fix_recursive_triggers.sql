-- Migration 010: Fix Recursive Trigger Issue
-- This migration specifically addresses the "stack depth limit exceeded" error
-- by disabling problematic triggers and creating a safe deletion system

-- ========================================
-- STEP 1: DISABLE PROBLEMATIC TRIGGERS
-- ========================================

-- Disable all triggers that might cause recursion
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    -- Disable all triggers on IMEI-related tables
    FOR trigger_record IN 
        SELECT 
            n.nspname as schemaname,
            c.relname as tablename,
            t.tgname as triggername
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND c.relname IN (
            'Item',
            'imei_sku_info',
            'imei_inspect_data', 
            'imei_units',
            'imei_data_queue',
            'DeviceTest',
            'Inventory'
        )
        AND t.tgenabled = 'O'  -- Only enabled triggers
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER %I', 
            trigger_record.schemaname, 
            trigger_record.tablename, 
            trigger_record.triggername
        );
        RAISE NOTICE 'Disabled trigger % on table %', 
            trigger_record.triggername, 
            trigger_record.tablename;
    END LOOP;
END $$;

-- ========================================
-- STEP 2: CREATE SAFE DELETION FUNCTION
-- ========================================

-- Create a simple, safe deletion function without triggers
CREATE OR REPLACE FUNCTION safe_delete_imei_data(target_imei TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    deleted_count INTEGER := 0;
    temp_count INTEGER;
    item_id INTEGER;
BEGIN
    -- Initialize result
    result := jsonb_build_object(
        'success', true,
        'imei', target_imei,
        'deleted_count', 0,
        'errors', '[]'::jsonb,
        'timestamp', NOW()
    );
    
    -- Get the Item ID for this IMEI
    SELECT id INTO item_id FROM "Item" WHERE imei = target_imei LIMIT 1;
    
    IF item_id IS NULL THEN
        result := jsonb_set(result::jsonb, '{success}', 'false'::jsonb);
        result := jsonb_set(result::jsonb, '{error}', '"IMEI not found"'::jsonb);
        RETURN result;
    END IF;
    
    -- Delete in safe order (no triggers, no recursion)
    BEGIN
        -- 1. Delete DeviceTest records
        DELETE FROM "DeviceTest" WHERE item_id = item_id;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
        -- 2. Delete Inventory records  
        DELETE FROM "Inventory" WHERE item_id = item_id;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
        -- 3. Delete imei_inspect_data records
        DELETE FROM imei_inspect_data WHERE imei = target_imei;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
        -- 4. Delete imei_units records
        DELETE FROM imei_units WHERE imei = target_imei;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
        -- 5. Delete imei_sku_info records
        DELETE FROM imei_sku_info WHERE imei = target_imei;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
        -- 6. Delete imei_data_queue records
        DELETE FROM imei_data_queue WHERE raw_data->>'imei' = target_imei;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
        -- 7. Finally delete the main Item record
        DELETE FROM "Item" WHERE imei = target_imei;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
    EXCEPTION
        WHEN OTHERS THEN
            result := jsonb_set(result::jsonb, '{success}', 'false'::jsonb);
            result := jsonb_set(result::jsonb, '{error}', to_jsonb(SQLERRM));
            result := jsonb_set(result::jsonb, '{deleted_count}', to_jsonb(deleted_count));
            RETURN result;
    END;
    
    -- Update result with final count
    result := jsonb_set(result::jsonb, '{deleted_count}', to_jsonb(deleted_count));
    
    RETURN result;
END;
$$;

-- ========================================
-- STEP 3: CREATE SAFE BULK DELETION
-- ========================================

CREATE OR REPLACE FUNCTION safe_bulk_delete_imei_data(imei_list TEXT[])
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_processed INTEGER := 0;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
    total_deleted INTEGER := 0;
    imei TEXT;
    single_result JSON;
    errors JSONB := '[]'::jsonb;
BEGIN
    -- Initialize result
    result := jsonb_build_object(
        'success', true,
        'total_processed', 0,
        'success_count', 0,
        'error_count', 0,
        'total_deleted', 0,
        'errors', '[]'::jsonb,
        'timestamp', NOW()
    );
    
    -- Process each IMEI
    FOREACH imei IN ARRAY imei_list
    LOOP
        total_processed := total_processed + 1;
        
        BEGIN
            single_result := safe_delete_imei_data(imei);
            
            IF (single_result->>'success')::boolean THEN
                success_count := success_count + 1;
                total_deleted := total_deleted + (single_result->>'deleted_count')::integer;
            ELSE
                error_count := error_count + 1;
                errors := errors || jsonb_build_object(
                    'imei', imei,
                    'error', single_result->>'error'
                );
            END IF;
            
        EXCEPTION
            WHEN OTHERS THEN
                error_count := error_count + 1;
                errors := errors || jsonb_build_object(
                    'imei', imei,
                    'error', SQLERRM
                );
        END;
    END LOOP;
    
    -- Update result with final counts
    result := jsonb_set(result::jsonb, '{total_processed}', to_jsonb(total_processed));
    result := jsonb_set(result::jsonb, '{success_count}', to_jsonb(success_count));
    result := jsonb_set(result::jsonb, '{error_count}', to_jsonb(error_count));
    result := jsonb_set(result::jsonb, '{total_deleted}', to_jsonb(total_deleted));
    result := jsonb_set(result::jsonb, '{errors}', errors);
    
    RETURN result;
END;
$$;

-- ========================================
-- STEP 4: CREATE SAFE NUCLEAR DELETE
-- ========================================

CREATE OR REPLACE FUNCTION safe_nuclear_delete_all_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_deleted INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Delete all data in safe order (no triggers)
    DELETE FROM "DeviceTest";
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_deleted := total_deleted + temp_count;
    
    DELETE FROM "Inventory";
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_deleted := total_deleted + temp_count;
    
    DELETE FROM imei_inspect_data;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_deleted := total_deleted + temp_count;
    
    DELETE FROM imei_units;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_deleted := total_deleted + temp_count;
    
    DELETE FROM imei_sku_info;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_deleted := total_deleted + temp_count;
    
    DELETE FROM imei_data_queue;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_deleted := total_deleted + temp_count;
    
    DELETE FROM "Item";
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_deleted := total_deleted + temp_count;
    
    result := jsonb_build_object(
        'success', true,
        'message', 'Nuclear deletion completed successfully (no triggers)',
        'total_deleted', total_deleted,
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

-- ========================================
-- STEP 5: UPDATE EXISTING FUNCTIONS
-- ========================================

-- Update the existing cleanup function to use the safe version
CREATE OR REPLACE FUNCTION cleanup_imei_data(target_imei TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    result := safe_delete_imei_data(target_imei);
    
    IF (result->>'success')::boolean THEN
        RETURN (result->>'deleted_count')::integer;
    ELSE
        RETURN -1;
    END IF;
END;
$$;

-- Update bulk cleanup function
CREATE OR REPLACE FUNCTION cleanup_multiple_imei_data(imei_list TEXT[])
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN safe_bulk_delete_imei_data(imei_list);
END;
$$;

-- Update nuclear cleanup function
CREATE OR REPLACE FUNCTION cleanup_all_imei_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN safe_nuclear_delete_all_data();
END;
$$;

-- ========================================
-- STEP 6: GRANT PERMISSIONS
-- ========================================

-- Grant execute permissions on safe functions
GRANT EXECUTE ON FUNCTION safe_delete_imei_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION safe_bulk_delete_imei_data(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION safe_nuclear_delete_all_data() TO authenticated;

-- Grant execute permissions on updated functions
GRANT EXECUTE ON FUNCTION cleanup_imei_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_multiple_imei_data(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_all_imei_data() TO authenticated;

-- ========================================
-- STEP 7: ADD DOCUMENTATION
-- ========================================

COMMENT ON FUNCTION safe_delete_imei_data(TEXT) IS 
'Safe deletion of IMEI data without triggers to prevent recursion. No archiving, direct deletion only.';

COMMENT ON FUNCTION safe_bulk_delete_imei_data(TEXT[]) IS 
'Safe bulk deletion of multiple IMEIs without triggers. No archiving, direct deletion only.';

COMMENT ON FUNCTION safe_nuclear_delete_all_data() IS 
'Safe nuclear deletion of all data without triggers. No archiving, direct deletion only.';

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 010: Fix Recursive Trigger Issue completed successfully';
    RAISE NOTICE 'All problematic triggers have been disabled';
    RAISE NOTICE 'Safe deletion functions created:';
    RAISE NOTICE '  - safe_delete_imei_data(imei)';
    RAISE NOTICE '  - safe_bulk_delete_imei_data(imei_list)';
    RAISE NOTICE '  - safe_nuclear_delete_all_data()';
    RAISE NOTICE 'Existing functions updated to use safe versions';
    RAISE NOTICE 'No more "stack depth limit exceeded" errors!';
END $$;
