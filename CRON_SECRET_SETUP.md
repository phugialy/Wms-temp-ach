# CRON_SECRET Setup Guide

## What is CRON_SECRET?

`CRON_SECRET` is a **security token** that you create yourself to protect your cron job endpoint from unauthorized access. It's not provided by Vercel - **you generate it yourself**.

## Why Do You Need It?

Without `CRON_SECRET`, anyone who knows your endpoint URL could trigger your cron job manually, which could:
- Waste resources
- Cause unwanted data processing
- Potentially cause issues with your system

With `CRON_SECRET`, only requests with the correct secret can execute the cron job.

## How to Generate CRON_SECRET

### Option 1: Generate Online (Easiest)
1. Go to: https://randomkeygen.com/
2. Copy a "CodeIgniter Encryption Keys" or "Fort Knox Password"
3. Use that as your `CRON_SECRET`

### Option 2: Generate Using Node.js
```bash
# In your terminal
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Option 3: Generate Using PowerShell (Windows)
```powershell
# In PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### Option 4: Use a Password Generator
- Use any password generator tool
- Generate a random string (32+ characters recommended)
- Example: `aB3xK9mP2qR7sT4vW8yZ1cD6fG0hJ5nL`

## How to Set CRON_SECRET in Vercel

### Step 1: Generate Your Secret
Use one of the methods above to create a random string.

**Example secret:** `wms-cron-2025-secret-key-abc123xyz789`

### Step 2: Add to Vercel Environment Variables

1. **Go to Vercel Dashboard**
   - Navigate to: https://vercel.com/dashboard
   - Select your project: `wms-temp-ach`

2. **Open Settings**
   - Click on your project
   - Go to **Settings** tab
   - Click **Environment Variables** in the left sidebar

3. **Add CRON_SECRET**
   - Click **Add New**
   - **Key:** `CRON_SECRET`
   - **Value:** Paste your generated secret (e.g., `wms-cron-2025-secret-key-abc123xyz789`)
   - **Environment:** Select **Production** (and Preview/Development if needed)
   - Click **Save**

4. **Redeploy**
   - After adding the variable, Vercel will prompt you to redeploy
   - Or manually trigger a new deployment

## Important Notes

### ⚠️ Security Best Practices

1. **Use a Strong Secret**
   - Minimum 32 characters
   - Mix of letters, numbers, and symbols
   - Don't use dictionary words or personal information

2. **Keep It Secret**
   - Never commit `CRON_SECRET` to Git
   - Don't share it publicly
   - Store it securely

3. **Use Different Secrets**
   - Use different secrets for development and production
   - Rotate secrets periodically (every 90 days)

### ✅ Optional but Recommended

`CRON_SECRET` is **optional** - if you don't set it, the cron endpoint will still work, but it won't be secured.

**Recommendation:** Set it for production to prevent unauthorized access.

## Quick Setup Checklist

- [ ] Generate a random secret (32+ characters)
- [ ] Go to Vercel Dashboard → Project → Settings → Environment Variables
- [ ] Add `CRON_SECRET` with your generated value
- [ ] Select **Production** environment
- [ ] Save and redeploy
- [ ] Verify cron jobs work after deployment

## Testing

After setting `CRON_SECRET`, you can test it:

```bash
# Replace with your actual URL and secret
curl -X GET "https://your-app.vercel.app/api/workflows/bulk-add" \
  -H "Authorization: Bearer your-cron-secret-here"
```

If the secret is correct, you'll get a successful response. If wrong, you'll get `401 Unauthorized`.

## Troubleshooting

### Cron Job Returns 401 Unauthorized
- ✅ Check that `CRON_SECRET` is set in Vercel
- ✅ Verify the secret matches what Vercel sends
- ✅ Check that it's set for the **Production** environment
- ✅ Redeploy after adding the variable

### Cron Job Works Without CRON_SECRET
- ✅ This is normal - `CRON_SECRET` is optional
- ✅ If not set, the endpoint will work without verification
- ✅ For production, it's recommended to set it for security

---

**TL;DR:** Generate a random string yourself, add it to Vercel environment variables as `CRON_SECRET`, and redeploy.

