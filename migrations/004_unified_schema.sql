-- Unified Schema Migration
-- This migration unifies the old WMS schema with the new IMEI-based system
-- Run this in your Supabase SQL Editor

-- ========================================
-- STEP 1: ENSURE EXISTING TABLES EXIST
-- ========================================

-- Create legacy WMS tables if they don't exist
CREATE TABLE IF NOT EXISTS "Item" (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    upc VARCHAR(255) UNIQUE,
    brand VARCHAR(255),
    model VARCHAR(255),
    grade VARCHAR(50) DEFAULT 'used',
    working VARCHAR(50) DEFAULT 'PENDING',
    cost DECIMAL(10, 2),
    price DECIMAL(10, 2),
    "weightOz" INTEGER,
    dimensions TEXT,
    "imageUrl" TEXT,
    type VARCHAR(100) NOT NULL,
    imei VARCHAR(15) UNIQUE,
    "serialNumber" VARCHAR(255) UNIQUE,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    carrier VARCHAR(255),
    color VARCHAR(255),
    "modelNumber" VARCHAR(255),
    storage VARCHAR(255),
    "carrierId" VARCHAR(255),
    "skuGeneratedAt" TIMESTAMP,
    condition VARCHAR(50) DEFAULT 'UNKNOWN',
    "batteryHealth" INTEGER,
    "screenCondition" VARCHAR(50),
    "bodyCondition" VARCHAR(50),
    "testResults" JSONB
);

CREATE TABLE IF NOT EXISTS "Warehouse" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    address TEXT,
    "contactInfo" JSONB
);

CREATE TABLE IF NOT EXISTS "Location" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "warehouseId" INTEGER NOT NULL REFERENCES "Warehouse"(id) ON DELETE CASCADE,
    description TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    capacity INTEGER,
    "currentOccupancy" INTEGER,
    "locationType" VARCHAR(100),
    UNIQUE("warehouseId", name)
);

CREATE TABLE IF NOT EXISTS "Inventory" (
    id SERIAL PRIMARY KEY,
    "itemId" INTEGER NOT NULL REFERENCES "Item"(id) ON DELETE CASCADE,
    "locationId" INTEGER NOT NULL REFERENCES "Location"(id) ON DELETE CASCADE,
    sku VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    reserved INTEGER DEFAULT 0,
    available INTEGER DEFAULT 1,
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("itemId", "locationId")
);

-- ========================================
-- STEP 2: ENSURE IMEI TABLES EXIST
-- ========================================

-- Create IMEI tables if they don't exist (from previous migrations)
CREATE TABLE IF NOT EXISTS imei_data_queue (
    id SERIAL PRIMARY KEY,
    raw_data JSONB NOT NULL,
    source VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS imei_sku_info (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) UNIQUE NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    model_number VARCHAR(100),
    storage VARCHAR(50),
    color VARCHAR(50),
    carrier VARCHAR(50),
    sku VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS imei_inspect_data (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) NOT NULL,
    test_type VARCHAR(50) DEFAULT 'PHONECHECK',
    test_results JSONB NOT NULL,
    passed BOOLEAN,
    battery_health INTEGER,
    battery_cycle INTEGER,
    notes TEXT,
    tester_name VARCHAR(100),
    repair_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    check_date TIMESTAMPTZ,
    FOREIGN KEY (imei) REFERENCES imei_sku_info(imei)
);

CREATE TABLE IF NOT EXISTS imei_units (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(200) NOT NULL,
    imei VARCHAR(15) UNIQUE NOT NULL,
    serial_number VARCHAR(100),
    condition VARCHAR(50),
    location VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (imei) REFERENCES imei_sku_info(imei)
);

-- ========================================
-- STEP 3: ENSURE ARCHIVAL TABLES EXIST
-- ========================================

CREATE TABLE IF NOT EXISTS imei_archived (
    id SERIAL PRIMARY KEY,
    original_table VARCHAR(50) NOT NULL,
    original_id INTEGER,
    imei VARCHAR(15) NOT NULL,
    archived_data JSONB NOT NULL,
    archived_at TIMESTAMPTZ DEFAULT NOW(),
    archived_by VARCHAR(100),
    archive_reason VARCHAR(200) DEFAULT 'cascade_delete'
);

CREATE TABLE IF NOT EXISTS imei_data_log (
    id SERIAL PRIMARY KEY,
    queue_id INTEGER,
    imei VARCHAR(15) NOT NULL,
    source VARCHAR(50) NOT NULL,
    raw_data JSONB NOT NULL,
    processed_data JSONB,
    processing_status VARCHAR(20) NOT NULL,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- STEP 4: CREATE INDEXES
-- ========================================

-- Legacy WMS indexes
CREATE INDEX IF NOT EXISTS idx_item_sku ON "Item"(sku);
CREATE INDEX IF NOT EXISTS idx_item_imei ON "Item"(imei);
CREATE INDEX IF NOT EXISTS idx_item_serial_number ON "Item"("serialNumber");
CREATE INDEX IF NOT EXISTS idx_item_type ON "Item"(type);
CREATE INDEX IF NOT EXISTS idx_item_grade ON "Item"(grade);
CREATE INDEX IF NOT EXISTS idx_item_working ON "Item"(working);
CREATE INDEX IF NOT EXISTS idx_item_is_active ON "Item"("isActive");

CREATE INDEX IF NOT EXISTS idx_warehouse_is_active ON "Warehouse"("isActive");

CREATE INDEX IF NOT EXISTS idx_location_is_active ON "Location"("isActive");
CREATE INDEX IF NOT EXISTS idx_location_type ON "Location"("locationType");

CREATE INDEX IF NOT EXISTS idx_inventory_sku ON "Inventory"(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON "Inventory"(quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_available ON "Inventory"(available);

-- IMEI system indexes
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_status ON imei_data_queue(status);
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_created_at ON imei_data_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_imei_sku_info_imei ON imei_sku_info(imei);
CREATE INDEX IF NOT EXISTS idx_imei_sku_info_sku ON imei_sku_info(sku);
CREATE INDEX IF NOT EXISTS idx_imei_inspect_data_imei ON imei_inspect_data(imei);
CREATE INDEX IF NOT EXISTS idx_imei_units_imei ON imei_units(imei);
CREATE INDEX IF NOT EXISTS idx_imei_units_sku ON imei_units(sku);

-- Archival system indexes
CREATE INDEX IF NOT EXISTS idx_imei_archived_imei ON imei_archived(imei);
CREATE INDEX IF NOT EXISTS idx_imei_archived_table ON imei_archived(original_table);
CREATE INDEX IF NOT EXISTS idx_imei_archived_date ON imei_archived(archived_at);
CREATE INDEX IF NOT EXISTS idx_imei_data_log_imei ON imei_data_log(imei);
CREATE INDEX IF NOT EXISTS idx_imei_data_log_status ON imei_data_log(processing_status);
CREATE INDEX IF NOT EXISTS idx_imei_data_log_date ON imei_data_log(processed_at);

-- ========================================
-- STEP 5: CREATE SYNC FUNCTION
-- ========================================

-- Function to sync IMEI data to legacy Item table
CREATE OR REPLACE FUNCTION sync_imei_to_item()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update Item table when IMEI data changes
    INSERT INTO "Item" (
        imei, sku, name, description, brand, model, "modelNumber", 
        storage, color, carrier, type, "serialNumber", "isActive",
        "createdAt", "updatedAt", condition, "batteryHealth", "testResults"
    ) VALUES (
        NEW.imei,
        NEW.sku,
        COALESCE(NEW.brand || ' ' || NEW.model, 'Unknown Device'),
        COALESCE(NEW.brand || ' ' || NEW.model || ' ' || NEW.storage || ' ' || NEW.color, ''),
        NEW.brand,
        NEW.model,
        NEW.model_number,
        NEW.storage,
        NEW.color,
        NEW.carrier,
        'phone',
        NULL, -- serial_number will be updated from imei_units
        true,
        NEW.created_at,
        NEW.updated_at,
        'UNKNOWN',
        NULL, -- battery_health will be updated from imei_inspect_data
        NULL  -- test_results will be updated from imei_inspect_data
    )
    ON CONFLICT (imei) DO UPDATE SET
        sku = EXCLUDED.sku,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        "modelNumber" = EXCLUDED."modelNumber",
        storage = EXCLUDED.storage,
        color = EXCLUDED.color,
        carrier = EXCLUDED.carrier,
        "updatedAt" = EXCLUDED."updatedAt";
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync inspect data to Item table
CREATE OR REPLACE FUNCTION sync_inspect_to_item()
RETURNS TRIGGER AS $$
BEGIN
    -- Update Item table with inspection data
    UPDATE "Item" SET
        "batteryHealth" = NEW.battery_health,
        "testResults" = NEW.test_results,
        working = CASE WHEN NEW.passed THEN 'YES' ELSE 'NO' END,
        "updatedAt" = NOW()
    WHERE imei = NEW.imei;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync unit data to Item table
CREATE OR REPLACE FUNCTION sync_unit_to_item()
RETURNS TRIGGER AS $$
BEGIN
    -- Update Item table with unit data
    UPDATE "Item" SET
        "serialNumber" = NEW.serial_number,
        condition = NEW.condition,
        "updatedAt" = NOW()
    WHERE imei = NEW.imei;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 6: CREATE TRIGGERS
-- ========================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_sync_imei_to_item ON imei_sku_info;
DROP TRIGGER IF EXISTS trigger_sync_inspect_to_item ON imei_inspect_data;
DROP TRIGGER IF EXISTS trigger_sync_unit_to_item ON imei_units;

-- Create triggers for automatic sync
CREATE TRIGGER trigger_sync_imei_to_item
    AFTER INSERT OR UPDATE ON imei_sku_info
    FOR EACH ROW
    EXECUTE FUNCTION sync_imei_to_item();

CREATE TRIGGER trigger_sync_inspect_to_item
    AFTER INSERT OR UPDATE ON imei_inspect_data
    FOR EACH ROW
    EXECUTE FUNCTION sync_inspect_to_item();

CREATE TRIGGER trigger_sync_unit_to_item
    AFTER INSERT OR UPDATE ON imei_units
    FOR EACH ROW
    EXECUTE FUNCTION sync_unit_to_item();

-- ========================================
-- STEP 7: CREATE VIEWS FOR EASY QUERYING
-- ========================================

-- View for complete item data (legacy + IMEI)
CREATE OR REPLACE VIEW item_complete AS
SELECT 
    i.id,
    i.sku,
    i.name,
    i.description,
    i.brand,
    i.model,
    i.imei,
    i."serialNumber",
    i.working,
    i.condition,
    i."batteryHealth",
    i."testResults",
    i."createdAt",
    i."updatedAt",
    isi.sku as imei_sku,
    iid.passed as test_passed,
    iid.test_type,
    iu.location as unit_location,
    iu.status as unit_status
FROM "Item" i
LEFT JOIN imei_sku_info isi ON i.imei = isi.imei
LEFT JOIN imei_inspect_data iid ON i.imei = iid.imei
LEFT JOIN imei_units iu ON i.imei = iu.imei;

-- View for inventory summary
CREATE OR REPLACE VIEW inventory_summary AS
SELECT 
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE working = 'YES') as available_items,
    COUNT(*) FILTER (WHERE working = 'NO') as failed_items,
    COUNT(*) FILTER (WHERE working = 'PENDING') as pending_items,
    jsonb_object_agg(brand, count) as by_brand,
    jsonb_object_agg(model, count) as by_model,
    jsonb_object_agg(condition, count) as by_condition
FROM (
    SELECT 
        brand, 
        model, 
        condition, 
        working,
        COUNT(*) as count
    FROM "Item"
    WHERE "isActive" = true
    GROUP BY brand, model, condition, working
) t;

-- ========================================
-- STEP 8: MIGRATION COMPLETE
-- ========================================

-- Log the migration
INSERT INTO imei_data_log (
    imei, source, raw_data, processing_status, error_message, processing_time_ms
) VALUES (
    'MIGRATION', 
    'schema-unification', 
    '{"migration": "004_unified_schema", "timestamp": "' || NOW() || '"}',
    'success',
    'Schema unification completed successfully',
    0
);

-- Success message
SELECT 'Schema unification completed successfully!' as status;
