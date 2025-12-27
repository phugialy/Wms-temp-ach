# IMEI Processing Statistics Guide

## Overview
A new endpoint has been added to get comprehensive statistics about IMEI (phone) processing, including:
- Total number of IMEIs processed
- Date ranges (from which date to which date)
- Breakdown by station
- Individual execution details

## Endpoint
```
GET /api/dashboard/imei-processing-stats
```

## Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `station` | string | No | Filter by specific station | `dncltz8` |
| `startDate` | string | No | Filter executions from this date (YYYY-MM-DD) | `2025-12-01` |
| `endDate` | string | No | Filter executions to this date (YYYY-MM-DD) | `2025-12-27` |

## Usage Examples

### Example 1: Get all IMEI processing statistics
```bash
GET /api/dashboard/imei-processing-stats
```

### Example 2: Get statistics for Station 8 only
```bash
GET /api/dashboard/imei-processing-stats?station=dncltz8
```

### Example 3: Get statistics for a date range
```bash
GET /api/dashboard/imei-processing-stats?startDate=2025-12-01&endDate=2025-12-27
```

### Example 4: Get Station 8 statistics for a specific date range
```bash
GET /api/dashboard/imei-processing-stats?station=dncltz8&startDate=2025-12-01&endDate=2025-12-27
```

## Response Format

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalExecutions": 50,
      "totalDevicesFound": 25000,
      "totalDevicesProcessed": 24800,
      "totalDevicesAdded": 24000,
      "totalDevicesFailed": 800,
      "uniqueImeisInMetadata": 24000,
      "dateRange": {
        "from": "2025-12-01",
        "to": "2025-12-27"
      }
    },
    "byStation": [
      {
        "station": "dncltz8",
        "executions": 10,
        "devicesFound": 5000,
        "devicesProcessed": 4800,
        "devicesAdded": 4500,
        "devicesFailed": 300,
        "dateRange": {
          "from": "2025-12-01",
          "to": "2025-12-27"
        }
      }
    ],
    "executions": [
      {
        "id": "39",
        "workflowType": "bulk-add",
        "triggerSource": "scheduled-cron",
        "status": "completed",
        "scheduleId": "5",
        "stations": ["dncltz8"],
        "dateFrom": "2025-12-26",
        "dateTo": "2025-12-26",
        "location": "Default Location",
        "devicesFound": 500,
        "devicesProcessed": 480,
        "devicesAdded": 450,
        "devicesFailed": 30,
        "startedAt": "2025-12-27T02:00:00Z",
        "completedAt": "2025-12-27T02:15:00Z",
        "durationMs": 900000,
        "imeiCountFromMetadata": 480,
        "uniqueImeisFromMetadata": ["IMEI1", "IMEI2", ...],
        "createdAt": "2025-12-27T02:00:00Z"
      }
    ]
  },
  "filters": {
    "station": null,
    "startDate": null,
    "endDate": null
  }
}
```

## Key Fields Explained

### Summary Section
- **totalExecutions**: Total number of cron job executions
- **totalDevicesFound**: Total devices found by Phonecheck API
- **totalDevicesProcessed**: Total devices processed (attempted to add/update)
- **totalDevicesAdded**: Total new IMEIs added to the database
- **totalDevicesFailed**: Total devices that failed to process
- **uniqueImeisInMetadata**: Number of unique IMEIs found in execution metadata
- **dateRange**: Overall date range covering all executions

### By Station Section
- **station**: Station code (e.g., `dncltz8`)
- **executions**: Number of executions for this station
- **devicesFound/Processed/Added/Failed**: Statistics for this station
- **dateRange**: Date range for this station's executions

### Executions Section
- **id**: Execution ID
- **dateFrom/dateTo**: Date range for this specific execution
- **devicesProcessed**: Number of IMEIs processed in this execution
- **imeiCountFromMetadata**: Number of IMEIs found in metadata (may be limited to 1000)
- **uniqueImeisFromMetadata**: Array of IMEIs from metadata (limited to first 100 for response size)

## Using in Browser

1. Start your backend server
2. Open browser and navigate to:
   ```
   http://localhost:3001/api/dashboard/imei-processing-stats
   ```
3. For Station 8 specifically:
   ```
   http://localhost:3001/api/dashboard/imei-processing-stats?station=dncltz8
   ```

## Using with PowerShell

```powershell
# Get all statistics
Invoke-WebRequest -Uri "http://localhost:3001/api/dashboard/imei-processing-stats" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10

# Get Station 8 statistics
Invoke-WebRequest -Uri "http://localhost:3001/api/dashboard/imei-processing-stats?station=dncltz8" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10

# Get statistics for date range
Invoke-WebRequest -Uri "http://localhost:3001/api/dashboard/imei-processing-stats?startDate=2025-12-01&endDate=2025-12-27" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

## Using with cURL

```bash
# Get all statistics
curl "http://localhost:3001/api/dashboard/imei-processing-stats" | jq

# Get Station 8 statistics
curl "http://localhost:3001/api/dashboard/imei-processing-stats?station=dncltz8" | jq

# Get statistics for date range
curl "http://localhost:3001/api/dashboard/imei-processing-stats?startDate=2025-12-01&endDate=2025-12-27" | jq
```

## Answering Your Questions

### "How many IMEIs were processed?"
Look at the `summary.totalDevicesProcessed` field in the response.

### "What date range?"
Look at the `summary.dateRange` field:
- `from`: Earliest date processed
- `to`: Latest date processed

### "For Station 8 specifically?"
Use the `station=dncltz8` query parameter, then check:
- `summary.totalDevicesProcessed` for total count
- `summary.dateRange` for date range
- `byStation[0]` for station-specific breakdown

## Notes

- The `uniqueImeisFromMetadata` array in each execution is limited to the first 100 IMEIs to keep response size manageable
- The metadata may store up to 1000 devices per execution
- If you need all IMEIs, you may need to query the database directly or check the `item` and `product` tables
- Date ranges are based on `date_from` and `date_to` fields in the execution records

