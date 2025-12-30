# Vercel Cron Jobs Fix

## Issue
Cron jobs are not working when deployed to Vercel.

## Root Causes Identified

### 1. ✅ **CRON_SECRET Verification Missing**
- **Problem:** Vercel cron jobs send `Authorization: Bearer ${CRON_SECRET}` header
- **Current:** Endpoint doesn't verify this header
- **Fix:** Added CRON_SECRET verification in GET `/bulk-add` handler

### 2. ⚠️ **Authentication Middleware Blocking**
- **Problem:** In `src/index.ts`, workflow routes use `authenticate` middleware
- **Issue:** Vercel cron jobs can't authenticate with Supabase tokens
- **Status:** `server.js` doesn't apply authentication, so this should be OK
- **Note:** Need to verify cron endpoint is accessible without auth

### 3. ⚠️ **Route Accessibility**
- **Problem:** Cron endpoint must be accessible in Vercel serverless function
- **Status:** Route is registered in `server.js` and exported via `api/index.js`
- **Action:** Verify route is reachable

### 4. ⚠️ **Environment Variables**
- **Required:** `CRON_STATIONS` and `CRON_DEFAULT_LOCATION` must be set in Vercel
- **Optional:** `CRON_SECRET` for security (recommended)

## Fixes Applied

### 1. Added CRON_SECRET Verification
```typescript
// Verify CRON_SECRET if configured
const cronSecret = process.env.CRON_SECRET;
if (cronSecret) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
```

### 2. Route Registration
- ✅ Route is registered in `server.js`
- ✅ GET handler exists for `/api/workflows/bulk-add`
- ✅ Route order is correct (schedules before workflows)

## Required Vercel Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

### Required
```
CRON_STATIONS=Station1,Station2,Station3
CRON_DEFAULT_LOCATION=DNCL-Inspection
```

### Recommended (Security)
```
CRON_SECRET=your-random-secret-string-here
```

## Testing Cron Jobs

### 1. Check Vercel Cron Jobs Dashboard
- Go to Vercel Dashboard → Project → Cron Jobs
- Verify cron job is listed and enabled
- Check execution history

### 2. Manual Test
```bash
# Test the endpoint manually (replace with your URL and secret)
curl -X GET "https://your-app.vercel.app/api/workflows/bulk-add" \
  -H "Authorization: Bearer your-cron-secret"
```

### 3. Check Logs
- Vercel Dashboard → Deployments → Functions → Logs
- Look for `[WorkflowRoute] GET /bulk-add - Vercel cron job triggered`
- Check for any errors

## Troubleshooting

### Cron Job Not Executing
1. ✅ Verify `vercel.json` has cron configuration
2. ✅ Verify deployment is to **production** (cron jobs only work in production)
3. ✅ Check Vercel Cron Jobs dashboard for status
4. ✅ Verify environment variables are set

### 401 Unauthorized
1. ✅ Set `CRON_SECRET` in Vercel environment variables
2. ✅ Verify the secret matches what Vercel sends
3. ✅ Check Authorization header in logs

### 400 Bad Request (No stations)
1. ✅ Set `CRON_STATIONS` environment variable
2. ✅ Format: `Station1,Station2,Station3` (comma-separated)

### Route Not Found (404)
1. ✅ Verify route is registered in `server.js`
2. ✅ Check route order (schedules before workflows)
3. ✅ Verify TypeScript compiled to `dist/`

## Next Steps

1. **Set Environment Variables in Vercel**
   - `CRON_STATIONS`
   - `CRON_DEFAULT_LOCATION`
   - `CRON_SECRET` (optional but recommended)

2. **Deploy to Production**
   - Cron jobs only work on production deployments
   - Preview deployments don't run cron jobs

3. **Monitor First Execution**
   - Check Vercel logs after first scheduled run
   - Verify workflow executes successfully
   - Check execution history in UI

---

**Status:** ✅ CRON_SECRET verification added - ready for testing

