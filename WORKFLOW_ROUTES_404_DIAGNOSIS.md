# Workflow Routes 404 Error - Diagnosis and Fix

## Current Problem

**Console Errors:**
- `GET /api/workflows/stats 404 (Not Found)`
- `GET /api/workflows/executions 404 (Not Found)`
- `GET /api/workflows/schedules 404 (Not Found)`

**Status:** Routes are returning 404, meaning they're not being loaded/registered correctly.

---

## Root Cause Analysis

### Issue 1: Route Loading Path Resolution
The `workflowApi.js` file tries to load `workflow.route.ts` but path resolution might be failing in production on Vercel.

**Current Flow:**
1. `server.js` loads `workflowApi.js` via `loadRoute('src/api/workflowApi')`
2. `workflowApi.js` tries to load `workflow.route.ts` from various paths
3. Path resolution fails → Routes not loaded → 404 errors

### Issue 2: TypeScript Compilation
Routes might not be compiling correctly to `dist/routes/workflow.route.js` during Vercel build.

### Issue 3: Route Registration Order
Routes are registered in `server.js` but might not be mounting correctly.

---

## Fixes Applied

### Fix 1: Improved Path Resolution
**File:** `src/api/workflowApi.js`

**Changes:**
- Added multiple path attempts (4 different paths)
- Better error logging to see which path fails
- Fallback to TypeScript loading if compiled routes not found
- Verification that loaded routes are valid Express routers

**New Path Resolution:**
```javascript
const possiblePaths = [
  path.join(__dirname, '../routes/workflow.route'),      // dist/routes/
  path.join(process.cwd(), 'dist/routes/workflow.route'), // Absolute
  '../routes/workflow.route',                            // Relative
  path.join(process.cwd(), 'src/routes/workflow.route'),  // Source fallback
];
```

### Fix 2: Better Error Logging
Added detailed logging to help diagnose:
- Which path is being tried
- Which path succeeded
- Current working directory
- `__dirname` value
- Error stack traces

---

## Verification Steps

### Step 1: Check Vercel Build Logs
After deployment, check Vercel logs for:
- `✅ Workflow routes loaded from: [path]`
- `✅ Workflow routes mounted successfully`
- `✅ Available routes: /bulk-add, /executions, /stats, /stations/stats`

**If you see:**
- `❌ Failed to load workflow routes` → Routes aren't compiling or path is wrong
- `⚠️ Compiled routes not found` → TypeScript compilation issue

### Step 2: Check Route Compilation
Verify TypeScript is compiling routes:
```bash
# Local test
pnpm build:backend
ls dist/routes/workflow.route.js  # Should exist
```

### Step 3: Test Endpoints
After deployment, test endpoints:
```bash
curl https://your-app.vercel.app/api/workflows/stats
curl https://your-app.vercel.app/api/workflows/executions
curl https://your-app.vercel.app/api/workflows/schedules
```

**Expected:** JSON responses, not 404

---

## Alternative Solution (If Above Doesn't Work)

If routes still don't load, we can simplify by:

### Option A: Direct Route Registration
Instead of loading via `workflowApi.js`, register routes directly in `server.js`:

```javascript
// In server.js
const workflowRoute = loadRoute('src/routes/workflow.route');
app.use('/api/workflows', workflowRoute);
```

### Option B: Ensure Routes Compile
Make sure `tsc` is actually compiling routes:
- Check `tsconfig.json` includes `src/routes/**/*`
- Verify `dist/routes/workflow.route.js` exists after build
- Check for TypeScript compilation errors

---

## Next Steps

1. **Deploy and check logs** - Look for route loading messages
2. **If still 404** - Check Vercel function logs for detailed error messages
3. **If routes not compiling** - Check TypeScript compilation in build logs
4. **If path resolution fails** - Use Option A (direct registration)

---

## Expected Behavior After Fix

### Console (Should See):
- ✅ `✅ Workflow routes loaded from: [path]`
- ✅ `✅ Workflow routes mounted successfully`
- ✅ No 404 errors for `/api/workflows/*` endpoints

### Browser (Should See):
- ✅ Data loads in Cron Job Management page
- ✅ Execution history displays
- ✅ Stats display correctly
- ✅ Schedules load properly

---

## Related Files

- `src/api/workflowApi.js` - Route loader (FIXED)
- `src/routes/workflow.route.ts` - Route definitions
- `server.js` - Route registration
- `package.json` - Build scripts
- `tsconfig.json` - TypeScript config

