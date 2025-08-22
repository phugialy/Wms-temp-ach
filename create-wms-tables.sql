-- WMS Database Tables Creation Script
-- Run this in your Supabase SQL Editor to create all tables

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
    "testResults" JSONB -- Store detailed test results
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

-- Create indexes for better performance
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

CREATE INDEX IF NOT EXISTS idx_inbound_log_status ON "InboundLog"(status);
CREATE INDEX IF NOT EXISTS idx_inbound_log_received_at ON "InboundLog"("receivedAt");
CREATE INDEX IF NOT EXISTS idx_inbound_log_source ON "InboundLog"(source);

CREATE INDEX IF NOT EXISTS idx_outbound_log_status ON "OutboundLog"(status);
CREATE INDEX IF NOT EXISTS idx_outbound_log_shipped_at ON "OutboundLog"("shippedAt");
CREATE INDEX IF NOT EXISTS idx_outbound_log_order_number ON "OutboundLog"("orderNumber");

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

CREATE INDEX IF NOT EXISTS idx_device_test_test_type ON "DeviceTest"("testType");
CREATE INDEX IF NOT EXISTS idx_device_test_test_date ON "DeviceTest"("testDate");
CREATE INDEX IF NOT EXISTS idx_device_test_passed ON "DeviceTest"(passed);
CREATE INDEX IF NOT EXISTS idx_device_test_tested_by ON "DeviceTest"("testedBy");

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

-- Insert sample data for testing
INSERT INTO "Warehouse" (name, description, "isActive") 
VALUES ('Main Warehouse', 'Primary warehouse for device storage and processing', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO "Location" (name, "warehouseId", description, "isActive", capacity, "currentOccupancy", "locationType")
SELECT 'Shelf A1', w.id, 'Main shelf for phones', true, 100, 0, 'SHELF'
FROM "Warehouse" w
WHERE w.name = 'Main Warehouse'
ON CONFLICT ("warehouseId", name) DO NOTHING;

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

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Success message
SELECT 'WMS Database tables created successfully!' as status;
