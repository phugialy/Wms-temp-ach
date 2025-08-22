-- Auto-Update Triggers for WMS System
-- Automatically sync data across tables when Items are updated

-- 1. Function to update Inventory when Item changes
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

-- 2. Function to update DeviceTest when Item changes
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

-- 3. Function to update ProcessingQueue when Item changes
CREATE OR REPLACE FUNCTION update_processing_queue_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update ProcessingQueue records when Item is modified
    UPDATE "ProcessingQueue" 
    SET 
        "updatedAt" = NOW(),
        "notes" = CONCAT('Item updated: ', NEW.brand, ' ', NEW.model, ' - Working: ', NEW.working)
    WHERE "itemId" = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Function to update QCApproval when Item changes
CREATE OR REPLACE FUNCTION update_qc_approval_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update QCApproval records when Item is modified
    UPDATE "QCApproval" 
    SET 
        "updatedAt" = NOW(),
        "qcScore" = CASE 
            WHEN NEW.condition = 'NEW' THEN 100
            WHEN NEW.condition = 'USED' AND NEW."batteryHealth" > 80 THEN 90
            WHEN NEW.condition = 'USED' AND NEW."batteryHealth" > 60 THEN 75
            WHEN NEW.condition = 'USED' AND NEW."batteryHealth" > 40 THEN 60
            ELSE 50
        END,
        "notes" = CONCAT('Auto-updated QC score based on condition: ', NEW.condition, ' and battery: ', NEW."batteryHealth", '%')
    WHERE "itemId" = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to update OutboundQueue when Item changes
CREATE OR REPLACE FUNCTION update_outbound_queue_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update OutboundQueue records when Item is modified
    UPDATE "OutboundQueue" 
    SET 
        "updatedAt" = NOW(),
        "notes" = CONCAT('Item updated: ', NEW.brand, ' ', NEW.model, ' - Status: ', NEW.working)
    WHERE "itemId" = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to update InboundLog when Item changes
CREATE OR REPLACE FUNCTION update_inbound_log_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update InboundLog records when Item is modified
    UPDATE "InboundLog" 
    SET 
        "notes" = CONCAT('Item updated: ', NEW.brand, ' ', NEW.model, ' - Working: ', NEW.working)
    WHERE "itemId" = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Function to update OutboundLog when Item changes
CREATE OR REPLACE FUNCTION update_outbound_log_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update OutboundLog records when Item is modified
    UPDATE "OutboundLog" 
    SET 
        "notes" = CONCAT('Item updated: ', NEW.brand, ' ', NEW.model, ' - Working: ', NEW.working)
    WHERE "itemId" = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for Item updates
CREATE TRIGGER trigger_update_inventory_on_item_change
    AFTER UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_on_item_change();

CREATE TRIGGER trigger_update_device_test_on_item_change
    AFTER UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION update_device_test_on_item_change();

CREATE TRIGGER trigger_update_processing_queue_on_item_change
    AFTER UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION update_processing_queue_on_item_change();

CREATE TRIGGER trigger_update_qc_approval_on_item_change
    AFTER UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION update_qc_approval_on_item_change();

CREATE TRIGGER trigger_update_outbound_queue_on_item_change
    AFTER UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION update_outbound_queue_on_item_change();

CREATE TRIGGER trigger_update_inbound_log_on_item_change
    AFTER UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION update_inbound_log_on_item_change();

CREATE TRIGGER trigger_update_outbound_log_on_item_change
    AFTER UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION update_outbound_log_on_item_change();

-- 8. Function to sync Inventory quantities when Item status changes
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

-- Create trigger for Item status changes
CREATE TRIGGER trigger_sync_inventory_on_item_status_change
    AFTER UPDATE ON "Item"
    FOR EACH ROW
    WHEN (OLD."isActive" IS DISTINCT FROM NEW."isActive")
    EXECUTE FUNCTION sync_inventory_on_item_status_change();

-- 9. Function to update Location occupancy when Inventory changes
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

-- Create triggers for Inventory changes
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

-- 10. Function to validate inventory quantities
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

-- Create trigger for Inventory validation
CREATE TRIGGER trigger_validate_inventory_quantities
    BEFORE INSERT OR UPDATE ON "Inventory"
    FOR EACH ROW
    EXECUTE FUNCTION validate_inventory_quantities();

-- 11. Function to log all Item changes for audit trail
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

-- Create trigger for Item audit logging
CREATE TRIGGER trigger_log_item_changes
    AFTER INSERT OR UPDATE OR DELETE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION log_item_changes();

-- Create indexes for audit log
CREATE INDEX idx_item_audit_log_item_id ON "ItemAuditLog" ("itemId");
CREATE INDEX idx_item_audit_log_action ON "ItemAuditLog" ("action");
CREATE INDEX idx_item_audit_log_changed_at ON "ItemAuditLog" ("changedAt");

-- Grant necessary permissions
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON "ItemAuditLog" TO postgres;
