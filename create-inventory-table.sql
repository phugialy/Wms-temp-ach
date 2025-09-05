-- Create the missing "Inventory" table that the frontend API expects
-- This table links Items to Locations with quantities

CREATE TABLE IF NOT EXISTS "Inventory" (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES "Item"(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES "Location"(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) DEFAULT 'in_stock',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(item_id, location_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_item_id ON "Inventory"(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location_id ON "Inventory"(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON "Inventory"(status);

-- Create a function to sync inventory from Item table
CREATE OR REPLACE FUNCTION sync_inventory_from_item()
RETURNS TRIGGER AS $$
BEGIN
    -- When an Item is created or updated, ensure it has an inventory record
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Get the default location (DNCL-Inspection)
        DECLARE
            default_location_id INTEGER;
        BEGIN
            SELECT id INTO default_location_id 
            FROM "Location" 
            WHERE name = 'DNCL-Inspection' 
            LIMIT 1;
            
            -- If no default location, use the first available location
            IF default_location_id IS NULL THEN
                SELECT id INTO default_location_id 
                FROM "Location" 
                ORDER BY id 
                LIMIT 1;
            END IF;
            
            -- Insert or update inventory record
            INSERT INTO "Inventory" (item_id, location_id, quantity, status)
            VALUES (NEW.id, default_location_id, 1, 'in_stock')
            ON CONFLICT (item_id, location_id) 
            DO UPDATE SET 
                updated_at = NOW();
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically sync inventory
DROP TRIGGER IF EXISTS trigger_sync_inventory_from_item ON "Item";
CREATE TRIGGER trigger_sync_inventory_from_item
    AFTER INSERT OR UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION sync_inventory_from_item();

-- Initial sync: Create inventory records for existing items
INSERT INTO "Inventory" (item_id, location_id, quantity, status)
SELECT 
    i.id,
    COALESCE(l.id, 1) as location_id, -- Use first location if no DNCL-Inspection
    1 as quantity,
    'in_stock' as status
FROM "Item" i
CROSS JOIN (
    SELECT id FROM "Location" 
    WHERE name = 'DNCL-Inspection' 
    LIMIT 1
) l
ON CONFLICT (item_id, location_id) DO NOTHING;

-- If no DNCL-Inspection location exists, use the first available location
INSERT INTO "Inventory" (item_id, location_id, quantity, status)
SELECT 
    i.id,
    (SELECT id FROM "Location" ORDER BY id LIMIT 1) as location_id,
    1 as quantity,
    'in_stock' as status
FROM "Item" i
WHERE NOT EXISTS (
    SELECT 1 FROM "Inventory" inv 
    WHERE inv.item_id = i.id
)
ON CONFLICT (item_id, location_id) DO NOTHING;

COMMENT ON TABLE "Inventory" IS 'Inventory tracking table linking Items to Locations with quantities';
COMMENT ON FUNCTION sync_inventory_from_item() IS 'Automatically creates inventory records when items are created or updated';

