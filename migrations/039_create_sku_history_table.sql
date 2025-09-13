-- Create SKU history table to track all SKU additions and modifications
CREATE TABLE IF NOT EXISTS sku_history (
    id SERIAL PRIMARY KEY,
    sku_code VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted'
    old_data JSONB, -- Previous data for updates/deletes
    new_data JSONB, -- New data for creates/updates
    changed_by VARCHAR(255), -- User or system identifier
    change_reason TEXT, -- Reason for the change
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_sku_history_sku_code ON sku_history(sku_code);
CREATE INDEX IF NOT EXISTS idx_sku_history_action ON sku_history(action);
CREATE INDEX IF NOT EXISTS idx_sku_history_created_at ON sku_history(created_at);
CREATE INDEX IF NOT EXISTS idx_sku_history_changed_by ON sku_history(changed_by);

-- Create a function to automatically log SKU changes
CREATE OR REPLACE FUNCTION log_sku_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO sku_history (sku_code, action, new_data, changed_by, change_reason)
        VALUES (
            NEW.sku_code,
            'created',
            to_jsonb(NEW),
            COALESCE(current_setting('app.current_user', true), 'system'),
            'SKU created via API'
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO sku_history (sku_code, action, old_data, new_data, changed_by, change_reason)
        VALUES (
            NEW.sku_code,
            'updated',
            to_jsonb(OLD),
            to_jsonb(NEW),
            COALESCE(current_setting('app.current_user', true), 'system'),
            'SKU updated via API'
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO sku_history (sku_code, action, old_data, changed_by, change_reason)
        VALUES (
            OLD.sku_code,
            'deleted',
            to_jsonb(OLD),
            COALESCE(current_setting('app.current_user', true), 'system'),
            'SKU deleted via API'
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically log changes
DROP TRIGGER IF EXISTS sku_history_trigger ON sku_master;
CREATE TRIGGER sku_history_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sku_master
    FOR EACH ROW EXECUTE FUNCTION log_sku_changes();

-- Add some sample data to show recent activity
INSERT INTO sku_history (sku_code, action, new_data, changed_by, change_reason, created_at)
SELECT 
    sku_code,
    'created',
    to_jsonb(sku_master.*),
    'system',
    'Existing SKU - migrated to history',
    created_at
FROM sku_master
WHERE created_at >= NOW() - INTERVAL '7 days'
ON CONFLICT DO NOTHING;
