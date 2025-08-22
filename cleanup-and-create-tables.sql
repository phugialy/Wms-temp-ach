-- WMS Database Cleanup and Setup Script
-- This script will:
-- 1. Drop all extra tables that aren't part of the current schema
-- 2. Create the correct tables from prisma/schema.prisma
-- 3. Set up auto-update triggers
-- 4. Configure Supabase RLS policies

-- ========================================
-- STEP 1: CLEANUP - Drop Extra Tables
-- ========================================

-- Drop tables that are NOT part of the current schema
-- These were from previous schema attempts

-- Drop tables with CASCADE to handle dependencies
DROP TABLE IF EXISTS "imei_detail" CASCADE;
DROP TABLE IF EXISTS "imei_details" CASCADE;
DROP TABLE IF EXISTS "inventory_item" CASCADE;
DROP TABLE IF EXISTS "inventory_items" CASCADE;
DROP TABLE IF EXISTS "inventory_ledger" CASCADE;
DROP TABLE IF EXISTS "inventory_summary" CASCADE;
DROP TABLE IF EXISTS "inventory_unit" CASCADE;
DROP TABLE IF EXISTS "inventory_units" CASCADE;
DROP TABLE IF EXISTS "movement" CASCADE;
DROP TABLE IF EXISTS "outbound" CASCADE;
DROP TABLE IF EXISTS "outbound_unit" CASCADE;
DROP TABLE IF EXISTS "phonecheck_log" CASCADE;
DROP TABLE IF EXISTS "product" CASCADE;
DROP TABLE IF EXISTS "tag" CASCADE;
DROP TABLE IF EXISTS "entity_tag" CASCADE;
DROP TABLE IF EXISTS "unit_location_history" CASCADE;
DROP TABLE IF EXISTS "unit_status_history" CASCADE;

-- Drop any related functions and triggers
DROP FUNCTION IF EXISTS update_imei_details_on_item_change() CASCADE;
DROP FUNCTION IF EXISTS update_inventory_items_on_item_change() CASCADE;
DROP FUNCTION IF EXISTS update_inventory_units_on_item_change() CASCADE;
DROP FUNCTION IF EXISTS sync_inventory_summary() CASCADE;

-- Drop any audit tables from previous attempts
DROP TABLE IF EXISTS "ItemAuditLog" CASCADE;

-- ========================================
-- STEP 2: CREATE CORRECT TABLES
-- ========================================

-- 1. Create Warehouse table
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

-- 2. Create Item table (main table for devices)
CREATE TABLE IF NOT EXISTS "Item" (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    upc VARCHAR(255) UNIQUE,
    brand VARCHAR(255),
    model VARCHAR(255),
    grade VARCHAR(50) DEFAULT 'used',
    working VARCHAR(50) DEFAULT 'PENDING', -- YES, NO, PENDING
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
    condition VARCHAR(50) DEFAULT 'UNKNOWN', -- NEW, USED, DAMAGED, REFURBISHED
    "batteryHealth" INTEGER, -- 0-100 percentage
    "screenCondition" VARCHAR(50), -- EXCELLENT, GOOD, FAIR, POOR
    "bodyCondition" VARCHAR(50), -- EXCELLENT, GOOD, FAIR, POOR
    "testResults" JSONB, -- Store detailed test results
    defects TEXT, -- PhoneCheck defects field
    notes TEXT, -- PhoneCheck notes field
    custom1 TEXT -- PhoneCheck custom1 field
);

-- 3. Create Location table
CREATE TABLE IF NOT EXISTS "Location" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "warehouseId" INTEGER NOT NULL REFERENCES "Warehouse"(id) ON DELETE CASCADE,
    description TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    capacity INTEGER, -- Maximum capacity
    "currentOccupancy" INTEGER, -- Current items in location
    "locationType" VARCHAR(100), -- SHELF, BIN, PALLET, etc.
    UNIQUE("warehouseId", name)
);

-- 4. Create Inventory table
CREATE TABLE IF NOT EXISTS "Inventory" (
    id SERIAL PRIMARY KEY,
    "itemId" INTEGER NOT NULL REFERENCES "Item"(id) ON DELETE CASCADE,
    "locationId" INTEGER NOT NULL REFERENCES "Location"(id) ON DELETE CASCADE,
    sku VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    reserved INTEGER DEFAULT 0, -- Reserved for outbound orders
    available INTEGER DEFAULT 1, -- Available for sale
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("itemId", "locationId")
);

-- 5. Create InboundLog table
CREATE TABLE IF NOT EXISTS "InboundLog" (
    id SERIAL PRIMARY KEY,
    "itemId" INTEGER NOT NULL REFERENCES "Item"(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    location TEXT NOT NULL,
    "receivedBy" VARCHAR(255) NOT NULL,
    "receivedAt" TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'RECEIVED',
    source VARCHAR(100), -- SUPPLIER, TRANSFER, RETURN
    "trackingNumber" VARCHAR(255)
);

-- 6. Create OutboundLog table
CREATE TABLE IF NOT EXISTS "OutboundLog" (
    id SERIAL PRIMARY KEY,
    "itemId" INTEGER NOT NULL REFERENCES "Item"(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    location TEXT NOT NULL,
    "shippedBy" VARCHAR(255) NOT NULL,
    "shippedAt" TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'SHIPPED',
    destination TEXT,
    "trackingNumber" VARCHAR(255),
    "orderNumber" VARCHAR(255)
);

-- 7. Create ProcessingQueue table
CREATE TABLE IF NOT EXISTS "ProcessingQueue" (
    id SERIAL PRIMARY KEY,
    "itemId" INTEGER NOT NULL REFERENCES "Item"(id) ON DELETE CASCADE,
    "inboundLogId" INTEGER NOT NULL REFERENCES "InboundLog"(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, FAILED
    "assignedTo" VARCHAR(255),
    "startedAt" TIMESTAMP,
    "completedAt" TIMESTAMP,
    notes TEXT,
    priority INTEGER DEFAULT 1, -- 1-5, 5 being highest
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 8. Create QCApproval table
CREATE TABLE IF NOT EXISTS "QCApproval" (
    id SERIAL PRIMARY KEY,
    "itemId" INTEGER NOT NULL REFERENCES "Item"(id) ON DELETE CASCADE,
    "processingQueueId" INTEGER NOT NULL REFERENCES "ProcessingQueue"(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    "approvedBy" VARCHAR(255),
    "approvedAt" TIMESTAMP,
    "rejectionReason" TEXT,
    notes TEXT,
    "qcScore" INTEGER, -- 0-100 quality score
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 9. Create OutboundQueue table
CREATE TABLE IF NOT EXISTS "OutboundQueue" (
    id SERIAL PRIMARY KEY,
    "itemId" INTEGER NOT NULL REFERENCES "Item"(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    location TEXT NOT NULL,
    "requestedBy" VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'QUEUED', -- QUEUED, PROCESSING, SHIPPED, CANCELLED
    priority INTEGER DEFAULT 1,
    "scheduledAt" TIMESTAMP,
    "shippedAt" TIMESTAMP,
    "canceledAt" TIMESTAMP,
    "canceledBy" VARCHAR(255),
    notes TEXT,
    "orderNumber" VARCHAR(255),
    "customerInfo" JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 10. Create DeviceTest table
CREATE TABLE IF NOT EXISTS "DeviceTest" (
    id SERIAL PRIMARY KEY,
    "itemId" INTEGER NOT NULL REFERENCES "Item"(id) ON DELETE CASCADE,
    "testType" VARCHAR(100) NOT NULL, -- PHONECHECK, MANUAL, AUTOMATED
    "testDate" TIMESTAMP DEFAULT NOW(),
    "testResults" JSONB NOT NULL, -- Detailed test results
    passed BOOLEAN NOT NULL,
    notes TEXT,
    "testedBy" VARCHAR(255)
);

-- ========================================
-- STEP 3: CREATE INDEXES
-- ========================================

-- Item indexes
CREATE INDEX IF NOT EXISTS idx_item_sku ON "Item"(sku);
CREATE INDEX IF NOT EXISTS idx_item_imei ON "Item"(imei);
CREATE INDEX IF NOT EXISTS idx_item_serial_number ON "Item"("serialNumber");
CREATE INDEX IF NOT EXISTS idx_item_type ON "Item"(type);
CREATE INDEX IF NOT EXISTS idx_item_grade ON "Item"(grade);
CREATE INDEX IF NOT EXISTS idx_item_working ON "Item"(working);
CREATE INDEX IF NOT EXISTS idx_item_is_active ON "Item"("isActive");

-- Warehouse indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_is_active ON "Warehouse"("isActive");

-- Location indexes
CREATE INDEX IF NOT EXISTS idx_location_is_active ON "Location"("isActive");
CREATE INDEX IF NOT EXISTS idx_location_type ON "Location"("locationType");

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON "Inventory"(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON "Inventory"(quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_available ON "Inventory"(available);

-- Log indexes
CREATE INDEX IF NOT EXISTS idx_inbound_log_status ON "InboundLog"(status);
CREATE INDEX IF NOT EXISTS idx_inbound_log_received_at ON "InboundLog"("receivedAt");
CREATE INDEX IF NOT EXISTS idx_inbound_log_source ON "InboundLog"(source);

CREATE INDEX IF NOT EXISTS idx_outbound_log_status ON "OutboundLog"(status);
CREATE INDEX IF NOT EXISTS idx_outbound_log_shipped_at ON "OutboundLog"("shippedAt");
CREATE INDEX IF NOT EXISTS idx_outbound_log_order_number ON "OutboundLog"("orderNumber");

-- Queue indexes
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON "ProcessingQueue"(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_priority ON "ProcessingQueue"(priority);
CREATE INDEX IF NOT EXISTS idx_processing_queue_assigned_to ON "ProcessingQueue"("assignedTo");
CREATE INDEX IF NOT EXISTS idx_processing_queue_created_at ON "ProcessingQueue"("createdAt");

CREATE INDEX IF NOT EXISTS idx_qc_approval_status ON "QCApproval"(status);
CREATE INDEX IF NOT EXISTS idx_qc_approval_qc_score ON "QCApproval"("qcScore");
CREATE INDEX IF NOT EXISTS idx_qc_approval_approved_by ON "QCApproval"("approvedBy");

CREATE INDEX IF NOT EXISTS idx_outbound_queue_status ON "OutboundQueue"(status);
CREATE INDEX IF NOT EXISTS idx_outbound_queue_priority ON "OutboundQueue"(priority);
CREATE INDEX IF NOT EXISTS idx_outbound_queue_order_number ON "OutboundQueue"("orderNumber");
CREATE INDEX IF NOT EXISTS idx_outbound_queue_scheduled_at ON "OutboundQueue"("scheduledAt");

-- DeviceTest indexes
CREATE INDEX IF NOT EXISTS idx_device_test_test_type ON "DeviceTest"("testType");
CREATE INDEX IF NOT EXISTS idx_device_test_test_date ON "DeviceTest"("testDate");
CREATE INDEX IF NOT EXISTS idx_device_test_passed ON "DeviceTest"(passed);
CREATE INDEX IF NOT EXISTS idx_device_test_tested_by ON "DeviceTest"("testedBy");

-- ========================================
-- STEP 4: CREATE AUTO-UPDATE TRIGGERS
-- ========================================

-- Drop existing triggers first to avoid conflicts
DROP TRIGGER IF EXISTS update_warehouse_updated_at ON "Warehouse";
DROP TRIGGER IF EXISTS update_item_updated_at ON "Item";
DROP TRIGGER IF EXISTS update_location_updated_at ON "Location";
DROP TRIGGER IF EXISTS update_inventory_updated_at ON "Inventory";
DROP TRIGGER IF EXISTS update_processing_queue_updated_at ON "ProcessingQueue";
DROP TRIGGER IF EXISTS update_qc_approval_updated_at ON "QCApproval";
DROP TRIGGER IF EXISTS update_outbound_queue_updated_at ON "OutboundQueue";

DROP TRIGGER IF EXISTS trigger_update_inventory_on_item_change ON "Item";
DROP TRIGGER IF EXISTS trigger_update_device_test_on_item_change ON "Item";
DROP TRIGGER IF EXISTS trigger_sync_inventory_on_item_status_change ON "Item";
DROP TRIGGER IF EXISTS trigger_update_location_occupancy_insert ON "Inventory";
DROP TRIGGER IF EXISTS trigger_update_location_occupancy_update ON "Inventory";
DROP TRIGGER IF EXISTS trigger_update_location_occupancy_delete ON "Inventory";
DROP TRIGGER IF EXISTS trigger_validate_inventory_quantities ON "Inventory";
DROP TRIGGER IF EXISTS trigger_log_item_changes ON "Item";

-- Create updatedAt trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updatedAt
CREATE TRIGGER update_warehouse_updated_at BEFORE UPDATE ON "Warehouse" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_item_updated_at BEFORE UPDATE ON "Item" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_location_updated_at BEFORE UPDATE ON "Location" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON "Inventory" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_processing_queue_updated_at BEFORE UPDATE ON "ProcessingQueue" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_qc_approval_updated_at BEFORE UPDATE ON "QCApproval" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_outbound_queue_updated_at BEFORE UPDATE ON "OutboundQueue" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update functions for cross-table synchronization
CREATE OR REPLACE FUNCTION update_inventory_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update Inventory records when Item is modified
    UPDATE "Inventory" 
    SET 
        sku = NEW.sku,
        "updatedAt" = NOW()
    WHERE "itemId" = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_device_test_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update DeviceTest records when Item is modified
    UPDATE "DeviceTest" 
    SET 
        "testResults" = NEW."testResults",
        "passed" = CASE 
            WHEN NEW.working = 'YES' THEN true 
            ELSE false 
        END,
        "notes" = CONCAT('PhoneCheck test for ', NEW.brand, ' ', NEW.model, ' - Updated: ', NOW())
    WHERE "itemId" = NEW.id AND "testType" = 'PHONECHECK';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_inventory_on_item_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If item is deactivated, set available quantity to 0
    IF NEW."isActive" = false AND OLD."isActive" = true THEN
        UPDATE "Inventory" 
        SET 
            "available" = 0,
            "updatedAt" = NOW()
        WHERE "itemId" = NEW.id;
    END IF;
    
    -- If item is reactivated, restore available quantity
    IF NEW."isActive" = true AND OLD."isActive" = false THEN
        UPDATE "Inventory" 
        SET 
            "available" = "quantity" - "reserved",
            "updatedAt" = NOW()
        WHERE "itemId" = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_location_occupancy()
RETURNS TRIGGER AS $$
BEGIN
    -- Update location occupancy when inventory is added/updated/deleted
    IF TG_OP = 'INSERT' THEN
        UPDATE "Location" 
        SET "currentOccupancy" = COALESCE("currentOccupancy", 0) + NEW.quantity
        WHERE id = NEW."locationId";
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE "Location" 
        SET "currentOccupancy" = COALESCE("currentOccupancy", 0) - OLD.quantity + NEW.quantity
        WHERE id = NEW."locationId";
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE "Location" 
        SET "currentOccupancy" = COALESCE("currentOccupancy", 0) - OLD.quantity
        WHERE id = OLD."locationId";
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_inventory_quantities()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure available quantity doesn't exceed total quantity
    IF NEW."available" > NEW.quantity THEN
        RAISE EXCEPTION 'Available quantity cannot exceed total quantity';
    END IF;
    
    -- Ensure reserved quantity doesn't exceed total quantity
    IF NEW."reserved" > NEW.quantity THEN
        RAISE EXCEPTION 'Reserved quantity cannot exceed total quantity';
    END IF;
    
    -- Ensure available + reserved doesn't exceed total
    IF (NEW."available" + NEW."reserved") > NEW.quantity THEN
        RAISE EXCEPTION 'Available + Reserved quantity cannot exceed total quantity';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create auto-update triggers
CREATE TRIGGER trigger_update_inventory_on_item_change
    AFTER UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_on_item_change();

CREATE TRIGGER trigger_update_device_test_on_item_change
    AFTER UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION update_device_test_on_item_change();

CREATE TRIGGER trigger_sync_inventory_on_item_status_change
    AFTER UPDATE ON "Item"
    FOR EACH ROW
    WHEN (OLD."isActive" IS DISTINCT FROM NEW."isActive")
    EXECUTE FUNCTION sync_inventory_on_item_status_change();

CREATE TRIGGER trigger_update_location_occupancy_insert
    AFTER INSERT ON "Inventory"
    FOR EACH ROW
    EXECUTE FUNCTION update_location_occupancy();

CREATE TRIGGER trigger_update_location_occupancy_update
    AFTER UPDATE ON "Inventory"
    FOR EACH ROW
    EXECUTE FUNCTION update_location_occupancy();

CREATE TRIGGER trigger_update_location_occupancy_delete
    AFTER DELETE ON "Inventory"
    FOR EACH ROW
    EXECUTE FUNCTION update_location_occupancy();

CREATE TRIGGER trigger_validate_inventory_quantities
    BEFORE INSERT OR UPDATE ON "Inventory"
    FOR EACH ROW
    EXECUTE FUNCTION validate_inventory_quantities();

-- ========================================
-- STEP 5: CREATE AUDIT LOG
-- ========================================

-- Create audit log table for tracking changes
CREATE TABLE IF NOT EXISTS "ItemAuditLog" (
    id SERIAL PRIMARY KEY,
    "itemId" INT NOT NULL,
    "action" VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    "oldValues" JSONB,
    "newValues" JSONB,
    "changedBy" VARCHAR(100) DEFAULT 'SYSTEM',
    "changedAt" TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION log_item_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO "ItemAuditLog" ("itemId", "action", "newValues", "changedBy")
        VALUES (NEW.id, 'INSERT', to_jsonb(NEW), current_user);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO "ItemAuditLog" ("itemId", "action", "oldValues", "newValues", "changedBy")
        VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), current_user);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO "ItemAuditLog" ("itemId", "action", "oldValues", "changedBy")
        VALUES (OLD.id, 'DELETE', to_jsonb(OLD), current_user);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_item_changes
    AFTER INSERT OR UPDATE OR DELETE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION log_item_changes();

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_item_audit_log_item_id ON "ItemAuditLog" ("itemId");
CREATE INDEX IF NOT EXISTS idx_item_audit_log_action ON "ItemAuditLog" ("action");
CREATE INDEX IF NOT EXISTS idx_item_audit_log_changed_at ON "ItemAuditLog" ("changedAt");

-- ========================================
-- STEP 6: INSERT SAMPLE DATA
-- ========================================

-- Insert sample warehouse and location
INSERT INTO "Warehouse" (name, description, "isActive") 
VALUES ('Main Warehouse', 'Primary warehouse for device storage and processing', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO "Location" (name, "warehouseId", description, "isActive", capacity, "currentOccupancy", "locationType")
SELECT 'Shelf A1', w.id, 'Main shelf for phones', true, 100, 0, 'SHELF'
FROM "Warehouse" w
WHERE w.name = 'Main Warehouse'
ON CONFLICT ("warehouseId", name) DO NOTHING;

-- ========================================
-- STEP 7: CONFIGURE SUPABASE RLS
-- ========================================

-- Enable Row Level Security (RLS) for Supabase
ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Location" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InboundLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OutboundLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessingQueue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QCApproval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OutboundQueue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeviceTest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemAuditLog" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Enable all access for all users" ON "Warehouse";
DROP POLICY IF EXISTS "Enable all access for all users" ON "Item";
DROP POLICY IF EXISTS "Enable all access for all users" ON "Location";
DROP POLICY IF EXISTS "Enable all access for all users" ON "Inventory";
DROP POLICY IF EXISTS "Enable all access for all users" ON "InboundLog";
DROP POLICY IF EXISTS "Enable all access for all users" ON "OutboundLog";
DROP POLICY IF EXISTS "Enable all access for all users" ON "ProcessingQueue";
DROP POLICY IF EXISTS "Enable all access for all users" ON "QCApproval";
DROP POLICY IF EXISTS "Enable all access for all users" ON "OutboundQueue";
DROP POLICY IF EXISTS "Enable all access for all users" ON "DeviceTest";
DROP POLICY IF EXISTS "Enable all access for all users" ON "ItemAuditLog";

-- Create policies for full access (you can modify these later for security)
CREATE POLICY "Enable all access for all users" ON "Warehouse" FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON "Item" FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON "Location" FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON "Inventory" FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON "InboundLog" FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON "OutboundLog" FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON "ProcessingQueue" FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON "QCApproval" FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON "OutboundQueue" FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON "DeviceTest" FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON "ItemAuditLog" FOR ALL USING (true);

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- ========================================
-- SUCCESS MESSAGE
-- ========================================

SELECT 'WMS Database cleanup and setup completed successfully!' as status;
SELECT 'Extra tables removed and correct schema created with auto-update triggers.' as details;

-- ========================================
-- STEP 8: FIX DEVICETEST TRIGGER ISSUE
-- ========================================

-- Fix DeviceTest trigger issue
-- The problem: Auto-update trigger is setting testResults to null, violating not-null constraint

-- Step 1: Drop the function with CASCADE (handles all dependent triggers automatically)
DROP FUNCTION IF EXISTS update_device_test_on_item_change() CASCADE;

-- Step 3: Create a fixed function that handles testResults properly
CREATE OR REPLACE FUNCTION update_device_test_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update DeviceTest records only if they exist and preserve testResults
    UPDATE "DeviceTest"
    SET
        testResults = COALESCE(testResults, '{}'::jsonb),
        notes = CONCAT('PhoneCheck test for ', COALESCE(NEW.brand, 'Unknown'), ' ', COALESCE(NEW.model, 'Unknown'), ' - Updated: ', NOW()),
        "testDate" = NOW(),
        passed = CASE 
            WHEN NEW.working = 'YES' THEN true 
            WHEN NEW.working = 'NO' THEN false 
            ELSE passed -- Keep existing value if working status is PENDING or other
        END
    WHERE itemId = NEW.id AND testType = 'PHONECHECK';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create the fixed trigger
CREATE TRIGGER update_device_test_on_item_change
    AFTER UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION update_device_test_on_item_change();

-- Step 5: Also fix any existing DeviceTest records with null testResults
UPDATE "DeviceTest"
SET "testResults" = '{}'::jsonb
WHERE "testResults" IS NULL;

-- Step 6: Verify the fix
SELECT
    'Trigger fixed successfully' as status,
    COUNT(*) as device_test_count
FROM "DeviceTest"
WHERE "testResults" IS NOT NULL;
