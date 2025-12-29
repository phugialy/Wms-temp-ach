# Network Errors Fix - 404 on /api/workflows/schedules

## Issue Identified

**Error:** `404 Not Found` for `/api/workflows/schedules` endpoint

**Root Cause:** Route order conflict in Express.js

### The Problem

In `server.js`, routes are registered in this order:
```javascript
app.use('/api/workflows', workflowApi);           // Line 78 - General route
app.use('/api/workflows/schedules', cronScheduleApi); // Line 79 - Specific route
```

**Express matches routes in order**, so when a request comes for `/api/workflows/schedules`:
1. Express checks `/api/workflows` first (matches!)
2. It tries to find `/schedules` in the `workflowApi` router
3. Since `workflowApi` doesn't have a `/schedules` route, it returns 404

### The Fix

**Solution:** Put more specific routes BEFORE general routes

```javascript
app.use('/api/workflows/schedules', cronScheduleApi); // Specific route FIRST
app.use('/api/workflows', workflowApi);                // General route AFTER
```

This ensures `/api/workflows/schedules` is matched before `/api/workflows`.

---

## Additional Issues to Check

### 1. Route Loading in Production
- Verify `cronScheduleApi` loads correctly in production
- Check if TypeScript compilation creates the route file in `dist/`
- Verify the route path: `src/routes/cron-schedule.route` → `dist/routes/cron-schedule.route.js`

### 2. Authentication
- Check if authentication middleware is blocking the route
- Verify Supabase session token is being sent
- Check if route requires authentication (might need to make it public or fix auth)

### 3. React Error #31
- This is a minified React error (hard to debug)
- Usually indicates a runtime error in component rendering
- Could be related to the 404 errors causing component failures
- Check ErrorBoundary for more details

---

## Files Modified

1. `server.js` - Fixed route order (moved `/api/workflows/schedules` before `/api/workflows`)

---

## Testing

After deployment, verify:
1. ✅ `/api/workflows/schedules` returns 200 (not 404)
2. ✅ Cron schedules load in the UI
3. ✅ No more network errors in console
4. ✅ React error #31 is resolved (if it was caused by the 404)

---

## Route Order Best Practices

**Always register more specific routes BEFORE general routes:**

```javascript
// ✅ CORRECT ORDER
app.use('/api/workflows/schedules', cronScheduleApi);  // Specific
app.use('/api/workflows/executions', executionsApi);   // Specific  
app.use('/api/workflows', workflowApi);                // General

// ❌ WRONG ORDER (causes 404s)
app.use('/api/workflows', workflowApi);                // General (catches everything)
app.use('/api/workflows/schedules', cronScheduleApi);  // Never reached!
```

---

**Status:** ✅ Route order fixed - should resolve 404 errors after deployment

