# Network Error Troubleshooting Guide

## Recent Changes Summary

I made changes to handle **0 devices found** as a successful scenario (not a failure). The changes include:

1. **Enhanced logging** when 0 devices are found
2. **Improved success determination** (based on errors, not device count)
3. **Better API response messages** for 0 devices scenarios
4. **Metadata tracking** for zero device scenarios

## Potential Network Error Causes

### 1. **Server Not Restarted**
After code changes, the dev server needs to be restarted:
```bash
# Stop the current server (Ctrl+C)
# Then restart:
pnpm dev
```

### 2. **TypeScript Compilation Issues**
Even if the build passes, runtime errors can occur. Check:
- Are there any unhandled promise rejections?
- Are all async/await properly handled?

### 3. **Database Connection Issues**
The workflow connects to the database. Check:
- Is Supabase connection working?
- Are environment variables set correctly?

### 4. **API Timeout**
If the workflow takes too long, it might timeout. Check:
- Network timeout settings
- Vercel function timeout (if deployed)

## Quick Fixes to Try

### Fix 1: Restart the Server
```bash
# Stop server (Ctrl+C in terminal)
# Restart:
pnpm dev
```

### Fix 2: Check Server Logs
Look at the terminal where the server is running for:
- Error messages
- Stack traces
- Unhandled promise rejections

### Fix 3: Check Browser Console
Open browser DevTools (F12) and check:
- Network tab for failed requests
- Console tab for JavaScript errors
- The exact error message

### Fix 4: Verify Environment Variables
Make sure all required env vars are set:
- `DIRECT_URL` (Supabase connection)
- `PHONECHECK_USERNAME`
- `PHONECHECK_PASSWORD`
- `PHONECHECK_BASE_URL`

## Code Changes Made

### Files Modified:
1. `src/services/workflow-engine.service.ts`
   - Added logging for 0 devices
   - Updated success determination logic
   - Added metadata note for zero devices

2. `src/routes/workflow.route.ts`
   - Updated API response message for 0 devices
   - Added note field in response

### What to Check:

1. **Error Message**: What exact error do you see?
   - "Network Error" (generic)
   - "Failed to fetch"
   - "Connection refused"
   - "Timeout"
   - Specific error message?

2. **When Does It Happen?**
   - On page load?
   - When triggering a workflow?
   - When fetching data?
   - Only with 0 devices?

3. **Server Status**: Is the backend server running?
   - Check terminal for server logs
   - Check if port 3001 is accessible

## Debugging Steps

### Step 1: Check Server Logs
```bash
# In the terminal where server is running, look for:
- [WorkflowRoute] POST /bulk-add - Request received
- Any error messages
- Stack traces
```

### Step 2: Test API Directly
```bash
# Test the endpoint directly:
curl -X POST http://localhost:3001/api/workflows/bulk-add \
  -H "Content-Type: application/json" \
  -d '{
    "stations": ["dncltz8"],
    "dateFrom": "2025-12-26",
    "dateTo": "2025-12-26",
    "location": "DNCL-Inspection"
  }'
```

### Step 3: Check Network Tab
1. Open browser DevTools (F12)
2. Go to Network tab
3. Trigger the workflow
4. Check the failed request:
   - Status code
   - Response body
   - Request payload

## Common Issues & Solutions

### Issue: "Network Error" or "Failed to fetch"
**Possible Causes:**
- Server not running
- CORS issue
- Port mismatch

**Solution:**
- Verify server is running on correct port
- Check CORS configuration
- Verify frontend is calling correct URL

### Issue: "Connection refused"
**Possible Causes:**
- Server crashed
- Port already in use
- Firewall blocking

**Solution:**
- Restart server
- Check if port 3001 is available
- Check firewall settings

### Issue: "Timeout"
**Possible Causes:**
- Workflow taking too long
- Network slow
- Database query slow

**Solution:**
- Check workflow execution time
- Check database performance
- Increase timeout if needed

## If Still Having Issues

Please provide:
1. **Exact error message** from browser console
2. **Server logs** from terminal
3. **Network tab details** (status code, response)
4. **When it happens** (specific action)

This will help identify the exact issue.

