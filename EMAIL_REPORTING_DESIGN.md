# Email Reporting System Design

## Overview
Email reports for cron job executions, grouped by stations with comprehensive metrics.

## Features

### Core Requirements
- ✅ Group executions by stations
- ✅ Show date, cron job name, devices added
- ✅ Send email after executions
- ✅ Clean, readable format

### Enhanced Features (Recommended)
- 📊 Multiple grouping options (by station, by schedule, by location)
- 📈 Additional metrics (devices found, failed, duration, success rate)
- 🎨 Professional HTML email template
- ⚙️ Configurable recipients per schedule
- 📅 Daily summary option (aggregate all runs for the day)
- 🔔 Failure alerts (separate email for failed executions)
- 📋 Detailed breakdown per station

## Email Template Design

### Daily Execution Report
```
═══════════════════════════════════════════════════════════
  📊 DAILY EXECUTION REPORT - December 19, 2025
═══════════════════════════════════════════════════════════

📅 Report Period: December 19, 2025
📍 Location: DNCL-Inspection
⏰ Generated: December 19, 2025 at 19:30 UTC

───────────────────────────────────────────────────────────
  EXECUTION SUMMARY BY STATION
───────────────────────────────────────────────────────────

┌─────────────────────────────┬──────────┬──────────┬──────────┐
│ Cron Job                    │ Found    │ Added    │ Failed   │
├─────────────────────────────┼──────────┼──────────┼──────────┤
│ DNCL - STATION 4            │   120    │   94     │    2     │
│ DNCL - STATION 3            │   105    │  100     │    0     │
│ DNCL - STATION 2            │    85    │   82     │    1     │
├─────────────────────────────┼──────────┼──────────┼──────────┤
│ TOTAL                       │   310    │  276     │    3     │
└─────────────────────────────┴──────────┴──────────┴──────────┘

📊 Success Rate: 89.0% (276/310)
⏱️  Average Duration: 45 seconds
✅ All executions completed successfully

───────────────────────────────────────────────────────────
  DETAILED BREAKDOWN
───────────────────────────────────────────────────────────

🔹 DNCL - STATION 4
   • Schedule: Daily at 02:00 UTC
   • Executed: Dec 19, 2025 at 02:00 UTC
   • Duration: 52 seconds
   • Status: ✅ Completed
   • Devices: 94 added, 2 failed, 24 skipped

🔹 DNCL - STATION 3
   • Schedule: Daily at 02:00 UTC
   • Executed: Dec 19, 2025 at 02:00 UTC
   • Duration: 38 seconds
   • Status: ✅ Completed
   • Devices: 100 added, 0 failed, 5 skipped

───────────────────────────────────────────────────────────

📧 This is an automated report from WMS Cron Job System
🔗 View full details: http://your-app.com/cron-jobs

```

## Architecture

### Components
1. **Email Service** (`email.service.ts`)
   - SMTP configuration
   - Email sending functionality
   - Template rendering

2. **Report Service** (`email-report.service.ts`)
   - Data aggregation
   - Grouping logic (by station, schedule, location)
   - Report generation

3. **Email Templates** (`templates/`)
   - HTML templates
   - Text fallback
   - Styling

4. **Integration Points**
   - After cron execution completion
   - Daily summary (optional)
   - Failure alerts

## Configuration

### Environment Variables
```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=WMS System

# Report Configuration
EMAIL_REPORTS_ENABLED=true
EMAIL_REPORT_ON_SUCCESS=true
EMAIL_REPORT_ON_FAILURE=true
EMAIL_DAILY_SUMMARY=true
EMAIL_DAILY_SUMMARY_TIME=08:00
```

### Per-Schedule Configuration
Add to `CronJobSchedule`:
- `emailRecipients: string[]` - List of email addresses
- `emailOnSuccess: boolean` - Send email on successful runs
- `emailOnFailure: boolean` - Send email on failed runs
- `emailGroupBy: 'station' | 'schedule' | 'location'` - Grouping method

## Implementation Steps

1. ✅ Install nodemailer
2. ✅ Create email service
3. ✅ Create report generation service
4. ✅ Design HTML email template
5. ✅ Add email config to database schema
6. ✅ Integrate with cron execution flow
7. ✅ Add UI for email configuration


