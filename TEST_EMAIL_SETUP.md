# Test Your Mailtrap API Setup

Since you already have Mailtrap API configured in your `.env`, let's verify it's working:

## Step 1: Check Email Service Status

Run this command to see if the email service is configured:

```bash
curl http://localhost:3001/api/email/test
```

**Expected Response (if working):**
```json
{
  "success": true,
  "configured": true,
  "connectionVerified": true,
  "provider": "mailtrap-api",
  "message": "Email service is configured and connection verified (mailtrap-api)"
}
```

**If NOT working, you'll see:**
```json
{
  "success": false,
  "error": "Email service not configured",
  "provider": "mailtrap-api"
}
```

## Step 2: Test Sending an Email

Send a test email to yourself:

```bash
curl -X POST http://localhost:3001/api/email/test-send \
  -H "Content-Type: application/json" \
  -d "{\"to\": \"phuly.dncl@gmail.com\"}"
```

**If successful:**
```json
{
  "success": true,
  "message": "Test email sent successfully"
}
```

**If failed:**
```json
{
  "success": false,
  "error": "Failed to send test email. Check server logs for details."
}
```

## Step 3: Check Server Logs

When you start your server, you should see:
```
[EmailService] Mailtrap API initialized successfully
```

When sending emails, check for:
- `[EmailService] Email sent successfully via Mailtrap API` ✅
- OR `[EmailService] Failed to send email via Mailtrap API` ❌

## Step 4: Verify Your .env Has These Variables

Make sure your `.env` file has:

```env
# Mailtrap API Token
MAILTRAP_API_TOKEN=your-token-here

# Email sender info
EMAIL_FROM=noreply@dncltechzone.com
EMAIL_FROM_NAME=WMS System

# Enable emails
EMAIL_REPORTS_ENABLED=true

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173
```

## Step 5: Restart Server After .env Changes

If you just added/updated `.env` variables:
1. Stop the server (Ctrl+C)
2. Restart: `pnpm dev`
3. Check logs for email service initialization

## Common Issues

### Issue 1: Email service not configured
**Solution:** Check that `MAILTRAP_API_TOKEN` is set in `.env` and restart server

### Issue 2: Emails disabled
**Solution:** Make sure `EMAIL_REPORTS_ENABLED=true` (not `false`)

### Issue 3: API token invalid
**Solution:** Verify your Mailtrap API token is correct:
- Go to https://mailtrap.io
- Settings → API Tokens
- Make sure the token matches your `.env`

### Issue 4: Emails sent but not received
**If using Mailtrap API:** Emails are sent to real recipients (check spam folder)
**If using Mailtrap SMTP:** Emails are captured in Mailtrap inbox (not sent to real recipients)

## Test Registration Email Flow

After verifying email works, test the registration flow:

1. **Register a new user** (not pre-approved)
2. **Check server logs** - should see:
   ```
   [AuthRoute] Attempting to notify admins
   [EmailService] Email sent successfully via Mailtrap API
   ```
3. **Check your email** (phuly.dncl@gmail.com) for admin notification

## Quick Debug Commands

```bash
# Check email service status
curl http://localhost:3001/api/email/test

# Send test email
curl -X POST http://localhost:3001/api/email/test-send \
  -H "Content-Type: application/json" \
  -d "{\"to\": \"phuly.dncl@gmail.com\"}"

# Check if server is running
curl http://localhost:3001/api/email/test
```

