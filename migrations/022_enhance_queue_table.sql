-- ========================================
-- ENHANCE QUEUE TABLE FOR ADVANCED QUEUE SYSTEM
-- ========================================

-- Add new columns to imei_data_queue table for enhanced queue management
ALTER TABLE imei_data_queue 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS source VARCHAR(50),
ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50);

-- Add comments to explain the new columns
COMMENT ON COLUMN imei_data_queue.priority IS 'Processing priority: 1=high, 5=normal, 10=low';
COMMENT ON COLUMN imei_data_queue.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN imei_data_queue.max_retries IS 'Maximum number of retry attempts allowed';
COMMENT ON COLUMN imei_data_queue.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN imei_data_queue.source IS 'Source of the data: bulk-add, single-add, api, etc.';
COMMENT ON COLUMN imei_data_queue.batch_id IS 'Group identifier for related items';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_status_priority 
ON imei_data_queue(status, priority);

CREATE INDEX IF NOT EXISTS idx_imei_data_queue_batch_id 
ON imei_data_queue(batch_id);

CREATE INDEX IF NOT EXISTS idx_imei_data_queue_source 
ON imei_data_queue(source);

CREATE INDEX IF NOT EXISTS idx_imei_data_queue_created_at 
ON imei_data_queue(created_at);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_imei_data_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_imei_data_queue_updated_at ON imei_data_queue;
CREATE TRIGGER trigger_update_imei_data_queue_updated_at
    BEFORE UPDATE ON imei_data_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_imei_data_queue_updated_at();

-- Create a function to get next item to process (with priority)
CREATE OR REPLACE FUNCTION get_next_queue_item()
RETURNS TABLE(
    id INTEGER,
    raw_data JSONB,
    priority INTEGER,
    retry_count INTEGER,
    max_retries INTEGER,
    source VARCHAR(50),
    batch_id VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.raw_data,
        q.priority,
        q.retry_count,
        q.max_retries,
        q.source,
        q.batch_id
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

