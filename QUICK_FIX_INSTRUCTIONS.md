# Quick Fix for Your Account

## Problem
Your account `phuly.dncl@gmail.com` exists in Supabase Auth but NOT in `wms_users` table, so login fails.

## Solution 1: Use the Fix Endpoint (Easiest)

I've created an endpoint to automatically fix this. Run this command:

```bash
curl -X POST http://localhost:3001/api/auth/fix-user-account \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"phuly.dncl@gmail.com\"}"
```

This will:
- Find your Supabase Auth account
- Check if you're a pre-approved admin (you are!)
- Create the missing `wms_users` record with ADMIN role
- Set you as verified and active

**After running this, try logging in again!**

## Solution 2: Try Logging In Again (Auto-Fix)

I've also added auto-fix to the login flow. When you try to log in:

1. If your account is missing from `wms_users`
2. The system will automatically try to fix it
3. If you're a pre-approved admin, it will create your record
4. Then log you in

**Just try logging in again - it should auto-fix now!**

## Solution 3: Manual SQL Fix (If above don't work)

If you have access to Supabase SQL editor, run:

```sql
-- First, get your user ID from Supabase Auth
-- Then insert/update your record
INSERT INTO wms_users (id, email, full_name, role, is_verified, is_active, app_identifier, verified_at, created_at)
SELECT 
  au.id,
  'phuly.dncl@gmail.com',
  'Phuly Admin',
  'ADMIN',
  true,
  true,
  'WMS',
  now(),
  now()
FROM auth.users au
WHERE au.email = 'phuly.dncl@gmail.com'
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = 'ADMIN',
  is_verified = true,
  is_active = true,
  verified_at = now();
```

## What Happened?

When you registered:
1. ✅ Supabase Auth account was created
2. ✅ You're in the pre-approved admin list
3. ❌ But the `wms_users` record wasn't created (bug in registration flow)

I've fixed the registration flow, but your account still needs to be fixed.

## After Fixing

Once your account is fixed:
1. Try logging in with: `phuly.dncl@gmail.com` / `your-password`
2. You should be able to access the dashboard
3. You'll have ADMIN role

## Test It

After running the fix endpoint, test login:
1. Go to `/login`
2. Enter: `phuly.dncl@gmail.com`
3. Enter your password
4. Should work now! ✅


