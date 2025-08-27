-- ========================================
-- FINAL AGGRESSIVE CLEANUP SCRIPT
-- This script will force remove ALL tables and prepare for new schema
-- ========================================

-- Disable foreign key checks
SET session_replication_role = replica;

-- ========================================
-- FORCE DROP ALL TABLES
-- ========================================

-- Drop all tables that might exist
DROP TABLE IF EXISTS movement_history CASCADE;
DROP TABLE IF EXISTS data_queue CASCADE;
DROP TABLE IF EXISTS queue_processing_log CASCADE;
DROP TABLE IF EXISTS device_test CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS item CASCADE;
DROP TABLE IF EXISTS product CASCADE;
DROP TABLE IF EXISTS location CASCADE;
DROP TABLE IF EXISTS warehouse CASCADE;

-- Drop old tables that might still exist
DROP TABLE IF EXISTS Item CASCADE;
DROP TABLE IF EXISTS Warehouse CASCADE;
DROP TABLE IF EXISTS Location CASCADE;
DROP TABLE IF EXISTS Inventory CASCADE;
DROP TABLE IF EXISTS InboundLog CASCADE;
DROP TABLE IF EXISTS OutboundLog CASCADE;
DROP TABLE IF EXISTS ProcessingQueue CASCADE;
DROP TABLE IF EXISTS QCApproval CASCADE;
DROP TABLE IF EXISTS OutboundQueue CASCADE;
DROP TABLE IF EXISTS DeviceTest CASCADE;
DROP TABLE IF EXISTS ItemAuditLog CASCADE;

-- Drop any remaining tables using dynamic SQL
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(table_record.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- ========================================
-- DROP ALL VIEWS
-- ========================================

DO $$
DECLARE
    view_record RECORD;
BEGIN
    FOR view_record IN (
        SELECT viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(view_record.viewname) || ' CASCADE';
    END LOOP;
END $$;

-- ========================================
-- DROP ALL FUNCTIONS
-- ========================================

DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN (
        SELECT proname, oid::regprocedure as full_name
        FROM pg_proc 
        WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.full_name || ' CASCADE';
    END LOOP;
END $$;

-- ========================================
-- DROP ALL TYPES
-- ========================================

DO $$
DECLARE
    type_record RECORD;
BEGIN
    FOR type_record IN (
        SELECT typname 
        FROM pg_type 
        WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND typtype = 'e'  -- enum types
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(type_record.typname) || ' CASCADE';
    END LOOP;
END $$;

-- ========================================
-- DROP ALL SEQUENCES
-- ========================================

DO $$
DECLARE
    seq_record RECORD;
BEGIN
    FOR seq_record IN (
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
    ) LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(seq_record.sequence_name) || ' CASCADE';
    END LOOP;
END $$;

-- ========================================
-- VERIFY CLEANUP
-- ========================================

DO $$
DECLARE
    table_count INTEGER;
    view_count INTEGER;
    func_count INTEGER;
    type_count INTEGER;
    seq_count INTEGER;
BEGIN
    -- Count remaining objects
    SELECT COUNT(*) INTO table_count FROM pg_tables WHERE schemaname = 'public';
    SELECT COUNT(*) INTO view_count FROM pg_views WHERE schemaname = 'public';
    SELECT COUNT(*) INTO func_count FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    SELECT COUNT(*) INTO type_count FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND typtype = 'e';
    SELECT COUNT(*) INTO seq_count FROM information_schema.sequences WHERE sequence_schema = 'public';
    
    RAISE NOTICE 'Cleanup Results:';
    RAISE NOTICE '  Tables remaining: %', table_count;
    RAISE NOTICE '  Views remaining: %', view_count;
    RAISE NOTICE '  Functions remaining: %', func_count;
    RAISE NOTICE '  Types remaining: %', type_count;
    RAISE NOTICE '  Sequences remaining: %', seq_count;
    
    IF table_count = 0 AND view_count = 0 AND func_count = 0 AND type_count = 0 AND seq_count = 0 THEN
        RAISE NOTICE '✅ Database is completely clean!';
    ELSE
        RAISE NOTICE '⚠️ Some objects still remain.';
    END IF;
END $$;

-- ========================================
-- RE-ENABLE FOREIGN KEY CHECKS
-- ========================================

SET session_replication_role = DEFAULT;

-- ========================================
-- CLEANUP COMPLETE
-- ========================================

COMMENT ON SCHEMA public IS 'Database completely cleaned - ready for new IMEI-centric schema';

DO $$
BEGIN
    RAISE NOTICE '🎉 Final cleanup completed successfully!';
    RAISE NOTICE '📋 Database is now completely clean and ready for new schema.';
END $$;
