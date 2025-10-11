-- Clean Input Schema Migration
-- This creates the necessary tables for the simple background processing approach

-- Device input table (stores raw device data)
CREATE TABLE IF NOT EXISTS device_input (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) UNIQUE NOT NULL,
    brand VARCHAR(50),
    model VARCHAR(100),
    capacity VARCHAR(50),
    color VARCHAR(50),
    carrier VARCHAR(50),
    device_notes TEXT,
    working_status VARCHAR(20),
    battery_health VARCHAR(20),
    source VARCHAR(20) NOT NULL DEFAULT 'api',
    batch_id VARCHAR(50),
    input_status VARCHAR(20) DEFAULT 'received',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- SKU matching results table (stores SKU matching results)
CREATE TABLE IF NOT EXISTS sku_matching_results (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) UNIQUE NOT NULL,
    matched_sku VARCHAR(100),
    match_score INTEGER,
    confidence_level VARCHAR(20),
    match_status VARCHAR(20),
    total_matches INTEGER,
    best_match_sku VARCHAR(100),
    processing_time INTEGER,
    data_completeness DECIMAL(3,2),
    requires_attention BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_device_input_imei ON device_input(imei);
CREATE INDEX IF NOT EXISTS idx_device_input_status ON device_input(input_status);
CREATE INDEX IF NOT EXISTS idx_device_input_batch ON device_input(batch_id);
CREATE INDEX IF NOT EXISTS idx_device_input_source ON device_input(source);
CREATE INDEX IF NOT EXISTS idx_device_input_created_at ON device_input(created_at);

CREATE INDEX IF NOT EXISTS idx_sku_matching_results_imei ON sku_matching_results(imei);
CREATE INDEX IF NOT EXISTS idx_sku_matching_results_status ON sku_matching_results(match_status);
CREATE INDEX IF NOT EXISTS idx_sku_matching_results_confidence ON sku_matching_results(confidence_level);
CREATE INDEX IF NOT EXISTS idx_sku_matching_results_processed_at ON sku_matching_results(processed_at);

CREATE INDEX IF NOT EXISTS idx_sku_match_details_imei ON sku_match_details(imei);
CREATE INDEX IF NOT EXISTS idx_sku_match_details_sku ON sku_match_details(sku_code);
CREATE INDEX IF NOT EXISTS idx_sku_match_details_score ON sku_match_details(match_score);

CREATE INDEX IF NOT EXISTS idx_processing_errors_imei ON processing_errors(imei);
CREATE INDEX IF NOT EXISTS idx_processing_errors_created_at ON processing_errors(created_at);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_device_input_updated_at
    BEFORE UPDATE ON device_input
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_sku_matching_results_updated_at
    BEFORE UPDATE ON sku_matching_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_sku_match_details_updated_at
    BEFORE UPDATE ON sku_match_details
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE device_input IS 'Stores raw device input data from operators';
COMMENT ON TABLE sku_matching_results IS 'Stores SKU matching results for each device';
COMMENT ON TABLE sku_match_details IS 'Stores individual SKU matches for each device';
COMMENT ON TABLE processing_errors IS 'Stores error details for failed processing';

COMMENT ON COLUMN device_input.input_status IS 'Status: received, processing, completed, failed';
COMMENT ON COLUMN sku_matching_results.match_status IS 'Status: matched, no_match, requires_attention, failed';
COMMENT ON COLUMN sku_matching_results.confidence_level IS 'Level: high_confidence, medium_confidence, low_confidence, very_low_confidence';
COMMENT ON COLUMN sku_matching_results.data_completeness IS 'Completeness score from 0.0 to 1.0';
COMMENT ON COLUMN sku_matching_results.requires_attention IS 'Whether the match requires manual review';


