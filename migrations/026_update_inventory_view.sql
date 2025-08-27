-- Migration 026: Update Inventory View with Complete Data
-- This migration updates the inventory_view to include all required columns for the frontend

-- Drop the existing view
DROP VIEW IF EXISTS inventory_view;

-- Create updated inventory view with all required columns
CREATE OR REPLACE VIEW inventory_view AS
SELECT 
    p.imei,
    i.working,
    -- Device name format: Model-Capacity-Color-Carrier
    CONCAT(
        COALESCE(i.model, 'Unknown'), '-',
        COALESCE(i.capacity, 'N/A'), '-',
        COALESCE(i.color, 'N/A'), '-',
        COALESCE(i.carrier, 'N/A')
    ) as device_name,
    -- Individual columns for frontend display
    i.model,
    i.capacity as storage,
    i.color,
    i.carrier,
    i.location,
    i.working as working_status,
    -- Condition based on battery health and working status
    CASE 
        WHEN i.working IN ('YES', 'PASS') THEN 'GOOD'
        WHEN i.working IN ('NO', 'FAILED') THEN 'POOR'
        WHEN i.working = 'PENDING' THEN 'UNKNOWN'
        ELSE 'UNKNOWN'
    END as condition,
    -- SKU display (original format)
    CONCAT(p.sku, ' (', i.model, '-', i.capacity, '-', i.color, '-', i.carrier, ')') as sku_display,
    -- Device test data
    dt.defects,
    dt.notes,
    dt.custom1 as repair_notes,
    -- Additional useful data
    i.battery_health,
    i.battery_count,
    i.model_number,
    p.brand,
    p.date_in,
    i.created_at,
    i.updated_at
FROM product p
LEFT JOIN item i ON p.imei = i.imei
LEFT JOIN device_test dt ON p.imei = dt.imei
ORDER BY p.imei;

-- Add comment to the view
COMMENT ON VIEW inventory_view IS 'Updated inventory view with complete device information for frontend display';

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

COMMENT ON SCHEMA public IS 'WMS Revamped Schema - Updated Inventory View - Migration 026 Applied';
