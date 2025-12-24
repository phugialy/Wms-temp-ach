# Mailtrap API Migration - From Sandbox to Direct API

## ✅ What Changed

The email service has been updated to **automatically use Mailtrap API** instead of the sandbox (SMTP) when an API token is detected.

### Key Changes:
1. **Auto-Detection**: If `MAILTRAP_API_TOKEN` is present, the system automatically uses Mailtrap API
2. **Direct API Endpoint**: Uses `https://send.api.mailtrap.io/api/send` (production API, not sandbox)
3. **Backward Compatible**: Still supports SMTP if no API token is found

## 🚀 Quick Setup

### Step 1: Add API Token to `.env`

Add this to your `.env` file:

```env
# Mailtrap API Token (your production API token)
MAILTRAP_API_TOKEN=795127fa697c62e3558d2344c3ab23ed

# Optional: Explicitly set provider (auto-detected if token exists)
EMAIL_PROVIDER=mailtrap-api

# Email settings
EMAIL_FROM=noreply@dncltechzone.com
EMAIL_FROM_NAME=Central WMS System
EMAIL_REPORTS_ENABLED=true
```

**That's it!** The system will automatically detect the API token and use Mailtrap API instead of SMTP.

### Step 2: Restart Your Server

```bash
# Stop the server (Ctrl+C)
# Then restart
pnpm dev
```

### Step 3: Verify It's Using API

Test the configuration:

```bash
curl http://localhost:3001/api/email/test
```

You should see:
```json
{
  "success": true,
  "configured": true,
  "connectionVerified": true,
  "provider": "mailtrap-api",
  "message": "Email service is configured and connection verified (mailtrap-api)"
}
```

## 📊 Sandbox vs Direct API

| Feature | Sandbox (SMTP) | Direct API |
|---------|----------------|------------|
| **Endpoint** | `smtp.mailtrap.io` | `send.api.mailtrap.io` |
| **Purpose** | Testing only | Production sending |
| **Delivery** | Captured in inbox | Actually sent to recipients |
| **Speed** | Slower (SMTP) | Faster (HTTP API) |
| **Reliability** | Can timeout | More reliable |

## 🔍 How Auto-Detection Works

The system checks for API token in this order:
1. `MAILTRAP_API_TOKEN` (preferred)
2. `SMTP_MAILTRAP_API` (alternative)
3. `SMPTP_MAILTRAP_API` (typo, but supported)

If any of these are found, it automatically uses **Mailtrap API** instead of SMTP.

## ✅ Verification Checklist

- [ ] `MAILTRAP_API_TOKEN` is set in `.env`
- [ ] Server restarted after adding token
- [ ] Test endpoint shows `"provider": "mailtrap-api"`
- [ ] Test email sends successfully
- [ ] Email arrives at recipient (not just in Mailtrap inbox)

## 🧪 Test Email Sending

```bash
# Send test email
curl -X POST http://localhost:3001/api/email/test-send \
  -H "Content-Type: application/json" \
  -d '{"to": "phuly.dncl@gmail.com"}'
```

## 📝 Current Configuration

Your current setup:
- **API Token**: `795127fa697c62e3558d2344c3ab23ed` ✅
- **API Endpoint**: `https://send.api.mailtrap.io/api/send` ✅
- **Auto-Detection**: Enabled ✅

Just add `MAILTRAP_API_TOKEN=795127fa697c62e3558d2344c3ab23ed` to your `.env` and restart!

## 🔄 Switching Back to SMTP (if needed)

If you want to use SMTP instead:

```env
# Explicitly set to SMTP
EMAIL_PROVIDER=smtp

# Remove or comment out API token
# MAILTRAP_API_TOKEN=795127fa697c62e3558d2344c3ab23ed

# Add SMTP settings
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-username
SMTP_PASS=your-password
```

## 🎯 Benefits of Direct API

1. **Real Email Delivery** - Emails actually go to recipients
2. **Faster** - HTTP API is faster than SMTP
3. **More Reliable** - No SMTP connection issues
4. **Better Tracking** - Get message IDs for tracking
5. **Production Ready** - Use in production environments

