-- Create cron_job_schedule table for managing scheduled cron jobs
CREATE TABLE IF NOT EXISTS cron_job_schedule (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  workflow_type VARCHAR(50) NOT NULL DEFAULT 'bulk-add',
  
  -- Workflow parameters (pre-set)
  stations TEXT[] NOT NULL,
  location VARCHAR(100) NOT NULL,
  date_range_days INTEGER NOT NULL DEFAULT 1,
  
  -- Schedule configuration
  schedule_time VARCHAR(10) NOT NULL, -- HH:mm format
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly'
  weekly_days INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  cron_expression VARCHAR(100),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  description TEXT,
  last_run_at TIMESTAMPTZ(6),
  next_run_at TIMESTAMPTZ(6),
  total_runs INTEGER NOT NULL DEFAULT 0,
  successful_runs INTEGER NOT NULL DEFAULT 0,
  failed_runs INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  created_by VARCHAR(100)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cron_schedule_active ON cron_job_schedule(is_active);
CREATE INDEX IF NOT EXISTS idx_cron_schedule_frequency ON cron_job_schedule(frequency);
CREATE INDEX IF NOT EXISTS idx_cron_schedule_next_run ON cron_job_schedule(next_run_at);

-- Add comment
COMMENT ON TABLE cron_job_schedule IS 'Stores scheduled cron job configurations for automated workflow execution';



