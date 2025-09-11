-- Fix the queue processing function to handle nullable SKU
CREATE OR REPLACE FUNCTION process_queue_manually()
RETURNS TABLE(processed INTEGER, errors INTEGER) AS $$
DECLARE
  queue_id INTEGER;
  queue_raw_data JSONB;
  processed INTEGER := 0;
  errors INTEGER := 0;
  imei_val TEXT;
  brand_val TEXT;
  model_val TEXT;
  sku_val TEXT;
BEGIN
  SELECT id, raw_data INTO queue_id, queue_raw_data 
  FROM data_queue 
  WHERE status = 'pending' 
  ORDER BY created_at ASC 
  LIMIT 1;
  
  IF FOUND THEN
    BEGIN
      imei_val := queue_raw_data->>'imei';
      brand_val := queue_raw_data->>'brand';
      model_val := queue_raw_data->>'model';
      
      -- Generate SKU only if we have both brand and model, otherwise leave as NULL
      sku_val := CASE 
        WHEN brand_val IS NOT NULL AND model_val IS NOT NULL 
             AND brand_val != '' AND model_val != '' 
        THEN brand_val || '-' || model_val 
        ELSE NULL 
      END;
      
      INSERT INTO product (imei, brand, sku, date_in) 
      VALUES (imei_val, brand_val, sku_val, NOW());
      
      UPDATE data_queue 
      SET status = 'completed', processed_at = NOW(), updated_at = NOW() 
      WHERE id = queue_id;
      
      processed := 1;
      
    EXCEPTION WHEN OTHERS THEN
      UPDATE data_queue 
      SET status = 'failed', error_message = SQLERRM, updated_at = NOW() 
      WHERE id = queue_id;
      
      errors := 1;
    END;
  END IF;
  
  RETURN QUERY SELECT processed, errors;
END;
$$ LANGUAGE plpgsql;
