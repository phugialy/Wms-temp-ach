# Mailtrap API Setup Guide

## ✅ What's New

Your email service now supports **Mailtrap API** in addition to SMTP! The API method is faster, more reliable, and provides better tracking.

## 🚀 Quick Setup

### Step 1: Get Your Mailtrap API Token

1. Go to [Mailtrap.io](https://mailtrap.io) and log in
2. Navigate to **Settings** → **API Tokens**
3. Click **Create Token**
4. Copy the token (you'll need it for `.env`)

### Step 2: Configure Environment Variables

Add these to your `.env` file:

```env
# Use Mailtrap API (recommended)
EMAIL_PROVIDER=mailtrap-api
MAILTRAP_API_TOKEN=your-api-token-here

# Email sender info
EMAIL_FROM=noreply@dncltechzone.com
EMAIL_FROM_NAME=Central WMS System
EMAIL_REPORTS_ENABLED=true
```

**Note:** The system also supports these alternative env var names for the API token:
- `MAILTRAP_API_TOKEN` (preferred)
- `SMTP_MAILTRAP_API` (also works)
- `SMPTP_MAILTRAP_API` (typo, but still supported)

### Step 3: Restart Your Server

```bash
# Stop the server (Ctrl+C)
# Then restart
pnpm dev
```

### Step 4: Test the Configuration

```bash
# Test email service
curl http://localhost:3001/api/email/test

# Send a test email
curl -X POST http://localhost:3001/api/email/test-send \
  -H "Content-Type: application/json" \
  -d '{"to": "phuly.dncl@gmail.com"}'
```

## 📊 API vs SMTP Comparison

| Feature | Mailtrap API | SMTP |
|---------|--------------|------|
| **Speed** | ⚡ Faster | 🐌 Slower |
| **Reliability** | ✅ More reliable | ⚠️ Can timeout |
| **Error Handling** | ✅ Better | ⚠️ Basic |
| **Tracking** | ✅ Advanced | ❌ Limited |
| **Setup** | 🔑 API token only | 🔑 Host, port, user, pass |

## 🔄 Switching Between Providers

You can easily switch between API and SMTP by changing the `EMAIL_PROVIDER` env var:

### Use Mailtrap API:
```env
EMAIL_PROVIDER=mailtrap-api
MAILTRAP_API_TOKEN=your-token
```

### Use SMTP:
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-username
SMTP_PASS=your-password
```

## ✅ Verification

After restarting, check the test endpoint response:

```json
{
  "success": true,
  "configured": true,
  "connectionVerified": true,
  "provider": "mailtrap-api",
  "message": "Email service is configured and connection verified (mailtrap-api)"
}
```

## 🎯 Benefits of Using Mailtrap API

1. **Faster Delivery** - Direct API calls are faster than SMTP handshakes
2. **Better Error Messages** - More detailed error responses
3. **Reliability** - No connection timeouts or SMTP handshake issues
4. **Tracking** - Better message tracking and analytics
5. **Simpler Setup** - Just one token instead of multiple SMTP settings

## 🔧 Troubleshooting

### "Email service not configured"
- Check that `EMAIL_PROVIDER=mailtrap-api` is set
- Verify `MAILTRAP_API_TOKEN` is set correctly
- Restart the server after changing `.env`

### "Mailtrap API token not found"
- Make sure the token is in `.env` as `MAILTRAP_API_TOKEN`
- Check for typos in the token
- Verify the token is valid in Mailtrap dashboard

### Still using SMTP?
- Check `EMAIL_PROVIDER` is set to `mailtrap-api` (not `smtp`)
- Default is `smtp` if not specified

## 📝 Current Configuration

Based on your `.env` file, you already have:
- `SMPTP_MAILTRAP_API = 9fdff3af8c1a4e7af23c5bb2d93d6042`

To use Mailtrap API, just add:
```env
EMAIL_PROVIDER=mailtrap-api
```

The system will automatically use the existing `SMPTP_MAILTRAP_API` token!

