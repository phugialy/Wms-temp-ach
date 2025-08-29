-- Filter FAILED devices from SKU matching view and create separate FAILED devices view
-- This migration ensures FAILED devices are excluded from SKU matching process

-- 1. Drop existing views first
DROP VIEW IF EXISTS sku_matching_summary CASCADE;
DROP VIEW IF EXISTS manual_review_sku_items CASCADE;
DROP VIEW IF EXISTS no_match_sku_items CASCADE;
DROP VIEW IF EXISTS successful_sku_matches CASCADE;
DROP VIEW IF EXISTS pending_sku_matches CASCADE;
DROP VIEW IF EXISTS sku_matching_view CASCADE;

-- 2. Create the main SKU matching view (EXCLUDING FAILED devices)
CREATE VIEW sku_matching_view AS
SELECT 
    p.imei,
    
    -- Original SKU (from product table - generated during data intake)
    p.sku as original_sku,
    
    -- Matched SKU (from sku_matching_results table - from Google Sheets master)
    smr.matched_sku as sku_matched,
    
    -- SKU matching details (essential for matching logic)
    smr.match_score,
    smr.match_method,
    smr.match_status,
    smr.match_notes,
    smr.processed_at as match_processed_at,
    
    -- Device information (only fields needed for SKU generation/matching)
    p.brand,
    i.model,
    i.carrier,
    i.capacity,
    i.color,
    
    -- CRITICAL: Device test notes for carrier override logic
    dt.notes as device_notes,
    
    -- Computed fields for matching logic
    CASE 
        WHEN i.model IS NOT NULL AND i.capacity IS NOT NULL AND i.color IS NOT NULL 
        THEN 'complete'
        WHEN i.model IS NOT NULL AND i.capacity IS NOT NULL 
        THEN 'partial'
        ELSE 'incomplete'
    END as data_completeness,
    
    -- Last activity timestamp (for prioritization)
    GREATEST(p.date_in, COALESCE(mh.movement_date, p.date_in)) as last_activity
    
FROM product p
LEFT JOIN item i ON p.imei = i.imei
LEFT JOIN device_test dt ON p.imei = dt.imei
LEFT JOIN movement_history mh ON p.imei = mh.imei
LEFT JOIN sku_matching_results smr ON p.imei = smr.imei
WHERE (mh.movement_date = (
    SELECT MAX(movement_date) 
    FROM movement_history mh2 
    WHERE mh2.imei = p.imei
) OR mh.movement_date IS NULL)
-- CRITICAL: Exclude FAILED devices from SKU matching
AND (dt.notes IS NULL OR (dt.notes NOT ILIKE '%FAIL%' AND dt.notes NOT ILIKE '%FAILED%'));

-- 3. Create a separate view for FAILED devices (for tracking/reporting)
CREATE VIEW failed_devices_view AS
SELECT 
    p.imei,
    p.sku as original_sku,
    p.brand,
    i.model,
    i.capacity,
    i.color,
    i.carrier,
    dt.notes as device_notes,
    p.date_in,
    GREATEST(p.date_in, COALESCE(mh.movement_date, p.date_in)) as last_activity,
    'FAILED' as device_status
FROM product p
LEFT JOIN item i ON p.imei = i.imei
LEFT JOIN device_test dt ON p.imei = dt.imei
LEFT JOIN movement_history mh ON p.imei = mh.imei
WHERE (mh.movement_date = (
    SELECT MAX(movement_date) 
    FROM movement_history mh2 
    WHERE mh2.imei = p.imei
) OR mh.movement_date IS NULL)
-- CRITICAL: Only include FAILED devices
AND dt.notes IS NOT NULL 
AND (dt.notes ILIKE '%FAIL%' OR dt.notes ILIKE '%FAILED%');

-- 4. Create a minimal view for pending SKU matches (only matching fields)
CREATE VIEW pending_sku_matches AS
SELECT 
    imei,
    original_sku,
    brand,
    model,
    capacity,
    color,
    carrier,
    device_notes,
    data_completeness,
    last_activity
FROM sku_matching_view
WHERE match_status IS NULL OR match_status = 'pending'
ORDER BY last_activity DESC;

-- 5. Create a view for successful matches (minimal fields)
CREATE VIEW successful_sku_matches AS
SELECT 
    imei,
    original_sku,
    sku_matched,
    match_score,
    match_method,
    brand,
    model,
    capacity,
    color,
    carrier,
    device_notes,
    match_processed_at
FROM sku_matching_view
WHERE match_status = 'matched'
ORDER BY match_processed_at DESC;

-- 6. Create a view for no-match items (minimal fields)
CREATE VIEW no_match_sku_items AS
SELECT 
    imei,
    original_sku,
    brand,
    model,
    capacity,
    color,
    carrier,
    device_notes,
    match_score,
    match_method,
    match_notes,
    data_completeness,
    last_activity
FROM sku_matching_view
WHERE match_status = 'no_match' OR match_score < 0.5
ORDER BY last_activity DESC;

-- 7. Create a view for manual review items (minimal fields)
CREATE VIEW manual_review_sku_items AS
SELECT 
    imei,
    original_sku,
    brand,
    model,
    capacity,
    color,
    carrier,
    device_notes,
    match_score,
    match_method,
    match_notes,
    data_completeness,
    last_activity
FROM sku_matching_view
WHERE match_status = 'manual_review' OR (match_score >= 0.5 AND match_score < 0.8)
ORDER BY match_score DESC, last_activity DESC;

-- 8. Create a summary view for reporting (includes FAILED devices count)
CREATE VIEW sku_matching_summary AS
SELECT 
    (SELECT COUNT(*) FROM sku_matching_view) as total_devices,
    (SELECT COUNT(*) FROM failed_devices_view) as failed_devices,
    COUNT(CASE WHEN match_status = 'matched' THEN 1 END) as matched_devices,
    COUNT(CASE WHEN match_status = 'no_match' THEN 1 END) as no_match_devices,
    COUNT(CASE WHEN match_status = 'manual_review' THEN 1 END) as manual_review_devices,
    COUNT(CASE WHEN match_status IS NULL THEN 1 END) as pending_devices,
    ROUND(AVG(CASE WHEN match_score IS NOT NULL THEN match_score END), 3) as avg_match_score,
    COUNT(CASE WHEN match_score >= 0.9 THEN 1 END) as high_confidence_matches,
    COUNT(CASE WHEN match_score >= 0.7 AND match_score < 0.9 THEN 1 END) as medium_confidence_matches,
    COUNT(CASE WHEN match_score < 0.7 THEN 1 END) as low_confidence_matches
FROM sku_matching_view;

-- Add comments for documentation
COMMENT ON VIEW sku_matching_view IS 'SKU matching view EXCLUDING FAILED devices - only devices suitable for SKU matching';
COMMENT ON VIEW failed_devices_view IS 'Separate view for FAILED devices - excluded from SKU matching process';
COMMENT ON COLUMN sku_matching_view.device_notes IS 'Notes from device_test table - FAILED devices are filtered out';
COMMENT ON COLUMN failed_devices_view.device_notes IS 'Notes from device_test table - only FAILED devices included';
