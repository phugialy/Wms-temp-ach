-- IMEI Queue System Migration
-- This creates a queue-based system for processing IMEI data

-- 1. Data Queue Table (Raw Input)
CREATE TABLE IF NOT EXISTS imei_data_queue (
    id SERIAL PRIMARY KEY,
    raw_data JSONB NOT NULL, -- Complete raw payload from bulk-add/phonecheck
    source VARCHAR(50) NOT NULL, -- 'bulk-add', 'single-phonecheck', 'api'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0
);

-- 2. IMEI SKU Info Table
CREATE TABLE IF NOT EXISTS imei_sku_info (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) UNIQUE NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    model_number VARCHAR(100),
    storage VARCHAR(50),
    color VARCHAR(50),
    carrier VARCHAR(50),
    sku VARCHAR(200), -- Generated SKU
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. IMEI Inspect Data Table
CREATE TABLE IF NOT EXISTS imei_inspect_data (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) NOT NULL,
    test_type VARCHAR(50) DEFAULT 'PHONECHECK',
    test_results JSONB NOT NULL, -- Full PhoneCheck payload
    passed BOOLEAN, -- (!failed && working == 'YES')
    battery_health INTEGER,
    battery_cycle INTEGER,
    notes TEXT,
    tester_name VARCHAR(100),
    repair_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    check_date TIMESTAMPTZ,
    FOREIGN KEY (imei) REFERENCES imei_sku_info(imei)
);

-- 4. IMEI Units Table
CREATE TABLE IF NOT EXISTS imei_units (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(200) NOT NULL,
    imei VARCHAR(15) UNIQUE NOT NULL,
    serial_number VARCHAR(100),
    condition VARCHAR(50),
    location VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (imei) REFERENCES imei_sku_info(imei)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_status ON imei_data_queue(status);
CREATE INDEX IF NOT EXISTS idx_imei_data_queue_created_at ON imei_data_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_imei_sku_info_imei ON imei_sku_info(imei);
CREATE INDEX IF NOT EXISTS idx_imei_sku_info_sku ON imei_sku_info(sku);
CREATE INDEX IF NOT EXISTS idx_imei_inspect_data_imei ON imei_inspect_data(imei);
CREATE INDEX IF NOT EXISTS idx_imei_units_imei ON imei_units(imei);
CREATE INDEX IF NOT EXISTS idx_imei_units_sku ON imei_units(sku);

-- SKU Generation Function
CREATE OR REPLACE FUNCTION generate_sku_from_data(data JSONB)
RETURNS VARCHAR(200) AS $$
DECLARE
    model_val VARCHAR(100);
    storage_val VARCHAR(50);
    color_val VARCHAR(50);
    carrier_val VARCHAR(50);
    sku_parts TEXT[];
BEGIN
    -- Get full model name (not compressed)
    model_val := COALESCE(data->>'model', '');
    
    -- Extract storage number (e.g., "512GB" -> "512")
    storage_val := REGEXP_REPLACE(COALESCE(data->>'storage', ''), '[^0-9]', '', 'g');
    
    -- Get color and convert to 3-letter code
    color_val := CASE 
        WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%black%' THEN 'BLK'
        WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%blue%' THEN 'BLU'
        WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%white%' THEN 'WHT'
        WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%red%' THEN 'RED'
        WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%green%' THEN 'GRN'
        WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%purple%' THEN 'PUR'
        WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%pink%' THEN 'PNK'
        WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%gold%' THEN 'GLD'
        WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%silver%' THEN 'SLV'
        WHEN LOWER(COALESCE(data->>'color', '')) LIKE '%gray%' OR LOWER(COALESCE(data->>'color', '')) LIKE '%grey%' THEN 'GRY'
        ELSE UPPER(LEFT(COALESCE(data->>'color', ''), 3))
    END;
    
    -- Get carrier
    carrier_val := COALESCE(data->>'carrier', '');
    
    -- Build SKU parts: Model-Storage-Color-Carrier
    sku_parts := ARRAY[model_val];
    
    IF storage_val != '' THEN
        sku_parts := array_append(sku_parts, storage_val);
    END IF;
    
    IF color_val != '' THEN
        sku_parts := array_append(sku_parts, color_val);
    END IF;
    
    IF carrier_val != '' THEN
        sku_parts := array_append(sku_parts, carrier_val);
    END IF;
    
    RETURN array_to_string(sku_parts, '-');
END;
$$ LANGUAGE plpgsql;

-- Function to process queue items
CREATE OR REPLACE FUNCTION process_imei_queue()
RETURNS void AS $$
DECLARE
    queue_item RECORD;
    imei_val VARCHAR(15);
    sku_val VARCHAR(200);
    passed_val BOOLEAN;
    battery_health_val INTEGER;
    battery_cycle_val INTEGER;
    check_date_val TIMESTAMPTZ;
BEGIN
    -- Get next pending item
    SELECT * INTO queue_item 
    FROM imei_data_queue 
    WHERE status = 'pending' 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN; -- No items to process
    END IF;
    
    -- Mark as processing
    UPDATE imei_data_queue 
    SET status = 'processing', processed_at = NOW() 
    WHERE id = queue_item.id;
    
    BEGIN
        -- Extract IMEI
        imei_val := queue_item.raw_data->>'imei';
        
        -- Generate SKU
        sku_val := generate_sku_from_data(queue_item.raw_data);
        
        -- Determine if passed
        passed_val := (
            NOT (queue_item.raw_data->>'failed')::boolean 
            AND queue_item.raw_data->>'working' = 'YES'
        );
        
        -- Parse battery values
        battery_health_val := NULL;
        battery_cycle_val := NULL;
        
        IF queue_item.raw_data->>'batteryHealth' IS NOT NULL AND queue_item.raw_data->>'batteryHealth' != 'N/A' THEN
            BEGIN
                battery_health_val := (queue_item.raw_data->>'batteryHealth')::integer;
            EXCEPTION WHEN OTHERS THEN
                battery_health_val := NULL;
            END;
        END IF;
        
        IF queue_item.raw_data->>'batteryCycle' IS NOT NULL AND queue_item.raw_data->>'batteryCycle' != 'N/A' THEN
            BEGIN
                battery_cycle_val := (queue_item.raw_data->>'batteryCycle')::integer;
            EXCEPTION WHEN OTHERS THEN
                battery_cycle_val := NULL;
            END;
        END IF;
        
        -- Parse check date
        check_date_val := NULL;
        IF queue_item.raw_data->>'checkDate' IS NOT NULL THEN
            BEGIN
                check_date_val := (queue_item.raw_data->>'checkDate')::timestamptz;
            EXCEPTION WHEN OTHERS THEN
                check_date_val := NOW();
            END;
        ELSE
            check_date_val := NOW();
        END IF;
        
        -- Insert/Update SKU info
        INSERT INTO imei_sku_info (imei, brand, model, model_number, storage, color, carrier, sku)
        VALUES (
            imei_val,
            queue_item.raw_data->>'brand',
            queue_item.raw_data->>'model',
            queue_item.raw_data->>'modelNumber',
            queue_item.raw_data->>'storage',
            queue_item.raw_data->>'color',
            queue_item.raw_data->>'carrier',
            sku_val
        )
        ON CONFLICT (imei) DO UPDATE SET
            brand = EXCLUDED.brand,
            model = EXCLUDED.model,
            model_number = EXCLUDED.model_number,
            storage = EXCLUDED.storage,
            color = EXCLUDED.color,
            carrier = EXCLUDED.carrier,
            sku = EXCLUDED.sku,
            updated_at = NOW();
        
        -- Insert inspect data
        INSERT INTO imei_inspect_data (
            imei, test_type, test_results, passed, 
            battery_health, battery_cycle, notes, tester_name, repair_notes, check_date
        )
        VALUES (
            imei_val,
            'PHONECHECK',
            queue_item.raw_data->'testResults',
            passed_val,
            battery_health_val,
            battery_cycle_val,
            queue_item.raw_data->>'notes',
            queue_item.raw_data->>'testerName',
            queue_item.raw_data->>'repairNotes',
            check_date_val
        );
        
        -- Insert/Update unit
        INSERT INTO imei_units (sku, imei, serial_number, condition, location)
        VALUES (
            sku_val,
            imei_val,
            queue_item.raw_data->>'serialNumber',
            queue_item.raw_data->>'condition',
            queue_item.raw_data->>'location'
        )
        ON CONFLICT (imei) DO UPDATE SET
            sku = EXCLUDED.sku,
            serial_number = EXCLUDED.serial_number,
            condition = EXCLUDED.condition,
            location = EXCLUDED.location,
            updated_at = NOW();
        
        -- Mark as completed
        UPDATE imei_data_queue 
        SET status = 'completed' 
        WHERE id = queue_item.id;
        
    EXCEPTION WHEN OTHERS THEN
        -- Mark as failed
        UPDATE imei_data_queue 
        SET status = 'failed', 
            error_message = SQLERRM,
            retry_count = retry_count + 1
        WHERE id = queue_item.id;
    END;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically process queue when new items are added
CREATE OR REPLACE FUNCTION trigger_process_queue()
RETURNS TRIGGER AS $$
BEGIN
    -- Process queue asynchronously
    PERFORM process_imei_queue();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS auto_process_queue ON imei_data_queue;

-- Create trigger
CREATE TRIGGER auto_process_queue
    AFTER INSERT ON imei_data_queue
    FOR EACH ROW
    EXECUTE FUNCTION trigger_process_queue();

-- Function to manually process all pending items
CREATE OR REPLACE FUNCTION process_all_pending_queue()
RETURNS INTEGER AS $$
DECLARE
    processed_count INTEGER := 0;
    queue_item RECORD;
BEGIN
    LOOP
        -- Process one item at a time
        SELECT * INTO queue_item 
        FROM imei_data_queue 
        WHERE status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT 1;
        
        EXIT WHEN NOT FOUND;
        
        PERFORM process_imei_queue();
        processed_count := processed_count + 1;
    END LOOP;
    
    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_queue_stats()
RETURNS TABLE(
    total_items BIGINT,
    pending_items BIGINT,
    processing_items BIGINT,
    completed_items BIGINT,
    failed_items BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_items,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_items,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_items,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_items
    FROM imei_data_queue;
END;
$$ LANGUAGE plpgsql;
