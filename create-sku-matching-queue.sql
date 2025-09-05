-- ========================================
-- PHASE 1A: SKU MATCHING QUEUE TABLE
-- ========================================
-- This table handles the queue for SKU matching processing
-- Supports both automatic triggers and manual queueing

-- Drop existing table if it exists
DROP TABLE IF EXISTS sku_matching_queue CASCADE;

-- Create the queue table
CREATE TABLE sku_matching_queue (
    id BIGSERIAL PRIMARY KEY,
    
    -- IMEI to process
    imei VARCHAR(15) NOT NULL,
    
    -- Queue status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    
    -- Priority levels (1 = highest priority)
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    
    -- Processing details
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    processing_attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Error handling
    error_message TEXT,
    error_details JSONB,
    
    -- Source information
    source VARCHAR(50) DEFAULT 'trigger' CHECK (source IN ('trigger', 'manual', 'bulk_import', 'reprocess')),
    source_reference VARCHAR(100), -- Reference to what triggered this queue entry
    
    -- Processing context
    processing_context JSONB, -- Store any additional context needed for processing
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(imei, status) -- Prevent duplicate pending entries for same IMEI
);

-- Create indexes for performance
CREATE INDEX idx_sku_matching_queue_status ON sku_matching_queue(status);
CREATE INDEX idx_sku_matching_queue_priority ON sku_matching_queue(priority);
CREATE INDEX idx_sku_matching_queue_imei ON sku_matching_queue(imei);
CREATE INDEX idx_sku_matching_queue_created_at ON sku_matching_queue(created_at);
CREATE INDEX idx_sku_matching_queue_processing_started ON sku_matching_queue(processing_started_at);

-- Create composite index for efficient queue processing
CREATE INDEX idx_sku_matching_queue_processing ON sku_matching_queue(status, priority, created_at) 
WHERE status = 'pending';

-- Add foreign key constraint to ensure IMEI exists in product table
ALTER TABLE sku_matching_queue 
ADD CONSTRAINT fk_sku_matching_queue_imei 
FOREIGN KEY (imei) REFERENCES product(imei) ON DELETE CASCADE;

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_sku_matching_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_sku_matching_queue_updated_at
    BEFORE UPDATE ON sku_matching_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_sku_matching_queue_updated_at();

-- Create function to clean up old completed entries (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_sku_matching_queue_entries()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete completed entries older than 30 days
    DELETE FROM sku_matching_queue 
    WHERE status = 'completed' 
    AND processing_completed_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE sku_matching_queue IS 'Queue for SKU matching processing - handles both automatic triggers and manual requests';
COMMENT ON COLUMN sku_matching_queue.imei IS 'IMEI of device to process for SKU matching';
COMMENT ON COLUMN sku_matching_queue.status IS 'Current processing status: pending, processing, completed, failed, cancelled';
COMMENT ON COLUMN sku_matching_queue.priority IS 'Processing priority (1=highest, 10=lowest)';
COMMENT ON COLUMN sku_matching_queue.source IS 'What triggered this queue entry: trigger, manual, bulk_import, reprocess';
COMMENT ON COLUMN sku_matching_queue.processing_context IS 'Additional context data for processing (JSON)';

-- Insert some test data to verify table works
INSERT INTO sku_matching_queue (imei, status, priority, source, source_reference) 
VALUES 
    ('356317536612128', 'pending', 1, 'manual', 'test_entry_1'),
    ('356317536605163', 'pending', 2, 'manual', 'test_entry_2');

-- Verify table creation
SELECT 
    'Table created successfully' as status,
    COUNT(*) as test_entries_count
FROM sku_matching_queue;

