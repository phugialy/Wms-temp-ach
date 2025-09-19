-- Create tables for bulk operations scheduling and monitoring

-- Table for scheduled bulk operations
CREATE TABLE IF NOT EXISTS scheduled_bulk_operations (
    id SERIAL PRIMARY KEY,
    station_id VARCHAR(50) NOT NULL,
    location_inspection VARCHAR(100) NOT NULL,
    operation_type VARCHAR(50) NOT NULL DEFAULT 'BULK_ADD',
    schedule_date DATE NOT NULL DEFAULT CURRENT_DATE,
    schedule_time TIME NOT NULL,
    schedule_type VARCHAR(20) DEFAULT 'once',
    is_active BOOLEAN DEFAULT true,
    is_modified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    notes TEXT
);

-- Table for bulk operation execution history
CREATE TABLE IF NOT EXISTS bulk_operation_executions (
    id SERIAL PRIMARY KEY,
    scheduled_operation_id INTEGER REFERENCES scheduled_bulk_operations(id),
    execution_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_completed_at TIMESTAMP,
    execution_status VARCHAR(20) DEFAULT 'RUNNING', -- RUNNING, COMPLETED, FAILED, CANCELLED
    total_devices_processed INTEGER DEFAULT 0,
    devices_passed INTEGER DEFAULT 0,
    devices_failed INTEGER DEFAULT 0,
    devices_pending INTEGER DEFAULT 0,
    devices_added_to_db INTEGER DEFAULT 0,
    skus_added INTEGER DEFAULT 0,
    execution_duration_seconds INTEGER,
    error_message TEXT,
    execution_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for bulk operation results (detailed SKU breakdown)
CREATE TABLE IF NOT EXISTS bulk_operation_results (
    id SERIAL PRIMARY KEY,
    execution_id INTEGER REFERENCES bulk_operation_executions(id),
    sku_code VARCHAR(200) NOT NULL,
    brand VARCHAR(50),
    model VARCHAR(100),
    capacity VARCHAR(20),
    color VARCHAR(50),
    carrier VARCHAR(50),
    device_count INTEGER DEFAULT 0,
    working_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scheduled_operations_date_time ON scheduled_bulk_operations(schedule_date, schedule_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_operations_active ON scheduled_bulk_operations(is_active);
CREATE INDEX IF NOT EXISTS idx_executions_scheduled_id ON bulk_operation_executions(scheduled_operation_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON bulk_operation_executions(execution_status);
CREATE INDEX IF NOT EXISTS idx_results_execution_id ON bulk_operation_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_results_sku ON bulk_operation_results(sku_code);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_scheduled_operations_updated_at 
    BEFORE UPDATE ON scheduled_bulk_operations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample scheduled operations
INSERT INTO scheduled_bulk_operations (station_id, location_inspection, schedule_date, schedule_time, created_by, notes)
VALUES 
    ('dncltz1', 'MAIN_INSPECTION_AREA', CURRENT_DATE, '09:00:00', 'Manager', 'Daily morning bulk processing'),
    ('dncltz2', 'QUALITY_CONTROL', CURRENT_DATE, '14:00:00', 'Manager', 'Afternoon quality check'),
    ('dncltz3', 'RETURNS_PROCESSING', CURRENT_DATE, '16:30:00', 'Manager', 'End of day returns processing')
ON CONFLICT DO NOTHING;
