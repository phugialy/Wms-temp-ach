-- Simple SKU Matching Views
-- This creates basic views for SKU matching

-- 1. Create the main SKU matching view (simplified)
CREATE OR REPLACE VIEW sku_matching_view AS
SELECT 
    p.imei,
    p.sku as original_sku,
    p.brand,
    p.date_in,
    i.model,
    i.model_number,
    i.carrier,
    i.capacity,
    i.color,
    i.battery_health,
    i.battery_count,
    i.working,
    dt.defects,
    dt.notes,
    dt.custom1,
    i.location,
    mh.movement_date,
    
    -- SKU matching results
    smr.matched_sku,
    smr.match_score,
    smr.match_method,
    smr.match_status,
    smr.processed_at as match_processed_at,
    
    -- Computed fields for matching
    CASE 
        WHEN i.model IS NOT NULL AND i.capacity IS NOT NULL AND i.color IS NOT NULL 
        THEN 'complete'
        WHEN i.model IS NOT NULL AND i.capacity IS NOT NULL 
        THEN 'partial'
        ELSE 'incomplete'
    END as data_completeness,
    
    -- Current working status
    CASE 
        WHEN i.working = 'YES' OR i.working = 'PASS' THEN 'Working'
        WHEN i.working = 'NO' OR i.working = 'FAILED' THEN 'Failed'
        WHEN i.working = 'PENDING' THEN 'Pending'
        ELSE 'Unknown'
    END as working_status,
    
    -- Last activity timestamp
    GREATEST(p.date_in, COALESCE(mh.movement_date, p.date_in)) as last_activity
    
FROM product p
LEFT JOIN item i ON p.imei = i.imei
LEFT JOIN device_test dt ON p.imei = dt.imei
LEFT JOIN movement_history mh ON p.imei = mh.imei
LEFT JOIN sku_matching_results smr ON p.imei = smr.imei
WHERE mh.movement_date = (
    SELECT MAX(movement_date) 
    FROM movement_history mh2 
    WHERE mh2.imei = p.imei
) OR mh.movement_date IS NULL;

-- 2. Create a view for pending SKU matches
CREATE OR REPLACE VIEW pending_sku_matches AS
SELECT 
    imei,
    original_sku,
    brand,
    model,
    capacity,
    color,
    carrier,
    data_completeness,
    working_status
FROM sku_matching_view
WHERE match_status IS NULL OR match_status = 'pending'
ORDER BY last_activity DESC;

-- 3. Create a view for successful matches
CREATE OR REPLACE VIEW successful_sku_matches AS
SELECT 
    imei,
    original_sku,
    matched_sku,
    match_score,
    match_method,
    brand,
    model,
    capacity,
    color,
    carrier,
    match_processed_at
FROM sku_matching_view
WHERE match_status = 'matched'
ORDER BY match_processed_at DESC;
