-- Migration: Add SKU Matching Results Table and Update Cascade
-- This creates the results table and implements the complete update flow

-- 1. Create SKU Matching Results Table
CREATE TABLE IF NOT EXISTS sku_matching_results (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) NOT NULL,
    original_sku VARCHAR(255) NOT NULL,
    matched_sku VARCHAR(255),
    match_score DECIMAL(5,2),
    match_method VARCHAR(50), -- 'exact', 'fuzzy', 'carrier_normalized', etc.
    match_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'matched', 'no_match', 'manual_review'
    match_notes TEXT,
    processed_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key to product table
    FOREIGN KEY (imei) REFERENCES product(imei) ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate results for same IMEI
    UNIQUE(imei)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sku_matching_results_imei ON sku_matching_results(imei);
CREATE INDEX IF NOT EXISTS idx_sku_matching_results_status ON sku_matching_results(match_status);
CREATE INDEX IF NOT EXISTS idx_sku_matching_results_score ON sku_matching_results(match_score);

-- 3. Function to update product SKU when matching is successful
CREATE OR REPLACE FUNCTION update_product_sku_from_matching()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if we have a successful match
    IF NEW.match_status = 'matched' AND NEW.matched_sku IS NOT NULL THEN
        -- Update the product table with the matched SKU
        UPDATE product 
        SET sku = NEW.matched_sku,
            updated_at = NOW()
        WHERE imei = NEW.imei;
        
        -- Log the update
        RAISE NOTICE 'Updated product SKU for IMEI %: % -> %', 
            NEW.imei, NEW.original_sku, NEW.matched_sku;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger to automatically update product SKU when matching results are inserted/updated
CREATE TRIGGER trigger_update_product_sku
    AFTER INSERT OR UPDATE ON sku_matching_results
    FOR EACH ROW
    EXECUTE FUNCTION update_product_sku_from_matching();

-- 5. Function to recalculate inventory when product SKU changes
CREATE OR REPLACE FUNCTION recalculate_inventory_on_sku_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If SKU changed, recalculate inventory for both old and new SKU
    IF OLD.sku IS DISTINCT FROM NEW.sku THEN
        -- Recalculate for old SKU (if it exists)
        IF OLD.sku IS NOT NULL THEN
            PERFORM recalculate_inventory_for_sku(OLD.sku);
        END IF;
        
        -- Recalculate for new SKU
        IF NEW.sku IS NOT NULL THEN
            PERFORM recalculate_inventory_for_sku(NEW.sku);
        END IF;
        
        RAISE NOTICE 'Recalculated inventory for SKU change: % -> %', OLD.sku, NEW.sku;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger to recalculate inventory when product SKU is updated
CREATE TRIGGER trigger_recalculate_inventory_on_sku_change
    AFTER UPDATE ON product
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_inventory_on_sku_change();

-- 7. Update the SKU matching view to include results
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
    mh.location_updated as location,
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

-- 8. Create a view for pending SKU matches
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

-- 9. Create a view for successful matches
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

-- 10. Create a view for no-match items
CREATE OR REPLACE VIEW no_match_sku_items AS
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
    working_status
FROM sku_matching_view
WHERE match_status = 'no_match'
ORDER BY last_activity DESC;

-- 11. Add some utility functions for SKU matching

-- Function to get SKU matching statistics
CREATE OR REPLACE FUNCTION get_sku_matching_stats()
RETURNS TABLE(
    total_items INTEGER,
    pending_items INTEGER,
    matched_items INTEGER,
    no_match_items INTEGER,
    manual_review_items INTEGER,
    avg_match_score DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_items,
        COUNT(CASE WHEN match_status IS NULL OR match_status = 'pending' THEN 1 END)::INTEGER as pending_items,
        COUNT(CASE WHEN match_status = 'matched' THEN 1 END)::INTEGER as matched_items,
        COUNT(CASE WHEN match_status = 'no_match' THEN 1 END)::INTEGER as no_match_items,
        COUNT(CASE WHEN match_status = 'manual_review' THEN 1 END)::INTEGER as manual_review_items,
        AVG(match_score) as avg_match_score
    FROM sku_matching_view;
END;
$$ LANGUAGE plpgsql;

-- Function to process SKU matching for a single IMEI
CREATE OR REPLACE FUNCTION process_sku_matching_for_imei(target_imei VARCHAR(15))
RETURNS TABLE(
    imei VARCHAR(15),
    original_sku VARCHAR(255),
    matched_sku VARCHAR(255),
    match_score DECIMAL(5,2),
    match_status VARCHAR(20),
    match_notes TEXT
) AS $$
DECLARE
    v_original_sku VARCHAR(255);
    v_brand VARCHAR(100);
    v_model VARCHAR(255);
    v_capacity VARCHAR(50);
    v_colors VARCHAR(100);
    v_carrier VARCHAR(100);
    v_best_match_sku VARCHAR(255);
    v_best_score DECIMAL(5,2);
    v_match_method VARCHAR(50);
BEGIN
    -- Get current data for the IMEI
    SELECT p.sku, p.brand, i.model, i.capacity, i.color, i.carrier
    INTO v_original_sku, v_brand, v_model, v_capacity, v_colors, v_carrier
    FROM product p
    LEFT JOIN item i ON p.imei = i.imei
    WHERE p.imei = target_imei;
    
    -- If no data found, return error
    IF v_original_sku IS NULL THEN
        RAISE EXCEPTION 'IMEI % not found in product table', target_imei;
    END IF;
    
    -- TODO: Implement actual SKU matching logic here
    -- For now, this is a placeholder that would call the backend matching service
    -- The actual matching would be done by the Node.js service
    
    -- Insert or update the matching result
    INSERT INTO sku_matching_results (
        imei, original_sku, matched_sku, match_score, 
        match_method, match_status, match_notes
    ) VALUES (
        target_imei, v_original_sku, v_best_match_sku, v_best_score,
        v_match_method, 
        CASE 
            WHEN v_best_score >= 0.8 THEN 'matched'
            WHEN v_best_score >= 0.6 THEN 'manual_review'
            ELSE 'no_match'
        END,
        CASE 
            WHEN v_best_score >= 0.8 THEN 'Automatic match'
            WHEN v_best_score >= 0.6 THEN 'Requires manual review'
            ELSE 'No suitable match found'
        END
    )
    ON CONFLICT (imei) 
    DO UPDATE SET
        matched_sku = EXCLUDED.matched_sku,
        match_score = EXCLUDED.match_score,
        match_method = EXCLUDED.match_method,
        match_status = EXCLUDED.match_status,
        match_notes = EXCLUDED.match_notes,
        updated_at = NOW();
    
    -- Return the result
    RETURN QUERY
    SELECT 
        smr.imei,
        smr.original_sku,
        smr.matched_sku,
        smr.match_score,
        smr.match_status,
        smr.match_notes
    FROM sku_matching_results smr
    WHERE smr.imei = target_imei;
    
END;
$$ LANGUAGE plpgsql;

-- 12. Add comments for documentation
COMMENT ON TABLE sku_matching_results IS 'Stores results of SKU matching process for each IMEI';
COMMENT ON VIEW sku_matching_view IS 'Comprehensive view combining product data with SKU matching results';
COMMENT ON VIEW pending_sku_matches IS 'Items that need SKU matching processing';
COMMENT ON VIEW successful_sku_matches IS 'Items that have been successfully matched to master SKUs';
COMMENT ON VIEW no_match_sku_items IS 'Items that could not be matched to master SKUs';
COMMENT ON FUNCTION update_product_sku_from_matching() IS 'Automatically updates product SKU when matching is successful';
COMMENT ON FUNCTION recalculate_inventory_on_sku_change() IS 'Recalculates inventory counts when product SKU changes';
