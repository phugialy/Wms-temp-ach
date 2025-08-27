-- Migration 027: Enhance Deletion View for Data Cleanup
-- This migration updates the deletion_view to include all required columns for the cleanup page

-- Drop the existing view
DROP VIEW IF EXISTS deletion_view;

-- Create enhanced deletion view with all required columns for cleanup
CREATE OR REPLACE VIEW deletion_view AS
SELECT 
    p.imei,
    p.sku,
    p.brand,
    i.model,
    i.capacity,
    i.color,
    i.carrier,
    i.working,
    i.location,
    -- Device name format for display
    CONCAT(
        COALESCE(i.model, 'Unknown'), '-',
        COALESCE(i.capacity, 'N/A'), '-',
        COALESCE(i.color, 'N/A'), '-',
        COALESCE(i.carrier, 'N/A')
    ) as device_name,
    -- SKU display format
    CONCAT(p.sku, ' (', i.model, '-', i.capacity, '-', i.color, '-', i.carrier, ')') as sku_display,
    -- Device test data
    dt.defects,
    dt.notes,
    dt.custom1 as repair_notes,
    -- Additional useful data
    i.battery_health,
    i.battery_count,
    i.model_number,
    p.date_in,
    i.created_at,
    i.updated_at,
    -- Status indicators for filtering
    CASE 
        WHEN i.working IN ('YES', 'PASS') THEN 'PASS'
        WHEN i.working IN ('NO', 'FAILED') THEN 'FAIL'
        WHEN i.working = 'PENDING' THEN 'PENDING'
        ELSE 'UNKNOWN'
    END as working_status,
    -- Condition based on working status
    CASE 
        WHEN i.working IN ('YES', 'PASS') THEN 'GOOD'
        WHEN i.working IN ('NO', 'FAILED') THEN 'POOR'
        WHEN i.working = 'PENDING' THEN 'UNKNOWN'
        ELSE 'UNKNOWN'
    END as condition
FROM product p
LEFT JOIN item i ON p.imei = i.imei
LEFT JOIN device_test dt ON p.imei = dt.imei
ORDER BY p.imei;

-- Add comment to the view
COMMENT ON VIEW deletion_view IS 'Enhanced deletion view with complete device information for data cleanup operations';

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

COMMENT ON SCHEMA public IS 'WMS Revamped Schema - Enhanced Deletion View - Migration 027 Applied';
