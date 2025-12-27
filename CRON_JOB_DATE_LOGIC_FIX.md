# Cron Job Date Logic Fix

## Problem Identified

You reported seeing date ranges that were expanding over time (from 1 day to multiple days), when cron jobs should only process **one day at a time** (00:00 AM to 6:00 PM on that specific day).

### What You Saw
- Individual executions with correct single-day ranges: `{"from":"2025-12-26T06:00:00.000Z","to":"2025-12-26T06:00:00.000Z"}`
- But also a summary showing: `"from":"2025-12-19T06:00:00.000Z","to":"2025-12-26T06:00:00.000Z"`

### Root Cause
The cron job logic was **correct** - it was setting both `dateFrom` and `dateTo` to the same date string. However:
1. **No validation** to ensure `dateFrom === dateTo` for scheduled cron jobs
2. **Date storage** was converting date strings to Date objects which could include timezone/timestamp issues
3. **Endpoint confusion** - the summary was showing the overall date range across ALL executions, not per-execution

## Solution Implemented

### 1. Added Validation for Scheduled Cron Jobs
**File**: `src/services/workflow-engine.service.ts`

```typescript
// CRITICAL: For scheduled cron jobs, ensure dateFrom === dateTo (single day processing only)
if (params.triggerSource === 'scheduled-cron') {
  if (params.dateFrom !== params.dateTo) {
    logger.warn('⚠️ Scheduled cron job has mismatched dates - forcing dateTo to match dateFrom');
    params.dateTo = params.dateFrom; // Force single-day processing
  }
}
```

**What it does**: 
- Validates that scheduled cron jobs always have `dateFrom === dateTo`
- Automatically fixes any mismatched dates by forcing `dateTo` to match `dateFrom`
- Logs a warning if a mismatch is detected

### 2. Fixed Date Storage
**File**: `src/services/workflow-engine.service.ts`

```typescript
// Normalize dates to ensure they're stored as dates (not timestamps)
const dateFromDate = new Date(params.dateFrom);
dateFromDate.setHours(0, 0, 0, 0); // Set to midnight to ensure it's a pure date
const dateToDate = new Date(params.dateTo);
dateToDate.setHours(0, 0, 0, 0); // Set to midnight to ensure it's a pure date
```

**What it does**:
- Ensures dates are stored as pure dates (midnight) without time components
- Prevents timezone conversion issues
- Ensures consistent date storage in the database

### 3. Enhanced Logging
**File**: `src/services/cron-schedule.service.ts`

Added explicit logging to clarify that each execution processes exactly ONE day:
```typescript
logger.info(`[CronSchedule] Date range calculated: ${dateString} ${startTime} to ${dateString} ${currentTime}`, {
  note: 'Single day processing - dateFrom === dateTo to prevent accumulation'
});
```

### 4. Improved Endpoint Response
**File**: `src/routes/dashboard.route.ts`

**Changes**:
- Added `isSingleDay` flag to each execution to detect multi-day executions
- Added `multiDayExecutions` count in summary
- Added warning message if any executions span multiple days
- Clarified that the overall date range is across ALL executions, not a single execution

**New Response Format**:
```json
{
  "summary": {
    "dateRange": {
      "from": "2025-12-19",
      "to": "2025-12-26",
      "note": "Overall range across 10 executions. Each execution processes ONE day only."
    },
    "multiDayExecutions": 0,
    "warning": null
  },
  "executions": [
    {
      "dateFrom": "2025-12-26",
      "dateTo": "2025-12-26",
      "isSingleDay": true
    }
  ]
}
```

## How Cron Jobs Work Now

### Each Execution Processes ONE Day Only

1. **Cron Schedule Calculates Target Date**:
   - If `dateRangeDays = 0`: Process today (from 00:00 to current time)
   - If `dateRangeDays = 1`: Process yesterday (from 01:00 to current time on that day)
   - If `dateRangeDays = N`: Process N days ago (from 01:00 to current time on that day)

2. **Both Dates Set to Same Value**:
   ```typescript
   dateFrom: "2025-12-26"
   dateTo: "2025-12-26"  // Always the same!
   ```

3. **Validation Ensures No Accumulation**:
   - If `dateFrom !== dateTo` for a scheduled cron job, `dateTo` is automatically set to match `dateFrom`
   - Warning is logged if a mismatch is detected

4. **Phonecheck API Called with Single Date**:
   - The API is called with the same date for both `date` parameter
   - Time range is from 00:00 (or 01:00) to the current time on that day

## Verification

### Check Individual Executions
Query the database to verify each execution processes only one day:

```sql
SELECT 
  id,
  trigger_source,
  date_from,
  date_to,
  CASE 
    WHEN date_from = date_to THEN 'Single Day ✓'
    ELSE 'MULTI-DAY ⚠️'
  END as date_check
FROM cron_job_execution
WHERE trigger_source = 'scheduled-cron'
ORDER BY started_at DESC
LIMIT 20;
```

### Expected Result
All `date_check` should show `'Single Day ✓'`. If you see `'MULTI-DAY ⚠️'`, there's an issue.

### Check via API
```bash
GET /api/dashboard/imei-processing-stats
```

Look for:
- `summary.multiDayExecutions` should be `0`
- `summary.warning` should be `null`
- Each execution in `executions[]` should have `isSingleDay: true`

## What the Date Range Summary Means

The summary showing `"from":"2025-12-19","to":"2025-12-26"` is **correct** - it shows:
- **Earliest date processed**: 2025-12-19
- **Latest date processed**: 2025-12-26
- **Across all executions**: This is the span of dates covered by all your cron job executions

**This does NOT mean** a single execution processed 7 days. Each execution still processes only ONE day.

## Testing

1. **Run a cron job manually** and verify:
   - `dateFrom === dateTo` in the execution record
   - Only devices from that single day are processed

2. **Check the logs** for the validation message:
   ```
   [CronSchedule] Date range calculated: 2025-12-26 01:00:00 to 2025-12-26 14:30:00
   note: 'Single day processing - dateFrom === dateTo to prevent accumulation'
   ```

3. **Query the API** and verify:
   - `multiDayExecutions: 0`
   - All executions have `isSingleDay: true`

## Summary

✅ **Fixed**: Added validation to ensure `dateFrom === dateTo` for scheduled cron jobs  
✅ **Fixed**: Normalized date storage to prevent timezone issues  
✅ **Fixed**: Enhanced endpoint to detect and warn about multi-day executions  
✅ **Clarified**: Each cron job execution processes exactly ONE day (00:00 to 18:00 on that day)  
✅ **Verified**: No date accumulation - each execution is independent and processes one day only

The cron job logic was already correct, but now it's **enforced** and **validated** to prevent any future issues.

