# Workflow API 404 Errors Fix

## Issues Identified

**Console Errors:**
- `GET /api/workflows/stats 404 (Not Found)`
- `GET /api/workflows/executions 404 (Not Found)`
- `GET /api/workflows/schedules 404 (Not Found)`

**Root Cause:**
The `workflowApi.js` file is not correctly loading the compiled TypeScript routes in production on Vercel. The path resolution is failing, causing all workflow routes to return 404.

---

## Routes That Should Exist

All these routes ARE defined in the TypeScript files:

1. **`/api/workflows/stats`** - Defined in `src/routes/workflow.route.ts` line 615
2. **`/api/workflows/executions`** - Defined in `src/routes/workflow.route.ts` line 288
3. **`/api/workflows/schedules`** - Defined in `src/routes/cron-schedule.route.ts` line 13

---

## The Problem

In `src/api/workflowApi.js`, the route loading logic:

1. **Tries to load from `dist/routes/workflow.route.js`** in production
2. **Path resolution fails** because:
   - `__dirname` might not point to the expected location
   - File might not exist at the expected path
   - Node.js require resolution might be failing

3. **Falls back to error handlers** that return 503, but Vercel might be returning 404 instead

---

## Fix Applied

**File:** `src/api/workflowApi.js`

**Changes:**
1. **Improved path resolution** - Check if file exists before requiring
2. **Better error handling** - Try multiple path resolutions
3. **Fallback to TypeScript** - If compiled routes not found, try loading TypeScript with ts-node
4. **Better logging** - More detailed error messages to help debug

**Key Changes:**
```javascript
// Check if compiled file exists
const routePath = path.join(__dirname, '../routes/workflow.route.js');
const routePathNoExt = path.join(__dirname, '../routes/workflow.route');

if (fs.existsSync(routePath) || fs.existsSync(routePathNoExt)) {
  workflowRoutes = require(routePathNoExt);
} else {
  // Fallback to relative require (Node.js will resolve it)
  workflowRoutes = require('../routes/workflow.route');
}
```

---

## Verification Steps

### 1. Check Route Registration
Routes are registered in `server.js`:
- ✅ Line 79: `app.use('/api/workflows/schedules', cronScheduleApi);`
- ✅ Line 80: `app.use('/api/workflows', workflowApi);`

### 2. Check Route Definitions
Routes are defined in TypeScript:
- ✅ `/stats` - `workflow.route.ts:615`
- ✅ `/executions` - `workflow.route.ts:288`
- ✅ `/schedules` - `cron-schedule.route.ts:13`

### 3. Check Build Process
TypeScript should compile to:
- `dist/routes/workflow.route.js`
- `dist/routes/cron-schedule.route.js`

### 4. Check Vercel Deployment
After deployment, check Vercel logs for:
- `✅ Workflow routes loaded from compiled JavaScript`
- Or error messages about route loading

---

## Testing

### Test 1: Check Routes Exist
```bash
# After deployment, test endpoints:
curl https://your-app.vercel.app/api/workflows/stats
curl https://your-app.vercel.app/api/workflows/executions
curl https://your-app.vercel.app/api/workflows/schedules
```

**Expected:** JSON responses, not 404

### Test 2: Check Browser Console
1. Open Cron Job Management page
2. Check browser console
3. **Should NOT see:**
   - `404 (Not Found)` for `/api/workflows/stats`
   - `404 (Not Found)` for `/api/workflows/executions`
   - `404 (Not Found)` for `/api/workflows/schedules`

**Should see:**
- Successful API calls
- Data loading correctly

---

## Additional Notes

### Why Routes Might Still Fail

1. **TypeScript Not Compiled**
   - Solution: Ensure `pnpm build:backend` runs during Vercel build
   - Check `package.json` build scripts

2. **File Path Issues**
   - Solution: The improved path resolution should handle this
   - Check Vercel logs for actual file paths

3. **Route Order**
   - ✅ Already fixed: `/api/workflows/schedules` comes before `/api/workflows`

4. **Export Format**
   - ✅ Routes use `export default router` which is handled correctly

---

## Next Steps

1. **Deploy to Vercel** - Push changes and wait for deployment
2. **Check Vercel Logs** - Look for route loading messages
3. **Test Endpoints** - Verify all three endpoints work
4. **Monitor Console** - Check browser console for errors

---

## Related Files

- `src/api/workflowApi.js` - Route loader (FIXED)
- `src/routes/workflow.route.ts` - Workflow routes definition
- `src/routes/cron-schedule.route.ts` - Schedule routes definition
- `server.js` - Route registration

