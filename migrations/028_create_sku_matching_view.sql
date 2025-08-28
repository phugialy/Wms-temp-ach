-- Create a comprehensive view for SKU matching that combines data from all relevant tables
-- This view provides all the data needed for the SKU matching process

CREATE OR REPLACE VIEW sku_matching_view AS
SELECT 
    p.imei,
    p.sku as current_sku,
    p.brand as product_brand,
    p.date_in,
    p.created_at as product_created,
    p.updated_at as product_updated,
    
    -- Item table data (detailed device info)
    i.model,
    i.model_number,
    i.carrier,
    i.capacity,
    i.color,
    i.battery_health,
    i.battery_count,
    i.working,
    i.location,
    i.created_at as item_created,
    i.updated_at as item_updated,
    
    -- Device test data
    dt.defects,
    dt.notes,
    dt.custom1 as repair_notes,
    dt.test_date,
    dt.created_at as test_created,
    
    -- Inventory data (aggregate info)
    inv.qty_total,
    inv.pass_devices,
    inv.failed_devices,
    inv.reserved,
    inv.available,
    inv.created_at as inventory_created,
    inv.updated_at as inventory_updated,
    
    -- Movement history (latest movement)
    mh.location_original,
    mh.location_updated,
    mh.movement_date,
    mh.created_at as movement_created,
    
    -- Computed fields for SKU matching
    COALESCE(p.brand, i.model) as primary_brand,
    COALESCE(i.model, p.brand) as primary_model,
    COALESCE(i.capacity, 'N/A') as primary_capacity,
    COALESCE(i.color, 'N/A') as primary_color,
    COALESCE(i.carrier, 'Unlocked') as primary_carrier,
    
    -- SKU generation components (for comparison)
    CASE 
        WHEN i.model IS NOT NULL THEN 
            REGEXP_REPLACE(i.model, '[^a-zA-Z0-9]', '', 'g')
        ELSE 
            REGEXP_REPLACE(COALESCE(p.brand, 'Unknown'), '[^a-zA-Z0-9]', '', 'g')
    END as clean_model,
    
    CASE 
        WHEN i.capacity IS NOT NULL THEN 
            UPPER(REGEXP_REPLACE(i.capacity::text, '\s+', '', 'g'))
        ELSE 
            'N/A'
    END as clean_capacity,
    
    CASE 
        WHEN i.color IS NOT NULL THEN 
            UPPER(REGEXP_REPLACE(i.color, '\s+', '', 'g'))
        ELSE 
            'N/A'
    END as clean_color,
    
    CASE 
        WHEN i.carrier IS NOT NULL AND i.carrier != '' THEN 
            UPPER(REGEXP_REPLACE(i.carrier, '\s+', '', 'g'))
        ELSE 
            'UNLOCKED'
    END as clean_carrier,
    
    -- Generated SKU for comparison
    CASE 
        WHEN i.model IS NOT NULL THEN 
            REGEXP_REPLACE(i.model, '[^a-zA-Z0-9]', '', 'g') || '-' ||
            UPPER(REGEXP_REPLACE(COALESCE(i.capacity, 'N/A')::text, '\s+', '', 'g')) || '-' ||
            UPPER(REGEXP_REPLACE(COALESCE(i.color, 'N/A'), '\s+', '', 'g')) || '-' ||
            UPPER(REGEXP_REPLACE(COALESCE(i.carrier, 'Unlocked'), '\s+', '', 'g'))
        ELSE 
            REGEXP_REPLACE(COALESCE(p.brand, 'Unknown'), '[^a-zA-Z0-9]', '', 'g') || '-' ||
            UPPER(REGEXP_REPLACE(COALESCE(i.capacity, 'N/A')::text, '\s+', '', 'g')) || '-' ||
            UPPER(REGEXP_REPLACE(COALESCE(i.color, 'N/A'), '\s+', '', 'g')) || '-' ||
            UPPER(REGEXP_REPLACE(COALESCE(i.carrier, 'Unlocked'), '\s+', '', 'g'))
    END as generated_sku,
    
    -- Status indicators
    CASE 
        WHEN i.working = 'YES' THEN 'PASS'
        WHEN i.working = 'NO' THEN 'FAILED'
        ELSE 'PENDING'
    END as working_status,
    
    -- Data completeness score (0-100)
    (
        CASE WHEN p.brand IS NOT NULL THEN 20 ELSE 0 END +
        CASE WHEN i.model IS NOT NULL THEN 20 ELSE 0 END +
        CASE WHEN i.capacity IS NOT NULL THEN 20 ELSE 0 END +
        CASE WHEN i.color IS NOT NULL THEN 20 ELSE 0 END +
        CASE WHEN i.carrier IS NOT NULL THEN 20 ELSE 0 END
    ) as data_completeness_score,
    
    -- Last activity timestamp
    GREATEST(
        p.updated_at,
        i.updated_at,
        dt.created_at,
        inv.updated_at,
        mh.created_at
    ) as last_activity

FROM product p
LEFT JOIN item i ON p.imei = i.imei
LEFT JOIN device_test dt ON p.imei = dt.imei
LEFT JOIN inventory inv ON p.sku = inv.sku
LEFT JOIN LATERAL (
    SELECT 
        imei,
        location_original,
        location_updated,
        movement_date,
        created_at
    FROM movement_history 
    WHERE imei = p.imei 
    ORDER BY created_at DESC 
    LIMIT 1
) mh ON p.imei = mh.imei
WHERE p.imei IS NOT NULL;

-- Create index to improve view performance
CREATE INDEX IF NOT EXISTS idx_sku_matching_view_imei ON product(imei);
CREATE INDEX IF NOT EXISTS idx_sku_matching_view_sku ON product(sku);
CREATE INDEX IF NOT EXISTS idx_sku_matching_view_brand ON product(brand);

-- Add comment to the view
COMMENT ON VIEW sku_matching_view IS 'Comprehensive view for SKU matching that combines data from product, item, device_test, inventory, and movement_history tables. Provides all necessary data for the SKU matching process including generated SKU components and data completeness scoring.';
