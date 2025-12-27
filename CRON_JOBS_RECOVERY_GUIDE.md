# Cron Jobs Recovery Guide

## ✅ Good News: Your Cron Jobs Are NOT Deleted!

Your cron job schedules are still in the database. Here's what exists:

### Current Cron Job Schedules (6 active):
1. **ID 7**: "DNCL-RETURN 3" - Weekly schedule
2. **ID 6**: "DNCL-DAILY Inspect- Station 10" - Daily schedule
3. **ID 5**: "DNCL-DAILY Inspect- Station 9" - Daily schedule
4. **ID 4**: "DNCL-DAILY Inspect- Station 8" - Daily schedule
5. **ID 3**: "DNCL-DAILY Inspect- Station 4" - Daily schedule
6. **ID 1**: "Daily-Return-1" - Weekly schedule

### Execution History:
- **39 total executions** recorded
- All executions are linked to their schedules
- Recent executions from December 25-27, 2025

## Why They Might Not Be Visible

If you're not seeing them in the UI, it could be:

1. **Frontend Loading Issue**: The schedules might not be loading from the API
2. **Filter Applied**: A filter might be hiding them
3. **Wrong Page**: You might be on a different view
4. **Browser Cache**: Old cached data might be showing

## How to Verify & Restore Visibility

### Option 1: Check the Cron Job Management Page

1. Navigate to **Cron Job Management** page in your app
2. Look for the "Schedules" tab or section
3. Check if there are any filters applied (Active/Inactive, etc.)
4. Try refreshing the page (Ctrl+F5 or Cmd+Shift+R)

### Option 2: Verify via API

You can test the API endpoint directly:

```bash
# Test the schedules endpoint
curl http://localhost:3000/api/workflows/schedules
```

Or open in browser:
```
http://localhost:3000/api/workflows/schedules
```

### Option 3: Check Database Directly

If you have database access, run:

```sql
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
  total_runs
FROM cron_job_schedule 
ORDER BY id DESC;
```

### Option 4: Restart the Application

Sometimes the cron schedule service needs to reload:

1. Stop your backend server
2. Restart it
3. The `CronScheduleService` should automatically load all active schedules on startup

## If Schedules Are Still Missing from UI

### Check Browser Console

1. Open Developer Tools (F12)
2. Go to Console tab
3. Look for errors when loading the Cron Job Management page
4. Check Network tab for failed API calls to `/api/workflows/schedules`

### Verify API Endpoint

The endpoint should be registered in `src/index.ts`:

```typescript
app.use('/api/workflows/schedules', cronScheduleRoutes);
```

## Manual Recovery (If Needed)

If for some reason schedules were accidentally deleted (which doesn't appear to be the case), you can recreate them using the existing data:

### Example: Recreate a Schedule

Based on your existing schedule ID 6:

```sql
-- This is just for reference - your schedules already exist!
-- Only use this if you need to recreate a deleted schedule

INSERT INTO cron_job_schedule (
  name,
  workflow_type,
  stations,
  location,
  date_range_days,
  schedule_time,
  timezone,
  frequency,
  weekly_days,
  is_active
) VALUES (
  'DNCL-DAILY Inspect- Station 10',
  'bulk-add',
  ARRAY['dncltz10'],
  'DNCL-Inspection',
  1,
  '19:00',
  'UTC',
  'daily',
  ARRAY[]::integer[],
  true
);
```

## Prevention

To prevent accidental deletion:

1. **Add Confirmation Dialogs**: The UI already has delete confirmations
2. **Backup Before Deletion**: Consider adding a backup feature
3. **Soft Delete**: Instead of hard delete, mark as `is_active = false`

## Current Status Summary

✅ **6 Schedules Active**  
✅ **39 Executions Recorded**  
✅ **All Linked Properly**  
✅ **Recent Runs Successful**

Your cron jobs are safe and running! If you're not seeing them in the UI, it's likely a display/loading issue, not a data loss issue.

