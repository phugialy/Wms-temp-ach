-- ========================================
-- SIMPLE TEST FUNCTION TO VERIFY UPDATE
-- ========================================

-- Simple test function to verify the function is being updated
CREATE OR REPLACE FUNCTION process_all_pending_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    processed_count INTEGER := 0;
    queue_item RECORD;
    error_msg TEXT;
BEGIN
    -- Update status to processing
    UPDATE imei_data_queue 
    SET status = 'processing' 
    WHERE status = 'pending';
    
    -- Process each item
    FOR queue_item IN 
        SELECT q.id, q.raw_data 
        FROM imei_data_queue q
        WHERE q.status = 'processing'
    LOOP
        BEGIN
            -- Just mark as completed for now to test
            UPDATE imei_data_queue 
            SET 
                status = 'completed',
                processed_at = NOW(),
                error_message = 'TEST FUNCTION WORKING'
            WHERE id = queue_item.id;
            
            processed_count := processed_count + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Capture the error message
                error_msg := SQLERRM;
                
                -- Mark as failed if processing fails
                UPDATE imei_data_queue 
                SET 
                    status = 'failed',
                    processed_at = NOW(),
                    error_message = error_msg
                WHERE id = queue_item.id;
                
                -- Log the error
                RAISE NOTICE 'Failed to process queue item %: %', queue_item.id, error_msg;
        END;
    END LOOP;
    
    RETURN processed_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_all_pending_queue() TO authenticated;
