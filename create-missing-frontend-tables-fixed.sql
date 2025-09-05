-- Create missing tables that frontend expects
-- These will be aliases/views for compatibility with existing data

-- 1. Create "Item" table (capital I) - alias for existing "item" table
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
    "batteryHealth" VARCHAR(50), -- Changed to VARCHAR to match existing data
    "screenCondition" VARCHAR(50),
    "bodyCondition" VARCHAR(50),
    "testResults" JSONB,
    defects TEXT,
    notes TEXT,
    custom1 TEXT,
    location VARCHAR(255) DEFAULT 'DNCL-Inspection'
);

-- 2. Create "Location" table (capital L) - for location management
CREATE TABLE IF NOT EXISTS "Location" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    address TEXT,
    "contactInfo" JSONB,
    capacity INTEGER,
    "currentCount" INTEGER DEFAULT 0
);

-- 3. Create "Warehouse" table (capital W) - for warehouse management
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

-- 4. Insert default locations
INSERT INTO "Location" (name, description, "isActive") VALUES
('DNCL-Inspection', 'Inspection area for new devices', true),
('DNCL-Testing', 'Testing area for device validation', true),
('DNCL-Storage', 'General storage area', true),
('DNCL-Warehouse-A', 'Warehouse section A', true),
('DNCL-Warehouse-B', 'Warehouse section B', true),
('DNCL-Processing', 'Processing area for device preparation', true),
('DNCL-QC', 'Quality control area', true),
('DNCL-Shipping', 'Shipping preparation area', true),
('SHIPOUT', 'Ready for shipment', true),
('REPAIR-BAY', 'Repair and maintenance area', true)
ON CONFLICT (name) DO NOTHING;

-- 5. Insert default warehouse
INSERT INTO "Warehouse" (name, description, "isActive") VALUES
('DNCL Main Warehouse', 'Main warehouse facility', true)
ON CONFLICT (name) DO NOTHING;

-- 6. Create a function to sync data from lowercase tables to uppercase tables
CREATE OR REPLACE FUNCTION sync_item_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update in "Item" table when data changes in "item" table
    INSERT INTO "Item" (
        imei, sku, brand, model, carrier, color, storage, working, 
        "batteryHealth", location, "createdAt", "updatedAt", name, type
    ) VALUES (
        NEW.imei, 
        (SELECT sku FROM product WHERE imei = NEW.imei LIMIT 1),
        (SELECT brand FROM product WHERE imei = NEW.imei LIMIT 1),
        NEW.model,
        NEW.carrier,
        NEW.color,
        NEW.capacity,
        NEW.working,
        NEW.battery_health, -- This is VARCHAR, so no casting needed
        NEW.location,
        COALESCE(NEW.created_at, NOW()),
        COALESCE(NEW.updated_at, NOW()),
        COALESCE(NEW.model, 'Unknown Device'), -- Use model as name
        'device' -- Set type as device
    )
    ON CONFLICT (imei) DO UPDATE SET
        sku = EXCLUDED.sku,
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        carrier = EXCLUDED.carrier,
        color = EXCLUDED.color,
        storage = EXCLUDED.storage,
        working = EXCLUDED.working,
        "batteryHealth" = EXCLUDED."batteryHealth",
        location = EXCLUDED.location,
        "updatedAt" = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger to sync data
DROP TRIGGER IF EXISTS trigger_sync_item_data ON item;
CREATE TRIGGER trigger_sync_item_data
    AFTER INSERT OR UPDATE ON item
    FOR EACH ROW
    EXECUTE FUNCTION sync_item_data();

-- 8. Initial sync of existing data
INSERT INTO "Item" (
    imei, sku, brand, model, carrier, color, storage, working, 
    "batteryHealth", location, "createdAt", "updatedAt", name, type
)
SELECT 
    i.imei,
    p.sku,
    p.brand,
    i.model,
    i.carrier,
    i.color,
    i.capacity,
    i.working,
    i.battery_health, -- VARCHAR to VARCHAR, no casting needed
    i.location,
    COALESCE(i.created_at, NOW()),
    COALESCE(i.updated_at, NOW()),
    COALESCE(i.model, 'Unknown Device'),
    'device'
FROM item i
LEFT JOIN product p ON i.imei = p.imei
ON CONFLICT (imei) DO NOTHING;

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_imei ON "Item"(imei);
CREATE INDEX IF NOT EXISTS idx_item_sku ON "Item"(sku);
CREATE INDEX IF NOT EXISTS idx_item_location ON "Item"(location);
CREATE INDEX IF NOT EXISTS idx_location_name ON "Location"(name);
CREATE INDEX IF NOT EXISTS idx_warehouse_name ON "Warehouse"(name);

-- 10. Create views for easy access
CREATE OR REPLACE VIEW item_summary AS
SELECT 
    i.id,
    i.imei,
    i.sku,
    i.brand,
    i.model,
    i.carrier,
    i.color,
    i.storage,
    i.working,
    i."batteryHealth",
    i.location,
    i."createdAt",
    i."updatedAt",
    smr.matched_sku,
    smr.match_score,
    smr.requires_attention
FROM "Item" i
LEFT JOIN sku_matching_results smr ON i.imei = smr.imei;

-- 11. Create inventory summary view
CREATE OR REPLACE VIEW inventory_summary AS
SELECT 
    sku,
    brand,
    model,
    carrier,
    color,
    storage,
    COUNT(*) as total_count,
    COUNT(CASE WHEN working = 'YES' THEN 1 END) as working_count,
    COUNT(CASE WHEN working = 'NO' THEN 1 END) as not_working_count,
    COUNT(CASE WHEN working = 'PENDING' THEN 1 END) as pending_count,
    COUNT(CASE WHEN location = 'SHIPOUT' THEN 1 END) as ready_to_ship
FROM "Item"
WHERE "isActive" = true
GROUP BY sku, brand, model, carrier, color, storage
ORDER BY sku;

COMMENT ON TABLE "Item" IS 'Frontend-compatible item table synced with lowercase item table';
COMMENT ON TABLE "Location" IS 'Location management for warehouse operations';
COMMENT ON TABLE "Warehouse" IS 'Warehouse management';
COMMENT ON VIEW item_summary IS 'Enhanced item view with SKU matching results';
COMMENT ON VIEW inventory_summary IS 'Inventory summary by SKU characteristics';

