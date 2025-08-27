-- ========================================
-- DATABASE CLEANUP SCRIPT
-- This script will safely remove all existing tables
-- and prepare the database for the new IMEI-centric schema
-- ========================================

-- Disable foreign key checks temporarily
SET session_replication_role = replica;

-- ========================================
-- DROP ALL EXISTING TABLES
-- ========================================

-- Drop queue-related tables
DROP TABLE IF EXISTS imei_data_queue CASCADE;
DROP TABLE IF EXISTS queue_processing_log CASCADE;
DROP TABLE IF EXISTS queue_batch CASCADE;

-- Drop IMEI-related tables
DROP TABLE IF EXISTS imei_sku_info CASCADE;
DROP TABLE IF EXISTS imei_inspect_data CASCADE;
DROP TABLE IF EXISTS imei_units CASCADE;
DROP TABLE IF EXISTS imei_detail CASCADE;

-- Drop inventory-related tables
DROP TABLE IF EXISTS inventory_unit CASCADE;
DROP TABLE IF EXISTS inventory_item CASCADE;
DROP TABLE IF EXISTS inventory_ledger CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;

-- Drop movement and history tables
DROP TABLE IF EXISTS movement CASCADE;
DROP TABLE IF EXISTS unit_status_history CASCADE;
DROP TABLE IF EXISTS unit_location_history CASCADE;

-- Drop outbound tables
DROP TABLE IF EXISTS outbound_unit CASCADE;
DROP TABLE IF EXISTS outbound CASCADE;

-- Drop tagging tables
DROP TABLE IF EXISTS entity_tag CASCADE;
DROP TABLE IF EXISTS tag CASCADE;

-- Drop core tables
DROP TABLE IF EXISTS product CASCADE;
DROP TABLE IF EXISTS location CASCADE;
DROP TABLE IF EXISTS item CASCADE;
DROP TABLE IF EXISTS device_test CASCADE;
DROP TABLE IF EXISTS warehouse CASCADE;

-- Drop phonecheck tables
DROP TABLE IF EXISTS phonecheck_log CASCADE;

-- Drop any remaining test tables
DROP TABLE IF EXISTS DeviceTest CASCADE;
DROP TABLE IF EXISTS Item CASCADE;
DROP TABLE IF EXISTS Inventory CASCADE;
DROP TABLE IF EXISTS Location CASCADE;
DROP TABLE IF EXISTS Warehouse CASCADE;
DROP TABLE IF EXISTS InboundLog CASCADE;
DROP TABLE IF EXISTS OutboundLog CASCADE;
DROP TABLE IF EXISTS ProcessingQueue CASCADE;
DROP TABLE IF EXISTS QCApproval CASCADE;
DROP TABLE IF EXISTS OutboundQueue CASCADE;
DROP TABLE IF EXISTS ItemAuditLog CASCADE;

-- ========================================
-- DROP CUSTOM TYPES
-- ========================================

-- Drop custom enum types
DROP TYPE IF EXISTS unit_status CASCADE;
DROP TYPE IF EXISTS outbound_type CASCADE;
DROP TYPE IF EXISTS outbound_status CASCADE;
DROP TYPE IF EXISTS ledger_reason CASCADE;

-- ========================================
-- DROP FUNCTIONS AND TRIGGERS
-- ========================================

-- Drop all functions (this will also drop associated triggers)
DO $$ 
DECLARE 
    func_record RECORD;
BEGIN
    FOR func_record IN (
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(func_record.routine_name) || ' CASCADE';
    END LOOP;
END $$;

-- ========================================
-- DROP VIEWS
-- ========================================

-- Drop all views
DO $$ 
DECLARE 
    view_record RECORD;
BEGIN
    FOR view_record IN (
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public'
    ) LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(view_record.table_name) || ' CASCADE';
    END LOOP;
END $$;

-- ========================================
-- DROP INDEXES (SIMPLIFIED)
-- ========================================

-- Drop all indexes except primary keys
DO $$ 
DECLARE 
    index_record RECORD;
BEGIN
    FOR index_record IN (
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname NOT LIKE '%_pkey'
        AND indexname NOT LIKE '%_key'
    ) LOOP
        BEGIN
            EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(index_record.indexname) || ' CASCADE';
        EXCEPTION
            WHEN OTHERS THEN
                -- Skip if there's an error dropping this index
                NULL;
        END;
    END LOOP;
END $$;

-- ========================================
-- CLEAN UP SEQUENCES
-- ========================================

-- Reset all sequences
DO $$ 
DECLARE 
    seq_record RECORD;
BEGIN
    FOR seq_record IN (
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
    ) LOOP
        BEGIN
            EXECUTE 'ALTER SEQUENCE ' || quote_ident(seq_record.sequence_name) || ' RESTART WITH 1';
        EXCEPTION
            WHEN OTHERS THEN
                -- Skip if there's an error resetting this sequence
                NULL;
        END;
    END LOOP;
END $$;

-- ========================================
-- VERIFY CLEANUP
-- ========================================

-- Check remaining tables
DO $$
DECLARE
    table_count INTEGER;
    table_record RECORD;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
    
    RAISE NOTICE 'Remaining tables after cleanup: %', table_count;
    
    IF table_count > 0 THEN
        RAISE NOTICE 'Remaining tables:';
        FOR table_record IN (
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        ) LOOP
            RAISE NOTICE '  - %', table_record.table_name;
        END LOOP;
    END IF;
END $$;

-- ========================================
-- RE-ENABLE FOREIGN KEY CHECKS
-- ========================================

SET session_replication_role = DEFAULT;

-- ========================================
-- CLEANUP COMPLETE
-- ========================================

COMMENT ON SCHEMA public IS 'Database cleaned and ready for new IMEI-centric schema';

-- Log cleanup completion
DO $$
BEGIN
    RAISE NOTICE 'Database cleanup completed successfully!';
    RAISE NOTICE 'Ready to apply new IMEI-centric schema.';
END $$;
