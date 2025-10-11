-- Integrate Clean Input with Existing Schema
-- This migration enhances existing tables instead of creating new ones

-- ========================================
-- STEP 1: ENHANCE EXISTING IMEI_DATA_QUEUE TABLE
-- ========================================

-- Add new columns to existing imei_data_queue table
ALTER TABLE imei_data_queue 
ADD COLUMN IF NOT EXISTS input_status VARCHAR(20) DEFAULT 'received',
ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS device_notes TEXT,
ADD COLUMN IF NOT EXISTS working_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS battery_health VARCHAR(20),
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'api';

-- ========================================
-- STEP 2: ENHANCE EXISTING SKU_MATCHING_RESULTS TABLE
-- ========================================

-- Add new columns to existing sku_matching_results table
ALTER TABLE sku_matching_results 
ADD COLUMN IF NOT EXISTS total_matches INTEGER,
ADD COLUMN IF NOT EXISTS best_match_sku VARCHAR(100),
ADD COLUMN IF NOT EXISTS processing_time INTEGER,
ADD COLUMN IF NOT EXISTS data_completeness DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS requires_attention BOOLEAN DEFAULT FALSE;

-- ========================================
-- STEP 3: CREATE NEW SUPPORTING TABLES (ONLY IF NEEDED)
-- ========================================

-- SKU match details table (stores individual matches)
CREATE TABLE IF NOT EXISTS sku_match_details (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) NOT NULL,
    sku_code VARCHAR(100) NOT NULL,
    match_score INTEGER,
    confidence_level VARCHAR(20),
    match_type VARCHAR(20),
    matched_characteristics JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(imei, sku_code)
);

-- Processing errors table (stores error details)
CREATE TABLE IF NOT EXISTS processing_errors (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) NOT NULL,
    error_message TEXT,
    error_type VARCHAR(50),
    stack_trace TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ========================================

-- Indexes for imei_data_queue
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_status ON imei_data_queue(input_status);
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_batch ON imei_data_queue(batch_id);
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_source ON imei_data_queue(source);
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_created_at ON imei_data_queue(created_at);

-- Indexes for sku_matching_results
CREATE INDEX IF NOT EXISTS idx_sku_matching_results_status ON sku_matching_results(match_status);
CREATE INDEX IF NOT EXISTS idx_sku_matching_results_confidence ON sku_matching_results(confidence_level);
CREATE INDEX IF NOT EXISTS idx_sku_matching_results_processed_at ON sku_matching_results(processed_at);

-- Indexes for sku_match_details
CREATE INDEX IF NOT EXISTS idx_sku_match_details_imei ON sku_match_details(imei);
CREATE INDEX IF NOT EXISTS idx_sku_match_details_sku ON sku_match_details(sku_code);
CREATE INDEX IF NOT EXISTS idx_sku_match_details_score ON sku_match_details(match_score);

-- Indexes for processing_errors
CREATE INDEX IF NOT EXISTS idx_processing_errors_imei ON processing_errors(imei);
CREATE INDEX IF NOT EXISTS idx_processing_errors_created_at ON processing_errors(created_at);

-- ========================================
-- STEP 5: UPDATE TRIGGERS FOR UPDATED_AT
-- ========================================

-- Update trigger for sku_match_details
CREATE TRIGGER IF NOT EXISTS trigger_sku_match_details_updated_at
    BEFORE UPDATE ON sku_match_details
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- STEP 6: COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON COLUMN imei_data_queue.input_status IS 'Status: received, processing, completed, failed';
COMMENT ON COLUMN imei_data_queue.batch_id IS 'Groups related items together';
COMMENT ON COLUMN imei_data_queue.source IS 'Source: bulk-add, phonecheck-add, manual, api';
COMMENT ON COLUMN sku_matching_results.data_completeness IS 'Completeness score from 0.0 to 1.0';
COMMENT ON COLUMN sku_matching_results.requires_attention IS 'Whether the match requires manual review';
COMMENT ON TABLE sku_match_details IS 'Stores individual SKU matches for each device';
COMMENT ON TABLE processing_errors IS 'Stores error details for failed processing';


