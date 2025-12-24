# Email Subscription System - Design & Implementation

## 🔍 Current Behavior Clarification

### How It Works Now
**Status:** ✅ **IMMEDIATE EMAIL SENDING** (No Accumulation)

**Current Flow:**
```
1. Cron Job Executes
   ↓
2. Execution Completes (success/failure)
   ↓
3. System IMMEDIATELY:
   - Checks schedule's emailRecipients
   - Generates report for that single execution
   - Sends email right away
   ↓
4. Email arrives in inbox immediately
```

**What This Means:**
- ✅ Real-time notifications
- ✅ Immediate alerts
- ❌ One email per execution (can be many emails)
- ❌ No accumulation/batching
- ❌ No scheduled summaries

## 🎯 Recommended: Subscription-Based System

### Why Subscription Model?
1. **Flexibility** - Users choose what to monitor
2. **Scalability** - Better for high-frequency jobs
3. **User Control** - Operators manage their own subscriptions
4. **Performance** - Can batch and aggregate
5. **Professional** - Standard SaaS pattern

## 📊 Architecture Design

### Two Delivery Modes

#### Mode 1: Immediate Delivery
**When:** Right after each execution
**Best for:**
- Critical failures
- Low-frequency jobs
- Real-time monitoring

#### Mode 2: Scheduled Summary
**When:** At scheduled time (e.g., daily 8:00 AM)
**Best for:**
- High-frequency jobs
- Executive summaries
- Reducing email noise
- Batch reporting

## 🗄️ Database Schema

### New Table: `email_report_subscription`

```sql
CREATE TABLE email_report_subscription (
  id BIGSERIAL PRIMARY KEY,
  
  -- Subscription Info
  name VARCHAR(100) NOT NULL, -- User-friendly name
  description TEXT,
  
  -- Which Cron Jobs to Monitor
  schedule_ids BIGINT[], -- Array of schedule IDs (empty = all schedules)
  location_filter VARCHAR(100), -- Optional: filter by location
  
  -- Recipients (Array Format)
  email_recipients TEXT[] NOT NULL, -- Multiple email addresses
  
  -- Delivery Schedule
  delivery_mode VARCHAR(20) NOT NULL DEFAULT 'immediate', -- 'immediate' | 'scheduled'
  schedule_time TIME, -- When to send (for scheduled: e.g., '08:00')
  schedule_frequency VARCHAR(20), -- 'daily' | 'weekly' | 'monthly'
  schedule_days INTEGER[], -- For weekly: [1,2,3] = Mon, Tue, Wed
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Email Preferences
  email_on_success BOOLEAN DEFAULT true,
  email_on_failure BOOLEAN DEFAULT true,
  summary_only BOOLEAN DEFAULT false, -- Only send summary, skip individual
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by VARCHAR(100),
  last_sent_at TIMESTAMPTZ -- Track when last email was sent
);

CREATE INDEX idx_email_subscription_active ON email_report_subscription(is_active, delivery_mode);
CREATE INDEX idx_email_subscription_schedules ON email_report_subscription USING GIN(schedule_ids);
```

## 🎨 Monitoring & Reports Page Design

### Page Structure

```
┌─────────────────────────────────────────────────────────┐
│  Monitoring & Email Reports                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [+ Create Email Subscription]                           │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Active Subscriptions                               │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ ┌──────────────────────────────────────────────┐  │ │
│  │ │ Daily Morning Summary                        │  │ │
│  │ │ 📧 manager@example.com, admin@example.com    │  │ │
│  │ │ 📅 Daily at 8:00 AM                          │  │ │
│  │ │ 📊 3 schedules: STATION 4, STATION 3, ...   │  │ │
│  │ │ [Edit] [Disable] [Test]                      │  │ │
│  │ └──────────────────────────────────────────────┘  │ │
│  │                                                    │ │
│  │ ┌──────────────────────────────────────────────┐  │ │
│  │ │ Immediate Alerts - Critical Failures          │  │ │
│  │ │ 📧 ops-team@example.com                      │  │ │
│  │ │ ⚡ Immediate (on failure only)               │  │ │
│  │ │ 📊 All schedules                             │  │ │
│  │ │ [Edit] [Disable] [Test]                      │  │ │
│  │ └──────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Create/Edit Subscription Modal

```
┌─────────────────────────────────────────────────────────┐
│  Create Email Subscription                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Subscription Name *                                    │
│  [Daily Morning Summary                    ]            │
│                                                          │
│  Description                                             │
│  [Summary of all morning executions        ]            │
│                                                          │
│  ────────────────────────────────────────────────────   │
│                                                          │
│  Select Cron Jobs to Monitor *                           │
│  ☑ DNCL - STATION 4                                      │
│  ☑ DNCL - STATION 3                                      │
│  ☐ DNCL - STATION 2                                      │
│  ☐ DNCL - STATION 1                                      │
│  ☑ All Active Schedules (overrides selection)            │
│                                                          │
│  Filter by Location (Optional)                           │
│  [All Locations ▼]                                       │
│                                                          │
│  ────────────────────────────────────────────────────   │
│                                                          │
│  Email Recipients *                                      │
│  ┌─────────────────────────────────────────────────┐  │
│  │ manager@example.com                        [×]   │  │
│  │ admin@example.com                          [×]   │  │
│  └─────────────────────────────────────────────────┘  │
│  [+ Add Email Address]                                  │
│                                                          │
│  ────────────────────────────────────────────────────   │
│                                                          │
│  Delivery Schedule *                                     │
│  ○ Immediate (send after each execution)                 │
│  ● Scheduled Summary (send at specified time)           │
│                                                          │
│  When to Send:                                           │
│  [Daily ▼] at [08:00] [AM ▼]                            │
│  Days: [Mon] [Tue] [Wed] [Thu] [Fri]                     │
│  Timezone: [UTC ▼]                                       │
│                                                          │
│  ────────────────────────────────────────────────────   │
│                                                          │
│  Email Preferences                                       │
│  ☑ Send on successful executions                         │
│  ☑ Send on failed executions                             │
│  ☐ Summary only (aggregated, no individual details)      │
│                                                          │
│  [Cancel] [Save Subscription]                            │
└─────────────────────────────────────────────────────────┘
```

## 🔄 Email Delivery Logic

### Immediate Delivery Flow

```typescript
// After each execution completes
async function handleImmediateEmail(execution: CronJobExecution) {
  // Find all active subscriptions with delivery_mode = 'immediate'
  const subscriptions = await findSubscriptions({
    deliveryMode: 'immediate',
    isActive: true,
    scheduleIds: [execution.scheduleId] // or empty array for "all"
  });
  
  for (const subscription of subscriptions) {
    // Check if should send based on success/failure
    if (execution.status === 'completed' && !subscription.emailOnSuccess) continue;
    if (execution.status === 'failed' && !subscription.emailOnFailure) continue;
    
    // Generate report (single execution or summary)
    const report = subscription.summaryOnly 
      ? await generateSummaryReport([execution])
      : await generateSingleExecutionReport(execution);
    
    // Send email
    await sendEmail(subscription.emailRecipients, report);
  }
}
```

### Scheduled Summary Flow

```typescript
// Cron job runs at scheduled times (e.g., every hour)
async function handleScheduledEmails() {
  const now = dayjs();
  
  // Find all active scheduled subscriptions
  const subscriptions = await findSubscriptions({
    deliveryMode: 'scheduled',
    isActive: true
  });
  
  for (const subscription of subscriptions) {
    // Check if it's time to send
    if (!shouldSendNow(subscription, now)) continue;
    
    // Calculate date range based on frequency
    const dateRange = calculateDateRange(subscription.scheduleFrequency);
    
    // Get executions for the period
    const executions = await getExecutions({
      scheduleIds: subscription.scheduleIds, // or all if empty
      location: subscription.locationFilter,
      dateFrom: dateRange.from,
      dateTo: dateRange.to
    });
    
    if (executions.length === 0) continue;
    
    // Generate aggregated report
    const report = await generateSummaryReport(executions);
    
    // Send email
    await sendEmail(subscription.emailRecipients, report);
    
    // Update last_sent_at
    await updateSubscription(subscription.id, { lastSentAt: now });
  }
}
```

## 📋 Implementation Plan

### Phase 1: Database & Backend
1. Create `email_report_subscription` table
2. Create subscription service
3. Create API endpoints (CRUD)
4. Update email service to check subscriptions

### Phase 2: Scheduled Email Delivery
1. Create cron job for scheduled emails
2. Implement accumulation logic
3. Generate aggregated reports
4. Send at scheduled times

### Phase 3: Frontend UI
1. Create Monitoring/Reports page
2. Subscription list view
3. Create/edit subscription form
4. Test email functionality

## 🎯 Best Practices

### Performance
- **Immediate:** Fast, no accumulation (current behavior)
- **Scheduled:** Batch queries, aggregate efficiently, send once per period

### User Experience
- **Default to Scheduled:** Less email noise
- **Immediate for Critical:** Only failures or important jobs
- **Summary Option:** Aggregate multiple executions

### Scalability
- **High-Frequency Jobs:** Use scheduled summaries
- **Low-Frequency Jobs:** Immediate is fine
- **Many Subscriptions:** Efficient querying with indexes

## ✅ Recommendation

**Implement Subscription System** with:
1. ✅ Monitoring/Reports page for operators
2. ✅ Multi-select cron jobs
3. ✅ Array of email recipients
4. ✅ Both immediate and scheduled delivery
5. ✅ Summary aggregation option

This gives you:
- Better UX (users choose what to monitor)
- Better performance (can batch)
- More flexibility (different delivery modes)
- Professional SaaS pattern

Should I implement this subscription system?

