-- Create email_report_subscription table for subscription-based email reporting
-- This allows users to subscribe to email reports for specific cron jobs with flexible delivery options

CREATE TABLE IF NOT EXISTS email_report_subscription (
  id BIGSERIAL PRIMARY KEY,
  
  -- Subscription Info
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Which Cron Jobs to Monitor
  schedule_ids BIGINT[] DEFAULT '{}', -- Array of schedule IDs (empty = all schedules)
  location_filter VARCHAR(100), -- Optional: filter by location
  
  -- Recipients (Array Format - Multiple Email Addresses)
  email_recipients TEXT[] NOT NULL DEFAULT '{}', -- Array of email addresses
  
  -- Delivery Schedule
  delivery_mode VARCHAR(20) NOT NULL DEFAULT 'immediate', -- 'immediate' | 'scheduled'
  schedule_time TIME, -- When to send (for scheduled: e.g., '08:00:00')
  schedule_frequency VARCHAR(20), -- 'daily' | 'weekly' | 'monthly'
  schedule_days INTEGER[] DEFAULT '{}', -- For weekly: [1,2,3] = Mon, Tue, Wed
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Email Preferences
  email_on_success BOOLEAN DEFAULT true,
  email_on_failure BOOLEAN DEFAULT true,
  summary_only BOOLEAN DEFAULT false, -- Only send summary, skip individual execution details
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by VARCHAR(100),
  last_sent_at TIMESTAMPTZ -- Track when last email was sent
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_subscription_active 
  ON email_report_subscription(is_active, delivery_mode);

CREATE INDEX IF NOT EXISTS idx_email_subscription_schedules 
  ON email_report_subscription USING GIN(schedule_ids);

CREATE INDEX IF NOT EXISTS idx_email_subscription_scheduled_time 
  ON email_report_subscription(delivery_mode, schedule_time) 
  WHERE delivery_mode = 'scheduled';

-- Comments
COMMENT ON TABLE email_report_subscription IS 'Email report subscriptions - allows users to subscribe to email reports for specific cron jobs';
COMMENT ON COLUMN email_report_subscription.schedule_ids IS 'Array of schedule IDs to monitor (empty array = all schedules)';
COMMENT ON COLUMN email_report_subscription.email_recipients IS 'Array of email addresses to receive reports';
COMMENT ON COLUMN email_report_subscription.delivery_mode IS 'Delivery mode: immediate (after each execution) or scheduled (at specified time)';
COMMENT ON COLUMN email_report_subscription.summary_only IS 'If true, only send aggregated summary, not individual execution details';


