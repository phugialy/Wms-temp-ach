-- Revised Database Schema for Bulk PhoneCheck Processing
-- IMEI Details: PhoneCheck data + inventory summary
-- Inventory: Simplified with IMEI, SKU, location, and inventory status

-- Drop existing tables if they exist (be careful with this in production!)
-- DROP TABLE IF EXISTS inventory CASCADE;
-- DROP TABLE IF EXISTS imei_details CASCADE;

-- 1. IMEI Details Table - Stores all PhoneCheck data + inventory summary per IMEI
CREATE TABLE IF NOT EXISTS imei_details (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) UNIQUE NOT NULL,
    
    -- PhoneCheck Data
    device_name VARCHAR(255),
    brand VARCHAR(100),
    model VARCHAR(100),
    storage VARCHAR(50),
    color VARCHAR(50),
    carrier VARCHAR(100),
    working_status VARCHAR(20),
    battery_health INTEGER,
    condition VARCHAR(50),
    phonecheck_data JSONB, -- Store full PhoneCheck response
    
    -- Inventory Summary Fields (from your image)
    ready INTEGER DEFAULT 0,
    reserved INTEGER DEFAULT 0,
    qa_hold INTEGER DEFAULT 0,
    damaged INTEGER DEFAULT 0,
    available INTEGER DEFAULT 0,
    avg_cost_cents INTEGER, -- Average cost in cents
    est_value_cents INTEGER, -- Estimated value in cents
    first_received_at TIMESTAMPTZ,
    last_movement_at TIMESTAMPTZ,
    tags_cached TEXT[], -- Array of tags
    
    -- Metadata
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Inventory Table - Simplified with IMEI, SKU, location, and inventory status
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) UNIQUE NOT NULL,
    sku VARCHAR(100),
    location VARCHAR(100) DEFAULT 'DNCL-Inspection',
    onhand INTEGER DEFAULT 0,
    ready INTEGER DEFAULT 0,
    reserved INTEGER DEFAULT 0,
    qa_hold INTEGER DEFAULT 0,
    damaged INTEGER DEFAULT 0,
    available INTEGER DEFAULT 0,
    avg_cost_cents INTEGER,
    est_value_cents INTEGER,
    first_received_at TIMESTAMPTZ,
    last_movement_at TIMESTAMPTZ,
    tags TEXT[],
    phonecheck_synced BOOLEAN DEFAULT FALSE,
    last_phonecheck TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_imei_details_imei ON imei_details(imei);
CREATE INDEX IF NOT EXISTS idx_imei_details_brand ON imei_details(brand);
CREATE INDEX IF NOT EXISTS idx_imei_details_model ON imei_details(model);
CREATE INDEX IF NOT EXISTS idx_imei_details_working_status ON imei_details(working_status);
CREATE INDEX IF NOT EXISTS idx_imei_details_condition ON imei_details(condition);

CREATE INDEX IF NOT EXISTS idx_inventory_imei ON inventory(imei);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location);
CREATE INDEX IF NOT EXISTS idx_inventory_phonecheck_synced ON inventory(phonecheck_synced);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_imei_details_brand_model ON imei_details(brand, model);
CREATE INDEX IF NOT EXISTS idx_inventory_sku_location ON inventory(sku, location);

-- Add foreign key constraints for data integrity
ALTER TABLE inventory 
ADD CONSTRAINT fk_inventory_imei 
FOREIGN KEY (imei) REFERENCES imei_details(imei) ON DELETE CASCADE;

-- Create a view for easy querying of complete inventory with PhoneCheck data
CREATE OR REPLACE VIEW inventory_summary AS
SELECT 
    i.imei,
    id.device_name,
    id.brand,
    id.model,
    id.storage,
    id.color,
    id.carrier,
    id.working_status,
    id.battery_health,
    id.condition,
    i.sku,
    i.location,
    i.onhand,
    i.ready,
    i.reserved,
    i.qa_hold,
    i.damaged,
    i.available,
    i.avg_cost_cents,
    i.est_value_cents,
    i.first_received_at,
    i.last_movement_at,
    i.tags,
    i.phonecheck_synced,
    i.last_phonecheck
FROM inventory i
LEFT JOIN imei_details id ON i.imei = id.imei;

-- Create a function to update inventory quantities automatically
CREATE OR REPLACE FUNCTION update_inventory_quantities()
RETURNS TRIGGER AS $$
BEGIN
    -- Update quantities in imei_details when inventory changes
    UPDATE imei_details 
    SET 
        ready = NEW.ready,
        reserved = NEW.reserved,
        qa_hold = NEW.qa_hold,
        damaged = NEW.damaged,
        available = NEW.available,
        avg_cost_cents = NEW.avg_cost_cents,
        est_value_cents = NEW.est_value_cents,
        first_received_at = NEW.first_received_at,
        last_movement_at = NEW.last_movement_at,
        tags_cached = NEW.tags,
        last_updated = NOW()
    WHERE imei = NEW.imei;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update imei_details when inventory changes
CREATE TRIGGER trigger_update_imei_details_insert
    AFTER INSERT ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_quantities();

CREATE TRIGGER trigger_update_imei_details_update
    AFTER UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_quantities();

-- Insert some sample data for testing
INSERT INTO imei_details (imei, device_name, brand, model, storage, color, carrier, working_status, battery_health, condition, ready, reserved, qa_hold, damaged, available, avg_cost_cents, est_value_cents, first_received_at, last_movement_at, tags_cached) 
VALUES 
    ('123456789012345', 'iPhone 14 Pro', 'Apple', 'iPhone 14 Pro', '128GB', 'Space Black', 'Unlocked', 'YES', 95, 'Excellent', 1, 0, 0, 0, 1, 85000, 95000, '2025-08-21 16:45:26.577916+00', '2025-08-21 16:45:27.086695+00', ARRAY['premium', 'unlocked']),
    ('987654321098765', 'Samsung Galaxy S23', 'Samsung', 'Galaxy S23', '256GB', 'Phantom Black', 'T-Mobile', 'YES', 88, 'Good', 1, 0, 0, 0, 1, 75000, 85000, '2025-08-21 16:45:26.577916+00', '2025-08-21 16:45:27.086695+00', ARRAY['mid-range', 'carrier-locked'])
ON CONFLICT (imei) DO NOTHING;

INSERT INTO inventory (imei, sku, location, onhand, ready, reserved, qa_hold, damaged, available, avg_cost_cents, est_value_cents, first_received_at, last_movement_at, tags, phonecheck_synced, last_phonecheck)
VALUES 
    ('123456789012345', 'APPLE-IPHONE14PRO-128GB-SPACEBLACK-UNLOCKED', 'DNCL-Inspection', 1, 1, 0, 0, 0, 1, 85000, 95000, '2025-08-21 16:45:26.577916+00', '2025-08-21 16:45:27.086695+00', ARRAY['premium', 'unlocked'], true, NOW()),
    ('987654321098765', 'SAMSUNG-GALAXYS23-256GB-PHANTOMBLACK-TMOBILE', 'DNCL-Inspection', 1, 1, 0, 0, 0, 1, 75000, 85000, '2025-08-21 16:45:26.577916+00', '2025-08-21 16:45:27.086695+00', ARRAY['mid-range', 'carrier-locked'], true, NOW())
ON CONFLICT (imei) DO NOTHING;

-- Grant necessary permissions (adjust as needed for your Supabase setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
