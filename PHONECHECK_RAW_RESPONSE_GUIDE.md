# Phonecheck API Raw Response Endpoint

## Overview
A new endpoint has been added to fetch and return the **raw response** from the Phonecheck API. This helps debug issues like Station 8 showing 500 devices when there should be 0.

## Endpoint
```
GET /api/phonecheck/raw-response
```

## Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `station` | string | No | Station code to filter by | `dncltz8` |
| `date` | string | No | Single date (YYYY-MM-DD) | `2025-12-26` |
| `startDate` | string | No | Start date for range (YYYY-MM-DD) | `2025-12-26` |
| `endDate` | string | No | End date for range (YYYY-MM-DD) | `2025-12-27` |
| `limit` | number | No | Maximum devices to return (default: 500) | `500` |
| `offset` | number | No | Offset for pagination (default: 0) | `0` |

## Usage Examples

### Example 1: Station 8 for a specific date
```bash
GET /api/phonecheck/raw-response?station=dncltz8&date=2025-12-26
```

### Example 2: Station 8 for today (when there should be 0 devices)
```bash
GET /api/phonecheck/raw-response?station=dncltz8&date=2025-12-27
```

### Example 3: Date range
```bash
GET /api/phonecheck/raw-response?station=dncltz8&startDate=2025-12-26&endDate=2025-12-27
```

### Example 4: All stations for a date (no station filter)
```bash
GET /api/phonecheck/raw-response?date=2025-12-26
```

### Example 5: With pagination
```bash
GET /api/phonecheck/raw-response?station=dncltz8&date=2025-12-26&limit=500&offset=0
```

## Response Format

```json
{
  "success": true,
  "request": {
    "endpoint": "https://api.phonecheck.com/v2/master/all-devices",
    "payload": {
      "limit": 500,
      "offset": 0,
      "date": "2025-12-26",
      "station": "dncltz8"
    },
    "method": "POST"
  },
  "response": {
    "status": 200,
    "statusText": "OK",
    "headers": {
      "content-type": "application/json",
      ...
    },
    "body": {
      // The actual API response body (parsed JSON)
      "numberOfDevices": 500,
      "devices": [...],
      ...
    },
    "rawText": "...", // Raw response text
    "bodyType": "object",
    "isArray": false,
    "bodyLength": 500,
    "numberOfDevices": 500,
    "total": 500,
    "hasDevicesArray": true,
    "hasDataArray": false
  }
}
```

## Key Fields to Check

### `numberOfDevices`
- **What it is**: The total number of devices the API reports for the query
- **Why it matters**: If this is `0` but `bodyLength` is `500`, the API is returning stale/cached data
- **Example**: `"numberOfDevices": 0` means no devices, but if `bodyLength: 500`, there's a problem

### `bodyLength`
- **What it is**: The number of devices in the returned array
- **Why it matters**: Should match `numberOfDevices` when there are devices
- **Example**: If `numberOfDevices: 0` but `bodyLength: 500`, the API is returning wrong data

### `hasDevicesArray`
- **What it is**: Whether the response has a `devices` array
- **Why it matters**: The API might structure responses differently
- **Example**: `true` means devices are in `body.devices[]`

### `body`
- **What it is**: The actual parsed response from the API
- **Why it matters**: This is what the system processes
- **Example**: Check if devices have the correct `station` field matching your query

## Testing Station 8 Zero Device Issue

To test why Station 8 shows 500 devices when there should be 0:

1. **Test with yesterday's date (should be 0)**:
   ```bash
   GET /api/phonecheck/raw-response?station=dncltz8&date=2025-12-27
   ```

2. **Check the response**:
   - Look at `numberOfDevices`: Should be `0` if no devices
   - Look at `bodyLength`: Should be `0` if no devices
   - If `numberOfDevices: 0` but `bodyLength: 500`, the API is returning stale data

3. **Check device stations**:
   - Look at `body.devices[]` (or `body[]` if it's a direct array)
   - Check the `station` field of each device
   - All should be `dncltz8` if the station filter is working

4. **Compare with a date that has devices**:
   ```bash
   GET /api/phonecheck/raw-response?station=dncltz8&date=2025-12-26
   ```
   - Compare the `numberOfDevices` and `bodyLength` values
   - This helps identify if the API is caching or returning wrong data

## Using in Browser

1. Start your backend server
2. Open browser and navigate to:
   ```
   http://localhost:3001/api/phonecheck/raw-response?station=dncltz8&date=2025-12-27
   ```
3. View the JSON response in the browser

## Using with cURL

```bash
curl "http://localhost:3001/api/phonecheck/raw-response?station=dncltz8&date=2025-12-27" | jq
```

## Using with Postman/Insomnia

1. Create a new GET request
2. URL: `http://localhost:3001/api/phonecheck/raw-response`
3. Add query parameters:
   - `station`: `dncltz8`
   - `date`: `2025-12-27`
4. Send request and view response

## Troubleshooting

### If you get authentication errors:
- Check that `PHONECHECK_USERNAME` and `PHONECHECK_PASSWORD` are set in `.env`
- Verify the credentials are correct

### If you get empty responses:
- Check the date format (must be YYYY-MM-DD)
- Verify the station code is correct
- Try without the station filter to see if the API is working

### If `numberOfDevices` doesn't match `bodyLength`:
- This indicates the API might be returning cached/stale data
- The fix we implemented should handle this by checking `numberOfDevices === 0` and returning an empty array

