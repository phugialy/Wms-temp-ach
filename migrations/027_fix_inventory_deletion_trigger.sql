-- ========================================
-- FIX: INVENTORY RECALCULATION FUNCTION
-- ========================================
-- This migration adds a function to recalculate inventory counts
-- based on actual data in the database

-- Function to recalculate inventory counts for a specific SKU
CREATE OR REPLACE FUNCTION recalculate_inventory_for_sku(target_sku VARCHAR(200))
RETURNS VOID AS $$
BEGIN
    -- Update inventory counts based on actual data
    UPDATE inventory 
    SET 
        qty_total = (
            SELECT COUNT(*) 
            FROM product p 
            WHERE p.sku = target_sku
        ),
        pass_devices = (
            SELECT COUNT(*) 
            FROM product p 
            JOIN item i ON p.imei = i.imei 
            WHERE p.sku = target_sku 
            AND i.working IN ('YES', 'PASS')
        ),
        failed_devices = (
            SELECT COUNT(*) 
            FROM product p 
            JOIN item i ON p.imei = i.imei 
            WHERE p.sku = target_sku 
            AND i.working IN ('NO', 'FAILED')
        ),
        available = (
            SELECT COUNT(*) 
            FROM product p 
            WHERE p.sku = target_sku
        ) - reserved, -- available = total - reserved
        updated_at = NOW()
    WHERE sku = target_sku;
    
    -- If no items exist for this SKU, set all counts to 0
    IF NOT EXISTS (SELECT 1 FROM product WHERE sku = target_sku) THEN
        UPDATE inventory 
        SET 
            qty_total = 0,
            pass_devices = 0,
            failed_devices = 0,
            available = 0,
            updated_at = NOW()
        WHERE sku = target_sku;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate ALL inventory counts
CREATE OR REPLACE FUNCTION recalculate_all_inventory()
RETURNS VOID AS $$
DECLARE
    sku_record RECORD;
BEGIN
    -- Loop through all unique SKUs and recalculate their inventory
    FOR sku_record IN 
        SELECT DISTINCT sku FROM product
        UNION
        SELECT DISTINCT sku FROM inventory
    LOOP
        PERFORM recalculate_inventory_for_sku(sku_record.sku);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to handle inventory updates when items are deleted
CREATE OR REPLACE FUNCTION handle_inventory_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- When an item is deleted, recalculate inventory for that SKU
    IF TG_OP = 'DELETE' THEN
        PERFORM recalculate_inventory_for_sku(OLD.sku);
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on product table for deletion
DROP TRIGGER IF EXISTS trigger_handle_inventory_deletion ON product;
CREATE TRIGGER trigger_handle_inventory_deletion
    AFTER DELETE ON product
    FOR EACH ROW EXECUTE FUNCTION handle_inventory_deletion();

-- Also create trigger for INSERT to handle new items
CREATE OR REPLACE FUNCTION handle_inventory_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new item is inserted, recalculate inventory for that SKU
    IF TG_OP = 'INSERT' THEN
        PERFORM recalculate_inventory_for_sku(NEW.sku);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on product table for insertion
DROP TRIGGER IF EXISTS trigger_handle_inventory_insert ON product;
CREATE TRIGGER trigger_handle_inventory_insert
    AFTER INSERT ON product
    FOR EACH ROW EXECUTE FUNCTION handle_inventory_insert();

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
