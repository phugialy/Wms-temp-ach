# Email Configuration Architecture

## 📋 Configuration Split Strategy

### Per-Schedule Configuration (Cron Jobs Management UI)
**Location:** `/cron-jobs` → Create/Edit Schedule Modal

**Fields:**
- `emailRecipients` - Array of email addresses (per schedule)
- `emailOnSuccess` - Boolean (per schedule)
- `emailOnFailure` - Boolean (per schedule)

**Why Here:**
- Each schedule may need different recipients
- Different schedules may have different notification preferences
- Users configure this when creating/editing schedules
- Contextual - email config is part of schedule setup

**UI Location:**
```
Cron Jobs Management
  └─ Create/Edit Schedule Modal
      ├─ Basic Info (name, description)
      ├─ Schedule Settings (time, frequency)
      ├─ Workflow Parameters (stations, location)
      └─ Email Notifications ⭐ NEW SECTION
          ├─ Email Recipients (multi-select or input)
          ├─ Send email on success (checkbox)
          └─ Send email on failure (checkbox)
```

### Global Configuration (General Settings Page)
**Location:** `/settings` or `/admin/settings` (new page)

**Fields:**
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password (masked input)
- `SMTP_SECURE` - Use SSL/TLS
- `EMAIL_FROM` - Default sender email
- `EMAIL_FROM_NAME` - Default sender name
- `EMAIL_REPORTS_ENABLED` - Master toggle

**Why Here:**
- Infrastructure-level configuration
- Affects entire system
- Admin-only access
- Changed infrequently
- Security-sensitive (credentials)

**UI Location:**
```
Settings / Admin Settings
  └─ Email Configuration Section
      ├─ SMTP Server Settings
      │   ├─ Host
      │   ├─ Port
      │   ├─ Username
      │   ├─ Password (masked)
      │   └─ Use SSL/TLS
      ├─ Email Sender Settings
      │   ├─ From Email
      │   └─ From Name
      └─ Global Email Settings
          └─ Enable Email Reports (toggle)
```

## 🎯 User Experience Flow

### Scenario 1: Creating a New Schedule
1. User goes to Cron Jobs Management
2. Clicks "Create Schedule"
3. Fills in schedule details
4. **NEW:** Configures email recipients for this schedule
5. Saves schedule
6. Email config is saved with schedule

### Scenario 2: Admin Configuring SMTP
1. Admin goes to Settings
2. Opens "Email Configuration" section
3. Enters SMTP credentials
4. Tests connection
5. Saves settings
6. All schedules now use this SMTP server

### Scenario 3: Editing Schedule Email Recipients
1. User goes to Cron Jobs Management
2. Clicks "Edit" on a schedule
3. Updates email recipients
4. Saves
5. Future executions send to new recipients

## 📊 Configuration Hierarchy

```
Global Settings (Settings Page)
  ├─ SMTP Server Config
  ├─ Email Sender Info
  └─ Master Toggle
      ↓
Per-Schedule Config (Cron Jobs Management)
  ├─ Email Recipients
  ├─ Email on Success
  └─ Email on Failure
```

## 🔐 Access Control

### Cron Jobs Management
- **Who:** Managers, Admins
- **What:** Configure email recipients per schedule
- **Why:** Operational configuration

### General Settings
- **Who:** Admins only
- **What:** Configure SMTP infrastructure
- **Why:** System-level configuration, security-sensitive

## 💡 Benefits of This Approach

1. **Separation of Concerns**
   - Infrastructure config (Settings) vs Feature config (Cron Jobs)

2. **User Experience**
   - Users configure emails where they create schedules
   - Admins manage infrastructure separately

3. **Security**
   - Credentials only in admin settings
   - Per-schedule configs don't expose infrastructure

4. **Flexibility**
   - Different schedules can have different recipients
   - Global SMTP can be changed without touching schedules

5. **Scalability**
   - Easy to add more global email settings
   - Easy to add more per-schedule email options

## 🚀 Implementation Priority

### Phase 1: Per-Schedule Config (Cron Jobs Management)
**Priority:** HIGH
- Add email fields to Create/Edit Schedule modal
- Update API to handle email fields
- Test email sending with configured recipients

### Phase 2: Global Settings Page
**Priority:** MEDIUM
- Create Settings page
- Add Email Configuration section
- Add SMTP test functionality
- Store settings in database or environment

### Phase 3: Enhanced Features
**Priority:** LOW
- Email templates customization
- Email preview
- Email delivery status tracking

## 📝 Current State

**What's Implemented:**
- ✅ Backend supports per-schedule email config
- ✅ Database schema has email fields
- ✅ Email service reads from environment variables
- ✅ API endpoints for email testing

**What's Missing:**
- ❌ UI for per-schedule email config (Cron Jobs Management)
- ❌ Settings page for global SMTP config
- ❌ UI for testing email from settings

## 🎨 UI Mockup Concept

### Cron Jobs Management - Email Section
```
┌─────────────────────────────────────────┐
│ Email Notifications                     │
├─────────────────────────────────────────┤
│ Email Recipients *                      │
│ ┌─────────────────────────────────────┐ │
│ │ manager@example.com          [×]     │ │
│ │ admin@example.com            [×]     │ │
│ └─────────────────────────────────────┘ │
│ [+ Add Email Address]                    │
│                                          │
│ ☑ Send email on successful execution    │
│ ☑ Send email on failed execution        │
│                                          │
│ ℹ️ Emails are sent after each execution │
└─────────────────────────────────────────┘
```

### Settings Page - Email Configuration
```
┌─────────────────────────────────────────┐
│ Email Configuration                     │
├─────────────────────────────────────────┤
│ SMTP Server Settings                    │
│ Host: [smtp.mailtrap.io        ]       │
│ Port: [2525                    ]       │
│ Username: [26621d1c7786bf      ]       │
│ Password: [••••••••••••••••    ] [👁]  │
│ ☐ Use SSL/TLS                           │
│ [Test Connection]                       │
│                                          │
│ Email Sender                            │
│ From Email: [noreply@dncltechzone.com]  │
│ From Name: [Central WMS System      ]  │
│                                          │
│ Global Settings                         │
│ ☑ Enable Email Reports                  │
│                                          │
│ [Save Settings] [Test Email]             │
└─────────────────────────────────────────┘
```

## ✅ Recommendation

**Start with Phase 1:** Add email configuration to Cron Jobs Management UI
- This is where users need it most
- Immediate value for users
- Can use environment variables for SMTP (already working)

**Then Phase 2:** Create Settings page for global config
- Better long-term architecture
- Allows changing SMTP without code changes
- Better for multi-tenant scenarios

This follows standard SaaS patterns where:
- **Feature configs** live with the feature
- **Infrastructure configs** live in Settings

