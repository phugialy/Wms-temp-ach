# Email Reporting Setup Guide

## Overview
The email reporting system sends automated reports after cron job executions, grouped by stations with comprehensive metrics.

## Setup Steps

### 1. Install Dependencies
Already installed: `nodemailer` and `@types/nodemailer`

### 2. Configure Environment Variables

Add these to your `.env` file:

```env
# Email Configuration (Required)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=WMS System

# Email Report Settings (Optional)
EMAIL_REPORTS_ENABLED=true
EMAIL_REPORT_ON_SUCCESS=true
EMAIL_REPORT_ON_FAILURE=true
```

### 3. Gmail Setup (Example)

If using Gmail:
1. Enable 2-Factor Authentication
2. Generate an App Password:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Use this password in `SMTP_PASS`

### 4. Run Database Migration

```bash
# Apply the migration to add email fields to cron_job_schedule table
psql -U your_user -d your_database -f migrations/042_add_email_config_to_schedules.sql
```

Or use Prisma:
```bash
pnpm prisma db push
```

### 5. Test Email Configuration

```bash
# Test email service
curl http://localhost:3001/api/email/test

# Send test email
curl -X POST http://localhost:3001/api/email/test-send \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com"}'
```

### 6. Configure Email Recipients for Schedules

You can configure email recipients in two ways:

#### Option A: Via Database (Direct)
```sql
UPDATE cron_job_schedule 
SET email_recipients = ARRAY['manager@example.com', 'admin@example.com']
WHERE id = 1;
```

#### Option B: Via API (Recommended)
```bash
PUT /api/workflows/schedules/:id
{
  "emailRecipients": ["manager@example.com", "admin@example.com"],
  "emailOnSuccess": true,
  "emailOnFailure": true
}
```

## Email Report Features

### What's Included
- ✅ Execution summary grouped by station/cron job
- ✅ Devices found, added, and failed counts
- ✅ Success rate and average duration
- ✅ Detailed breakdown per execution
- ✅ Professional HTML formatting

### When Emails Are Sent
- After each cron job execution (if configured)
- Only to recipients specified in the schedule
- Respects `emailOnSuccess` and `emailOnFailure` settings

### Email Format
The email includes:
1. **Header**: Date and location
2. **Summary**: Overall statistics
3. **Table**: Execution summary by station
4. **Details**: Breakdown of each execution

## Testing

### Test Daily Report
```bash
curl -X POST http://localhost:3001/api/email/report/daily \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-12-19",
    "recipients": ["your-email@example.com"],
    "location": "DNCL-Inspection"
  }'
```

## Troubleshooting

### Email Not Sending
1. Check SMTP configuration in `.env`
2. Verify email service: `GET /api/email/test`
3. Check server logs for errors
4. Verify `EMAIL_REPORTS_ENABLED=true`

### Connection Issues
- Verify SMTP host and port
- Check firewall settings
- For Gmail: Ensure App Password is used (not regular password)
- Check if SMTP requires TLS/SSL

### No Recipients
- Ensure `emailRecipients` array is not empty
- Check schedule configuration in database

## Next Steps

1. ✅ Configure SMTP settings
2. ✅ Run database migration
3. ✅ Test email service
4. ✅ Configure recipients for schedules
5. ✅ Monitor first execution reports

## Future Enhancements

- [ ] UI for configuring email recipients in frontend
- [ ] Daily summary email (aggregate all runs)
- [ ] Failure alert emails (separate from reports)
- [ ] Email templates customization
- [ ] Scheduled daily summaries


