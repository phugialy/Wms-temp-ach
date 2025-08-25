-- ========================================
-- ADD ERROR MESSAGE COLUMN TO QUEUE TABLE
-- ========================================

-- Add error_message column to imei_data_queue table
ALTER TABLE imei_data_queue 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN imei_data_queue.error_message IS 'Stores error messages when queue processing fails';
