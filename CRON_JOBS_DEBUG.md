# Cron Jobs Page Debugging Guide

## Issue
The Cron Jobs Management page shows "No data" and appears stuck.

## Fixes Applied

### 1. API Proxy Query Parameter Fix
**File:** `frontend/scripts/turbopack-dev.js`

**Problem:** The dev server proxy was stripping query parameters from API requests. When the frontend called `/api/workflows/executions?limit=100&offset=0`, only `/api/workflows/executions` was being forwarded to the backend.

**Fix:** Changed line 164 from `path: url` to `path: fullUrl` to preserve query parameters.

## Debugging Steps

### 1. Verify Backend is Running
```bash
# Check if backend is running on port 3001
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "...",
  "environment": "..."
}
```

### 2. Test API Endpoints Directly

#### Test Executions Endpoint
```bash
curl "http://localhost:3001/api/workflows/executions?limit=10&offset=0"
```

Expected response:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 0
  }
}
```

#### Test Stats Endpoint
```bash
curl http://localhost:3001/api/workflows/stats
```

Expected response:
```json
{
  "success": true,
  "data": {
    "total": 0,
    "completed": 0,
    "failed": 0,
    "running": 0,
    "pending": 0,
    "averages": {
      "devicesFound": 0,
      "devicesAdded": 0,
      "durationMs": 0
    }
  }
}
```

### 3. Check Browser Console

Open the browser DevTools (F12) and check:
1. **Console tab** - Look for error messages
2. **Network tab** - Check if API requests are being made and their status

Look for:
- `[WorkflowService]` logs
- `[ApiClient]` logs
- `[CronJobManagement]` logs
- Any 404, 500, or network errors

### 4. Verify Database Has Data

If the API returns empty arrays, it might be that there are no cron job executions in the database yet. This is normal if:
- No workflows have been executed yet
- The database was recently reset
- Cron jobs haven't run yet

To create a test execution, use the "Manual Trigger" button on the page.

### 5. Check Proxy Logs

The dev server should show proxy requests in the terminal. Look for:
- Successful proxy requests
- Proxy errors (502 Bad Gateway)
- Connection refused errors

## Common Issues

### Backend Not Running
**Symptom:** 502 Bad Gateway or "Backend server not available" errors

**Solution:** Start the backend server:
```bash
cd <project-root>
npm run dev
# or
pnpm dev
```

### CORS Issues
**Symptom:** CORS errors in browser console

**Solution:** The backend should have CORS enabled. Check `src/index.ts` line 55.

### Database Connection Issues
**Symptom:** 500 errors from backend, database connection errors in backend logs

**Solution:** 
1. Check database is running
2. Verify `.env` has correct `DATABASE_URL`
3. Run migrations: `npx prisma migrate dev`

### Empty Database
**Symptom:** API returns `{ success: true, data: [] }` with empty array

**Solution:** This is normal if no executions exist. Use "Manual Trigger" to create a test execution.

## Next Steps

1. **Restart the dev server** to apply the query parameter fix:
   ```bash
   cd frontend
   pnpm dev
   ```

2. **Check browser console** for detailed logs

3. **Test the API endpoints** directly using curl

4. **Verify backend is running** on port 3001

5. **Check database** for existing cron job executions

## Expected Behavior

After the fix:
- API requests should include query parameters
- The page should load data (or show empty state if no data exists)
- Console should show successful API calls
- Network tab should show 200 OK responses


