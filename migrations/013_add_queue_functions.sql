-- ========================================
-- ADD QUEUE FUNCTIONS FOR CLEAN SCHEMA
-- ========================================

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_queue_stats()
RETURNS TABLE (
    total_items BIGINT,
    pending_items BIGINT,
    processing_items BIGINT,
    completed_items BIGINT,
    failed_items BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_items,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_items,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_items,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_items
    FROM imei_data_queue;
END;
$$;

-- Function to process all pending queue items
CREATE OR REPLACE FUNCTION process_all_pending_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    processed_count INTEGER := 0;
    queue_item RECORD;
BEGIN
    -- Update status to processing
    UPDATE imei_data_queue 
    SET status = 'processing' 
    WHERE status = 'pending';
    
    -- Process each item (simplified - just mark as completed for now)
    FOR queue_item IN 
        SELECT id, raw_data 
        FROM imei_data_queue 
        WHERE status = 'processing'
    LOOP
        BEGIN
            -- For now, just mark as completed
            -- In a real implementation, this would process the raw_data
            UPDATE imei_data_queue 
            SET 
                status = 'completed',
                processed_at = NOW()
            WHERE id = queue_item.id;
            
            processed_count := processed_count + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Mark as failed if processing fails
                UPDATE imei_data_queue 
                SET 
                    status = 'failed',
                    processed_at = NOW()
                WHERE id = queue_item.id;
        END;
    END LOOP;
    
    RETURN processed_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_queue_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION process_all_pending_queue() TO authenticated;
