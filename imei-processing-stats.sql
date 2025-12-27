-- IMEI Processing Statistics Query
-- Run this in Supabase SQL Editor to get IMEI processing statistics

-- ============================================
-- 1. SUMMARY: Total IMEIs Processed and Date Range
-- ============================================
SELECT 
  COUNT(*) as total_executions,
  SUM(devices_found) as total_devices_found,
  SUM(devices_processed) as total_devices_processed,
  SUM(devices_added) as total_devices_added,
  SUM(devices_failed) as total_devices_failed,
  MIN(date_from) as earliest_date,
  MAX(COALESCE(date_to, date_from)) as latest_date
FROM cron_job_execution
WHERE status = 'completed';

-- ============================================
-- 2. BY STATION: Breakdown by Station
-- ============================================
SELECT 
  unnest(stations) as station,
  COUNT(*) as executions,
  SUM(devices_found) as devices_found,
  SUM(devices_processed) as devices_processed,
  SUM(devices_added) as devices_added,
  SUM(devices_failed) as devices_failed,
  MIN(date_from) as earliest_date,
  MAX(COALESCE(date_to, date_from)) as latest_date
FROM cron_job_execution
WHERE status = 'completed'
GROUP BY unnest(stations)
ORDER BY devices_processed DESC;

-- ============================================
-- 3. STATION 8 SPECIFIC: Detailed Stats
-- ============================================
SELECT 
  id,
  workflow_type,
  trigger_source,
  status,
  stations,
  date_from,
  date_to,
  devices_found,
  devices_processed,
  devices_added,
  devices_failed,
  started_at,
  completed_at,
  duration_ms
FROM cron_job_execution
WHERE 'dncltz8' = ANY(stations)
  AND status = 'completed'
ORDER BY started_at DESC;

-- ============================================
-- 4. STATION 8 SUMMARY: Total for Station 8
-- ============================================
SELECT 
  COUNT(*) as total_executions,
  SUM(devices_found) as total_devices_found,
  SUM(devices_processed) as total_devices_processed,
  SUM(devices_added) as total_devices_added,
  SUM(devices_failed) as total_devices_failed,
  MIN(date_from) as earliest_date,
  MAX(COALESCE(date_to, date_from)) as latest_date
FROM cron_job_execution
WHERE 'dncltz8' = ANY(stations)
  AND status = 'completed';

-- ============================================
-- 5. DATE RANGE BREAKDOWN: By Date
-- ============================================
SELECT 
  date_from as processing_date,
  COUNT(*) as executions,
  SUM(devices_processed) as devices_processed,
  SUM(devices_added) as devices_added,
  SUM(devices_failed) as devices_failed
FROM cron_job_execution
WHERE status = 'completed'
  AND date_from IS NOT NULL
GROUP BY date_from
ORDER BY date_from DESC;

-- ============================================
-- 6. EXTRACT IMEIs FROM METADATA: For a specific execution
-- ============================================
-- Replace 39 with your execution ID
SELECT 
  id as execution_id,
  devices_processed,
  jsonb_array_length(metadata->'devices') as devices_in_metadata,
  jsonb_array_elements(metadata->'devices')->>'imei' as imei
FROM cron_job_execution
WHERE id = 39
  AND metadata IS NOT NULL
  AND metadata->'devices' IS NOT NULL;

-- ============================================
-- 7. UNIQUE IMEIs COUNT: From metadata across all executions
-- ============================================
SELECT 
  COUNT(DISTINCT imei_data.imei) as unique_imeis_in_metadata
FROM cron_job_execution,
  LATERAL jsonb_array_elements(metadata->'devices') AS imei_data(data)
WHERE metadata IS NOT NULL
  AND metadata->'devices' IS NOT NULL
  AND imei_data.data->>'imei' IS NOT NULL;

-- ============================================
-- 8. RECENT EXECUTIONS: Last 20 with details
-- ============================================
SELECT 
  id,
  workflow_type,
  stations,
  date_from,
  date_to,
  devices_found,
  devices_processed,
  devices_added,
  devices_failed,
  status,
  started_at,
  completed_at,
  CASE 
    WHEN date_from = date_to OR date_to IS NULL 
    THEN date_from::text
    ELSE date_from::text || ' to ' || date_to::text
  END as date_range
FROM cron_job_execution
ORDER BY started_at DESC NULLS LAST, created_at DESC
LIMIT 20;

