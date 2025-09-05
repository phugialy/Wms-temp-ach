-- ========================================
-- PHASE 1B: SKU MATCHING TRIGGERS
-- ========================================
-- These triggers automatically add IMEIs to the sku_matching_queue
-- when device data is inserted or updated

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to add IMEI to queue (with deduplication)
CREATE OR REPLACE FUNCTION add_imei_to_sku_matching_queue(
    p_imei VARCHAR(15),
    p_source VARCHAR(50) DEFAULT 'trigger',
    p_source_reference VARCHAR(100) DEFAULT NULL,
    p_priority INTEGER DEFAULT 5
)
RETURNS VOID AS $$
BEGIN
    -- Only add if IMEI exists in product table
    IF NOT EXISTS (SELECT 1 FROM product WHERE imei = p_imei) THEN
        RAISE WARNING 'IMEI % does not exist in product table, skipping queue addition', p_imei;
        RETURN;
    END IF;
    
    -- Insert or update queue entry (UPSERT logic)
    INSERT INTO sku_matching_queue (
        imei, 
        status, 
        priority, 
        source, 
        source_reference,
        processing_context
    ) VALUES (
        p_imei, 
        'pending', 
        p_priority, 
        p_source, 
        p_source_reference,
        jsonb_build_object(
            'triggered_at', NOW(),
            'trigger_source', p_source
        )
    )
    ON CONFLICT (imei, status) 
    DO UPDATE SET
        priority = LEAST(sku_matching_queue.priority, EXCLUDED.priority),
        source_reference = COALESCE(EXCLUDED.source_reference, sku_matching_queue.source_reference),
        processing_context = sku_matching_queue.processing_context || EXCLUDED.processing_context,
        updated_at = NOW()
    WHERE sku_matching_queue.status = 'pending';
    
    -- Log the action
    RAISE NOTICE 'Added IMEI % to SKU matching queue (source: %, priority: %)', p_imei, p_source, p_priority;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to add IMEI % to queue: %', p_imei, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- TRIGGER FUNCTIONS
-- ========================================

-- Trigger function for new devices (product table)
CREATE OR REPLACE FUNCTION trigger_new_device_sku_matching()
RETURNS TRIGGER AS $$
BEGIN
    -- Add to queue with high priority for new devices
    PERFORM add_imei_to_sku_matching_queue(
        NEW.imei,
        'trigger',
        'new_device_insert',
        3  -- High priority for new devices
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for device updates (product table)
CREATE OR REPLACE FUNCTION trigger_device_update_sku_matching()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if IMEI or SKU changed
    IF OLD.imei != NEW.imei OR OLD.sku != NEW.sku THEN
        PERFORM add_imei_to_sku_matching_queue(
            NEW.imei,
            'trigger',
            'device_update',
            4  -- Medium priority for updates
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for item table changes
CREATE OR REPLACE FUNCTION trigger_item_update_sku_matching()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if any SKU-relevant fields changed
    IF (OLD.model != NEW.model OR 
        OLD.capacity != NEW.capacity OR 
        OLD.color != NEW.color OR 
        OLD.carrier != NEW.carrier) THEN
        
        PERFORM add_imei_to_sku_matching_queue(
            NEW.imei,
            'trigger',
            'item_characteristics_update',
            4  -- Medium priority for characteristic updates
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for device_test table changes (especially notes)
CREATE OR REPLACE FUNCTION trigger_device_notes_update_sku_matching()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if notes changed (this affects carrier status)
    IF OLD.notes != NEW.notes THEN
        PERFORM add_imei_to_sku_matching_queue(
            NEW.imei,
            'trigger',
            'device_notes_update',
            2  -- High priority for notes changes (affects carrier status)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- CREATE TRIGGERS
-- ========================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_new_device_sku_matching ON product;
DROP TRIGGER IF EXISTS trigger_device_update_sku_matching ON product;
DROP TRIGGER IF EXISTS trigger_item_update_sku_matching ON item;
DROP TRIGGER IF EXISTS trigger_device_notes_update_sku_matching ON device_test;

-- Create triggers
CREATE TRIGGER trigger_new_device_sku_matching
    AFTER INSERT ON product
    FOR EACH ROW
    EXECUTE FUNCTION trigger_new_device_sku_matching();

CREATE TRIGGER trigger_device_update_sku_matching
    AFTER UPDATE ON product
    FOR EACH ROW
    EXECUTE FUNCTION trigger_device_update_sku_matching();

CREATE TRIGGER trigger_item_update_sku_matching
    AFTER INSERT OR UPDATE ON item
    FOR EACH ROW
    EXECUTE FUNCTION trigger_item_update_sku_matching();

CREATE TRIGGER trigger_device_notes_update_sku_matching
    AFTER INSERT OR UPDATE ON device_test
    FOR EACH ROW
    EXECUTE FUNCTION trigger_device_notes_update_sku_matching();

-- ========================================
-- TESTING AND VERIFICATION
-- ========================================

-- Test the triggers by inserting test data
INSERT INTO product (imei, sku, brand) 
VALUES ('999999999999999', 'TEST-SKU-001', 'TestBrand')
ON CONFLICT (imei) DO NOTHING;

-- Insert corresponding item data
INSERT INTO item (imei, model, capacity, color, carrier)
VALUES ('999999999999999', 'TESTMODEL', '256', 'BLACK', 'UNLOCKED')
ON CONFLICT (imei) DO UPDATE SET
    model = EXCLUDED.model,
    capacity = EXCLUDED.capacity,
    color = EXCLUDED.color,
    carrier = EXCLUDED.carrier;

-- Insert device test data
INSERT INTO device_test (imei, notes)
VALUES ('999999999999999', 'CARRIER UNLOCKED, TEST DEVICE')
ON CONFLICT (imei) DO UPDATE SET
    notes = EXCLUDED.notes;

-- Check if triggers worked
SELECT 
    'Trigger test results' as test_type,
    COUNT(*) as queue_entries_created,
    STRING_AGG(DISTINCT source_reference, ', ') as trigger_sources
FROM sku_matching_queue 
WHERE imei = '999999999999999';

-- Show current queue status
SELECT 
    'Current queue status' as status_type,
    status,
    COUNT(*) as count,
    MIN(created_at) as oldest_entry,
    MAX(created_at) as newest_entry
FROM sku_matching_queue 
GROUP BY status
ORDER BY status;

-- Add comments for documentation
COMMENT ON FUNCTION add_imei_to_sku_matching_queue IS 'Helper function to add IMEI to SKU matching queue with deduplication';
COMMENT ON FUNCTION trigger_new_device_sku_matching IS 'Trigger function for new device insertion';
COMMENT ON FUNCTION trigger_device_update_sku_matching IS 'Trigger function for device updates';
COMMENT ON FUNCTION trigger_item_update_sku_matching IS 'Trigger function for item characteristic updates';
COMMENT ON FUNCTION trigger_device_notes_update_sku_matching IS 'Trigger function for device notes updates (carrier status)';

