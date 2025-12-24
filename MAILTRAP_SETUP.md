# Mailtrap Configuration Guide

## What is Mailtrap?

Mailtrap is an email testing service that captures all emails sent by your application without actually delivering them. It's perfect for:
- ✅ Development and testing
- ✅ Viewing email content and formatting
- ✅ Testing email templates
- ✅ Debugging email issues
- ✅ No risk of sending test emails to real users

## Quick Setup Steps

### 1. Create Mailtrap Account

1. Go to [https://mailtrap.io](https://mailtrap.io)
2. Sign up for a free account (no credit card required)
3. Verify your email address

### 2. Get Your SMTP Credentials

1. After logging in, go to **Email Testing** → **Inboxes**
2. You'll see a default inbox (or create a new one)
3. Click on the inbox name to open it
4. Go to **SMTP Settings** tab
5. You'll see your credentials:
   ```
   Host: smtp.mailtrap.io
   Port: 2525 (or 587)
   Username: [your-username]
   Password: [your-password]
   ```

### 3. Configure Your .env File

Add these values to your `.env` file:

```env
# Mailtrap Configuration
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your-mailtrap-username-here
SMTP_PASS=your-mailtrap-password-here

# Email Sender (can be anything for testing)
EMAIL_FROM=test@wms-system.com
EMAIL_FROM_NAME=WMS System

# Enable email reports
EMAIL_REPORTS_ENABLED=true
```

**Important:** Replace `your-mailtrap-username-here` and `your-mailtrap-password-here` with the actual values from your Mailtrap inbox settings.

### 4. Restart Your Server

After updating `.env`, restart your server:
```bash
# Stop the server (Ctrl+C)
# Then restart
pnpm dev
```

### 5. Test Email Configuration

```bash
# Test email service
curl http://localhost:3001/api/email/test

# Send a test email
curl -X POST http://localhost:3001/api/email/test-send \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

### 6. View Emails in Mailtrap

1. Go back to your Mailtrap inbox
2. You should see the test email appear
3. Click on it to view:
   - HTML content
   - Plain text version
   - Headers and metadata
   - Raw email source

## Mailtrap SMTP Settings Reference

| Setting | Value |
|---------|-------|
| **Host** | `smtp.mailtrap.io` |
| **Port** | `2525` (recommended) or `587` |
| **Secure** | `false` |
| **Username** | Your Mailtrap inbox username |
| **Password** | Your Mailtrap inbox password |

## Example .env Configuration

```env
# ============================================
# MAILTRAP CONFIGURATION (Development)
# ============================================
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=a1b2c3d4e5f6g7
SMTP_PASS=h8i9j0k1l2m3n4
EMAIL_FROM=wms-test@example.com
EMAIL_FROM_NAME=WMS Test System
EMAIL_REPORTS_ENABLED=true
```

## Testing Cron Job Email Reports

1. Configure a cron schedule with email recipients:
   ```bash
   PUT /api/workflows/schedules/1
   {
     "emailRecipients": ["test@example.com"]
   }
   ```

2. Trigger a cron job execution (manually or wait for scheduled run)

3. Check your Mailtrap inbox - you'll see the email report appear

4. View the email to verify:
   - Formatting looks correct
   - All data is present
   - Tables render properly
   - Links work (if any)

## Mailtrap Features

### Email Preview
- View HTML emails as they would appear in email clients
- See plain text version
- Check mobile responsiveness

### Email Analysis
- View email headers
- Check spam score
- See email size
- View raw HTML source

### Multiple Inboxes
- Create separate inboxes for different environments
- Use different inboxes for different projects
- Organize test emails

### Team Collaboration
- Share inboxes with team members
- Comment on emails
- Export emails

## Switching from Mailtrap to Production

When ready to use real email in production:

1. Update `.env` with production SMTP settings:
   ```env
   # Production SMTP (Gmail example)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-production-email@gmail.com
   SMTP_PASS=your-app-password
   ```

2. Restart the server

3. Test with a real email address

## Troubleshooting

### "SMTP connection verification failed"
- Double-check your Mailtrap username and password
- Make sure you copied from the correct inbox
- Verify port is `2525` (not `587`)

### "Email not appearing in Mailtrap"
- Check server logs for errors
- Verify `EMAIL_REPORTS_ENABLED=true`
- Make sure cron schedule has `emailRecipients` configured
- Check spam folder in Mailtrap (unlikely but possible)

### "Connection timeout"
- Check firewall settings
- Verify port `2525` is not blocked
- Try port `587` instead

## Mailtrap Free Tier Limits

- ✅ 500 emails/month (free tier)
- ✅ Unlimited inboxes
- ✅ Email history for 7 days
- ✅ Team collaboration (limited)

For higher limits, consider upgrading to a paid plan.

## Next Steps

1. ✅ Set up Mailtrap account
2. ✅ Configure `.env` with Mailtrap credentials
3. ✅ Test email service
4. ✅ Configure cron schedules with email recipients
5. ✅ Test email reports
6. ✅ When ready, switch to production SMTP

Your email testing setup is complete! 🎉

