# Network Debugging Guide

## Issue: No API Calls Showing in Network Tab

After the changes, if you're not seeing API calls in the Network tab, here's how to debug:

## Step 1: Check Browser Console

Open DevTools (F12) → Console tab and look for:

### Expected Logs (if working):
```
[CronJobManagement] Component mounted
[CronJobManagement] ===== Starting data load =====
[CronJobManagement] Calling workflowService.getExecutionHistory()...
[WorkflowService] getExecutionHistory called with: { limit: 100, offset: 0 }
[ApiClient] GET /workflows/executions { params: { limit: 100, offset: 0 } }
[ApiClient] GET /workflows/executions - Response: { status: 200, data: {...} }
```

### If You See Errors:
- **Network errors**: Backend not running or CORS issue
- **404 errors**: Route not found - check backend routes
- **500 errors**: Backend error - check backend logs
- **No logs at all**: Component not mounting or JavaScript error

## Step 2: Check Network Tab

1. Open DevTools → Network tab
2. Clear network log (trash icon)
3. Click "Refresh" button on the page
4. Look for:
   - `GET /api/workflows/executions?limit=100&offset=0`
   - `GET /api/workflows/stats`

### If Requests Don't Appear:
- Check "Preserve log" checkbox
- Check filter - make sure "All" or "Fetch/XHR" is selected
- Check if requests are being blocked

### If Requests Show But Fail:
- Check Status column (should be 200)
- Click on request → Response tab to see error
- Check Headers tab for CORS issues

## Step 3: Verify Backend is Running

```bash
# Check if backend is running
# Should see: "🚀 WMS Backend server running on port 3001"
```

## Step 4: Test API Directly

Open browser console and run:

```javascript
// Test executions endpoint
fetch('/api/workflows/executions?limit=5')
  .then(r => {
    console.log('Status:', r.status);
    return r.json();
  })
  .then(data => {
    console.log('Data:', data);
  })
  .catch(err => {
    console.error('Error:', err);
  });

// Test stats endpoint
fetch('/api/workflows/stats')
  .then(r => {
    console.log('Status:', r.status);
    return r.json();
  })
  .then(data => {
    console.log('Data:', data);
  })
  .catch(err => {
    console.error('Error:', err);
  });
```

## Common Issues

### Issue 1: Loading State Stuck
**Symptom**: Refresh button always shows loading spinner
**Fix**: Check `finally` block sets `setLoading(false)`

### Issue 2: Duplicate Request Prevention
**Symptom**: Clicking refresh does nothing
**Fix**: The guard `if (loading) return;` might be blocking. Check console for "Load data already in progress" message.

### Issue 3: API Calls Not Made
**Symptom**: No network requests in Network tab
**Possible causes**:
- Component not mounting
- JavaScript error preventing execution
- API client not initialized

**Fix**: Check browser console for errors

### Issue 4: CORS Errors
**Symptom**: Network tab shows CORS error
**Fix**: Backend should have CORS enabled (already configured)

## Debugging Checklist

- [ ] Browser console shows component mounting logs
- [ ] Browser console shows API call logs
- [ ] Network tab shows API requests
- [ ] API requests return 200 status
- [ ] Response data has `success: true`
- [ ] No CORS errors
- [ ] No JavaScript errors
- [ ] Backend is running on port 3001
- [ ] Backend logs show incoming requests

## What the Logs Tell You

### If you see:
```
[CronJobManagement] Component mounted
[CronJobManagement] ===== Starting data load =====
```
✅ Component is mounting and calling loadData

### If you see:
```
[ApiClient] GET /workflows/executions
```
✅ API client is making the request

### If you see:
```
[ApiClient] GET /workflows/executions - Response: { status: 200 }
```
✅ Request succeeded

### If you see:
```
[ApiClient] GET /workflows/executions - Error: ...
```
❌ Request failed - check error details

### If you DON'T see any logs:
❌ Component might not be mounting or JavaScript error

## Next Steps

1. **Refresh the page** (hard refresh: Ctrl+Shift+R)
2. **Open browser console** and check for logs
3. **Open Network tab** and click Refresh button
4. **Check what requests are made**
5. **Share the console logs** if issues persist

The enhanced logging will help identify exactly where the issue is!



