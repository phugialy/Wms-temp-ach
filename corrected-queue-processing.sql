-- Corrected queue processing function with proper ON CONFLICT handling
CREATE OR REPLACE FUNCTION process_queue_batch(batch_size INTEGER DEFAULT 10)
RETURNS TABLE(processed INTEGER, errors INTEGER) AS $$
DECLARE
  queue_item RECORD;
  processed INTEGER := 0;
  errors INTEGER := 0;
  imei_val TEXT;
  brand_val TEXT;
  model_val TEXT;
  sku_val TEXT;
  item_count INTEGER := 0;
BEGIN
  -- Process items in batches
  FOR queue_item IN 
    SELECT id, raw_data 
    FROM data_queue 
    WHERE status = 'pending' 
    ORDER BY created_at ASC 
    LIMIT batch_size
  LOOP
    item_count := item_count + 1;
    
    BEGIN
      imei_val := queue_item.raw_data->>'imei';
      brand_val := queue_item.raw_data->>'brand';
      model_val := queue_item.raw_data->>'model';
      
      -- Generate SKU only if we have both brand and model, otherwise leave as NULL
      sku_val := CASE 
        WHEN brand_val IS NOT NULL AND model_val IS NOT NULL 
             AND brand_val != '' AND model_val != '' 
        THEN brand_val || '-' || model_val 
        ELSE NULL 
      END;
      
      -- Insert into product table (no unique constraint on imei, so no ON CONFLICT)
      INSERT INTO product (imei, brand, sku, date_in) 
      VALUES (imei_val, brand_val, sku_val, NOW());
      
      -- Insert into item table (no unique constraint on imei, so no ON CONFLICT)
      IF imei_val IS NOT NULL AND imei_val != '' THEN
        INSERT INTO item (
          imei, model, model_number, carrier, capacity, color,
          battery_health, battery_count, working, location,
          created_at, updated_at
        )
        VALUES (
          imei_val,
          COALESCE(model_val, ''),
          COALESCE(queue_item.raw_data->>'serialNumber', model_val, ''),
          COALESCE(queue_item.raw_data->>'carrier', ''),
          COALESCE(queue_item.raw_data->>'capacity', ''),
          COALESCE(queue_item.raw_data->>'color', ''),
          NULL, -- battery_health
          NULL, -- battery_count
          COALESCE(queue_item.raw_data->>'working', ''),
          COALESCE(queue_item.raw_data->>'location', 'INCOMING'),
          NOW(),
          NOW()
        );
      END IF;
      
      -- Insert into device_test table (HAS unique constraint on imei, so use ON CONFLICT)
      IF queue_item.raw_data->>'working' IS NOT NULL 
         AND queue_item.raw_data->>'working' != 'PENDING'
         AND queue_item.raw_data->>'working' != '' THEN
        
        INSERT INTO device_test (imei, working, notes, tester, created_at)
        VALUES (
          imei_val,
          queue_item.raw_data->>'working',
          COALESCE(queue_item.raw_data->>'notes', ''),
          COALESCE(queue_item.raw_data->>'testerName', ''),
          NOW()
        )
        ON CONFLICT (imei) DO UPDATE SET
          working = EXCLUDED.working,
          notes = EXCLUDED.notes,
          tester = EXCLUDED.tester,
          created_at = NOW();
      END IF;
      
      -- Insert into sku_matching_queue (HAS unique constraint on imei, so use ON CONFLICT)
      INSERT INTO sku_matching_queue (imei, status, created_at, updated_at)
      VALUES (imei_val, 'pending', NOW(), NOW())
      ON CONFLICT (imei) DO UPDATE SET
        status = 'pending',
        updated_at = NOW();
      
      -- Mark as completed
      UPDATE data_queue 
      SET status = 'completed', processed_at = NOW(), updated_at = NOW() 
      WHERE id = queue_item.id;
      
      processed := processed + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- Mark as failed
      UPDATE data_queue 
      SET status = 'failed', error_message = SQLERRM, updated_at = NOW() 
      WHERE id = queue_item.id;
      
      errors := errors + 1;
    END;
  END LOOP;
  
  RETURN QUERY SELECT processed, errors;
END;
$$ LANGUAGE plpgsql;
