-- Fix the queue processing function to handle constraints properly
CREATE OR REPLACE FUNCTION process_queue_manually()
RETURNS TABLE(processed INTEGER, errors INTEGER) AS $$
DECLARE
  queue_item RECORD;
  processed INTEGER := 0;
  errors INTEGER := 0;
BEGIN
  -- Process all pending items
  FOR queue_item IN
    SELECT * FROM data_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 100
  LOOP
    BEGIN
      -- Insert into product table (no unique constraint on imei, so no ON CONFLICT)
      INSERT INTO product (imei, brand, sku, created_at, updated_at)
      VALUES (
        queue_item.raw_data->>'imei',
        queue_item.raw_data->>'brand',
        queue_item.raw_data->>'brand' || '-' || queue_item.raw_data->>'model' || '-' || RIGHT(queue_item.raw_data->>'imei', 4),
        NOW(),
        NOW()
      );

      -- Insert into item table (no unique constraint on imei, so no ON CONFLICT)
      INSERT INTO item (
        imei, model, model_number, carrier, capacity, color,
        battery_health, battery_count, working, location,
        created_at, updated_at
      )
      VALUES (
        queue_item.raw_data->>'imei',
        queue_item.raw_data->>'model',
        COALESCE(queue_item.raw_data->>'serialNumber', queue_item.raw_data->>'serialnumber', queue_item.raw_data->>'model'),
        queue_item.raw_data->>'carrier',
        queue_item.raw_data->>'storage',
        queue_item.raw_data->>'color',
        COALESCE(queue_item.raw_data->>'batteryHealth', queue_item.raw_data->>'batteryhealth', queue_item.raw_data->>'BatteryHealthPercentage'),
        COALESCE((queue_item.raw_data->>'batteryCycleCount')::integer, (queue_item.raw_data->>'BatteryCycle')::integer, (queue_item.raw_data->>'bcc')::integer),
        queue_item.raw_data->>'working',
        COALESCE(queue_item.raw_data->>'location', 'INCOMING'),
        NOW(),
        NOW()
      );

      -- Insert into device_test table ONLY if working status is valid (not PENDING)
      -- This table HAS a unique constraint on imei, so we can use ON CONFLICT
      IF queue_item.raw_data->>'working' IS NOT NULL
         AND queue_item.raw_data->>'working' != 'PENDING'
         AND queue_item.raw_data->>'working' != '' THEN

        INSERT INTO device_test (imei, working, notes, tester, created_at)
        VALUES (
          queue_item.raw_data->>'imei',
          queue_item.raw_data->>'working',
          queue_item.raw_data->>'notes',
          COALESCE(queue_item.raw_data->>'TesterName', queue_item.raw_data->>'testerName'),
          NOW()
        )
        ON CONFLICT (imei) DO UPDATE SET
          working = EXCLUDED.working,
          notes = EXCLUDED.notes,
          tester = EXCLUDED.tester,
          created_at = NOW();
      END IF;

      -- Insert into sku_matching_queue for SKU matching
      -- This table HAS a unique constraint on imei, so we can use ON CONFLICT
      INSERT INTO sku_matching_queue (imei, status, created_at, updated_at)
      VALUES (queue_item.raw_data->>'imei', 'pending', NOW(), NOW())
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
