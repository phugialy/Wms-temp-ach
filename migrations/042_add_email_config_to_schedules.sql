-- Add email reporting configuration to cron_job_schedule table
-- This allows each schedule to have its own email recipients and notification preferences

-- Add email recipients column (array of email addresses)
ALTER TABLE cron_job_schedule
ADD COLUMN IF NOT EXISTS email_recipients TEXT[] DEFAULT '{}';

-- Add email on success flag
ALTER TABLE cron_job_schedule
ADD COLUMN IF NOT EXISTS email_on_success BOOLEAN DEFAULT true;

-- Add email on failure flag
ALTER TABLE cron_job_schedule
ADD COLUMN IF NOT EXISTS email_on_failure BOOLEAN DEFAULT true;

-- Add comments
COMMENT ON COLUMN cron_job_schedule.email_recipients IS 'Array of email addresses to receive execution reports for this schedule';
COMMENT ON COLUMN cron_job_schedule.email_on_success IS 'Whether to send email reports when execution succeeds';
COMMENT ON COLUMN cron_job_schedule.email_on_failure IS 'Whether to send email reports when execution fails';

