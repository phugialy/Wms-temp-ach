# How CRON_SECRET Works - Complete Guide

## Quick Answers

### 1. Do you just set one CRON_SECRET?
**Yes!** You set **one `CRON_SECRET`** in Vercel environment variables. That's it.

### 2. Is the functionality already built in?
**Yes!** The code already handles CRON_SECRET verification. You just need to:
- Set `CRON_SECRET` in Vercel environment variables
- The code will automatically verify it when cron jobs run

### 3. How do they verify and talk?
**Vercel automatically sends the secret** in the `Authorization` header when it triggers cron jobs.

---

## How It Works (Step by Step)

### Step 1: You Set CRON_SECRET in Vercel
```
Vercel Dashboard → Settings → Environment Variables
Key: CRON_SECRET
Value: your-secret-here
Environment: Production
```

### Step 2: Vercel Automatically Uses It
When Vercel triggers your cron job:
1. Vercel reads `CRON_SECRET` from your environment variables
2. Vercel automatically adds it to the request: `Authorization: Bearer ${CRON_SECRET}`
3. Vercel sends the request to your endpoint

### Step 3: Your Code Verifies It
Your endpoint receives the request and:
1. Reads `CRON_SECRET` from environment variables
2. Reads `Authorization` header from the request
3. Compares them: `req.headers.authorization === "Bearer ${CRON_SECRET}"`
4. If they match → ✅ Allow the request
5. If they don't match → ❌ Return 401 Unauthorized

---

## The Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ 1. Vercel Cron Scheduler (at 2 AM UTC)                  │
│    - Reads CRON_SECRET from your env vars              │
│    - Creates request with:                              │
│      Authorization: Bearer your-cron-secret            │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Your Endpoint (api/workflows/bulk-add.ts)            │
│    - Receives request                                   │
│    - Reads CRON_SECRET from env vars                    │
│    - Reads Authorization header                        │
│    - Compares: header === "Bearer ${CRON_SECRET}"       │
└──────────────────┬──────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ✅ Match            ❌ No Match
         │                   │
         ▼                   ▼
┌──────────────┐    ┌──────────────────┐
│ Execute      │    │ Return 401       │
│ Workflow     │    │ Unauthorized     │
└──────────────┘    └──────────────────┘
```

---

## Important Points

### ✅ What Vercel Does Automatically
- **Reads** `CRON_SECRET` from your environment variables
- **Sends** it in the `Authorization` header automatically
- **You don't need to configure anything else** - just set the env var!

### ✅ What Your Code Does
- **Reads** `CRON_SECRET` from environment variables
- **Verifies** the incoming `Authorization` header matches
- **Allows or blocks** the request based on verification

### ⚠️ Important Notes

1. **Same Secret in Both Places**
   - Vercel reads: `CRON_SECRET` from env vars → sends in header
   - Your code reads: `CRON_SECRET` from env vars → verifies header
   - They must be the **same value**!

2. **Optional but Recommended**
   - If `CRON_SECRET` is not set, the endpoint still works (just not secured)
   - For production, it's recommended to set it

3. **One Secret Per Environment**
   - You can set different secrets for Production, Preview, Development
   - Or use the same one for all

---

## Verification Process (Code Level)

### In Your Serverless Function (`api/workflows/bulk-add.ts`):
```typescript
// 1. Read CRON_SECRET from environment
const cronSecret = process.env.CRON_SECRET;

// 2. Read Authorization header from request
const authHeader = req.headers.authorization;

// 3. Compare them
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}

// 4. If they match, continue with workflow execution
```

### In Your Express Route (`src/routes/workflow.route.ts`):
```typescript
// Same process - reads from env, compares with header
const cronSecret = process.env.CRON_SECRET;
const authHeader = req.headers.authorization;
if (authHeader !== `Bearer ${cronSecret}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

---

## Testing the Verification

### Test with Correct Secret (Should Work)
```bash
curl -X GET "https://your-app.vercel.app/api/workflows/bulk-add" \
  -H "Authorization: Bearer your-actual-cron-secret"
```
**Expected:** ✅ 200 OK with workflow execution

### Test with Wrong Secret (Should Fail)
```bash
curl -X GET "https://your-app.vercel.app/api/workflows/bulk-add" \
  -H "Authorization: Bearer wrong-secret"
```
**Expected:** ❌ 401 Unauthorized

### Test Without Secret (If CRON_SECRET not set)
```bash
curl -X GET "https://your-app.vercel.app/api/workflows/bulk-add"
```
**Expected:** ✅ 200 OK (works because verification is optional)

---

## Summary

1. **Set ONE `CRON_SECRET`** in Vercel environment variables
2. **Vercel automatically sends it** in the Authorization header
3. **Your code automatically verifies it** - no extra configuration needed
4. **It just works** - the functionality is already built in!

---

**TL;DR:** Set `CRON_SECRET` in Vercel → Vercel sends it automatically → Your code verifies it automatically → Done! ✅

