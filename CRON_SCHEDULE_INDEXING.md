# Cron Schedule Indexing System

## Overview
This document explains how cron job executions are indexed and linked to their schedules for proper tracking and display in the Execution History.

## Architecture

### 1. Schedule Creation
When a cron schedule is created in the Cron Jobs Management UI:
- A record is created in `cron_job_schedule` table with a unique `id` (BigInt)
- The schedule is assigned an ID immediately upon creation
- This ID is used as the primary key for indexing

### 2. Schedule Execution Flow
When a scheduled cron job runs:

```
Cron Schedule Service (cron-schedule.service.ts)
  ↓
startSchedule(id: bigint)
  ↓
cron.schedule() callback executes
  ↓
workflowEngine.executeBulkAddWorkflow({
  ...params,
  scheduleId: schedule.id  // ← CRITICAL: Schedule ID is passed here
})
  ↓
Workflow Engine Service (workflow-engine.service.ts)
  ↓
prisma.cronJobExecution.create({
  scheduleId: params.scheduleId  // ← Stored in execution record
})
```

### 3. Database Schema
- **`cron_job_schedule`** table:
  - `id` (BigInt, Primary Key) - Unique schedule identifier
  - Other schedule configuration fields

- **`cron_job_execution`** table:
  - `id` (BigInt, Primary Key) - Unique execution identifier
  - `schedule_id` (BigInt, Foreign Key, Nullable) - Links to `cron_job_schedule.id`
  - Foreign key constraint: `fk_cron_job_execution_schedule`
  - Index: `idx_cron_job_schedule_id` for fast lookups

### 4. Execution History Retrieval
When fetching execution history:

```typescript
// workflow-engine.service.ts
prisma.cronJobExecution.findMany({
  include: {
    schedule: {
      select: {
        id: true,
        name: true,
        scheduleTime: true,
        frequency: true,
      }
    }
  }
})
```

The schedule relation is automatically joined via the foreign key, providing:
- `scheduleName` - Name of the schedule (e.g., "DNCL-DAILY Inspect")
- `scheduleTime` - Time the schedule runs (e.g., "19:00")
- `scheduleFrequency` - Frequency (e.g., "daily", "weekly")

### 5. Frontend Display
The Execution History table displays:
- **With Schedule**: Shows schedule name, time, and frequency
- **Manual Trigger**: Shows "Manual Trigger" for manual executions
- **Scheduled Run (unlinked)**: Shows "Scheduled Run (Schedule not linked)" for old executions without schedule_id

## Key Implementation Points

### Backend (cron-schedule.service.ts)
```typescript
// Line 280: Schedule ID is passed when executing workflow
const result = await workflowEngine.executeBulkAddWorkflow({
  stations: schedule.stations,
  dateFrom: dateString,
  dateTo: dateString,
  location: schedule.location,
  triggerSource: 'scheduled-cron',
  scheduleId: schedule.id, // ← Links execution to schedule
});
```

### Backend (workflow-engine.service.ts)
```typescript
// Line 47: Schedule ID is stored in execution record
const execution = await prisma.cronJobExecution.create({
  data: {
    workflowType: 'bulk-add',
    triggerSource: params.triggerSource || 'api',
    status: 'running',
    scheduleId: params.scheduleId, // ← Stored for indexing
    // ... other fields
  }
});
```

### Backend (workflow.route.ts)
```typescript
// Lines 149-151: Schedule info is serialized for frontend
scheduleId: execution.scheduleId?.toString() || null,
scheduleName: execution.schedule?.name || null,
scheduleTime: execution.schedule?.scheduleTime || null,
scheduleFrequency: execution.schedule?.frequency || null,
```

## Benefits

1. **Proper Indexing**: Every execution from a schedule is linked via `schedule_id`
2. **Fast Queries**: Index on `schedule_id` enables efficient lookups
3. **Data Integrity**: Foreign key constraint ensures valid schedule references
4. **Clear Tracking**: Users can see which schedule triggered each execution
5. **Historical Context**: Even if a schedule is deleted, executions retain the link (via `ON DELETE SET NULL`)

## Migration Notes

- Old executions (created before `schedule_id` column existed) were backfilled using location and station matching
- Future executions will automatically have `schedule_id` populated when created
- Manual triggers will have `schedule_id = null` (expected behavior)

## Future Improvements

- Consider adding a `schedule_name` denormalized field for faster queries (if schedule is deleted)
- Add execution filtering by schedule ID in the UI
- Add schedule performance analytics based on execution history



