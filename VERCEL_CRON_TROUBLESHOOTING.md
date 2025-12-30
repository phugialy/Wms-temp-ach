# Vercel Cron Jobs Troubleshooting Guide

## Current Setup

Your app has **TWO** endpoints for cron jobs:

1. **Serverless Function:** `api/workflows/bulk-add.ts` (Vercel native)
2. **Express Route:** `/api/workflows/bulk-add` via `server.js` (Express app)

**Vercel prioritizes serverless functions** in the `api/` directory, so the serverless function will be called first.

## How Vercel Routes Work

When a request comes to `/api/workflows/bulk-add`:
1. ✅ Vercel checks `api/workflows/bulk-add.ts` first (serverless function)
2. If not found, falls back to Express app via `api/index.js`

## Fixes Applied

### 1. ✅ Serverless Function Updated
- Now accepts **GET** requests (Vercel cron sends GET by default)
- Added CRON_SECRET verification
- Reads from query params (GET) or body (POST)

### 2. ✅ Express Route Updated  
- GET handler added with CRON_SECRET verification
- Reads from environment variables

## Required Environment Variables

Set these in **Vercel Dashboard → Settings → Environment Variables**:

```
CRON_STATIONS=Station1,Station2,Station3
CRON_DEFAULT_LOCATION=DNCL-Inspection
CRON_SECRET=your-random-secret-here  (optional but recommended)
```

## Testing

### Option 1: Test Serverless Function Directly
```bash
curl -X GET "https://your-app.vercel.app/api/workflows/bulk-add" \
  -H "Authorization: Bearer your-cron-secret"
```

### Option 2: Check Vercel Logs
1. Go to Vercel Dashboard → Deployments
2. Click on latest deployment
3. Go to "Functions" tab
4. Check logs for `api/workflows/bulk-add`
5. Look for: `[VercelCron] Cron job triggered via serverless function`

## Common Issues

### Issue 1: Cron Job Not Executing
**Symptoms:** No logs, no execution
**Solutions:**
- ✅ Verify deployment is to **production** (not preview)
- ✅ Check Vercel Cron Jobs dashboard
- ✅ Verify `vercel.json` has cron configuration
- ✅ Wait for scheduled time (cron runs at specified time)

### Issue 2: 401 Unauthorized
**Symptoms:** 401 error in logs
**Solutions:**
- ✅ Set `CRON_SECRET` in Vercel environment variables
- ✅ Or remove CRON_SECRET check (not recommended for production)

### Issue 3: 400 Bad Request (No stations)
**Symptoms:** "No stations configured" error
**Solutions:**
- ✅ Set `CRON_STATIONS` environment variable
- ✅ Format: `Station1,Station2,Station3` (comma-separated, no spaces)

### Issue 4: Function Timeout
**Symptoms:** Function exceeds max duration
**Solutions:**
- ✅ Increase `maxDuration` in `vercel.json`
- ✅ Current: 60 seconds
- ✅ Can increase to 300 seconds (5 minutes) for Hobby plan

## Verification Checklist

- [ ] `vercel.json` has cron configuration
- [ ] `CRON_STATIONS` environment variable is set
- [ ] `CRON_DEFAULT_LOCATION` environment variable is set
- [ ] `CRON_SECRET` is set (optional but recommended)
- [ ] Deployment is to **production** (not preview)
- [ ] Serverless function accepts GET requests
- [ ] Express route has GET handler
- [ ] Check Vercel Cron Jobs dashboard for status

## Next Steps

1. **Set Environment Variables** in Vercel
2. **Deploy to Production** (cron jobs only work in production)
3. **Wait for Scheduled Time** or manually trigger
4. **Check Logs** in Vercel dashboard
5. **Verify Execution** in your app's cron job management UI

---

**Status:** ✅ Both endpoints updated - ready for testing

