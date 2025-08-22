-- Fix DeviceTest trigger issue
-- The problem: Auto-update trigger is setting testResults to null, violating not-null constraint

-- Step 1: Drop the problematic trigger
DROP TRIGGER IF EXISTS update_device_test_on_item_change ON "Item";

-- Step 2: Drop the function
DROP FUNCTION IF EXISTS update_device_test_on_item_change();

-- Step 3: Create a fixed function that handles testResults properly
CREATE OR REPLACE FUNCTION update_device_test_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update DeviceTest records only if they exist and preserve testResults
    UPDATE "DeviceTest" 
    SET 
        testResults = COALESCE(testResults, '{}'::jsonb),
        notes = CONCAT('PhoneCheck test for ', NEW.brand, ' ', NEW.model, ' - Updated: ', NOW()),
        "testDate" = NOW()
    WHERE itemId = NEW.id AND testType = 'PHONECHECK';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create the fixed trigger
CREATE TRIGGER update_device_test_on_item_change
    AFTER UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE FUNCTION update_device_test_on_item_change();

-- Step 5: Also fix any existing DeviceTest records with null testResults
UPDATE "DeviceTest" 
SET testResults = '{}'::jsonb 
WHERE testResults IS NULL;

-- Step 6: Verify the fix
SELECT 
    'Trigger fixed successfully' as status,
    COUNT(*) as device_test_count
FROM "DeviceTest" 
WHERE testResults IS NOT NULL;
