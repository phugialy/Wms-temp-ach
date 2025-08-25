-- Migration 009: Systematic Database Deletion System
-- This migration creates a comprehensive, systematic deletion system with proper hierarchy and constraints
-- Designed for clarity, safety, and maintainability

-- ========================================
-- STEP 1: CREATE SYSTEMATIC ARCHIVE TABLES
-- ========================================

-- Create a unified archive system with proper structure
CREATE TABLE IF NOT EXISTS system_archives (
    id SERIAL PRIMARY KEY,
    archive_id UUID DEFAULT gen_random_uuid(),
    original_table VARCHAR(100) NOT NULL,
    original_id INTEGER,
    imei VARCHAR(15),
    archived_data JSONB NOT NULL,
    archived_at TIMESTAMPTZ DEFAULT NOW(),
    archived_by VARCHAR(100) DEFAULT 'SYSTEM',
    archive_reason VARCHAR(200),
    archive_type VARCHAR(50) DEFAULT 'MANUAL', -- MANUAL, BULK, NUCLEAR, AUTO
    metadata JSONB -- Additional metadata about the archive
);

-- Create indexes for the unified archive system
CREATE INDEX IF NOT EXISTS idx_system_archives_imei ON system_archives(imei);
CREATE INDEX IF NOT EXISTS idx_system_archives_table ON system_archives(original_table);
CREATE INDEX IF NOT EXISTS idx_system_archives_archive_id ON system_archives(archive_id);
CREATE INDEX IF NOT EXISTS idx_system_archives_archived_at ON system_archives(archived_at);
CREATE INDEX IF NOT EXISTS idx_system_archives_type ON system_archives(archive_type);

-- ========================================
-- STEP 2: CREATE DELETION HIERARCHY FUNCTIONS
-- ========================================

-- Function to archive a single record with metadata
CREATE OR REPLACE FUNCTION archive_record(
    p_table_name VARCHAR(100),
    p_original_id INTEGER,
    p_imei VARCHAR(15),
    p_data JSONB,
    p_reason VARCHAR(200) DEFAULT 'Manual deletion',
    p_archive_type VARCHAR(50) DEFAULT 'MANUAL'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    archive_record_id INTEGER;
BEGIN
    INSERT INTO system_archives (
        original_table,
        original_id,
        imei,
        archived_data,
        archive_reason,
        archive_type,
        metadata
    ) VALUES (
        p_table_name,
        p_original_id,
        p_imei,
        p_data,
        p_reason,
        p_archive_type,
        jsonb_build_object(
            'archived_at', NOW(),
            'table_name', p_table_name,
            'original_id', p_original_id
        )
    ) RETURNING id INTO archive_record_id;
    
    RETURN archive_record_id;
END;
$$;

-- Function to get deletion hierarchy for a table
CREATE OR REPLACE FUNCTION get_deletion_hierarchy(p_table_name VARCHAR(100))
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    hierarchy JSON;
BEGIN
    -- Define the deletion hierarchy based on foreign key relationships
    CASE p_table_name
        WHEN 'Item' THEN
            hierarchy := '[
                {"table": "DeviceTest", "relation": "item_id", "cascade": true},
                {"table": "Inventory", "relation": "item_id", "cascade": true},
                {"table": "imei_sku_info", "relation": "imei", "cascade": true},
                {"table": "imei_inspect_data", "relation": "imei", "cascade": true},
                {"table": "imei_units", "relation": "imei", "cascade": true},
                {"table": "imei_data_queue", "relation": "imei", "cascade": false}
            ]'::JSON;
        WHEN 'imei_sku_info' THEN
            hierarchy := '[
                {"table": "imei_inspect_data", "relation": "imei", "cascade": true},
                {"table": "imei_units", "relation": "imei", "cascade": true}
            ]'::JSON;
        WHEN 'Location' THEN
            hierarchy := '[
                {"table": "Inventory", "relation": "location_id", "cascade": true}
            ]'::JSON;
        WHEN 'Warehouse' THEN
            hierarchy := '[
                {"table": "Location", "relation": "warehouse_id", "cascade": true}
            ]'::JSON;
        ELSE
            hierarchy := '[]'::JSON;
    END CASE;
    
    RETURN hierarchy;
END;
$$;

-- ========================================
-- STEP 3: CREATE SYSTEMATIC DELETION FUNCTIONS
-- ========================================

-- Main systematic deletion function
CREATE OR REPLACE FUNCTION systematic_delete_imei(
    p_imei VARCHAR(15),
    p_reason VARCHAR(200) DEFAULT 'Systematic deletion',
    p_archive_type VARCHAR(50) DEFAULT 'MANUAL'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    hierarchy JSON;
    hierarchy_item JSON;
    table_name VARCHAR(100);
    relation_field VARCHAR(100);
    cascade_delete BOOLEAN;
    archived_count INTEGER := 0;
    deleted_count INTEGER := 0;
    item_id INTEGER;
    temp_count INTEGER;
BEGIN
    -- Initialize result
    result := jsonb_build_object(
        'success', true,
        'imei', p_imei,
        'archived_count', 0,
        'deleted_count', 0,
        'errors', '[]'::jsonb,
        'timestamp', NOW()
    );
    
    -- Get the Item ID for this IMEI
    SELECT id INTO item_id FROM "Item" WHERE imei = p_imei LIMIT 1;
    
    IF item_id IS NULL THEN
        result := jsonb_set(result::jsonb, '{success}', 'false'::jsonb);
        result := jsonb_set(result::jsonb, '{error}', '"IMEI not found"'::jsonb);
        RETURN result;
    END IF;
    
    -- Get deletion hierarchy for Item table
    hierarchy := get_deletion_hierarchy('Item');
    
    -- Process each table in the hierarchy
    FOR i IN 0..jsonb_array_length(hierarchy::jsonb) - 1 LOOP
        hierarchy_item := hierarchy->i;
        table_name := hierarchy_item->>'table';
        relation_field := hierarchy_item->>'relation';
        cascade_delete := (hierarchy_item->>'cascade')::boolean;
        
        BEGIN
            -- Archive and delete based on table type
            CASE table_name
                WHEN 'DeviceTest' THEN
                    -- Archive DeviceTest records
                    INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
                    SELECT 
                        'DeviceTest',
                        id,
                        p_imei,
                        to_jsonb(dt.*),
                        p_reason,
                        p_archive_type
                    FROM "DeviceTest" dt
                    WHERE item_id = item_id;
                    
                    GET DIAGNOSTICS temp_count = ROW_COUNT;
                    archived_count := archived_count + temp_count;
                    
                    -- Delete DeviceTest records
                    DELETE FROM "DeviceTest" WHERE item_id = item_id;
                    GET DIAGNOSTICS temp_count = ROW_COUNT;
                    deleted_count := deleted_count + temp_count;
                    
                WHEN 'Inventory' THEN
                    -- Archive Inventory records
                    INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
                    SELECT 
                        'Inventory',
                        id,
                        p_imei,
                        to_jsonb(inv.*),
                        p_reason,
                        p_archive_type
                    FROM "Inventory" inv
                    WHERE item_id = item_id;
                    
                    GET DIAGNOSTICS temp_count = ROW_COUNT;
                    archived_count := archived_count + temp_count;
                    
                    -- Delete Inventory records
                    DELETE FROM "Inventory" WHERE item_id = item_id;
                    GET DIAGNOSTICS temp_count = ROW_COUNT;
                    deleted_count := deleted_count + temp_count;
                    
                WHEN 'imei_sku_info' THEN
                    -- Archive imei_sku_info records
                    INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
                    SELECT 
                        'imei_sku_info',
                        id,
                        imei,
                        to_jsonb(isi.*),
                        p_reason,
                        p_archive_type
                    FROM imei_sku_info isi
                    WHERE imei = p_imei;
                    
                    GET DIAGNOSTICS temp_count = ROW_COUNT;
                    archived_count := archived_count + temp_count;
                    
                    -- Delete imei_sku_info records
                    DELETE FROM imei_sku_info WHERE imei = p_imei;
                    GET DIAGNOSTICS temp_count = ROW_COUNT;
                    deleted_count := deleted_count + temp_count;
                    
                WHEN 'imei_inspect_data' THEN
                    -- Archive imei_inspect_data records
                    INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
                    SELECT 
                        'imei_inspect_data',
                        id,
                        imei,
                        to_jsonb(iid.*),
                        p_reason,
                        p_archive_type
                    FROM imei_inspect_data iid
                    WHERE imei = p_imei;
                    
                    GET DIAGNOSTICS temp_count = ROW_COUNT;
                    archived_count := archived_count + temp_count;
                    
                    -- Delete imei_inspect_data records
                    DELETE FROM imei_inspect_data WHERE imei = p_imei;
                    GET DIAGNOSTICS temp_count = ROW_COUNT;
                    deleted_count := deleted_count + temp_count;
                    
                WHEN 'imei_units' THEN
                    -- Archive imei_units records
                    INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
                    SELECT 
                        'imei_units',
                        id,
                        imei,
                        to_jsonb(iu.*),
                        p_reason,
                        p_archive_type
                    FROM imei_units iu
                    WHERE imei = p_imei;
                    
                    GET DIAGNOSTICS temp_count = ROW_COUNT;
                    archived_count := archived_count + temp_count;
                    
                    -- Delete imei_units records
                    DELETE FROM imei_units WHERE imei = p_imei;
                    GET DIAGNOSTICS temp_count = ROW_COUNT;
                    deleted_count := deleted_count + temp_count;
                    
                WHEN 'imei_data_queue' THEN
                    -- Archive imei_data_queue records (only if cascade is true)
                    IF cascade_delete THEN
                        INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
                        SELECT 
                            'imei_data_queue',
                            id,
                            p_imei,
                            to_jsonb(idq.*),
                            p_reason,
                            p_archive_type
                        FROM imei_data_queue idq
                        WHERE raw_data->>'imei' = p_imei;
                        
                        GET DIAGNOSTICS temp_count = ROW_COUNT;
                        archived_count := archived_count + temp_count;
                        
                        -- Delete imei_data_queue records
                        DELETE FROM imei_data_queue WHERE raw_data->>'imei' = p_imei;
                        GET DIAGNOSTICS temp_count = ROW_COUNT;
                        deleted_count := deleted_count + temp_count;
                    END IF;
                    
            END CASE;
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but continue with other tables
                result := jsonb_set(result::jsonb, '{errors}', 
                    (result->'errors')::jsonb || jsonb_build_object(
                        'table', table_name,
                        'error', SQLERRM,
                        'imei', p_imei
                    ));
        END;
    END LOOP;
    
    -- Finally, archive and delete the main Item record
    BEGIN
        INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
        SELECT 
            'Item',
            id,
            imei,
            to_jsonb(item.*),
            p_reason,
            p_archive_type
        FROM "Item" item
        WHERE imei = p_imei;
        
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        archived_count := archived_count + temp_count;
        
        DELETE FROM "Item" WHERE imei = p_imei;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
    EXCEPTION
        WHEN OTHERS THEN
            result := jsonb_set(result::jsonb, '{errors}', 
                (result->'errors')::jsonb || jsonb_build_object(
                    'table', 'Item',
                    'error', SQLERRM,
                    'imei', p_imei
                ));
    END;
    
    -- Update result with final counts
    result := jsonb_set(result::jsonb, '{archived_count}', to_jsonb(archived_count));
    result := jsonb_set(result::jsonb, '{deleted_count}', to_jsonb(deleted_count));
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        result := jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'imei', p_imei,
            'timestamp', NOW()
        );
        RETURN result;
END;
$$;

-- Bulk deletion function with systematic approach
CREATE OR REPLACE FUNCTION systematic_bulk_delete_imei(
    p_imei_list TEXT[],
    p_reason VARCHAR(200) DEFAULT 'Bulk systematic deletion',
    p_archive_type VARCHAR(50) DEFAULT 'BULK'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_processed INTEGER := 0;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
    total_archived INTEGER := 0;
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
        'total_archived', 0,
        'total_deleted', 0,
        'errors', '[]'::jsonb,
        'timestamp', NOW()
    );
    
    -- Process each IMEI
    FOREACH imei IN ARRAY p_imei_list
    LOOP
        total_processed := total_processed + 1;
        
        BEGIN
            single_result := systematic_delete_imei(imei, p_reason, p_archive_type);
            
            IF (single_result->>'success')::boolean THEN
                success_count := success_count + 1;
                total_archived := total_archived + (single_result->>'archived_count')::integer;
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
    result := jsonb_set(result::jsonb, '{total_archived}', to_jsonb(total_archived));
    result := jsonb_set(result::jsonb, '{total_deleted}', to_jsonb(total_deleted));
    result := jsonb_set(result::jsonb, '{errors}', errors);
    
    RETURN result;
END;
$$;

-- Nuclear option - delete all data systematically
CREATE OR REPLACE FUNCTION systematic_nuclear_delete(
    p_reason VARCHAR(200) DEFAULT 'Nuclear deletion - all data',
    p_archive_type VARCHAR(50) DEFAULT 'NUCLEAR'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_archived INTEGER := 0;
    total_deleted INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Archive all data systematically
    -- Start with dependent tables first
    
    -- Archive DeviceTest
    INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
    SELECT 
        'DeviceTest',
        id,
        (SELECT imei FROM "Item" WHERE id = dt.item_id),
        to_jsonb(dt.*),
        p_reason,
        p_archive_type
    FROM "DeviceTest" dt;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    
    -- Archive Inventory
    INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
    SELECT 
        'Inventory',
        id,
        (SELECT imei FROM "Item" WHERE id = inv.item_id),
        to_jsonb(inv.*),
        p_reason,
        p_archive_type
    FROM "Inventory" inv;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    
    -- Archive imei_inspect_data
    INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
    SELECT 
        'imei_inspect_data',
        id,
        imei,
        to_jsonb(iid.*),
        p_reason,
        p_archive_type
    FROM imei_inspect_data iid;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    
    -- Archive imei_units
    INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
    SELECT 
        'imei_units',
        id,
        imei,
        to_jsonb(iu.*),
        p_reason,
        p_archive_type
    FROM imei_units iu;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    
    -- Archive imei_sku_info
    INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
    SELECT 
        'imei_sku_info',
        id,
        imei,
        to_jsonb(isi.*),
        p_reason,
        p_archive_type
    FROM imei_sku_info isi;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    
    -- Archive imei_data_queue
    INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
    SELECT 
        'imei_data_queue',
        id,
        raw_data->>'imei',
        to_jsonb(idq.*),
        p_reason,
        p_archive_type
    FROM imei_data_queue idq;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    
    -- Archive Item (main table)
    INSERT INTO system_archives (original_table, original_id, imei, archived_data, archive_reason, archive_type)
    SELECT 
        'Item',
        id,
        imei,
        to_jsonb(item.*),
        p_reason,
        p_archive_type
    FROM "Item" item;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    total_archived := total_archived + temp_count;
    
    -- Now delete all data in reverse order (respecting foreign key constraints)
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
        'message', 'Nuclear deletion completed successfully',
        'total_archived', total_archived,
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
-- STEP 4: CREATE RESTORE FUNCTIONS
-- ========================================

-- Function to restore archived data by IMEI
CREATE OR REPLACE FUNCTION systematic_restore_imei(
    p_imei VARCHAR(15),
    p_restore_reason VARCHAR(200) DEFAULT 'Manual restore'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    restored_count INTEGER := 0;
    temp_count INTEGER;
    archive_record RECORD;
BEGIN
    -- Initialize result
    result := jsonb_build_object(
        'success', true,
        'imei', p_imei,
        'restored_count', 0,
        'errors', '[]'::jsonb,
        'timestamp', NOW()
    );
    
    -- Restore records in the correct order (respecting foreign key constraints)
    FOR archive_record IN 
        SELECT * FROM system_archives 
        WHERE imei = p_imei 
        ORDER BY 
            CASE original_table
                WHEN 'Item' THEN 1
                WHEN 'imei_sku_info' THEN 2
                WHEN 'imei_inspect_data' THEN 3
                WHEN 'imei_units' THEN 4
                WHEN 'Inventory' THEN 5
                WHEN 'DeviceTest' THEN 6
                ELSE 7
            END
    LOOP
        BEGIN
            CASE archive_record.original_table
                WHEN 'Item' THEN
                    INSERT INTO "Item" SELECT * FROM jsonb_populate_record(null::"Item", archive_record.archived_data)
                    ON CONFLICT (id) DO NOTHING;
                    
                WHEN 'imei_sku_info' THEN
                    INSERT INTO imei_sku_info SELECT * FROM jsonb_populate_record(null::imei_sku_info, archive_record.archived_data)
                    ON CONFLICT (imei) DO NOTHING;
                    
                WHEN 'imei_inspect_data' THEN
                    INSERT INTO imei_inspect_data SELECT * FROM jsonb_populate_record(null::imei_inspect_data, archive_record.archived_data)
                    ON CONFLICT (id) DO NOTHING;
                    
                WHEN 'imei_units' THEN
                    INSERT INTO imei_units SELECT * FROM jsonb_populate_record(null::imei_units, archive_record.archived_data)
                    ON CONFLICT (imei) DO NOTHING;
                    
                WHEN 'Inventory' THEN
                    INSERT INTO "Inventory" SELECT * FROM jsonb_populate_record(null::"Inventory", archive_record.archived_data)
                    ON CONFLICT (id) DO NOTHING;
                    
                WHEN 'DeviceTest' THEN
                    INSERT INTO "DeviceTest" SELECT * FROM jsonb_populate_record(null::"DeviceTest", archive_record.archived_data)
                    ON CONFLICT (id) DO NOTHING;
                    
            END CASE;
            
            GET DIAGNOSTICS temp_count = ROW_COUNT;
            restored_count := restored_count + temp_count;
            
        EXCEPTION
            WHEN OTHERS THEN
                result := jsonb_set(result::jsonb, '{errors}', 
                    (result->'errors')::jsonb || jsonb_build_object(
                        'table', archive_record.original_table,
                        'error', SQLERRM
                    ));
        END;
    END LOOP;
    
    -- Update result
    result := jsonb_set(result::jsonb, '{restored_count}', to_jsonb(restored_count));
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        result := jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'imei', p_imei,
            'timestamp', NOW()
        );
        RETURN result;
END;
$$;

-- ========================================
-- STEP 5: CREATE STATISTICS AND MONITORING
-- ========================================

-- Function to get comprehensive deletion statistics
CREATE OR REPLACE FUNCTION get_systematic_deletion_stats()
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
            'total_archives', (SELECT COUNT(*) FROM system_archives),
            'by_table', (
                SELECT jsonb_object_agg(table_name, count)
                FROM (
                    SELECT original_table as table_name, COUNT(*) as count
                    FROM system_archives
                    GROUP BY original_table
                ) t
            ),
            'by_type', (
                SELECT jsonb_object_agg(archive_type, count)
                FROM (
                    SELECT archive_type, COUNT(*) as count
                    FROM system_archives
                    GROUP BY archive_type
                ) t
            )
        ),
        'recent_activity', (
            SELECT jsonb_agg(jsonb_build_object(
                'imei', imei,
                'table_name', original_table,
                'archived_at', archived_at,
                'archive_reason', archive_reason,
                'archive_type', archive_type
            ))
            FROM system_archives 
            WHERE archived_at > NOW() - INTERVAL '24 hours'
            ORDER BY archived_at DESC
        ),
        'system_health', jsonb_build_object(
            'total_archives_today', (SELECT COUNT(*) FROM system_archives WHERE archived_at > NOW() - INTERVAL '24 hours'),
            'total_archives_week', (SELECT COUNT(*) FROM system_archives WHERE archived_at > NOW() - INTERVAL '7 days'),
            'largest_archive_table', (
                SELECT original_table 
                FROM system_archives 
                GROUP BY original_table 
                ORDER BY COUNT(*) DESC 
                LIMIT 1
            )
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

-- ========================================
-- STEP 6: CREATE VIEWS FOR EASY ACCESS
-- ========================================

-- View for easy access to archived data
CREATE OR REPLACE VIEW systematic_archives_view AS
SELECT 
    archive_id,
    original_table,
    original_id,
    imei,
    archived_at,
    archived_by,
    archive_reason,
    archive_type,
    metadata
FROM system_archives
ORDER BY archived_at DESC;

-- View for recent deletion activity
CREATE OR REPLACE VIEW recent_deletion_activity AS
SELECT 
    imei,
    original_table,
    archived_at,
    archive_reason,
    archive_type,
    archived_by
FROM system_archives
WHERE archived_at > NOW() - INTERVAL '7 days'
ORDER BY archived_at DESC;

-- ========================================
-- STEP 7: GRANT PERMISSIONS
-- ========================================

-- Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION systematic_delete_imei(VARCHAR(15), VARCHAR(200), VARCHAR(50)) TO authenticated;
GRANT EXECUTE ON FUNCTION systematic_bulk_delete_imei(TEXT[], VARCHAR(200), VARCHAR(50)) TO authenticated;
GRANT EXECUTE ON FUNCTION systematic_nuclear_delete(VARCHAR(200), VARCHAR(50)) TO authenticated;
GRANT EXECUTE ON FUNCTION systematic_restore_imei(VARCHAR(15), VARCHAR(200)) TO authenticated;
GRANT EXECUTE ON FUNCTION get_systematic_deletion_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_deletion_hierarchy(VARCHAR(100)) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_record(VARCHAR(100), INTEGER, VARCHAR(15), JSONB, VARCHAR(200), VARCHAR(50)) TO authenticated;

-- Grant select permissions on views
GRANT SELECT ON systematic_archives_view TO authenticated;
GRANT SELECT ON recent_deletion_activity TO authenticated;

-- Grant select permissions on archive table
GRANT SELECT ON system_archives TO authenticated;

-- ========================================
-- STEP 8: ADD DOCUMENTATION
-- ========================================

COMMENT ON FUNCTION systematic_delete_imei(VARCHAR(15), VARCHAR(200), VARCHAR(50)) IS 
'Systematic deletion of IMEI data following proper hierarchy and constraints. Archives all related data before deletion.';

COMMENT ON FUNCTION systematic_bulk_delete_imei(TEXT[], VARCHAR(200), VARCHAR(50)) IS 
'Bulk systematic deletion of multiple IMEIs with comprehensive error handling and reporting.';

COMMENT ON FUNCTION systematic_nuclear_delete(VARCHAR(200), VARCHAR(50)) IS 
'Nuclear option: Deletes and archives ALL data from the database. Use with extreme caution.';

COMMENT ON FUNCTION systematic_restore_imei(VARCHAR(15), VARCHAR(200)) IS 
'Restores archived data for a specific IMEI following proper restoration order.';

COMMENT ON FUNCTION get_systematic_deletion_stats() IS 
'Returns comprehensive statistics about current data, archived data, and recent deletion activity.';

COMMENT ON TABLE system_archives IS 
'Unified archive system storing all deleted data with metadata and proper indexing.';

COMMENT ON VIEW systematic_archives_view IS 
'View for easy access to archived data with proper ordering and filtering.';

-- ========================================
-- STEP 9: CREATE BACKWARD COMPATIBILITY
-- ========================================

-- Create backward compatibility functions that map to the new systematic functions
CREATE OR REPLACE FUNCTION cleanup_imei_data(target_imei TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    result := systematic_delete_imei(target_imei, 'Legacy cleanup function', 'MANUAL');
    
    IF (result->>'success')::boolean THEN
        RETURN (result->>'archived_count')::integer;
    ELSE
        RETURN -1;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_multiple_imei_data(imei_list TEXT[])
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN systematic_bulk_delete_imei(imei_list, 'Legacy bulk cleanup function', 'BULK');
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_all_imei_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN systematic_nuclear_delete('Legacy nuclear cleanup function', 'NUCLEAR');
END;
$$;

CREATE OR REPLACE FUNCTION restore_imei_data(target_imei TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN systematic_restore_imei(target_imei, 'Legacy restore function');
END;
$$;

CREATE OR REPLACE FUNCTION get_deletion_stats()
RETURNS JSON
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN get_systematic_deletion_stats();
END;
$$;

-- Grant permissions on backward compatibility functions
GRANT EXECUTE ON FUNCTION cleanup_imei_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_multiple_imei_data(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_all_imei_data() TO authenticated;
GRANT EXECUTE ON FUNCTION restore_imei_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_deletion_stats() TO authenticated;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 009: Systematic Database Deletion System completed successfully';
    RAISE NOTICE 'New functions available:';
    RAISE NOTICE '  - systematic_delete_imei(imei, reason, type)';
    RAISE NOTICE '  - systematic_bulk_delete_imei(imei_list, reason, type)';
    RAISE NOTICE '  - systematic_nuclear_delete(reason, type)';
    RAISE NOTICE '  - systematic_restore_imei(imei, reason)';
    RAISE NOTICE '  - get_systematic_deletion_stats()';
    RAISE NOTICE 'Backward compatibility maintained for existing functions.';
END $$;
