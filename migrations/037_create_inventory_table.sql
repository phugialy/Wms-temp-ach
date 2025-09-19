-- Create dedicated inventory table for pre-computed SKU data
-- This table will store aggregated inventory data for fast frontend access

CREATE TABLE IF NOT EXISTS inventory_aggregated (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    capacity VARCHAR(50),
    color VARCHAR(50),
    carrier VARCHAR(100),
    sku_code VARCHAR(200) NOT NULL,
    device_count INTEGER NOT NULL DEFAULT 0,
    working_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint to prevent duplicates
    UNIQUE(brand, model, capacity, color, carrier, sku_code)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_inventory_brand ON inventory_aggregated(brand);
CREATE INDEX IF NOT EXISTS idx_inventory_model ON inventory_aggregated(model);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_aggregated(sku_code);
CREATE INDEX IF NOT EXISTS idx_inventory_last_updated ON inventory_aggregated(last_updated);

-- Create a function to refresh inventory data
CREATE OR REPLACE FUNCTION refresh_inventory_data()
RETURNS INTEGER AS $$
DECLARE
    processed_count INTEGER := 0;
BEGIN
    -- Clear existing data
    DELETE FROM inventory_aggregated;
    
    -- Insert aggregated data from source tables
    INSERT INTO inventory_aggregated (
        brand, model, capacity, color, carrier, sku_code, 
        device_count, working_count, failed_count, last_updated
    )
    SELECT 
        p.brand,
        i.model,
        i.capacity,
        i.color,
        i.carrier,
        CONCAT(UPPER(p.brand), '-', UPPER(i.model), '-', COALESCE(i.capacity, ''), '-', COALESCE(i.color, '')) as sku_code,
        COUNT(*) as device_count,
        COUNT(CASE WHEN i.working = 'YES' OR i.working = 'PASS' THEN 1 END) as working_count,
        COUNT(CASE WHEN i.working = 'NO' OR i.working = 'FAILED' THEN 1 END) as failed_count,
        CURRENT_TIMESTAMP as last_updated
    FROM product p
    INNER JOIN item i ON p.imei = i.imei
    WHERE p.brand IS NOT NULL 
      AND i.model IS NOT NULL
    GROUP BY p.brand, i.model, i.capacity, i.color, i.carrier
    ORDER BY p.brand, i.model, i.capacity, i.color, i.carrier;
    
    -- Get count of processed records
    GET DIAGNOSTICS processed_count = ROW_COUNT;
    
    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy querying
CREATE OR REPLACE VIEW inventory_summary AS
SELECT 
    brand,
    model,
    COUNT(*) as capacity_variants,
    SUM(device_count) as total_devices,
    SUM(working_count) as total_working,
    SUM(failed_count) as total_failed
FROM inventory_aggregated
GROUP BY brand, model
ORDER BY brand, model;
