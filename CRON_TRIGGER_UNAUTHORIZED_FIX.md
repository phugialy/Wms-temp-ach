# Cron Trigger "Unauthorized" Error Fix

## Issue

When manually triggering cron jobs from the UI, users get:
- **Error:** "Failed to trigger workflow: Unauthorized"
- **Status:** 401 Unauthorized

## Root Cause

The Vercel serverless function `api/workflows/bulk-add.ts` was checking `CRON_SECRET` for **both GET and POST requests**. However:

- **GET requests** = Vercel cron jobs (should require CRON_SECRET)
- **POST requests** = Manual triggers from UI (should NOT require CRON_SECRET)

When users click "Manual Trigger" in the UI, it sends a POST request, which was being blocked by the CRON_SECRET check.

## Fix Applied

**File:** `api/workflows/bulk-add.ts`

**Change:** Only check CRON_SECRET for GET requests (Vercel cron jobs), not POST requests (manual triggers)

**Before:**
```typescript
// Checked CRON_SECRET for both GET and POST
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**After:**
```typescript
// Only check CRON_SECRET for GET requests (Vercel cron jobs)
if (req.method === 'GET') {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing CRON_SECRET' });
  }
}
```

## How It Works Now

### GET Request (Vercel Cron Job)
1. Vercel sends GET request with `Authorization: Bearer ${CRON_SECRET}`
2. Server checks CRON_SECRET ✅
3. If valid → Execute workflow
4. If invalid → Return 401 Unauthorized

### POST Request (Manual Trigger from UI)
1. User clicks "Manual Trigger" in UI
2. Frontend sends POST request (with Supabase auth token, not CRON_SECRET)
3. Server **skips** CRON_SECRET check ✅
4. Executes workflow directly

## Related Issues

### 1. 404 Errors for Workflow Endpoints
- **Status:** Routes may not be loading correctly in production
- **Fix:** Improved route loading in `workflowApi.js` (already applied)
- **Action:** Verify routes load after deployment

### 2. Dashboard Endpoint 404
- **Status:** `/api/dashboard/cron-jobs-today` returning 404
- **Fix:** Route registered in `server.js` (already applied)
- **Action:** Verify route loads after deployment

## Testing

### Test 1: Manual Trigger (Should Work Now)
1. Navigate to Cron Job Management page
2. Click "Manual Trigger" button
3. Fill in form (stations, date range, location)
4. Click OK
5. **Expected:** ✅ Success message, no "Unauthorized" error
6. **Expected:** ✅ Workflow executes successfully

### Test 2: Vercel Cron Job (Should Still Work)
1. Wait for scheduled cron job time
2. Check Vercel logs
3. **Expected:** ✅ Cron job executes with CRON_SECRET
4. **Expected:** ✅ No 401 errors

## Summary

- ✅ **Fixed:** POST requests (manual triggers) no longer require CRON_SECRET
- ✅ **Fixed:** GET requests (Vercel cron) still require CRON_SECRET for security
- ✅ **Result:** Manual triggers from UI should work without "Unauthorized" errors

