-- Migration: Create no_match_queue table for devices without SKU matches
-- Purpose: Store devices that don't match any SKUs for manual review and SKU creation

CREATE TABLE IF NOT EXISTS no_match_queue (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) NOT NULL UNIQUE,
    brand VARCHAR(100),
    model VARCHAR(200),
    capacity VARCHAR(50),
    color VARCHAR(100),
    carrier VARCHAR(100),
    device_notes TEXT,
    original_sku VARCHAR(200),
    
    -- Normalization results (what we tried to match)
    normalized_model VARCHAR(100),
    normalized_capacity VARCHAR(50),
    normalized_color VARCHAR(100),
    normalized_carrier VARCHAR(100),
    
    -- Fallback attempts
    fallback_attempts JSONB DEFAULT '[]'::jsonb,
    fallback_reason TEXT,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'ignored')),
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1 = highest priority
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by VARCHAR(100),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_sku VARCHAR(200),
    
    -- Indexes for performance
    CONSTRAINT no_match_queue_imei_check CHECK (LENGTH(imei) = 15)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_no_match_queue_status ON no_match_queue(status);
CREATE INDEX IF NOT EXISTS idx_no_match_queue_priority ON no_match_queue(priority);
CREATE INDEX IF NOT EXISTS idx_no_match_queue_created_at ON no_match_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_no_match_queue_brand ON no_match_queue(brand);
CREATE INDEX IF NOT EXISTS idx_no_match_queue_model ON no_match_queue(model);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_no_match_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_no_match_queue_updated_at
    BEFORE UPDATE ON no_match_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_no_match_queue_updated_at();

-- Add comments for documentation
COMMENT ON TABLE no_match_queue IS 'Queue for devices that don''t match any SKUs in sku_master table';
COMMENT ON COLUMN no_match_queue.imei IS 'Device IMEI (15 digits)';
COMMENT ON COLUMN no_match_queue.fallback_attempts IS 'JSON array of fallback strategies attempted';
COMMENT ON COLUMN no_match_queue.status IS 'Current status: pending, reviewed, resolved, ignored';
COMMENT ON COLUMN no_match_queue.priority IS 'Priority level 1-10 (1 = highest priority)';
COMMENT ON COLUMN no_match_queue.resolved_sku IS 'SKU code assigned when resolved';
