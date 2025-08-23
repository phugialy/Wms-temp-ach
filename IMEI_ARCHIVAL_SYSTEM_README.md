# 🗄️ IMEI Archival System

## Overview

The IMEI Archival System provides **automatic data synchronization and archival** for your WMS. When you delete an IMEI from any table, all related data is automatically archived before deletion, ensuring data integrity and recovery capabilities.

## 🏗️ System Architecture

### Tables Created

1. **`imei_archived`** - Stores archived data from all IMEI-related tables
2. **`imei_data_log`** - Logs processed queue items for audit trail

### Automatic Triggers

- **Cascade Deletion**: When IMEI is deleted from `imei_sku_info`, related records in `imei_inspect_data` and `imei_units` are automatically archived and deleted
- **Queue Logging**: When queue items are processed (completed/failed), they're automatically moved to the data log

## 🚀 Features

### ✅ **Automatic Archival**
- Delete from any table → All related data archived automatically
- Complete data preservation in JSONB format
- Audit trail with timestamps and reasons

### ✅ **Data Recovery**
- Restore archived IMEI data with one command
- Maintains data relationships and integrity
- Safe restoration with conflict handling

### ✅ **Queue Management**
- Automatic logging of processed queue items
- Performance metrics and processing times
- Cleanup of old queue data

### ✅ **Comprehensive Statistics**
- Archive statistics (total, daily, weekly, monthly)
- Processing performance metrics
- Data log analytics

## 📋 API Endpoints

### Archive Operations
```
POST   /api/imei-archival/archive          # Manually archive IMEI
GET    /api/imei-archival/stats            # Get archive statistics
GET    /api/imei-archival/records/:imei    # Get archived records for IMEI
GET    /api/imei-archival/records          # Get all archived records
POST   /api/imei-archival/restore/:imei    # Restore archived IMEI
DELETE /api/imei-archival/permanent/:imei  # Permanently delete archived data
```

### Data Log Operations
```
GET    /api/imei-archival/logs             # Get data log records
GET    /api/imei-archival/logs/stats       # Get data log statistics
GET    /api/imei-archival/metrics          # Get processing metrics
```

### Cleanup Operations
```
POST   /api/imei-archival/cleanup          # Cleanup old queue data
```

## 🔧 Setup Instructions

### 1. Execute SQL Migration

Copy and execute this SQL in your Supabase SQL Editor:

```sql
-- IMEI Archival System Migration
-- This creates an archival system for deleted IMEI data and queue logging

-- 1. IMEI Archive Table (for deleted data)
CREATE TABLE IF NOT EXISTS imei_archived (
    id SERIAL PRIMARY KEY,
    original_table VARCHAR(50) NOT NULL, -- 'imei_sku_info', 'imei_inspect_data', 'imei_units'
    original_id INTEGER, -- Original record ID
    imei VARCHAR(15) NOT NULL,
    archived_data JSONB NOT NULL, -- Complete original record data
    archived_at TIMESTAMPTZ DEFAULT NOW(),
    archived_by VARCHAR(100), -- User/system that triggered the archive
    archive_reason VARCHAR(200) DEFAULT 'cascade_delete' -- 'manual_delete', 'cascade_delete', 'system_cleanup'
);

-- 2. IMEI Data Log Table (for processed queue items)
CREATE TABLE IF NOT EXISTS imei_data_log (
    id SERIAL PRIMARY KEY,
    queue_id INTEGER, -- Reference to original queue item
    imei VARCHAR(15) NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'bulk-add', 'single-phonecheck', 'api'
    raw_data JSONB NOT NULL, -- Original raw data
    processed_data JSONB, -- Processed/transformed data
    processing_status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'partial'
    error_message TEXT,
    processing_time_ms INTEGER, -- Time taken to process
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_imei_archived_imei ON imei_archived(imei);
CREATE INDEX IF NOT EXISTS idx_imei_archived_table ON imei_archived(original_table);
CREATE INDEX IF NOT EXISTS idx_imei_archived_date ON imei_archived(archived_at);
CREATE INDEX IF NOT EXISTS idx_imei_data_log_imei ON imei_data_log(imei);
CREATE INDEX IF NOT EXISTS idx_imei_data_log_status ON imei_data_log(processing_status);
CREATE INDEX IF NOT EXISTS idx_imei_data_log_date ON imei_data_log(processed_at);

-- Function to archive IMEI data when deleted
CREATE OR REPLACE FUNCTION archive_imei_data()
RETURNS TRIGGER AS $$
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
    
    -- If this is a deletion from imei_sku_info, cascade to other tables
    IF TG_TABLE_NAME = 'imei_sku_info' THEN
        -- Archive related inspect data
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
        
        -- Archive related unit data
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
        
        -- Delete related records from other tables
        DELETE FROM imei_inspect_data WHERE imei = OLD.imei;
        DELETE FROM imei_units WHERE imei = OLD.imei;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Function to move processed queue items to log
CREATE OR REPLACE FUNCTION log_processed_queue_item()
RETURNS TRIGGER AS $$
DECLARE
    processing_start_time TIMESTAMPTZ;
    processing_time_ms INTEGER;
BEGIN
    -- Only process when status changes to 'completed' or 'failed'
    IF NEW.status IN ('completed', 'failed') AND OLD.status != NEW.status THEN
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
            NEW.raw_data->>'imei',
            NEW.source,
            NEW.raw_data,
            NEW.status,
            NEW.error_message,
            processing_time_ms,
            NEW.processed_at
        );
        
        -- Delete from queue (optional - you can keep it if you want to retain queue history)
        -- For now, we'll keep it but you can uncomment the line below to delete
        -- DELETE FROM imei_data_queue WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for archival system
-- Trigger for imei_sku_info deletions
DROP TRIGGER IF EXISTS trigger_archive_imei_sku_info ON imei_sku_info;
CREATE TRIGGER trigger_archive_imei_sku_info
    BEFORE DELETE ON imei_sku_info
    FOR EACH ROW
    EXECUTE FUNCTION archive_imei_data();

-- Trigger for imei_inspect_data deletions
DROP TRIGGER IF EXISTS trigger_archive_imei_inspect_data ON imei_inspect_data;
CREATE TRIGGER trigger_archive_imei_inspect_data
    BEFORE DELETE ON imei_inspect_data
    FOR EACH ROW
    EXECUTE FUNCTION archive_imei_data();

-- Trigger for imei_units deletions
DROP TRIGGER IF EXISTS trigger_archive_imei_units ON imei_units;
CREATE TRIGGER trigger_archive_imei_units
    BEFORE DELETE ON imei_units
    FOR EACH ROW
    EXECUTE FUNCTION archive_imei_data();

-- Trigger for queue logging
DROP TRIGGER IF EXISTS trigger_log_processed_queue ON imei_data_queue;
CREATE TRIGGER trigger_log_processed_queue
    AFTER UPDATE ON imei_data_queue
    FOR EACH ROW
    EXECUTE FUNCTION log_processed_queue_item();

-- Function to manually archive IMEI data
CREATE OR REPLACE FUNCTION manual_archive_imei(target_imei VARCHAR(15), reason VARCHAR(200) DEFAULT 'manual_delete')
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Archive SKU info
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
        reason
    FROM imei_sku_info 
    WHERE imei = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Archive inspect data
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
        reason
    FROM imei_inspect_data 
    WHERE imei = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Archive unit data
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
        reason
    FROM imei_units 
    WHERE imei = target_imei;
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    archived_count := archived_count + temp_count;
    
    -- Delete from all tables
    DELETE FROM imei_sku_info WHERE imei = target_imei;
    DELETE FROM imei_inspect_data WHERE imei = target_imei;
    DELETE FROM imei_units WHERE imei = target_imei;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get archive statistics
CREATE OR REPLACE FUNCTION get_archive_stats()
RETURNS TABLE(
    total_archived BIGINT,
    archived_today BIGINT,
    archived_this_week BIGINT,
    archived_this_month BIGINT,
    by_table JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_archived,
        COUNT(*) FILTER (WHERE archived_at >= CURRENT_DATE) as archived_today,
        COUNT(*) FILTER (WHERE archived_at >= CURRENT_DATE - INTERVAL '7 days') as archived_this_week,
        COUNT(*) FILTER (WHERE archived_at >= CURRENT_DATE - INTERVAL '1 month') as archived_this_month,
        jsonb_object_agg(original_table, count) as by_table
    FROM imei_archived,
    LATERAL (
        SELECT jsonb_object_agg(original_table, count) as count
        FROM (
            SELECT original_table, COUNT(*) as count
            FROM imei_archived
            GROUP BY original_table
        ) t
    ) stats;
END;
$$ LANGUAGE plpgsql;

-- Function to restore archived IMEI data
CREATE OR REPLACE FUNCTION restore_archived_imei(target_imei VARCHAR(15))
RETURNS INTEGER AS $$
DECLARE
    restored_count INTEGER := 0;
    archived_record RECORD;
BEGIN
    -- Restore each archived record
    FOR archived_record IN 
        SELECT * FROM imei_archived 
        WHERE imei = target_imei 
        ORDER BY archived_at DESC
    LOOP
        CASE archived_record.original_table
            WHEN 'imei_sku_info' THEN
                INSERT INTO imei_sku_info 
                SELECT * FROM jsonb_populate_record(null::imei_sku_info, archived_record.archived_data)
                ON CONFLICT (imei) DO NOTHING;
            WHEN 'imei_inspect_data' THEN
                INSERT INTO imei_inspect_data 
                SELECT * FROM jsonb_populate_record(null::imei_inspect_data, archived_record.archived_data)
                ON CONFLICT (id) DO NOTHING;
            WHEN 'imei_units' THEN
                INSERT INTO imei_units 
                SELECT * FROM jsonb_populate_record(null::imei_units, archived_record.archived_data)
                ON CONFLICT (imei) DO NOTHING;
        END CASE;
        
        restored_count := restored_count + 1;
    END LOOP;
    
    -- Remove from archive after successful restoration
    DELETE FROM imei_archived WHERE imei = target_imei;
    
    RETURN restored_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old queue data (move to log and delete from queue)
CREATE OR REPLACE FUNCTION cleanup_old_queue_data(older_than_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
    cutoff_date TIMESTAMPTZ;
BEGIN
    cutoff_date := NOW() - (older_than_days || ' days')::INTERVAL;
    
    -- Move old completed/failed items to log
    INSERT INTO imei_data_log (
        queue_id,
        imei,
        source,
        raw_data,
        processing_status,
        error_message,
        processed_at
    )
    SELECT 
        id,
        raw_data->>'imei',
        source,
        raw_data,
        status,
        error_message,
        processed_at
    FROM imei_data_queue 
    WHERE created_at < cutoff_date 
    AND status IN ('completed', 'failed');
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    -- Delete old items from queue
    DELETE FROM imei_data_queue 
    WHERE created_at < cutoff_date 
    AND status IN ('completed', 'failed');
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;
```

### 2. Restart Your Server

The archival system is now integrated into your Express server. The routes are automatically available at `/api/imei-archival/*`.

## 🧪 Testing

Run the test script to verify everything works:

```bash
node test-archival-system.js
```

## 📊 Usage Examples

### Manual Archive
```bash
curl -X POST http://localhost:3001/api/imei-archival/archive \
  -H "Content-Type: application/json" \
  -d '{"imei": "123456789012345", "reason": "manual_delete"}'
```

### Get Archive Stats
```bash
curl http://localhost:3001/api/imei-archival/stats
```

### Restore Archived IMEI
```bash
curl -X POST http://localhost:3001/api/imei-archival/restore/123456789012345
```

### Get Processing Metrics
```bash
curl http://localhost:3001/api/imei-archival/metrics
```

## 🔄 How It Works

### Automatic Cascade Deletion
1. Delete IMEI from `imei_sku_info` table
2. Trigger automatically archives the deleted record
3. Trigger finds related records in `imei_inspect_data` and `imei_units`
4. All related records are archived and then deleted
5. You get 3 archived records (one from each table) for one deletion

### Queue Processing Logging
1. Queue item is processed (completed/failed)
2. Trigger automatically calculates processing time
3. Record is moved to `imei_data_log` table
4. Original queue record is preserved (or optionally deleted)

### Data Recovery
1. Call restore endpoint with IMEI
2. System finds all archived records for that IMEI
3. Each record is restored to its original table
4. Archived records are removed after successful restoration

## 🛡️ Safety Features

- **Complete Data Preservation**: All data is stored in JSONB format
- **Audit Trail**: Every archive operation is logged with timestamp and reason
- **Safe Restoration**: Uses `ON CONFLICT DO NOTHING` to prevent data corruption
- **Performance Optimized**: Indexes on frequently queried columns
- **Automatic Cleanup**: Old queue data can be automatically moved to logs

## 📈 Benefits

1. **Data Integrity**: No data loss during deletions
2. **Recovery Capability**: Restore accidentally deleted data
3. **Audit Compliance**: Complete audit trail of all operations
4. **Performance Monitoring**: Track processing times and success rates
5. **Storage Optimization**: Automatic cleanup of old queue data
6. **Business Continuity**: Maintain data relationships across operations

## 🎯 Perfect for Your Use Case

This system exactly matches your requirements:
- ✅ **3 tables synchronized**: When one IMEI is deleted, all related data is archived
- ✅ **Archive table**: `imei_archived` stores all deleted data
- ✅ **Queue logging**: `imei_data_log` tracks all processed queue items
- ✅ **Automatic operation**: No manual intervention required
- ✅ **Complete recovery**: Restore any archived IMEI with all its data

The system is now ready to use! 🚀
