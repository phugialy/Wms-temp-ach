-- Migration: Enhance undefined_sku table for smart suggestions and undefined classification
-- Purpose: Add support for smart suggestions, undefined classification, and enhanced tracking
-- Date: 2024-01-XX

-- =====================================================
-- 1. ENHANCE UNDEFINED_SKU TABLE STRUCTURE
-- =====================================================

-- Add new columns to support smart suggestions and undefined classification
ALTER TABLE undefined_sku 
ADD COLUMN IF NOT EXISTS undefined_reason VARCHAR(500),
ADD COLUMN IF NOT EXISTS smart_suggestion_sku VARCHAR(255),
ADD COLUMN IF NOT EXISTS smart_suggestion_score INTEGER,
ADD COLUMN IF NOT EXISTS smart_suggestion_details JSONB,
ADD COLUMN IF NOT EXISTS confidence_level VARCHAR(50),
ADD COLUMN IF NOT EXISTS match_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS processing_method VARCHAR(100),
ADD COLUMN IF NOT EXISTS requires_attention BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS review_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS review_notes TEXT,
ADD COLUMN IF NOT EXISTS resolution_status VARCHAR(50) DEFAULT 'unresolved',
ADD COLUMN IF NOT EXISTS resolved_sku VARCHAR(255),
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255);

-- =====================================================
-- 2. ADD INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for undefined reason lookups
CREATE INDEX IF NOT EXISTS idx_undefined_sku_reason 
ON undefined_sku (undefined_reason) 
WHERE undefined_reason IS NOT NULL;

-- Index for confidence level filtering
CREATE INDEX IF NOT EXISTS idx_undefined_sku_confidence 
ON undefined_sku (confidence_level) 
WHERE confidence_level IS NOT NULL;

-- Index for review status
CREATE INDEX IF NOT EXISTS idx_undefined_sku_review_status 
ON undefined_sku (review_status) 
WHERE review_status IS NOT NULL;

-- Index for requires attention
CREATE INDEX IF NOT EXISTS idx_undefined_sku_requires_attention 
ON undefined_sku (requires_attention) 
WHERE requires_attention = true;

-- Index for resolution status
CREATE INDEX IF NOT EXISTS idx_undefined_sku_resolution_status 
ON undefined_sku (resolution_status) 
WHERE resolution_status IS NOT NULL;

-- Index for smart suggestion score
CREATE INDEX IF NOT EXISTS idx_undefined_sku_suggestion_score 
ON undefined_sku (smart_suggestion_score) 
WHERE smart_suggestion_score IS NOT NULL;

-- Composite index for review workflow
CREATE INDEX IF NOT EXISTS idx_undefined_sku_review_workflow 
ON undefined_sku (review_status, requires_attention, created_at) 
WHERE review_status = 'pending' AND requires_attention = true;

-- Index for JSONB smart suggestion details
CREATE INDEX IF NOT EXISTS idx_undefined_sku_suggestion_details_gin 
ON undefined_sku USING GIN (smart_suggestion_details) 
WHERE smart_suggestion_details IS NOT NULL;

-- =====================================================
-- 3. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN undefined_sku.undefined_reason IS 'Detailed reason for undefined classification (e.g., "Missing critical data - Input has carrier AT&T but match has no carrier")';
COMMENT ON COLUMN undefined_sku.smart_suggestion_sku IS 'Best matching SKU code suggested by the system';
COMMENT ON COLUMN undefined_sku.smart_suggestion_score IS 'Match score of the smart suggestion (0-100)';
COMMENT ON COLUMN undefined_sku.smart_suggestion_details IS 'JSONB object containing detailed suggestion information';
COMMENT ON COLUMN undefined_sku.confidence_level IS 'Confidence level of the match (high, medium, low, very_low)';
COMMENT ON COLUMN undefined_sku.match_type IS 'Type of match attempted (tag_based, field_based, pattern_based, hybrid)';
COMMENT ON COLUMN undefined_sku.processing_method IS 'Method used for processing (hybrid_sku_matching, complete_sku_matching, etc.)';
COMMENT ON COLUMN undefined_sku.requires_attention IS 'Whether this item requires manual review';
COMMENT ON COLUMN undefined_sku.review_status IS 'Status of manual review (pending, in_progress, completed, dismissed)';
COMMENT ON COLUMN undefined_sku.reviewed_by IS 'User who reviewed the item';
COMMENT ON COLUMN undefined_sku.reviewed_at IS 'Timestamp when review was completed';
COMMENT ON COLUMN undefined_sku.review_notes IS 'Notes from manual review';
COMMENT ON COLUMN undefined_sku.resolution_status IS 'Resolution status (unresolved, resolved, dismissed, needs_sku_creation)';
COMMENT ON COLUMN undefined_sku.resolved_sku IS 'SKU code that was assigned during resolution';
COMMENT ON COLUMN undefined_sku.resolved_at IS 'Timestamp when resolution was completed';
COMMENT ON COLUMN undefined_sku.resolved_by IS 'User who resolved the item';

-- =====================================================
-- 4. CREATE VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for pending review items
CREATE OR REPLACE VIEW pending_undefined_reviews AS
SELECT 
    imei,
    undefined_reason,
    smart_suggestion_sku,
    smart_suggestion_score,
    confidence_level,
    match_type,
    requires_attention,
    created_at,
    device_data
FROM undefined_sku 
WHERE review_status = 'pending' 
  AND requires_attention = true
ORDER BY created_at DESC;

-- View for high-priority items (low confidence, high suggestion score)
CREATE OR REPLACE VIEW high_priority_undefined AS
SELECT 
    imei,
    undefined_reason,
    smart_suggestion_sku,
    smart_suggestion_score,
    confidence_level,
    match_type,
    created_at,
    device_data
FROM undefined_sku 
WHERE review_status = 'pending' 
  AND requires_attention = true
  AND (
    confidence_level IN ('low', 'very_low') 
    OR smart_suggestion_score >= 70
  )
ORDER BY 
    CASE confidence_level 
        WHEN 'very_low' THEN 1
        WHEN 'low' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
    END,
    smart_suggestion_score DESC,
    created_at DESC;

-- View for resolution statistics
CREATE OR REPLACE VIEW undefined_resolution_stats AS
SELECT 
    resolution_status,
    COUNT(*) as count,
    AVG(smart_suggestion_score) as avg_suggestion_score,
    MIN(created_at) as oldest_item,
    MAX(created_at) as newest_item
FROM undefined_sku 
GROUP BY resolution_status
ORDER BY count DESC;

-- =====================================================
-- 5. UPDATE EXISTING DATA (if any)
-- =====================================================

-- Update existing records to have default values
UPDATE undefined_sku 
SET 
    undefined_reason = COALESCE(undefined_reason, reason),
    confidence_level = 'unknown',
    match_type = 'legacy',
    processing_method = 'complete_sku_matching',
    requires_attention = true,
    review_status = 'pending',
    resolution_status = 'unresolved'
WHERE undefined_reason IS NULL;

-- =====================================================
-- 6. ADD CONSTRAINTS
-- =====================================================

-- Add check constraints for valid values
ALTER TABLE undefined_sku 
ADD CONSTRAINT chk_undefined_sku_confidence_level 
CHECK (confidence_level IN ('high', 'medium', 'low', 'very_low', 'unknown'));

ALTER TABLE undefined_sku 
ADD CONSTRAINT chk_undefined_sku_review_status 
CHECK (review_status IN ('pending', 'in_progress', 'completed', 'dismissed'));

ALTER TABLE undefined_sku 
ADD CONSTRAINT chk_undefined_sku_resolution_status 
CHECK (resolution_status IN ('unresolved', 'resolved', 'dismissed', 'needs_sku_creation'));

ALTER TABLE undefined_sku 
ADD CONSTRAINT chk_undefined_sku_suggestion_score 
CHECK (smart_suggestion_score IS NULL OR (smart_suggestion_score >= 0 AND smart_suggestion_score <= 100));

-- =====================================================
-- 7. GRANT PERMISSIONS (if needed)
-- =====================================================

-- Grant appropriate permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON undefined_sku TO your_app_user;
-- GRANT SELECT ON pending_undefined_reviews TO your_app_user;
-- GRANT SELECT ON high_priority_undefined TO your_app_user;
-- GRANT SELECT ON undefined_resolution_stats TO your_app_user;

-- =====================================================
-- 8. FINAL COMMENTS
-- =====================================================

COMMENT ON TABLE undefined_sku IS 'Enhanced table for tracking undefined SKU matches with smart suggestions and classification';
COMMENT ON VIEW pending_undefined_reviews IS 'View of all pending undefined SKU items requiring manual review';
COMMENT ON VIEW high_priority_undefined IS 'View of high-priority undefined items (low confidence or high suggestion scores)';
COMMENT ON VIEW undefined_resolution_stats IS 'Statistics on undefined SKU resolution status';
