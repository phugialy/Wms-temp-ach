-- Create Hybrid Inventory System
-- This migration creates a comprehensive inventory system that handles both SKU-based and IMEI-based tracking
-- with real-time synchronization between product status and SKU assignments

-- 1. Create comprehensive inventory view (IMEI-based with SKU info)
CREATE VIEW inventory_view AS
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
    
    -- Device Status Classification
    CASE 
        WHEN dt.notes IS NOT NULL AND (dt.notes ILIKE '%FAIL%' OR dt.notes ILIKE '%FAILED%') 
        THEN 'FAILED'
        WHEN smr.matched_sku IS NOT NULL 
        THEN 'SKU_MATCHED'
        WHEN smr.matched_sku IS NULL AND smr.imei IS NOT NULL 
        THEN 'NO_SKU_MATCH'
        ELSE 'PENDING_SKU_MATCH'
    END as device_status,
    
    -- SKU Information (from matching results)
    smr.matched_sku as assigned_sku,
    smr.match_score,
    smr.match_method,
    smr.match_notes,
    smr.processed_at as sku_processed_at,
    
    -- Data Completeness
    CASE 
        WHEN i.model IS NOT NULL AND i.capacity IS NOT NULL AND i.color IS NOT NULL 
        THEN 'complete'
        WHEN i.model IS NOT NULL AND i.capacity IS NOT NULL 
        THEN 'partial'
        ELSE 'incomplete'
    END as data_completeness
    
FROM product p
LEFT JOIN item i ON p.imei = i.imei
LEFT JOIN device_test dt ON p.imei = dt.imei
LEFT JOIN movement_history mh ON p.imei = mh.imei
LEFT JOIN sku_matching_results smr ON p.imei = smr.imei
WHERE (mh.movement_date = (
    SELECT MAX(movement_date) 
    FROM movement_history mh2 
    WHERE mh2.imei = p.imei
) OR mh.movement_date IS NULL);

-- 2. Create SKU-based inventory view (aggregated by SKU)
CREATE VIEW sku_inventory_view AS
SELECT 
    smr.matched_sku as sku_code,
    p.brand,
    i.model,
    i.capacity,
    i.color,
    i.carrier,
    
    -- SKU Statistics
    COUNT(*) as total_devices,
    COUNT(CASE WHEN dt.notes IS NOT NULL AND (dt.notes ILIKE '%FAIL%' OR dt.notes ILIKE '%FAILED%') THEN 1 END) as failed_devices,
    COUNT(CASE WHEN dt.notes IS NULL OR (dt.notes NOT ILIKE '%FAIL%' AND dt.notes NOT ILIKE '%FAILED%') THEN 1 END) as active_devices,
    
    -- Match Quality
    ROUND(AVG(smr.match_score), 3) as avg_match_score,
    COUNT(CASE WHEN smr.match_score >= 0.9 THEN 1 END) as high_confidence_matches,
    COUNT(CASE WHEN smr.match_score >= 0.7 AND smr.match_score < 0.9 THEN 1 END) as medium_confidence_matches,
    COUNT(CASE WHEN smr.match_score < 0.7 THEN 1 END) as low_confidence_matches,
    
    -- Last Activity
    MAX(GREATEST(p.date_in, COALESCE(mh.movement_date, p.date_in))) as last_activity,
    
    -- Device List (for detailed view)
    STRING_AGG(p.imei, ', ' ORDER BY p.imei) as imei_list
    
FROM sku_matching_results smr
JOIN product p ON smr.imei = p.imei
LEFT JOIN item i ON p.imei = i.imei
LEFT JOIN device_test dt ON p.imei = dt.imei
LEFT JOIN movement_history mh ON p.imei = mh.imei
WHERE smr.matched_sku IS NOT NULL
AND (mh.movement_date = (
    SELECT MAX(movement_date) 
    FROM movement_history mh2 
    WHERE mh2.imei = p.imei
) OR mh.movement_date IS NULL)
GROUP BY smr.matched_sku, p.brand, i.model, i.capacity, i.color, i.carrier
ORDER BY total_devices DESC, last_activity DESC;

-- 3. Create detailed SKU device list view
CREATE VIEW sku_device_details_view AS
SELECT 
    smr.matched_sku as sku_code,
    p.imei,
    p.sku as original_sku,
    p.brand,
    i.model,
    i.capacity,
    i.color,
    i.carrier,
    dt.notes as device_notes,
    smr.match_score,
    smr.match_method,
    GREATEST(p.date_in, COALESCE(mh.movement_date, p.date_in)) as last_activity,
    
    -- Device Status
    CASE 
        WHEN dt.notes IS NOT NULL AND (dt.notes ILIKE '%FAIL%' OR dt.notes ILIKE '%FAILED%') 
        THEN 'FAILED'
        ELSE 'ACTIVE'
    END as device_status
    
FROM sku_matching_results smr
JOIN product p ON smr.imei = p.imei
LEFT JOIN item i ON p.imei = i.imei
LEFT JOIN device_test dt ON p.imei = dt.imei
LEFT JOIN movement_history mh ON p.imei = mh.imei
WHERE smr.matched_sku IS NOT NULL
AND (mh.movement_date = (
    SELECT MAX(movement_date) 
    FROM movement_history mh2 
    WHERE mh2.imei = p.imei
) OR mh.movement_date IS NULL)
ORDER BY smr.matched_sku, p.imei;

-- 4. Create comprehensive inventory summary
CREATE VIEW inventory_summary_view AS
SELECT 
    -- Overall Statistics
    (SELECT COUNT(*) FROM product) as total_devices,
    (SELECT COUNT(*) FROM failed_devices_view) as failed_devices,
    (SELECT COUNT(*) FROM sku_matching_view WHERE matched_sku IS NOT NULL) as sku_matched_devices,
    (SELECT COUNT(*) FROM sku_matching_view WHERE matched_sku IS NULL) as unmatched_devices,
    
    -- Brand Statistics
    (SELECT COUNT(DISTINCT brand) FROM product WHERE brand IS NOT NULL) as unique_brands,
    (SELECT COUNT(DISTINCT model) FROM item WHERE model IS NOT NULL) as unique_models,
    
    -- SKU Statistics
    (SELECT COUNT(DISTINCT matched_sku) FROM sku_matching_results WHERE matched_sku IS NOT NULL) as unique_skus,
    (SELECT COUNT(*) FROM sku_matching_results WHERE match_score >= 0.9) as high_confidence_matches,
    (SELECT ROUND(AVG(match_score), 3) FROM sku_matching_results WHERE match_score IS NOT NULL) as avg_match_score,
    
    -- Data Quality
    (SELECT COUNT(*) FROM inventory_view WHERE data_completeness = 'complete') as complete_data_devices,
    (SELECT COUNT(*) FROM inventory_view WHERE data_completeness = 'partial') as partial_data_devices,
    (SELECT COUNT(*) FROM inventory_view WHERE data_completeness = 'incomplete') as incomplete_data_devices;

-- 5. Create brand/model statistics view
CREATE VIEW brand_model_stats_view AS
SELECT 
    p.brand,
    i.model,
    COUNT(*) as total_devices,
    COUNT(CASE WHEN dt.notes IS NOT NULL AND (dt.notes ILIKE '%FAIL%' OR dt.notes ILIKE '%FAILED%') THEN 1 END) as failed_devices,
    COUNT(CASE WHEN dt.notes IS NULL OR (dt.notes NOT ILIKE '%FAIL%' AND dt.notes NOT ILIKE '%FAILED%') THEN 1 END) as active_devices,
    COUNT(CASE WHEN smr.matched_sku IS NOT NULL THEN 1 END) as sku_matched_devices,
    COUNT(CASE WHEN smr.matched_sku IS NULL THEN 1 END) as unmatched_devices,
    ROUND(AVG(CASE WHEN smr.match_score IS NOT NULL THEN smr.match_score END), 3) as avg_match_score,
    MAX(GREATEST(p.date_in, COALESCE(mh.movement_date, p.date_in))) as last_activity
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
AND p.brand IS NOT NULL
GROUP BY p.brand, i.model
ORDER BY total_devices DESC, last_activity DESC;

-- 6. Create function to sync device status changes
CREATE OR REPLACE FUNCTION sync_device_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If device becomes FAILED, remove from SKU matching results
    IF NEW.notes IS NOT NULL AND (NEW.notes ILIKE '%FAIL%' OR NEW.notes ILIKE '%FAILED%') THEN
        DELETE FROM sku_matching_results WHERE imei = NEW.imei;
    END IF;
    
    -- If device is no longer FAILED, trigger SKU matching
    IF OLD.notes IS NOT NULL AND (OLD.notes ILIKE '%FAIL%' OR OLD.notes ILIKE '%FAILED%') 
       AND (NEW.notes IS NULL OR (NEW.notes NOT ILIKE '%FAIL%' AND NEW.notes NOT ILIKE '%FAILED%')) THEN
        -- This would trigger SKU matching process (implement as needed)
        RAISE NOTICE 'Device % is no longer FAILED - trigger SKU matching', NEW.imei;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger for device status changes
CREATE TRIGGER device_status_change_trigger
    AFTER UPDATE ON device_test
    FOR EACH ROW
    EXECUTE FUNCTION sync_device_status();

-- Add comments for documentation
COMMENT ON VIEW inventory_view IS 'Comprehensive inventory view with device status, SKU matching, and data completeness';
COMMENT ON VIEW sku_inventory_view IS 'SKU-based inventory aggregation showing device counts and statistics per SKU';
COMMENT ON VIEW sku_device_details_view IS 'Detailed device list for each SKU with individual device information';
COMMENT ON VIEW inventory_summary_view IS 'Overall inventory statistics and summary data';
COMMENT ON VIEW brand_model_stats_view IS 'Statistics grouped by brand and model';
COMMENT ON FUNCTION sync_device_status() IS 'Automatically syncs device status changes with SKU matching system';
