-- ========================================
-- FIX QUEUE FUNCTIONS - DROP AND RECREATE
-- ========================================

-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_queue_stats();
DROP FUNCTION IF EXISTS get_next_queue_item();
DROP FUNCTION IF EXISTS mark_queue_item_processing(INTEGER);
DROP FUNCTION IF EXISTS mark_queue_item_completed(INTEGER);
DROP FUNCTION IF EXISTS mark_queue_item_failed(INTEGER, TEXT);

-- Create a function to get next item to process (with priority)
CREATE OR REPLACE FUNCTION get_next_queue_item()
RETURNS TABLE(
    id INTEGER,
    raw_data JSONB,
    status VARCHAR(20),
    priority INTEGER,
    retry_count INTEGER,
    max_retries INTEGER,
    source VARCHAR(50),
    batch_id VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    processed_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.raw_data,
        q.status,
        q.priority,
        q.retry_count,
        q.max_retries,
        q.source,
        q.batch_id,
        q.created_at,
        q.updated_at,
        q.processed_at
    FROM imei_data_queue q
    WHERE q.status = 'pending'
    ORDER BY q.priority ASC, q.created_at ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_next_queue_item() TO authenticated;

-- Create a function to mark item as processing
CREATE OR REPLACE FUNCTION mark_queue_item_processing(item_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    success BOOLEAN := FALSE;
BEGIN
    UPDATE imei_data_queue
    SET 
        status = 'processing',
        updated_at = NOW()
    WHERE id = item_id AND status = 'pending';
    
    IF FOUND THEN
        success := TRUE;
    END IF;
    
    RETURN success;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mark_queue_item_processing(INTEGER) TO authenticated;

-- Create a function to mark item as completed
CREATE OR REPLACE FUNCTION mark_queue_item_completed(item_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    success BOOLEAN := FALSE;
BEGIN
    UPDATE imei_data_queue
    SET 
        status = 'completed',
        processed_at = NOW(),
        updated_at = NOW(),
        error_message = NULL
    WHERE id = item_id;
    
    IF FOUND THEN
        success := TRUE;
    END IF;
    
    RETURN success;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mark_queue_item_completed(INTEGER) TO authenticated;

-- Create a function to mark item as failed
CREATE OR REPLACE FUNCTION mark_queue_item_failed(item_id INTEGER, error_msg TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    success BOOLEAN := FALSE;
    current_retry_count INTEGER;
    current_max_retries INTEGER;
BEGIN
    -- Get current retry information
    SELECT retry_count, max_retries INTO current_retry_count, current_max_retries
    FROM imei_data_queue WHERE id = item_id;
    
    -- Increment retry count
    current_retry_count := current_retry_count + 1;
    
    -- Determine if we should retry or mark as permanently failed
    IF current_retry_count < current_max_retries THEN
        -- Mark for retry
        UPDATE imei_data_queue
        SET 
            status = 'pending',
            retry_count = current_retry_count,
            updated_at = NOW(),
            error_message = error_msg
        WHERE id = item_id;
    ELSE
        -- Mark as permanently failed
        UPDATE imei_data_queue
        SET 
            status = 'failed',
            retry_count = current_retry_count,
            processed_at = NOW(),
            updated_at = NOW(),
            error_message = error_msg
        WHERE id = item_id;
    END IF;
    
    IF FOUND THEN
        success := TRUE;
    END IF;
    
    RETURN success;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mark_queue_item_failed(INTEGER, TEXT) TO authenticated;

-- Create a function to get queue statistics
CREATE OR REPLACE FUNCTION get_queue_stats()
RETURNS TABLE(
    total_items BIGINT,
    pending_items BIGINT,
    processing_items BIGINT,
    completed_items BIGINT,
    failed_items BIGINT,
    avg_processing_time INTERVAL,
    oldest_pending_item TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_items,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_items,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_items,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_items,
        AVG(processed_at - created_at) FILTER (WHERE status = 'completed') as avg_processing_time,
        MIN(created_at) FILTER (WHERE status = 'pending') as oldest_pending_item
    FROM imei_data_queue;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_queue_stats() TO authenticated;

