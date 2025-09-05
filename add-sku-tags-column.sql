-- Add sku_tags column to sku_master table
DO $$ 
BEGIN 
    -- Add sku_tags column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sku_master' AND column_name = 'sku_tags'
    ) THEN
        ALTER TABLE sku_master ADD COLUMN sku_tags TEXT[];
        RAISE NOTICE 'Added sku_tags column to sku_master table';
    ELSE
        RAISE NOTICE 'sku_tags column already exists in sku_master table';
    END IF;
END $$;

-- Verify the change
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sku_master' AND column_name = 'sku_tags';

