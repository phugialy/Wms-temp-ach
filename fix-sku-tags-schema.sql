-- Fix missing updated_at column in sku_tags table
DO $$ 
BEGIN 
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sku_tags' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE sku_tags ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updated_at column to sku_tags table';
    ELSE
        RAISE NOTICE 'updated_at column already exists in sku_tags table';
    END IF;
END $$;

-- Update existing records to have updated_at = created_at
UPDATE sku_tags 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Verify the fix
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'sku_tags' 
ORDER BY ordinal_position;

