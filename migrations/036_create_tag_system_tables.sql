-- Migration 036: Create Tag-Based SKU System Tables
-- This migration sets up the foundation for the new tag-based SKU matching system
-- All changes are ADDITIVE - no existing data or functionality is removed

-- 1. Create sku_tags table for storing individual tag definitions
CREATE TABLE IF NOT EXISTS sku_tags (
    id SERIAL PRIMARY KEY,
    tag_name VARCHAR(100) NOT NULL,
    tag_category VARCHAR(50) NOT NULL,
    tag_value VARCHAR(100) NOT NULL,
    usage_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create sku_master_tags table for SKU-to-tag relationships
CREATE TABLE IF NOT EXISTS sku_master_tags (
    id SERIAL PRIMARY KEY,
    sku_master_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    tag_position INTEGER, -- Position of tag in SKU (0, 1, 2, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sku_master_id) REFERENCES sku_master(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES sku_tags(id) ON DELETE CASCADE
);

-- 3. Create undefined_tag_review table for manual review of unidentified tags
CREATE TABLE IF NOT EXISTS undefined_tag_review (
    id SERIAL PRIMARY KEY,
    tag_value VARCHAR(100) NOT NULL,
    original_sku VARCHAR(200) NOT NULL,
    status VARCHAR(50) DEFAULT 'UNDEFINED',
    suggested_type VARCHAR(50),
    suggested_category VARCHAR(50),
    product_description TEXT,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Add new columns to existing sku_master table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sku_master' AND column_name = 'device_type') THEN
        ALTER TABLE sku_master ADD COLUMN device_type VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sku_master' AND column_name = 'tag_count') THEN
        ALTER TABLE sku_master ADD COLUMN tag_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 5. Create unique constraint on (tag_name, tag_category) for sku_tags
-- This allows the same tag value to exist in different categories (e.g., "32" as CAPACITY and MODEL)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'sku_tags' AND constraint_name = 'sku_tags_name_category_unique') THEN
        ALTER TABLE sku_tags ADD CONSTRAINT sku_tags_name_category_unique UNIQUE (tag_name, tag_category);
    END IF;
END $$;

-- 6. Create indexes for performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sku_tags_category') THEN
        CREATE INDEX idx_sku_tags_category ON sku_tags(tag_category);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sku_tags_name') THEN
        CREATE INDEX idx_sku_tags_name ON sku_tags(tag_name);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sku_master_tags_sku_id') THEN
        CREATE INDEX idx_sku_master_tags_sku_id ON sku_master_tags(sku_master_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sku_master_tags_tag_id') THEN
        CREATE INDEX idx_sku_master_tags_tag_id ON sku_master_tags(tag_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sku_master_device_type') THEN
        CREATE INDEX idx_sku_master_device_type ON sku_master(device_type);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_undefined_tag_review_status') THEN
        CREATE INDEX idx_undefined_tag_review_status ON undefined_tag_review(status);
    END IF;
END $$;

-- 7. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sku_tags_updated_at') THEN
        CREATE TRIGGER update_sku_tags_updated_at 
            BEFORE UPDATE ON sku_tags 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_undefined_tag_review_updated_at') THEN
        CREATE TRIGGER update_undefined_tag_review_updated_at 
            BEFORE UPDATE ON undefined_tag_review 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 8. Add comments for documentation
COMMENT ON TABLE sku_tags IS 'Stores individual tag definitions for SKU parsing system';
COMMENT ON TABLE sku_master_tags IS 'Maps SKU master entries to their associated tags';
COMMENT ON TABLE undefined_tag_review IS 'Queue for manually reviewing unidentified tags during parsing';
COMMENT ON COLUMN sku_master.device_type IS 'Device type classification (PHONE, TABLET, WATCH, DESKTOP)';
COMMENT ON COLUMN sku_master.tag_count IS 'Total number of tags associated with this SKU';

-- 9. Verify table creation
DO $$
BEGIN
    RAISE NOTICE 'Migration 036 completed successfully';
    RAISE NOTICE 'Created tables: sku_tags, sku_master_tags, undefined_tag_review';
    RAISE NOTICE 'Added columns: device_type, tag_count to sku_master';
    RAISE NOTICE 'All changes are ADDITIVE - no existing data modified';
END $$;
