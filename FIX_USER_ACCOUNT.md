# Fix User Account Issue

## Problem
User `phuly.dncl@gmail.com` exists in Supabase Auth but NOT in `wms_users` table, causing login to fail.

## Solution: Create Missing User Record

Since `phuly.dncl@gmail.com` is a pre-approved admin, we need to create the user record manually.

### Option 1: Use SQL to Create User Record

First, we need to get the Supabase Auth user ID. Then run:

```sql
-- First, find the user ID from Supabase Auth (you'll need to check Supabase dashboard)
-- Or use this query if you have access to auth.users:

-- Insert the user record (replace USER_ID with actual Supabase Auth user ID)
INSERT INTO wms_users (id, email, full_name, role, is_verified, is_active, app_identifier, verified_at, created_at)
VALUES (
  'USER_ID_FROM_SUPABASE_AUTH',  -- Replace with actual user ID
  'phuly.dncl@gmail.com',
  'Phuly Admin',  -- Or your actual name
  'ADMIN',
  true,
  true,
  'WMS',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_verified = true,
  is_active = true,
  verified_at = now();
```

### Option 2: Use Backend API to Fix

I'll create an endpoint to fix this automatically.


