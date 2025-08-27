-- ========================================
-- REVAMP DATABASE SCHEMA - IMEI CENTRIC DESIGN
-- ========================================

-- Drop existing tables to start fresh (if they exist)
DROP TABLE IF EXISTS imei_data_queue CASCADE;
DROP TABLE IF EXISTS queue_processing_log CASCADE;
DROP TABLE IF EXISTS queue_batch CASCADE;
DROP TABLE IF EXISTS imei_sku_info CASCADE;
DROP TABLE IF EXISTS imei_inspect_data CASCADE;
DROP TABLE IF EXISTS imei_units CASCADE;
DROP TABLE IF EXISTS imei_detail CASCADE;
DROP TABLE IF EXISTS inventory_unit CASCADE;
DROP TABLE IF EXISTS inventory_item CASCADE;
DROP TABLE IF EXISTS inventory_ledger CASCADE;
DROP TABLE IF EXISTS movement CASCADE;
DROP TABLE IF EXISTS phonecheck_log CASCADE;
DROP TABLE IF EXISTS unit_status_history CASCADE;
DROP TABLE IF EXISTS unit_location_history CASCADE;
DROP TABLE IF EXISTS outbound_unit CASCADE;
DROP TABLE IF EXISTS outbound CASCADE;
DROP TABLE IF EXISTS entity_tag CASCADE;
DROP TABLE IF EXISTS tag CASCADE;
DROP TABLE IF EXISTS product CASCADE;
DROP TABLE IF EXISTS location CASCADE;
DROP TABLE IF EXISTS item CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS device_test CASCADE;
DROP TABLE IF EXISTS warehouse CASCADE;

-- ========================================
-- CORE TABLES - IMEI CENTRIC DESIGN
-- ========================================

-- 1. PRODUCT TABLE (IMEI, date_in, SKU, brand)
CREATE TABLE product (
    imei VARCHAR(15) PRIMARY KEY,
    date_in TIMESTAMPTZ DEFAULT NOW(),
    sku VARCHAR(200) NOT NULL,
    brand VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ITEM TABLE (IMEI, model, model_number, carrier, capacity, color, battery_health, battery_count, working, location)
CREATE TABLE item (
    imei VARCHAR(15) PRIMARY KEY REFERENCES product(imei) ON DELETE CASCADE,
    model VARCHAR(100),
    model_number VARCHAR(100),
    carrier VARCHAR(50),
    capacity VARCHAR(50),
    color VARCHAR(50),
    battery_health VARCHAR(50),
    battery_count INTEGER,
    working VARCHAR(20) DEFAULT 'PENDING', -- YES/PASS, NO/FAILED, PENDING
    location VARCHAR(100) DEFAULT 'Default Location',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INVENTORY TABLE (SKU, location, qty_total, pass_devices, failed_devices, reserved, available)
CREATE TABLE inventory (
    id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(200) NOT NULL,
    location VARCHAR(100) NOT NULL,
    qty_total INTEGER DEFAULT 0,
    pass_devices INTEGER DEFAULT 0,
    failed_devices INTEGER DEFAULT 0,
    reserved INTEGER DEFAULT 0,
    available INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sku, location)
);

-- 4. DEVICE_TEST TABLE (IMEI, working, defects, notes, custom1, date)
CREATE TABLE device_test (
    id BIGSERIAL PRIMARY KEY,
    imei VARCHAR(15) REFERENCES product(imei) ON DELETE CASCADE,
    working VARCHAR(20),
    defects TEXT,
    notes TEXT,
    custom1 TEXT,
    test_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(imei)
);

-- 5. MOVEMENT_HISTORY TABLE (IMEI, location_original, location_updated, timestamp)
CREATE TABLE movement_history (
    id BIGSERIAL PRIMARY KEY,
    imei VARCHAR(15) REFERENCES product(imei) ON DELETE CASCADE,
    location_original VARCHAR(100),
    location_updated VARCHAR(100),
    movement_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- QUEUE SYSTEM TABLES
-- ========================================

-- Queue for processing incoming data
CREATE TABLE data_queue (
    id BIGSERIAL PRIMARY KEY,
    raw_data JSONB NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'bulk-add', 'phonecheck-api'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    priority INTEGER DEFAULT 5, -- 1=high, 5=normal, 10=low
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    batch_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Queue processing logs
CREATE TABLE queue_processing_log (
    id BIGSERIAL PRIMARY KEY,
    queue_item_id BIGINT REFERENCES data_queue(id) ON DELETE CASCADE,
    action VARCHAR(50), -- 'processing', 'completed', 'failed', 'retry'
    message TEXT,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Product table indexes
CREATE INDEX idx_product_sku ON product(sku);
CREATE INDEX idx_product_brand ON product(brand);
CREATE INDEX idx_product_date_in ON product(date_in);

-- Item table indexes
CREATE INDEX idx_item_model ON item(model);
CREATE INDEX idx_item_carrier ON item(carrier);
CREATE INDEX idx_item_working ON item(working);
CREATE INDEX idx_item_capacity ON item(capacity);
CREATE INDEX idx_item_color ON item(color);

-- Inventory table indexes
CREATE INDEX idx_inventory_sku ON inventory(sku);
CREATE INDEX idx_inventory_location ON inventory(location);
CREATE INDEX idx_inventory_sku_location ON inventory(sku, location);

-- Device test indexes
CREATE INDEX idx_device_test_imei ON device_test(imei);
CREATE INDEX idx_device_test_date ON device_test(test_date);

-- Movement history indexes
CREATE INDEX idx_movement_history_imei ON movement_history(imei);
CREATE INDEX idx_movement_history_date ON movement_history(movement_date);

-- Queue indexes
CREATE INDEX idx_data_queue_status ON data_queue(status);
CREATE INDEX idx_data_queue_priority ON data_queue(priority);
CREATE INDEX idx_data_queue_batch_id ON data_queue(batch_id);
CREATE INDEX idx_data_queue_created_at ON data_queue(created_at);

-- ========================================
-- TRIGGERS AND FUNCTIONS
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER trigger_update_product_updated_at
    BEFORE UPDATE ON product
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_item_updated_at
    BEFORE UPDATE ON item
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_data_queue_updated_at
    BEFORE UPDATE ON data_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to recalculate inventory counts
CREATE OR REPLACE FUNCTION recalculate_inventory_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update inventory counts when item working status changes
    IF TG_OP = 'UPDATE' AND OLD.working IS DISTINCT FROM NEW.working THEN
        -- Update pass_devices count
        UPDATE inventory 
        SET pass_devices = (
            SELECT COUNT(*) 
            FROM item i 
            JOIN product p ON i.imei = p.imei 
            WHERE p.sku = (SELECT sku FROM product WHERE imei = NEW.imei)
            AND i.location = (SELECT location FROM inventory WHERE sku = (SELECT sku FROM product WHERE imei = NEW.imei) LIMIT 1)
            AND i.working IN ('YES', 'PASS')
        )
        WHERE sku = (SELECT sku FROM product WHERE imei = NEW.imei);
        
        -- Update failed_devices count
        UPDATE inventory 
        SET failed_devices = (
            SELECT COUNT(*) 
            FROM item i 
            JOIN product p ON i.imei = p.imei 
            WHERE p.sku = (SELECT sku FROM product WHERE imei = NEW.imei)
            AND i.location = (SELECT location FROM inventory WHERE sku = (SELECT sku FROM product WHERE imei = NEW.imei) LIMIT 1)
            AND i.working IN ('NO', 'FAILED')
        )
        WHERE sku = (SELECT sku FROM product WHERE imei = NEW.imei);
        
        -- Update available count
        UPDATE inventory 
        SET available = qty_total - reserved
        WHERE sku = (SELECT sku FROM product WHERE imei = NEW.imei);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply inventory recalculation trigger
CREATE TRIGGER trigger_recalculate_inventory
    AFTER UPDATE OF working ON item
    FOR EACH ROW EXECUTE FUNCTION recalculate_inventory_counts();

-- Function to record movement history
CREATE OR REPLACE FUNCTION record_movement_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.location IS DISTINCT FROM NEW.location THEN
        INSERT INTO movement_history (imei, location_original, location_updated)
        VALUES (NEW.imei, OLD.location, NEW.location);
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO movement_history (imei, location_original, location_updated)
        VALUES (NEW.imei, 'INITIATED', NEW.location);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply movement history trigger
CREATE TRIGGER trigger_record_movement
    AFTER INSERT OR UPDATE OF location ON item
    FOR EACH ROW EXECUTE FUNCTION record_movement_history();

-- ========================================
-- VIEWS FOR FRONTEND
-- ========================================

-- Inventory view for frontend
CREATE OR REPLACE VIEW inventory_view AS
SELECT 
    p.imei,
    i.working,
    CONCAT(p.sku, ' (', i.model, '-', i.capacity, '-', i.color, '-', i.carrier, ')') as sku_display,
    dt.defects,
    dt.notes,
    dt.custom1 as repair_notes
FROM product p
LEFT JOIN item i ON p.imei = i.imei
LEFT JOIN device_test dt ON p.imei = dt.imei
ORDER BY p.imei;

-- Deletion view for frontend
CREATE OR REPLACE VIEW deletion_view AS
SELECT 
    p.imei,
    p.sku,
    i.working,
    i.location
FROM product p
LEFT JOIN item i ON p.imei = i.imei
ORDER BY p.imei;

-- ========================================
-- GRANT PERMISSIONS
-- ========================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

COMMENT ON SCHEMA public IS 'WMS Revamped Schema - IMEI Centric Design - Migration 024 Applied';
