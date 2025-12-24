# Email Configuration Guide - Step by Step

## 📋 Overview

This guide walks you through setting up email reporting for cron job executions. You'll configure:
1. **SMTP Server Settings** (one-time setup)
2. **Email Recipients per Schedule** (per cron job)
3. **Email Preferences** (when to send emails)

---

## Part 1: Email Provider Configuration (One-Time Setup)

### Step 1: Choose Your Email Provider

The system now supports **both SMTP and Mailtrap API**. Choose the method that works best for you:

#### Option A: Mailtrap API (Recommended - Faster & More Reliable)
- **Provider:** `mailtrap-api`
- **Requires:** Mailtrap API token
- **Best for:** Production and development (faster, more reliable than SMTP)
- **Get API token:** https://mailtrap.io → Settings → API Tokens → Create Token
- **Benefits:**
  - ✅ Faster delivery
  - ✅ Better error handling
  - ✅ More reliable
  - ✅ Better tracking and analytics

#### Option B: Mailtrap SMTP (Development/Testing)
- **SMTP Host:** `smtp.mailtrap.io`
- **SMTP Port:** `2525` (or `587`)
- **Requires:** Mailtrap account (free tier available)
- **Best for:** Testing email functionality without sending real emails
- **Get credentials:** https://mailtrap.io → Inboxes → Select inbox → SMTP Settings

#### Option B: Gmail (Production)
- **SMTP Host:** `smtp.gmail.com`
- **SMTP Port:** `587` (TLS) or `465` (SSL)
- **Requires:** App Password (not your regular password)

#### Option C: Outlook/Office 365
- **SMTP Host:** `smtp.office365.com`
- **SMTP Port:** `587`
- **Requires:** Office 365 account

#### Option D: Custom SMTP Server
- Use your organization's SMTP server
- Contact IT for host, port, and credentials

### Step 2: Get SMTP Credentials

#### For Mailtrap (Development/Testing):
1. Go to [Mailtrap.io](https://mailtrap.io) and sign up (free account available)
2. After login, go to **Email Testing** → **Inboxes**
3. Select an inbox (or create a new one)
4. Click on the inbox name to open **SMTP Settings**
5. You'll see:
   - **Host:** `smtp.mailtrap.io`
   - **Port:** `2525` (or `587`)
   - **Username:** (your Mailtrap username - shown in the settings)
   - **Password:** (your Mailtrap password - shown in the settings)
6. Copy these credentials to your `.env` file

**Note:** Mailtrap captures all emails sent to it, so you can view them in the Mailtrap dashboard without actually sending real emails. Perfect for development!

#### For Gmail (Production):
1. Go to [Google Account](https://myaccount.google.com/)
2. Navigate to **Security** → **2-Step Verification** (enable if not already)
3. Go to **App passwords**
4. Select **Mail** and your device
5. Click **Generate**
6. **Copy the 16-character password** (you'll use this, not your regular password)

#### For Other Providers:
- Use your email account credentials
- Some providers require app-specific passwords
- Check your provider's documentation

### Step 3: Configure Environment Variables

Open your `.env` file in the project root and add:

#### For Mailtrap API (Recommended):
```env
# ============================================
# EMAIL CONFIGURATION - MAILTRAP API
# ============================================

# Choose provider: 'mailtrap-api' or 'smtp'
EMAIL_PROVIDER=mailtrap-api

# Mailtrap API Token (get from https://mailtrap.io → Settings → API Tokens)
MAILTRAP_API_TOKEN=795127fa697c62e3558d2344c3ab23ed
# Alternative env var names (also supported):
# SMTP_MAILTRAP_API=795127fa697c62e3558d2344c3ab23ed
# SMPTP_MAILTRAP_API=795127fa697c62e3558d2344c3ab23ed

# Note: If EMAIL_PROVIDER is not set, the system will auto-detect:
# - If MAILTRAP_API_TOKEN exists → uses Mailtrap API
# - Otherwise → uses SMTP

EMAIL_FROM=noreply@dncltechzone.com
EMAIL_FROM_NAME=Central WMS System
EMAIL_REPORTS_ENABLED=true
```

#### For Mailtrap SMTP (Alternative):
```env
# ============================================
# EMAIL CONFIGURATION - SMTP
# ============================================

# Choose provider: 'mailtrap-api' or 'smtp'
EMAIL_PROVIDER=smtp

# SMTP Server Settings
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=26621d1c7786bf
SMTP_PASS=c86dd948b2c281

EMAIL_FROM=noreply@dncltechzone.com
EMAIL_FROM_NAME=Central WMS System
EMAIL_REPORTS_ENABLED=true
```

#### For Gmail (Production):
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=Central WMS System
EMAIL_REPORTS_ENABLED=true
```

# Email Sender Information (OPTIONAL)
EMAIL_FROM=noreply@dncltechzone.com
EMAIL_FROM_NAME=Central WMS System

# Email Report Settings (OPTIONAL - defaults shown)
EMAIL_REPORTS_ENABLED=true
EMAIL_REPORT_ON_SUCCESS=true
EMAIL_REPORT_ON_FAILURE=true
```

### Step 4: Test Email Configuration

After setting up environment variables, restart your server and test:

#### Method 1: API Test Endpoint
```bash
# Test if email service is configured
curl http://localhost:3001/api/email/test

# Send a test email
curl -X POST http://localhost:3001/api/email/test-send \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com"}'
```

#### Method 2: Check Server Logs
Look for these messages in your server logs:
```
[EmailService] Email service initialized successfully
[EmailService] SMTP connection verified successfully
```

**Expected Response:**
```json
{
  "success": true,
  "configured": true,
  "connectionVerified": true,
  "message": "Email service is configured and connection verified"
}
```

---

## Part 2: Configure Email Recipients for Each Cron Schedule

### Method 1: Via API (Recommended)

#### Update Existing Schedule

```bash
PUT /api/workflows/schedules/:id
Content-Type: application/json

{
  "emailRecipients": [
    "manager@example.com",
    "admin@example.com",
    "team-lead@example.com"
  ],
  "emailOnSuccess": true,
  "emailOnFailure": true
}
```

**Example using curl:**
```bash
curl -X PUT http://localhost:3001/api/workflows/schedules/1 \
  -H "Content-Type: application/json" \
  -d '{
    "emailRecipients": ["manager@example.com", "admin@example.com"],
    "emailOnSuccess": true,
    "emailOnFailure": true
  }'
```

#### Create New Schedule with Email

```bash
POST /api/workflows/schedules
Content-Type: application/json

{
  "name": "DNCL - STATION 4 Daily",
  "workflowType": "bulk-add",
  "stations": ["dncltz4"],
  "location": "DNCL-Inspection",
  "dateRangeDays": 1,
  "scheduleTime": "02:00",
  "timezone": "UTC",
  "frequency": "daily",
  "emailRecipients": ["manager@example.com"],
  "emailOnSuccess": true,
  "emailOnFailure": true
}
```

### Method 2: Via Database (Direct SQL)

```sql
-- Update email recipients for a specific schedule
UPDATE cron_job_schedule 
SET 
  email_recipients = ARRAY[
    'manager@example.com',
    'admin@example.com',
    'team-lead@example.com'
  ],
  email_on_success = true,
  email_on_failure = true
WHERE id = 1;

-- View current email configuration
SELECT 
  id,
  name,
  email_recipients,
  email_on_success,
  email_on_failure
FROM cron_job_schedule
WHERE id = 1;
```

### Method 3: Via Frontend UI (Future Enhancement)

*Note: UI for email configuration will be added in a future update. For now, use API or database methods.*

---

## Part 3: Email Preferences Explained

### `emailRecipients` (Array of Email Addresses)
- **Required:** At least one email address
- **Format:** Array of valid email addresses
- **Example:** `["manager@example.com", "admin@example.com"]`
- **Behavior:** All recipients receive the same email report

### `emailOnSuccess` (Boolean)
- **Default:** `true`
- **Purpose:** Send email when cron job completes successfully
- **When to disable:** If you only want emails for failures
- **Example:** `"emailOnSuccess": false` → No email on success

### `emailOnFailure` (Boolean)
- **Default:** `true`
- **Purpose:** Send email when cron job fails
- **When to disable:** If you only want emails for successes
- **Example:** `"emailOnFailure": false` → No email on failure

### Common Scenarios

#### Scenario 1: Email on Both Success and Failure
```json
{
  "emailRecipients": ["manager@example.com"],
  "emailOnSuccess": true,
  "emailOnFailure": true
}
```

#### Scenario 2: Email Only on Failures
```json
{
  "emailRecipients": ["admin@example.com"],
  "emailOnSuccess": false,
  "emailOnFailure": true
}
```

#### Scenario 3: Email Only on Success
```json
{
  "emailRecipients": ["team@example.com"],
  "emailOnSuccess": true,
  "emailOnFailure": false
}
```

#### Scenario 4: Multiple Recipients
```json
{
  "emailRecipients": [
    "manager@example.com",
    "admin@example.com",
    "operations@example.com"
  ],
  "emailOnSuccess": true,
  "emailOnFailure": true
}
```

---

## Part 4: Testing Your Email Setup

### Step 1: Verify SMTP Configuration
```bash
GET /api/email/test
```

### Step 2: Send Test Email
```bash
POST /api/email/test-send
{
  "to": "your-email@example.com",
  "subject": "Test Email"  // Optional
}
```

### Step 3: Test Daily Report
```bash
POST /api/email/report/daily
{
  "date": "2025-12-19",
  "recipients": ["your-email@example.com"],
  "location": "DNCL-Inspection"  // Optional
}
```

### Step 4: Trigger a Cron Job
1. Wait for a scheduled cron job to run, OR
2. Manually trigger a cron job from the UI
3. Check your email inbox for the report

---

## Part 5: Troubleshooting

### Issue: "Email service not configured"
**Solution:**
- Check that all SMTP environment variables are set
- Verify `.env` file is in the project root
- Restart the server after adding environment variables

### Issue: "SMTP connection verification failed"
**Possible Causes:**
1. **Wrong credentials:** Double-check username and password
2. **Gmail App Password:** Make sure you're using App Password, not regular password
3. **Firewall/Network:** Check if SMTP port is blocked
4. **Wrong port:** Try port 465 with `SMTP_SECURE=true` for SSL

**Solution:**
```bash
# Test with different ports
SMTP_PORT=587
SMTP_SECURE=false

# OR

SMTP_PORT=465
SMTP_SECURE=true
```

### Issue: "No email received after cron execution"
**Checklist:**
1. ✅ SMTP configuration is correct (test with `/api/email/test`)
2. ✅ Schedule has `emailRecipients` configured (not empty array)
3. ✅ `emailOnSuccess` or `emailOnFailure` is `true` (depending on execution result)
4. ✅ Check spam/junk folder
5. ✅ Check server logs for email errors

**Debug Steps:**
```sql
-- Check schedule email configuration
SELECT 
  id,
  name,
  email_recipients,
  email_on_success,
  email_on_failure,
  last_run_at
FROM cron_job_schedule
WHERE id = YOUR_SCHEDULE_ID;
```

### Issue: "Emails going to spam"
**Solutions:**
1. Add sender email to contacts
2. Configure SPF/DKIM records (for custom domains)
3. Use a professional email service (SendGrid, Mailgun, etc.)
4. Check email content (avoid spam trigger words)

---

## Part 6: Email Report Content

### What's Included in the Email

1. **Header Section**
   - Report date
   - Location
   - Generation timestamp

2. **Summary Statistics**
   - Success rate percentage
   - Average duration
   - Overall totals

3. **Execution Table**
   - Cron job name
   - Schedule time
   - Devices found
   - Devices added
   - Devices failed
   - Status indicator

4. **Detailed Breakdown**
   - Per-execution details
   - Station information
   - Execution metadata

### Example Email Subject
```
📊 Daily Execution Report - December 19, 2025
```

---

## Part 7: Best Practices

### 1. Use App Passwords for Gmail
- Never use your regular Gmail password
- Generate a new App Password for this application
- Store it securely in `.env` file (never commit to git)

### 2. Test Before Production
- Always test email configuration with test endpoint
- Send test email to yourself first
- Verify email format and content

### 3. Configure Recipients Wisely
- Don't add too many recipients (email limits)
- Use distribution lists for teams
- Consider separate emails for different alert levels

### 4. Monitor Email Delivery
- Check server logs regularly
- Set up email delivery monitoring
- Have a backup notification method

### 5. Environment-Specific Configuration
- Use different email addresses for dev/staging/prod
- Test in development before deploying to production
- Keep production credentials secure

---

## Quick Reference

### Environment Variables Checklist
```env
✅ SMTP_HOST=smtp.gmail.com
✅ SMTP_PORT=587
✅ SMTP_SECURE=false
✅ SMTP_USER=your-email@gmail.com
✅ SMTP_PASS=your-app-password
✅ EMAIL_FROM=noreply@yourdomain.com
✅ EMAIL_REPORTS_ENABLED=true
```

### API Endpoints
```
GET  /api/email/test                    # Test email configuration
POST /api/email/test-send              # Send test email
POST /api/email/report/daily           # Send daily report
PUT  /api/workflows/schedules/:id      # Update schedule email config
```

### Database Fields
```sql
email_recipients TEXT[]     -- Array of email addresses
email_on_success BOOLEAN    -- Send on success (default: true)
email_on_failure BOOLEAN    -- Send on failure (default: true)
```

---

## Need Help?

1. **Check Server Logs:** Look for `[EmailService]` and `[EmailReportService]` messages
2. **Test Endpoints:** Use `/api/email/test` to verify configuration
3. **Database Check:** Verify schedule has email recipients configured
4. **SMTP Test:** Try sending test email first before relying on cron reports

---

## Next Steps

After completing this setup:
1. ✅ Configure SMTP settings
2. ✅ Test email service
3. ✅ Add email recipients to your cron schedules
4. ✅ Monitor first execution reports
5. ✅ Adjust preferences as needed

Your email reporting system is now ready! 🎉

