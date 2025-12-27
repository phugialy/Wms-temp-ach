-- Quick Verification Script for Cron Jobs
-- Run this in your Supabase SQL Editor or database client

-- 1. Check all cron job schedules
SELECT 
  id,
  name,
  workflow_type,
  stations,
  location,
  schedule_time,
  frequency,
  is_active,
  last_run_at,
  next_run_at,
  total_runs,
  successful_runs,
  failed_runs,
  created_at
FROM cron_job_schedule 
ORDER BY id DESC;

-- 2. Count total schedules
SELECT COUNT(*) as total_schedules FROM cron_job_schedule;

-- 3. Count active vs inactive
SELECT 
  is_active,
  COUNT(*) as count
FROM cron_job_schedule
GROUP BY is_active;

-- 4. Recent executions
SELECT 
  id,
  workflow_type,
  trigger_source,
  status,
  schedule_id,
  devices_found,
  devices_added,
  devices_failed,
  started_at,
  completed_at
FROM cron_job_execution
ORDER BY created_at DESC
LIMIT 20;

-- 5. Executions per schedule
SELECT 
  s.id as schedule_id,
  s.name as schedule_name,
  COUNT(e.id) as execution_count,
  MAX(e.started_at) as last_execution
FROM cron_job_schedule s
LEFT JOIN cron_job_execution e ON e.schedule_id = s.id
GROUP BY s.id, s.name
ORDER BY s.id DESC;

