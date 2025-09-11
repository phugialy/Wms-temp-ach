-- Migration: Optimize Hybrid SKU Matching Performance
-- Purpose: Add strategic indexes to improve query performance for HybridSkuMatchingService
-- Date: 2024-01-XX

-- =====================================================
-- 1. SKU_MASTER TABLE OPTIMIZATIONS
-- =====================================================

-- GIN index for sku_tags array operations (critical for tag-based matching)
CREATE INDEX IF NOT EXISTS idx_sku_master_sku_tags_gin 
ON sku_master USING GIN (sku_tags) 
WHERE is_active = true;

-- Composite index for tag-based matching with brand requirement
CREATE INDEX IF NOT EXISTS idx_sku_master_active_brand_tags 
ON sku_master (is_active, brand) 
WHERE is_active = true AND brand IS NOT NULL;

-- Individual tag column indexes for fallback matching
CREATE INDEX IF NOT EXISTS idx_sku_master_model_tag 
ON sku_master (model_tag) 
WHERE is_active = true AND model_tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sku_master_capacity_tag 
ON sku_master (capacity_tag) 
WHERE is_active = true AND capacity_tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sku_master_color_tag 
ON sku_master (color_tag) 
WHERE is_active = true AND color_tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sku_master_carrier_tag 
ON sku_master (carrier_tag) 
WHERE is_active = true AND carrier_tag IS NOT NULL;

-- Composite index for individual tag matching combinations
CREATE INDEX IF NOT EXISTS idx_sku_master_model_capacity_tags 
ON sku_master (model_tag, capacity_tag) 
WHERE is_active = true AND model_tag IS NOT NULL AND capacity_tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sku_master_model_color_tags 
ON sku_master (model_tag, color_tag) 
WHERE is_active = true AND model_tag IS NOT NULL AND color_tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sku_master_model_carrier_tags 
ON sku_master (model_tag, carrier_tag) 
WHERE is_active = true AND model_tag IS NOT NULL AND carrier_tag IS NOT NULL;

-- Index for SKU code pattern matching
CREATE INDEX IF NOT EXISTS idx_sku_master_sku_code_pattern 
ON sku_master (sku_code) 
WHERE is_active = true;

-- Index for traditional field matching
CREATE INDEX IF NOT EXISTS idx_sku_master_brand_model_capacity 
ON sku_master (brand, model, capacity) 
WHERE is_active = true AND brand IS NOT NULL AND model IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sku_master_brand_model_color 
ON sku_master (brand, model, color) 
WHERE is_active = true AND brand IS NOT NULL AND model IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sku_master_brand_model_carrier 
ON sku_master (brand, model, carrier) 
WHERE is_active = true AND brand IS NOT NULL AND model IS NOT NULL;

-- Index for post-fix filtering
CREATE INDEX IF NOT EXISTS idx_sku_master_post_fix 
ON sku_master (post_fix) 
WHERE is_active = true;

-- =====================================================
-- 2. NORMALIZATION_TAGS TABLE OPTIMIZATIONS
-- =====================================================

-- GIN index for tags array operations
CREATE INDEX IF NOT EXISTS idx_normalization_tags_tags_gin 
ON normalization_tags USING GIN (tags) 
WHERE is_active = true;

-- Composite index for category and input_value lookups
CREATE INDEX IF NOT EXISTS idx_normalization_tags_category_input 
ON normalization_tags (category, input_value) 
WHERE is_active = true;

-- Index for priority-based lookups
CREATE INDEX IF NOT EXISTS idx_normalization_tags_category_priority 
ON normalization_tags (category, priority DESC) 
WHERE is_active = true;

-- Index for post-fix filtering
CREATE INDEX IF NOT EXISTS idx_normalization_tags_postfix 
ON normalization_tags (is_postfix) 
WHERE is_active = true;

-- =====================================================
-- 3. SKU_TAGS TABLE OPTIMIZATIONS
-- =====================================================

-- Index for tag category lookups
CREATE INDEX IF NOT EXISTS idx_sku_tags_category_active 
ON sku_tags (tag_category, is_active) 
WHERE is_active = true;

-- Index for tag name lookups
CREATE INDEX IF NOT EXISTS idx_sku_tags_name_active 
ON sku_tags (tag_name, is_active) 
WHERE is_active = true;

-- Index for usage count (for popular tags)
CREATE INDEX IF NOT EXISTS idx_sku_tags_usage_count 
ON sku_tags (usage_count DESC) 
WHERE is_active = true AND usage_count > 0;

-- =====================================================
-- 4. SKU_MASTER_TAGS JUNCTION TABLE OPTIMIZATIONS
-- =====================================================

-- Index for sku_master_id lookups
CREATE INDEX IF NOT EXISTS idx_sku_master_tags_sku_id 
ON sku_master_tags (sku_master_id) 
WHERE sku_master_id IS NOT NULL;

-- Index for tag_id lookups
CREATE INDEX IF NOT EXISTS idx_sku_master_tags_tag_id 
ON sku_master_tags (tag_id) 
WHERE tag_id IS NOT NULL;

-- Composite index for tag category lookups
CREATE INDEX IF NOT EXISTS idx_sku_master_tags_category 
ON sku_master_tags (tag_category) 
WHERE tag_category IS NOT NULL;

-- =====================================================
-- 5. QUERY-SPECIFIC OPTIMIZATIONS
-- =====================================================

-- Index for the main hybrid query WHERE clause
CREATE INDEX IF NOT EXISTS idx_sku_master_hybrid_query 
ON sku_master (is_active, brand, model_tag, capacity_tag, color_tag, carrier_tag) 
WHERE is_active = true;

-- Index for pattern matching queries
CREATE INDEX IF NOT EXISTS idx_sku_master_pattern_matching 
ON sku_master (is_active, brand, sku_code) 
WHERE is_active = true AND brand IS NOT NULL;

-- Index for field matching queries
CREATE INDEX IF NOT EXISTS idx_sku_master_field_matching 
ON sku_master (is_active, brand, model, capacity, color, carrier) 
WHERE is_active = true AND brand IS NOT NULL;

-- =====================================================
-- 6. STATISTICS UPDATE
-- =====================================================

-- Update table statistics for better query planning
ANALYZE sku_master;
ANALYZE normalization_tags;
ANALYZE sku_tags;
ANALYZE sku_master_tags;

-- =====================================================
-- 7. INDEX USAGE MONITORING
-- =====================================================

-- Create a view to monitor index usage
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW_USAGE'
        WHEN idx_scan < 1000 THEN 'MEDIUM_USAGE'
        ELSE 'HIGH_USAGE'
    END as usage_level
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- =====================================================
-- 8. PERFORMANCE MONITORING QUERIES
-- =====================================================

-- Query to check index sizes
CREATE OR REPLACE VIEW index_sizes AS
SELECT 
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
    pg_relation_size(indexname::regclass) as size_bytes
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- Query to identify slow queries (requires pg_stat_statements extension)
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- 
-- CREATE OR REPLACE VIEW slow_queries AS
-- SELECT 
--     query,
--     calls,
--     total_time,
--     mean_time,
--     rows
-- FROM pg_stat_statements 
-- WHERE query LIKE '%sku_master%' 
--    OR query LIKE '%normalization_tags%'
-- ORDER BY mean_time DESC;

COMMENT ON INDEX idx_sku_master_sku_tags_gin IS 'GIN index for sku_tags array operations - critical for tag-based matching';
COMMENT ON INDEX idx_sku_master_active_brand_tags IS 'Composite index for active SKUs with brand - prevents cross-brand contamination';
COMMENT ON INDEX idx_normalization_tags_tags_gin IS 'GIN index for normalization_tags array operations';
COMMENT ON INDEX idx_sku_master_hybrid_query IS 'Optimized index for the main hybrid matching query WHERE clause';
