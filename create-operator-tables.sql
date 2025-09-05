-- ========================================
-- PHASE 1D: OPERATOR ACTION TABLES
-- ========================================
-- These tables support the multi-role operator interface

-- Drop existing tables if they exist
DROP TABLE IF EXISTS operator_actions CASCADE;
DROP TABLE IF EXISTS location_transitions CASCADE;

-- Create operator actions log table
CREATE TABLE operator_actions (
    id BIGSERIAL PRIMARY KEY,
    imei VARCHAR(15) NOT NULL,
    operator_role VARCHAR(50) NOT NULL CHECK (operator_role IN ('SHIPPING', 'POSTFIX', 'REPAIR', 'INSPECTOR', 'ADMIN')),
    action_type VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    location VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create location transitions table
CREATE TABLE location_transitions (
    id BIGSERIAL PRIMARY KEY,
    imei VARCHAR(15) NOT NULL,
    from_location VARCHAR(100),
    to_location VARCHAR(100) NOT NULL,
    transition_reason VARCHAR(100),
    operator VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_operator_actions_imei ON operator_actions(imei);
CREATE INDEX idx_operator_actions_role ON operator_actions(operator_role);
CREATE INDEX idx_operator_actions_created_at ON operator_actions(created_at);
CREATE INDEX idx_location_transitions_imei ON location_transitions(imei);
CREATE INDEX idx_location_transitions_created_at ON location_transitions(created_at);

-- Add foreign key constraints
ALTER TABLE operator_actions 
ADD CONSTRAINT fk_operator_actions_imei 
FOREIGN KEY (imei) REFERENCES product(imei) ON DELETE CASCADE;

ALTER TABLE location_transitions 
ADD CONSTRAINT fk_location_transitions_imei 
FOREIGN KEY (imei) REFERENCES product(imei) ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE operator_actions IS 'Log of all operator actions for audit and tracking';
COMMENT ON TABLE location_transitions IS 'History of device location changes';
COMMENT ON COLUMN operator_actions.operator_role IS 'Role of operator: SHIPPING, POSTFIX, REPAIR, INSPECTOR, ADMIN';
COMMENT ON COLUMN operator_actions.action_type IS 'Type of action performed';
COMMENT ON COLUMN operator_actions.old_value IS 'Previous values (JSON)';
COMMENT ON COLUMN operator_actions.new_value IS 'New values (JSON)';

-- Insert some test data to verify tables work
INSERT INTO operator_actions (imei, operator_role, action_type, new_value, notes) 
VALUES 
    ('352707358605214', 'SHIPPING', 'QUICK_PICKUP', '{"new_location": "SHIPOUT"}', 'Test shipping pickup'),
    ('356317536605163', 'POSTFIX', 'GRADE_UPDATE', '{"grade": "A", "new_sku": "FOLD3-512-BLK-UL"}', 'Test postfix update');

-- Verify table creation
SELECT 
    'Operator tables created successfully' as status,
    (SELECT COUNT(*) FROM operator_actions) as operator_actions_count,
    (SELECT COUNT(*) FROM location_transitions) as location_transitions_count;

