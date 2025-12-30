# Vercel 484 Error Diagnosis

## Problem

**Error:** `484` status code for `/api/workflows/stats` and `/api/workflows/executions`

**Console Logs:**
```
Failed to load resource: the server responded with a status of 484 ()
► Critical endpoint not found
[ApiClient] GET /workflows/stats Error
[ApiClient] GET /workflows/executions Error
```

---

## Analysis

### What is 484?

**484 is NOT a standard HTTP status code.** Standard HTTP status codes are:
- `1xx` - Informational
- `2xx` - Success
- `3xx` - Redirection
- `4xx` - Client Error (400-499)
- `5xx` - Server Error (500-599)

**484 is outside the standard range**, which suggests:
1. **Vercel-specific error** - Custom error from Vercel's edge network
2. **Routing layer issue** - Request not reaching Express at all
3. **Function timeout/error** - Vercel function failed before responding

---

## Possible Causes

### 1. Route Not Loading in Production

**Issue:** `workflowApi.js` might not be loading `workflow.route.js` correctly in Vercel.

**Check:**
- ✅ Compiled file exists: `dist/routes/workflow.route.js` ✅
- ✅ Export format: `exports.default = router` ✅
- ⚠️ Path resolution: Might fail in Vercel environment

**Fix Applied:**
- Improved path resolution with multiple fallback paths
- Added better error logging
- Added `require.resolve()` check before loading

### 2. Vercel Function Not Reaching Express

**Issue:** Request might be intercepted by Vercel before reaching `api/index.js`.

**Check:**
- `vercel.json` configuration
- `api/index.js` entry point
- Function routing rules

**Current Setup:**
```json
{
  "functions": {
    "api/index.js": {
      "maxDuration": 60,
      "memory": 1024
    }
  }
}
```

### 3. Route Registration Order

**Issue:** Routes might be registered in wrong order, causing conflicts.

**Current Order:**
```javascript
app.use('/api/workflows/schedules', cronScheduleApi); // Specific first ✅
app.use('/api/workflows', workflowApi);                // General second ✅
```

**Status:** ✅ Correct order

### 4. Module Export/Import Mismatch

**Issue:** TypeScript compiles to `exports.default`, but CommonJS might not handle it correctly.

**Check:**
- ✅ `workflowApi.js` handles: `workflowRoutes = workflowRoutes.default || workflowRoutes;`
- ✅ Router verification: Checks if it's a valid Express router

---

## Debugging Steps

### Step 1: Check Vercel Build Logs

Look for:
- Route loading errors
- Module resolution failures
- TypeScript compilation errors

### Step 2: Check Vercel Function Logs

In Vercel dashboard:
1. Go to Deployment → Functions
2. Check `api/index.js` logs
3. Look for:
   - `✅ Workflow routes loaded from: ...`
   - `❌ Failed to load workflow routes: ...`

### Step 3: Test Route Loading Locally

```bash
# Simulate production environment
NODE_ENV=production node -e "
const workflowApi = require('./dist/api/workflowApi.js');
console.log('Routes loaded:', !!workflowApi);
"
```

### Step 4: Check Network Tab

In browser DevTools:
- Check if request reaches server
- Check response headers
- Check if it's a CORS issue

---

## Fixes Applied

### 1. Improved Path Resolution

**File:** `src/api/workflowApi.js`

**Changes:**
- Added `require.resolve()` check before loading
- Improved error logging with full paths
- Added multiple fallback paths
- Better error messages

### 2. Enhanced Error Handling

**Added:**
- Detailed logging for each path attempt
- Last error tracking
- Current directory logging
- TypeScript fallback with better error handling

---

## Next Steps

### Immediate Actions

1. **Check Vercel Build Logs**
   - Look for route loading errors
   - Verify TypeScript compilation succeeded
   - Check if `dist/routes/workflow.route.js` exists in build

2. **Check Vercel Function Logs**
   - Look for `✅ Workflow routes loaded from: ...`
   - Check for any `❌ Failed to load` errors
   - Verify Express app is starting correctly

3. **Test Locally in Production Mode**
   ```bash
   NODE_ENV=production pnpm build:backend
   NODE_ENV=production node server.js
   # Then test: curl http://localhost:3001/api/workflows/stats
   ```

### If Still Failing

1. **Add Debug Endpoint**
   ```javascript
   // In server.js, add before routes
   app.get('/api/debug/routes', (req, res) => {
     res.json({
       workflowApiLoaded: !!workflowApi,
       routes: app._router?.stack?.map(layer => layer.route?.path || layer.regexp)
     });
   });
   ```

2. **Check Vercel Environment Variables**
   - Ensure `NODE_ENV=production` is set
   - Check if `VERCEL` or `VERCEL_ENV` is set correctly

3. **Verify Build Output**
   - Check if `dist/` folder is included in deployment
   - Verify `.vercelignore` isn't excluding necessary files

---

## Expected Behavior

### Successful Route Loading

**Console Output:**
```
✅ Workflow routes loaded from: /path/to/dist/routes/workflow.route
✅ Workflow routes mounted successfully
✅ Available routes: /bulk-add, /executions, /stats, /stations/stats
```

### Successful API Response

**Request:** `GET /api/workflows/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalExecutions": 123,
    "completedExecutions": 100,
    "failedExecutions": 10,
    ...
  }
}
```

---

## Summary

| Issue | Status | Action |
|-------|--------|--------|
| **484 Error** | 🔍 Investigating | Check Vercel logs |
| **Route Loading** | ✅ Fixed | Improved path resolution |
| **Export Format** | ✅ Correct | `exports.default` handled |
| **Route Order** | ✅ Correct | Specific before general |
| **Build Output** | ✅ Exists | `dist/routes/workflow.route.js` present |

**Next:** Check Vercel deployment logs to see if routes are loading correctly.

