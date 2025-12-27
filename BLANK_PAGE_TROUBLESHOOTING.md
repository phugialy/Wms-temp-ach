# Blank Page Troubleshooting Guide

## Issue
Blank page at `localhost:3001/cron-jobs` - React app loads but doesn't render.

## What I Fixed

### 1. Added Error Handling
- ✅ Added error state to display errors to user
- ✅ Added early return if critical error occurs
- ✅ Added console logging for debugging
- ✅ Better error messages for API failures

### 2. Rebuilt Frontend
- ✅ Fresh build with SWC (Rust)
- ✅ Generated new `index.html` with correct asset references
- ✅ Output: `dist/assets/main-LLEPBN63.js`

## Next Steps to Debug

### Step 1: Check Browser Console
Open browser DevTools (F12) and check the Console tab for errors:

1. **JavaScript Errors**: Look for red error messages
2. **Network Errors**: Check Network tab for failed API calls
3. **React Errors**: Look for React component errors

### Step 2: Verify Backend is Running
```bash
# Check if backend is running on port 3001
curl http://localhost:3001/api/health
```

Should return:
```json
{
  "status": "OK",
  "timestamp": "...",
  "message": "WMS API Server is running"
}
```

### Step 3: Check API Endpoints
Test the workflow endpoints:

```bash
# Test executions endpoint
curl http://localhost:3001/api/workflows/executions?limit=10

# Test stats endpoint
curl http://localhost:3001/api/workflows/stats
```

### Step 4: Check Browser Network Tab
1. Open DevTools → Network tab
2. Refresh the page
3. Look for:
   - Failed requests (red)
   - 404 errors
   - CORS errors
   - Timeout errors

### Step 5: Check Component Logs
The component now logs to console:
- `[CronJobManagement] Component mounted`
- `[CronJobManagement] Loading data...`
- `[CronJobManagement] Loaded X executions`

If you don't see these logs, the component isn't mounting.

## Common Issues

### Issue 1: API Calls Failing
**Symptoms**: Blank page, no console errors
**Check**: Network tab for failed `/api/workflows/*` requests
**Fix**: Ensure backend is running and accessible

### Issue 2: CORS Errors
**Symptoms**: Console shows CORS errors
**Fix**: Backend should have CORS enabled (already configured)

### Issue 3: Component Not Mounting
**Symptoms**: No console logs from component
**Check**: 
- Browser console for React errors
- Check if `main.js` is loading correctly
- Check if React Router is working

### Issue 4: Route Not Matching
**Symptoms**: Page loads but component doesn't render
**Check**: 
- URL is exactly `/cron-jobs` (not `/cron-jobs/`)
- React Router is configured correctly

## Quick Fixes

### Fix 1: Rebuild Frontend
```bash
cd frontend
pnpm build
```

### Fix 2: Restart Backend
```bash
# Stop backend (Ctrl+C)
# Restart backend
pnpm dev
```

### Fix 3: Clear Browser Cache
- Press `Ctrl+Shift+R` (hard refresh)
- Or clear browser cache completely

### Fix 4: Check Backend Routes
Verify backend has workflow routes:
```bash
# Check if route exists
curl http://localhost:3001/api/workflows/executions
```

## Debugging Checklist

- [ ] Backend is running on port 3001
- [ ] Frontend build exists in `frontend/dist/`
- [ ] Browser console shows no errors
- [ ] Network tab shows API calls succeeding
- [ ] Component logs appear in console
- [ ] React Router is working (try navigating to `/`)
- [ ] No CORS errors
- [ ] No 404 errors for assets

## What to Report

If still blank, provide:
1. **Browser console errors** (copy all red errors)
2. **Network tab failures** (screenshot or list)
3. **Backend logs** (any errors when accessing `/cron-jobs`)
4. **Component logs** (do you see `[CronJobManagement]` logs?)

## Expected Behavior

After fixes, you should see:
1. Page loads with "Cron Job Management" heading
2. Statistics cards showing execution counts
3. Table showing execution history
4. Console logs showing data loading
5. No errors in browser console

## Updated Component Features

The component now has:
- ✅ Error state display (shows errors to user)
- ✅ Console logging (for debugging)
- ✅ Better error messages
- ✅ Graceful failure handling
- ✅ Early return on critical errors

Try refreshing the page and check the browser console for the new logs!



