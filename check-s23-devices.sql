-- Query to check for any S23 devices across all relevant tables
-- This searches for S23 in various fields and tables

-- 1. Check SKU Master for S23 devices
SELECT 
    'SKU Master' as source_table,
    sku_code,
    brand,
    model,
    capacity,
    color,
    carrier,
    sku_tags,
    device_type,
    last_synced,
    created_at
FROM sku_master 
WHERE 
    sku_code ILIKE '%S23%' 
    OR model ILIKE '%S23%'
    OR brand ILIKE '%S23%'
    OR sku_tags::text ILIKE '%S23%'
ORDER BY last_synced DESC;

-- 2. Check Item table for S23 devices
SELECT 
    'Item' as source_table,
    imei,
    device_name,
    model,
    brand,
    matched_sku,
    sku_match_score,
    sku_match_status,
    created_at
FROM item 
WHERE 
    device_name ILIKE '%S23%'
    OR model ILIKE '%S23%'
    OR brand ILIKE '%S23%'
    OR matched_sku ILIKE '%S23%'
ORDER BY created_at DESC;

-- 3. Check Inventory View for S23 devices
SELECT 
    'Inventory View' as source_table,
    imei,
    device_name,
    model,
    brand,
    matched_sku,
    sku_match_score,
    sku_match_status,
    sku_match_method,
    created_at
FROM inventory_view 
WHERE 
    device_name ILIKE '%S23%'
    OR model ILIKE '%S23%'
    OR brand ILIKE '%S23%'
    OR matched_sku ILIKE '%S23%'
ORDER BY created_at DESC;

-- 4. Check Device Test table for S23 devices
SELECT 
    'Device Test' as source_table,
    imei,
    device_name,
    model,
    brand,
    created_at
FROM device_test 
WHERE 
    device_name ILIKE '%S23%'
    OR model ILIKE '%S23%'
    OR brand ILIKE '%S23%'
ORDER BY created_at DESC;

-- 5. Check Undefined SKU table for S23 devices
SELECT 
    'Undefined SKU' as source_table,
    imei,
    device_data,
    reason,
    created_at
FROM undefined_sku 
WHERE 
    device_data::text ILIKE '%S23%'
    OR reason ILIKE '%S23%'
ORDER BY created_at DESC;

-- 6. Summary count of S23 devices across all tables
SELECT 
    'SUMMARY' as source_table,
    'Total S23 devices found' as description,
    COUNT(*) as count
FROM (
    SELECT sku_code FROM sku_master WHERE sku_code ILIKE '%S23%' OR model ILIKE '%S23%' OR brand ILIKE '%S23%' OR sku_tags::text ILIKE '%S23%'
    UNION ALL
    SELECT imei FROM item WHERE device_name ILIKE '%S23%' OR model ILIKE '%S23%' OR brand ILIKE '%S23%' OR matched_sku ILIKE '%S23%'
    UNION ALL
    SELECT imei FROM inventory_view WHERE device_name ILIKE '%S23%' OR model ILIKE '%S23%' OR brand ILIKE '%S23%' OR matched_sku ILIKE '%S23%'
    UNION ALL
    SELECT imei FROM device_test WHERE device_name ILIKE '%S23%' OR model ILIKE '%S23%' OR brand ILIKE '%S23%'
    UNION ALL
    SELECT imei FROM undefined_sku WHERE device_data::text ILIKE '%S23%' OR reason ILIKE '%S23%'
) as all_s23_devices;
