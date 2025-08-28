-- Simple SKU Matching Results Table
-- This creates just the core table and basic trigger

-- 1. Create SKU Matching Results Table
CREATE TABLE IF NOT EXISTS sku_matching_results (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) NOT NULL,
    original_sku VARCHAR(255) NOT NULL,
    matched_sku VARCHAR(255),
    match_score DECIMAL(5,2),
    match_method VARCHAR(50),
    match_status VARCHAR(20) DEFAULT 'pending',
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

-- 3. Simple function to update product SKU when matching is successful
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
