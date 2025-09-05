-- Fix the trigger function to handle special characters in JSON field names
CREATE OR REPLACE FUNCTION process_data_queue_automatically()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to 'pending'
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status != 'pending') THEN
    
    -- Insert into product table
    INSERT INTO product (imei, brand, sku, created_at, updated_at)
    VALUES (
      NEW.raw_data->>'imei',
      NEW.raw_data->>'brand',
      NEW.raw_data->>'brand' || '-' || NEW.raw_data->>'model' || '-' || RIGHT(NEW.raw_data->>'imei', 4),
      NOW(),
      NOW()
    )
    ON CONFLICT (imei) DO UPDATE SET
      brand = EXCLUDED.brand,
      sku = EXCLUDED.sku,
      updated_at = NOW();
    
    -- Insert into item table
    INSERT INTO item (
      imei, model, model_number, carrier, capacity, color, 
      battery_health, battery_count, working, location, 
      created_at, updated_at
    )
    VALUES (
      NEW.raw_data->>'imei',
      NEW.raw_data->>'model',
      -- Fix: Use proper JSON field access for Model# field
      COALESCE(NEW.raw_data->'Model#'->>0, NEW.raw_data->>'serialNumber', NEW.raw_data->>'serialnumber', NEW.raw_data->>'model'),
      NEW.raw_data->>'carrier',
      NEW.raw_data->>'storage',
      NEW.raw_data->>'color',
      COALESCE(NEW.raw_data->>'batteryHealth', NEW.raw_data->>'batteryhealth', NEW.raw_data->>'BatteryHealthPercentage'),
      COALESCE((NEW.raw_data->>'batteryCycleCount')::integer, (NEW.raw_data->>'BatteryCycle')::integer, (NEW.raw_data->>'bcc')::integer),
      NEW.raw_data->>'working',
      COALESCE(NEW.raw_data->>'location', 'INCOMING'),
      NOW(),
      NOW()
    )
    ON CONFLICT (imei) DO UPDATE SET
      model = EXCLUDED.model,
      model_number = EXCLUDED.model_number,
      carrier = EXCLUDED.carrier,
      capacity = EXCLUDED.capacity,
      color = EXCLUDED.color,
      battery_health = EXCLUDED.battery_health,
      battery_count = EXCLUDED.battery_count,
      working = EXCLUDED.working,
      location = EXCLUDED.location,
      updated_at = NOW();
    
    -- Insert into device_test table ONLY if working status is valid (not PENDING)
    IF NEW.raw_data->>'working' IS NOT NULL 
       AND NEW.raw_data->>'working' != 'PENDING' 
       AND NEW.raw_data->>'working' != '' THEN
      
      INSERT INTO device_test (imei, working, notes, tester, created_at)
      VALUES (
        NEW.raw_data->>'imei',
        NEW.raw_data->>'working',
        NEW.raw_data->>'notes',
        COALESCE(NEW.raw_data->>'TesterName', NEW.raw_data->>'testerName'),
        NOW()
      )
      ON CONFLICT (imei) DO UPDATE SET
        working = EXCLUDED.working,
        notes = EXCLUDED.notes,
        tester = EXCLUDED.tester,
        created_at = NOW();
    END IF;
    
    -- Mark as completed
    UPDATE data_queue 
    SET status = 'completed', processed_at = NOW(), updated_at = NOW()
    WHERE id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


