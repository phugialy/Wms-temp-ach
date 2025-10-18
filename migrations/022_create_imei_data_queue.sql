-- Create IMEI Data Queue Table for App 1: IMEI Processing
-- This table stores IMEI data for ultra-fast processing

CREATE TABLE IF NOT EXISTS imei_data_queue (
    id BIGSERIAL PRIMARY KEY,
    imei VARCHAR(15) UNIQUE NOT NULL,
    brand VARCHAR(50),
    model VARCHAR(100),
    capacity VARCHAR(50),
    color VARCHAR(50),
    carrier VARCHAR(50),
    device_notes TEXT,
    working_status VARCHAR(20),
    battery_health VARCHAR(20),
    source VARCHAR(20) DEFAULT 'api',
    batch_id VARCHAR(50),
    input_status VARCHAR(20) DEFAULT 'received',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_imei ON imei_data_queue(imei);
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_batch_id ON imei_data_queue(batch_id);
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_input_status ON imei_data_queue(input_status);
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_source ON imei_data_queue(source);
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_created_at ON imei_data_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_processed_at ON imei_data_queue(processed_at);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_status_batch ON imei_data_queue(input_status, batch_id);
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_status_created ON imei_data_queue(input_status, created_at);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_imei_data_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_imei_data_queue_updated_at
    BEFORE UPDATE ON imei_data_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_imei_data_queue_updated_at();

-- Add comments for documentation
COMMENT ON TABLE imei_data_queue IS 'Stores IMEI data for ultra-fast processing in App 1';
COMMENT ON COLUMN imei_data_queue.imei IS '15-digit IMEI number (unique)';
COMMENT ON COLUMN imei_data_queue.brand IS 'Device brand (e.g., Samsung, Apple)';
COMMENT ON COLUMN imei_data_queue.model IS 'Device model (e.g., Galaxy S23, iPhone 14)';
COMMENT ON COLUMN imei_data_queue.capacity IS 'Storage capacity (e.g., 256GB, 128GB)';
COMMENT ON COLUMN imei_data_queue.color IS 'Device color (e.g., Black, Blue)';
COMMENT ON COLUMN imei_data_queue.carrier IS 'Carrier information (e.g., Unlocked, Verizon)';
COMMENT ON COLUMN imei_data_queue.device_notes IS 'Additional device notes or comments';
COMMENT ON COLUMN imei_data_queue.working_status IS 'Device working status (e.g., Working, Failed)';
COMMENT ON COLUMN imei_data_queue.battery_health IS 'Battery health status (e.g., Good, Poor)';
COMMENT ON COLUMN imei_data_queue.source IS 'Data source (api, phonecheck, manual)';
COMMENT ON COLUMN imei_data_queue.batch_id IS 'Batch identifier for bulk processing';
COMMENT ON COLUMN imei_data_queue.input_status IS 'Processing status (received, ready_for_sku_matching, sku_processed)';
COMMENT ON COLUMN imei_data_queue.error_message IS 'Error message if processing failed';
COMMENT ON COLUMN imei_data_queue.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN imei_data_queue.updated_at IS 'Record last update timestamp';
COMMENT ON COLUMN imei_data_queue.processed_at IS 'SKU processing completion timestamp';



