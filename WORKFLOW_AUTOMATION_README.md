# Workflow Automation System

## Overview

This system provides automated workflow execution for bulk-add operations, designed to be triggered by Vercel Cron Jobs. It wraps the existing bulk-add functionality into a workflow engine that can be automated and monitored.

## Architecture

### Components

1. **WorkflowEngineService** (`src/services/workflow-engine.service.ts`)
   - Core workflow execution engine
   - Wraps: Get device data → Pull info → Push to DB
   - Tracks execution status and results

2. **Workflow API** (`src/routes/workflow.route.ts`)
   - `POST /api/workflows/bulk-add` - Execute bulk-add workflow
   - `GET /api/workflows/executions` - Get execution history
   - `GET /api/workflows/executions/:id` - Get specific execution details
   - `GET /api/workflows/stats` - Get execution statistics

3. **Cron Job Tracking** (`prisma/schema.prisma`)
   - `CronJobExecution` model tracks all workflow executions
   - Stores parameters, results, errors, and timing information

4. **Management Dashboard** (`frontend/src/pages/CronJobManagement.tsx`)
   - React component for monitoring cron job executions
   - Shows statistics, execution history, and detailed views

5. **Vercel Cron Integration** (`api/workflows/bulk-add.ts`, `vercel.json`)
   - Serverless function for Vercel cron job triggers
   - Configuration for scheduled executions

## Workflow: Bulk-Add Automation

### Workflow Steps

1. **Get Device Data**
   - Fetches devices from Phonecheck API for specified stations and date range
   - Uses `PhonecheckService.getAllDevicesFromStation()`

2. **Pull Info**
   - Retrieves enhanced device details for each device
   - Uses `PhonecheckService.getDeviceDetailsEnhanced()`

3. **Push to DB**
   - Processes and adds devices to database
   - Creates/updates Product, Item, and DeviceTest records

### Workflow Parameters

```typescript
{
  stations: string[];      // Array of station names (e.g., ["Station1", "Station2"])
  dateFrom: string;        // ISO date string (e.g., "2024-01-01")
  dateTo: string;          // ISO date string (e.g., "2024-01-31")
  location: string;         // Location name (e.g., "Warehouse A")
  triggerSource?: string;  // 'vercel-cron', 'manual', 'api' (optional)
}
```

## API Usage

### Execute Workflow (Manual Trigger)

```bash
POST /api/workflows/bulk-add
Content-Type: application/json

{
  "stations": ["Station1", "Station2"],
  "dateFrom": "2024-01-01",
  "dateTo": "2024-01-31",
  "location": "Warehouse A",
  "triggerSource": "manual"
}
```

### Get Execution History

```bash
GET /api/workflows/executions?limit=50&offset=0
```

### Get Execution Details

```bash
GET /api/workflows/executions/:id
```

### Get Statistics

```bash
GET /api/workflows/stats
```

## Vercel Cron Job Setup

### 1. Configure Environment Variables

In Vercel dashboard, set these environment variables:

```
CRON_STATIONS=Station1,Station2,Station3
CRON_DEFAULT_LOCATION=Default Location
CRON_SECRET=your-secret-key-here
INTERNAL_API_KEY=your-api-key-here
WORKFLOW_API_URL=https://your-app.vercel.app
```

### 2. Configure Cron Schedule

Edit `vercel.json` to set your desired schedule:

```json
{
  "crons": [
    {
      "path": "/api/workflows/bulk-add",
      "schedule": "0 2 * * *"  // Daily at 2 AM UTC
    }
  ]
}
```

### Cron Schedule Format

- `0 2 * * *` - Daily at 2 AM UTC
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 1` - Every Monday at midnight
- `*/30 * * * *` - Every 30 minutes

### 3. Deploy to Vercel

```bash
vercel deploy
```

## Database Migration

After adding the `CronJobExecution` model to the schema:

```bash
# Generate migration
npx prisma migrate dev --name add_cron_job_execution

# Or apply to production
npx prisma migrate deploy
```

## Management Dashboard

Access the cron job management page at:
- `/cron-jobs` (if route is configured)
- Or import `CronJobManagement` component in your routing

### Features

- **Statistics Overview**: Total, completed, failed, running, pending executions
- **Average Metrics**: Average devices found, added, and duration
- **Execution History**: Table view of all executions with filtering
- **Execution Details**: Modal with full execution information
- **Auto-refresh**: Updates every 30 seconds

## Monitoring

### Execution Status

- `pending` - Workflow queued but not started
- `running` - Workflow currently executing
- `completed` - Workflow finished successfully
- `failed` - Workflow encountered errors

### Tracking Fields

- **Devices Found**: Total devices retrieved from Phonecheck
- **Devices Processed**: Devices that went through processing
- **Devices Added**: Successfully added to database
- **Devices Failed**: Failed to process/add
- **Duration**: Total execution time in milliseconds

## Error Handling

- Individual device failures don't stop the workflow
- Errors are logged and stored in `errorDetails` JSON field
- Failed executions are marked with `status: 'failed'`
- Error messages are stored in `errorMessage` field

## Best Practices

1. **Station Selection**: Use specific station names that exist in Phonecheck
2. **Date Ranges**: Keep date ranges reasonable (e.g., daily or weekly)
3. **Location**: Use consistent location names across executions
4. **Monitoring**: Check the dashboard regularly for failed executions
5. **Error Review**: Review error details to identify patterns

## Example Use Cases

### Daily Automation
- Schedule: `0 2 * * *` (2 AM daily)
- Stations: All active stations
- Date Range: Previous day

### Weekly Summary
- Schedule: `0 0 * * 1` (Monday midnight)
- Stations: All stations
- Date Range: Previous week

### Hourly Processing
- Schedule: `0 * * * *` (Every hour)
- Stations: High-volume stations
- Date Range: Last hour

## Troubleshooting

### Workflow Not Executing

1. Check Vercel cron job logs
2. Verify environment variables are set
3. Check API endpoint is accessible
4. Review execution records in database

### High Failure Rate

1. Check Phonecheck API status
2. Review error details in execution records
3. Verify station names are correct
4. Check date range validity

### Performance Issues

1. Reduce number of stations per execution
2. Narrow date ranges
3. Check database connection pool
4. Review execution duration metrics

## Future Enhancements

- [ ] Retry mechanism for failed executions
- [ ] Email notifications for failures
- [ ] Workflow scheduling UI
- [ ] Multi-workflow support
- [ ] Workflow templates
- [ ] Execution queuing system



