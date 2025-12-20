-- Add schedule_id column to cron_job_execution table to link executions to schedules
ALTER TABLE cron_job_execution 
ADD COLUMN IF NOT EXISTS schedule_id BIGINT;

-- Add foreign key constraint
ALTER TABLE cron_job_execution
ADD CONSTRAINT fk_cron_job_execution_schedule 
FOREIGN KEY (schedule_id) 
REFERENCES cron_job_schedule(id) 
ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_cron_job_schedule_id ON cron_job_execution(schedule_id);

-- Add comment
COMMENT ON COLUMN cron_job_execution.schedule_id IS 'Reference to the cron schedule that triggered this execution (null for manual triggers)';


