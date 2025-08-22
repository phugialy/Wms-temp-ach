-- Optimized Database Schema for Bulk PhoneCheck Processing
-- Designed for 500+ units with 20-30 variables each

-- Drop existing tables if they exist (be careful with this in production!)
-- DROP TABLE IF EXISTS inventory_units CASCADE;
-- DROP TABLE IF EXISTS inventory_items CASCADE;
-- DROP TABLE IF EXISTS imei_details CASCADE;

-- 1. IMEI Details Table - Stores all PhoneCheck data per IMEI
CREATE TABLE IF NOT EXISTS imei_details (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) UNIQUE NOT NULL,
    device_name VARCHAR(255),
    brand VARCHAR(100),
    model VARCHAR(100),
    storage VARCHAR(50),
    color VARCHAR(50),
    carrier VARCHAR(100),
    working_status VARCHAR(20),
    battery_health INTEGER,
    condition VARCHAR(50),
    phonecheck_data JSONB, -- Store full PhoneCheck response for future reference
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Inventory Items Table - Aggregated by SKU
CREATE TABLE IF NOT EXISTS inventory_items (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    storage VARCHAR(50),
    color VARCHAR(50),
    carrier VARCHAR(100),
    total_quantity INTEGER DEFAULT 0,
    available_quantity INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Inventory Units Table - Individual unit tracking
CREATE TABLE IF NOT EXISTS inventory_units (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) UNIQUE NOT NULL,
    sku VARCHAR(100),
    location VARCHAR(100) DEFAULT 'DNCL-Inspection',
    status VARCHAR(50) DEFAULT 'active',
    phonecheck_synced BOOLEAN DEFAULT FALSE,
    last_phonecheck TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_imei_details_imei ON imei_details(imei);
CREATE INDEX IF NOT EXISTS idx_imei_details_brand ON imei_details(brand);
CREATE INDEX IF NOT EXISTS idx_imei_details_model ON imei_details(model);
CREATE INDEX IF NOT EXISTS idx_imei_details_working_status ON imei_details(working_status);

CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_brand ON inventory_items(brand);
CREATE INDEX IF NOT EXISTS idx_inventory_items_model ON inventory_items(model);

CREATE INDEX IF NOT EXISTS idx_inventory_units_imei ON inventory_units(imei);
CREATE INDEX IF NOT EXISTS idx_inventory_units_sku ON inventory_units(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_units_location ON inventory_units(location);
CREATE INDEX IF NOT EXISTS idx_inventory_units_status ON inventory_units(status);
CREATE INDEX IF NOT EXISTS idx_inventory_units_phonecheck_synced ON inventory_units(phonecheck_synced);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_imei_details_brand_model ON imei_details(brand, model);
CREATE INDEX IF NOT EXISTS idx_inventory_items_brand_model ON inventory_items(brand, model);
CREATE INDEX IF NOT EXISTS idx_inventory_units_sku_location ON inventory_units(sku, location);

-- Add foreign key constraints for data integrity
ALTER TABLE inventory_units 
ADD CONSTRAINT fk_inventory_units_imei 
FOREIGN KEY (imei) REFERENCES imei_details(imei) ON DELETE CASCADE;

ALTER TABLE inventory_units 
ADD CONSTRAINT fk_inventory_units_sku 
FOREIGN KEY (sku) REFERENCES inventory_items(sku) ON DELETE CASCADE;

-- Create a view for easy querying of complete inventory
CREATE OR REPLACE VIEW inventory_summary AS
SELECT 
    iu.imei,
    id.device_name,
    id.brand,
    id.model,
    id.storage,
    id.color,
    id.carrier,
    id.working_status,
    id.battery_health,
    id.condition,
    iu.sku,
    iu.location,
    iu.status,
    iu.phonecheck_synced,
    iu.last_phonecheck,
    ii.total_quantity,
    ii.available_quantity
FROM inventory_units iu
LEFT JOIN imei_details id ON iu.imei = id.imei
LEFT JOIN inventory_items ii ON iu.sku = ii.sku;

-- Create a function to update inventory quantities automatically
CREATE OR REPLACE FUNCTION update_inventory_quantities()
RETURNS TRIGGER AS $$
BEGIN
    -- Update total_quantity and available_quantity in inventory_items
    UPDATE inventory_items 
    SET 
        total_quantity = (
            SELECT COUNT(*) 
            FROM inventory_units 
            WHERE sku = NEW.sku
        ),
        available_quantity = (
            SELECT COUNT(*) 
            FROM inventory_units 
            WHERE sku = NEW.sku AND status = 'active'
        ),
        last_updated = NOW()
    WHERE sku = NEW.sku;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update quantities
CREATE TRIGGER trigger_update_inventory_quantities_insert
    AFTER INSERT ON inventory_units
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_quantities();

CREATE TRIGGER trigger_update_inventory_quantities_update
    AFTER UPDATE ON inventory_units
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_quantities();

CREATE TRIGGER trigger_update_inventory_quantities_delete
    AFTER DELETE ON inventory_units
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_quantities();

-- Insert some sample data for testing
INSERT INTO imei_details (imei, device_name, brand, model, storage, color, carrier, working_status, battery_health, condition) 
VALUES 
    ('123456789012345', 'iPhone 14 Pro', 'Apple', 'iPhone 14 Pro', '128GB', 'Space Black', 'Unlocked', 'YES', 95, 'Excellent'),
    ('987654321098765', 'Samsung Galaxy S23', 'Samsung', 'Galaxy S23', '256GB', 'Phantom Black', 'T-Mobile', 'YES', 88, 'Good')
ON CONFLICT (imei) DO NOTHING;

INSERT INTO inventory_items (sku, brand, model, storage, color, carrier, total_quantity, available_quantity)
VALUES 
    ('APPLE-IPHONE14PRO-128GB-SPACEBLACK-UNLOCKED', 'Apple', 'iPhone 14 Pro', '128GB', 'Space Black', 'Unlocked', 1, 1),
    ('SAMSUNG-GALAXYS23-256GB-PHANTOMBLACK-TMOBILE', 'Samsung', 'Galaxy S23', '256GB', 'Phantom Black', 'T-Mobile', 1, 1)
ON CONFLICT (sku) DO NOTHING;

INSERT INTO inventory_units (imei, sku, location, status, phonecheck_synced, last_phonecheck)
VALUES 
    ('123456789012345', 'APPLE-IPHONE14PRO-128GB-SPACEBLACK-UNLOCKED', 'DNCL-Inspection', 'active', true, NOW()),
    ('987654321098765', 'SAMSUNG-GALAXYS23-256GB-PHANTOMBLACK-TMOBILE', 'DNCL-Inspection', 'active', true, NOW())
ON CONFLICT (imei) DO NOTHING;

-- Grant necessary permissions (adjust as needed for your Supabase setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
