-- ========================================
-- SKU MASTER SYSTEM MIGRATION
-- ========================================
-- This migration creates the SKU master system for managing
-- SKUs from Google Sheets and matching logic

-- SKU Master Table - Stores all SKUs from Google Sheets
CREATE TABLE sku_master (
    id SERIAL PRIMARY KEY,
    sku_code VARCHAR(100) UNIQUE NOT NULL,
    brand VARCHAR(50),
    model VARCHAR(100),
    capacity VARCHAR(50),
    color VARCHAR(50),
    carrier VARCHAR(50),
    post_fix VARCHAR(50),
    is_unlocked BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    source_tab VARCHAR(100),
    sheet_row_id INTEGER,
    last_synced TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- SKU Mapping Rules - For matching logic and carrier variations
CREATE TABLE sku_mapping_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    brand_pattern VARCHAR(100),
    model_pattern VARCHAR(100),
    capacity_pattern VARCHAR(100),
    color_pattern VARCHAR(100),
    carrier_pattern VARCHAR(100),
    target_sku VARCHAR(100),
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- SKU Sync Log - Track sync operations
CREATE TABLE sku_sync_log (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL, -- 'manual', 'scheduled', 'api'
    status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'partial'
    total_skus INTEGER DEFAULT 0,
    new_skus INTEGER DEFAULT 0,
    updated_skus INTEGER DEFAULT 0,
    failed_skus INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- SKU Match Log - Track SKU matching operations
CREATE TABLE sku_match_log (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(50) NOT NULL,
    original_sku VARCHAR(100),
    matched_sku VARCHAR(100),
    match_score DECIMAL(5,2),
    match_method VARCHAR(50), -- 'exact', 'fuzzy', 'rule_based'
    applied_rule_id INTEGER REFERENCES sku_mapping_rules(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sku_master_brand_model ON sku_master(brand, model);
CREATE INDEX idx_sku_master_carrier ON sku_master(carrier);
CREATE INDEX idx_sku_master_active ON sku_master(is_active);
CREATE INDEX idx_sku_mapping_rules_active ON sku_mapping_rules(is_active);
CREATE INDEX idx_sku_match_log_imei ON sku_match_log(imei);

-- Insert default carrier mapping rules
INSERT INTO sku_mapping_rules (rule_name, carrier_pattern, target_sku, priority) VALUES
('AT&T Variations', 'ATT|AT&T|AT&T WIRELESS', 'AT&T', 1),
('Verizon Variations', 'VERIZON|VER|VERZ|VERIZON WIRELESS', 'VERIZON', 1),
('T-Mobile Variations', 'TMobile|TMB|T-Mobile|T-MOBILE', 'T-Mobile', 1),
('Unlocked Variations', 'UNLOCKED|UNL|UNLOCK', 'Unlocked', 1);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sku_master_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for sku_master updated_at
CREATE TRIGGER trigger_sku_master_updated_at
    BEFORE UPDATE ON sku_master
    FOR EACH ROW EXECUTE FUNCTION update_sku_master_updated_at();

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
