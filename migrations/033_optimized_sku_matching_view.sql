-- Optimized SKU Matching View - Only essential fields for matching
-- This view is streamlined for SKU matching performance

-- 1. Drop existing views first
DROP VIEW IF EXISTS sku_matching_summary CASCADE;
DROP VIEW IF EXISTS manual_review_sku_items CASCADE;
DROP VIEW IF EXISTS no_match_sku_items CASCADE;
DROP VIEW IF EXISTS successful_sku_matches CASCADE;
DROP VIEW IF EXISTS pending_sku_matches CASCADE;
DROP VIEW IF EXISTS sku_matching_view CASCADE;

-- 2. Create the optimized main SKU matching view (only essential fields)
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
LEFT JOIN movement_history mh ON p.imei = mh.imei
LEFT JOIN sku_matching_results smr ON p.imei = smr.imei
WHERE mh.movement_date = (
    SELECT MAX(movement_date) 
    FROM movement_history mh2 
    WHERE mh2.imei = p.imei
) OR mh.movement_date IS NULL;

-- 3. Create a minimal view for pending SKU matches (only matching fields)
CREATE VIEW pending_sku_matches AS
SELECT 
    imei,
    original_sku,
    brand,
    model,
    capacity,
    color,
    carrier,
    data_completeness,
    last_activity
FROM sku_matching_view
WHERE match_status IS NULL OR match_status = 'pending'
ORDER BY last_activity DESC;

-- 4. Create a view for successful matches (minimal fields)
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
    match_processed_at
FROM sku_matching_view
WHERE match_status = 'matched'
ORDER BY match_processed_at DESC;

-- 5. Create a view for no-match items (minimal fields)
CREATE VIEW no_match_sku_items AS
SELECT 
    imei,
    original_sku,
    brand,
    model,
    capacity,
    color,
    carrier,
    match_notes,
    data_completeness,
    last_activity
FROM sku_matching_view
WHERE match_status = 'no_match'
ORDER BY last_activity DESC;

-- 6. Create a view for manual review items (minimal fields)
CREATE VIEW manual_review_sku_items AS
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
    match_notes,
    data_completeness,
    match_processed_at
FROM sku_matching_view
WHERE match_status = 'manual_review'
ORDER BY match_score DESC;

-- 7. Create a summary view for SKU matching statistics
CREATE VIEW sku_matching_summary AS
SELECT 
    COUNT(*) as total_items,
    COUNT(CASE WHEN match_status = 'matched' THEN 1 END) as matched_items,
    COUNT(CASE WHEN match_status = 'manual_review' THEN 1 END) as review_items,
    COUNT(CASE WHEN match_status = 'no_match' THEN 1 END) as no_match_items,
    COUNT(CASE WHEN match_status IS NULL THEN 1 END) as pending_items,
    ROUND(
        COUNT(CASE WHEN match_status = 'matched' THEN 1 END) * 100.0 / COUNT(*), 2
    ) as match_percentage
FROM sku_matching_view;
