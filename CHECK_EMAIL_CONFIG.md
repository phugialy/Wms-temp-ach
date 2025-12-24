# Check Your Email Configuration

## Current Setup

The system supports **Mailtrap** in two ways:

### Option 1: Mailtrap API (Recommended) ⚡
- **Faster** and more reliable
- Uses HTTP API instead of SMTP
- Better error handling

### Option 2: Mailtrap SMTP (Testing)
- For development/testing
- Captures emails in Mailtrap inbox
- Doesn't send real emails

## How to Check Your Current Configuration

### Step 1: Check Your `.env` File

Look for these variables in your `.env` file:

**For Mailtrap API:**
```env
MAILTRAP_API_TOKEN=your-token-here
# OR
SMTP_MAILTRAP_API=your-token-here
```

**For Mailtrap SMTP:**
```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-username
SMTP_PASS=your-password
```

### Step 2: Test Email Service

Run this command to check your email configuration:

```bash
curl http://localhost:3001/api/email/test
```

**Expected Response if Mailtrap API is configured:**
```json
{
  "success": true,
  "configured": true,
  "connectionVerified": true,
  "provider": "mailtrap-api",
  "message": "Email service is configured and connection verified (mailtrap-api)"
}
```

**Expected Response if Mailtrap SMTP is configured:**
```json
{
  "success": true,
  "configured": true,
  "connectionVerified": true,
  "provider": "smtp",
  "message": "Email service is configured and connection verified (smtp)"
}
```

**If NOT configured:**
```json
{
  "success": false,
  "error": "Email service not configured",
  "message": "Please configure email settings in environment variables"
}
```

### Step 3: Check Server Logs

When your server starts, look for these messages:

**If Mailtrap API is working:**
```
[EmailService] Mailtrap API initialized successfully
```

**If Mailtrap SMTP is working:**
```
[EmailService] Email service initialized successfully (SMTP)
```

**If NOT configured:**
```
[EmailService] Mailtrap API token not found. Email functionality disabled.
[EmailService] SMTP configuration incomplete. Email functionality disabled.
```

## How to Set Up Mailtrap

### For Mailtrap API (Recommended):

1. **Get API Token:**
   - Go to https://mailtrap.io
   - Log in to your account
   - Navigate to **Settings** → **API Tokens**
   - Click **Create Token**
   - Copy the token

2. **Add to `.env`:**
   ```env
   MAILTRAP_API_TOKEN=your-api-token-here
   EMAIL_FROM=noreply@dncltechzone.com
   EMAIL_FROM_NAME=WMS System
   EMAIL_REPORTS_ENABLED=true
   FRONTEND_URL=http://localhost:5173
   ```

3. **Restart server:**
   ```bash
   # Stop server (Ctrl+C)
   pnpm dev
   ```

### For Mailtrap SMTP (Testing):

1. **Get SMTP Credentials:**
   - Go to https://mailtrap.io
   - Log in to your account
   - Go to **Email Testing** → **Inboxes**
   - Select an inbox
   - Go to **SMTP Settings** tab
   - Copy: Host, Port, Username, Password

2. **Add to `.env`:**
   ```env
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.mailtrap.io
   SMTP_PORT=2525
   SMTP_SECURE=false
   SMTP_USER=your-username
   SMTP_PASS=your-password
   EMAIL_FROM=noreply@dncltechzone.com
   EMAIL_FROM_NAME=WMS System
   EMAIL_REPORTS_ENABLED=true
   FRONTEND_URL=http://localhost:5173
   ```

3. **Restart server**

## Test Email Sending

After configuration, test sending an email:

```bash
curl -X POST http://localhost:3001/api/email/test-send \
  -H "Content-Type: application/json" \
  -d '{"to": "phuly.dncl@gmail.com"}'
```

**If using Mailtrap SMTP:** Check your Mailtrap inbox to see the email
**If using Mailtrap API:** The email will be sent to the actual recipient

## Which One Should You Use?

- **Development/Testing:** Use Mailtrap SMTP (captures emails, doesn't send real ones)
- **Production:** Use Mailtrap API (sends real emails, faster, more reliable)

## Current Status

To see what's currently configured, check your server logs when it starts, or run:
```bash
curl http://localhost:3001/api/email/test
```

