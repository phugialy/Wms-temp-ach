-- ========================================
-- CREATE MISSING TABLES FOR HYBRID QUEUE SYSTEM
-- ========================================

-- Create Queue Processing Logs table
CREATE TABLE IF NOT EXISTS queue_processing_log (
    id SERIAL PRIMARY KEY,
    queue_item_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'processing', 'completed', 'failed', 'retry'
    message TEXT,
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for queue_processing_log
CREATE INDEX IF NOT EXISTS idx_queue_processing_log_queue_item_id 
ON queue_processing_log(queue_item_id);

CREATE INDEX IF NOT EXISTS idx_queue_processing_log_created_at 
ON queue_processing_log(created_at);

-- Create Queue Batch Tracking table
CREATE TABLE IF NOT EXISTS queue_batch (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(50) UNIQUE NOT NULL,
    source VARCHAR(50) NOT NULL,
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'failed'
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for queue_batch
CREATE INDEX IF NOT EXISTS idx_queue_batch_batch_id 
ON queue_batch(batch_id);

CREATE INDEX IF NOT EXISTS idx_queue_batch_status 
ON queue_batch(status);

CREATE INDEX IF NOT EXISTS idx_queue_batch_started_at 
ON queue_batch(started_at);

-- Create trigger to update updated_at for queue_batch
CREATE OR REPLACE FUNCTION update_queue_batch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for queue_batch
DROP TRIGGER IF EXISTS trigger_update_queue_batch_updated_at ON queue_batch;
CREATE TRIGGER trigger_update_queue_batch_updated_at
    BEFORE UPDATE ON queue_batch
    FOR EACH ROW
    EXECUTE FUNCTION update_queue_batch_updated_at();

-- Add comments to explain the tables
COMMENT ON TABLE queue_processing_log IS 'Logs all queue processing actions for debugging and monitoring';
COMMENT ON TABLE queue_batch IS 'Tracks batch processing progress and statistics';

COMMENT ON COLUMN queue_processing_log.queue_item_id IS 'Reference to the queue item being processed';
COMMENT ON COLUMN queue_processing_log.action IS 'Type of action: processing, completed, failed, retry';
COMMENT ON COLUMN queue_processing_log.message IS 'Success or informational message';
COMMENT ON COLUMN queue_processing_log.error IS 'Error message if action failed';

COMMENT ON COLUMN queue_batch.batch_id IS 'Unique identifier for the batch';
COMMENT ON COLUMN queue_batch.source IS 'Source of the batch: bulk-add, single-add, api, etc.';
COMMENT ON COLUMN queue_batch.total_items IS 'Total number of items in the batch';
COMMENT ON COLUMN queue_batch.processed_items IS 'Number of successfully processed items';
COMMENT ON COLUMN queue_batch.failed_items IS 'Number of failed items';
COMMENT ON COLUMN queue_batch.status IS 'Batch status: active, completed, failed';
COMMENT ON COLUMN queue_batch.started_at IS 'When batch processing started';
COMMENT ON COLUMN queue_batch.completed_at IS 'When batch processing completed';

-- Grant necessary permissions
GRANT ALL ON TABLE queue_processing_log TO authenticated;
GRANT ALL ON TABLE queue_batch TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE queue_processing_log_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE queue_batch_id_seq TO authenticated;

