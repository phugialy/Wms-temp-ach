# Database Integrity Check Feature

## Overview

The Database Integrity Check feature is an admin tool designed to identify and fix missing identification fields in the inventory database. It scans for records with missing Model, Storage/Capacity, Color, or Carrier information and automatically fetches the missing data from PhoneCheck API to update the records.

## Architecture

Following the 3-layer architecture:
- **INPUT**: Admin UI Tool (`public/db-integrity-check.html`)
- **PROCESS**: WMS Layer (`src/services/db-integrity-check.service.ts`)
- **DASHBOARD**: Results display in the admin UI

## Components

### 1. Service Layer
**File**: `src/services/db-integrity-check.service.ts`

**Key Methods**:
- `scanForMissingData()`: Scans the `item` table for records with missing fields
- `processMissingData()`: Batch processes IMEIs through PhoneCheck API
- `runIntegrityCheck()`: Complete workflow (scan + process)
- `getMissingDataStats()`: Returns statistics about missing data

**Features**:
- Configurable batch processing (default: 5 IMEIs per batch)
- Configurable delay between batches to avoid API rate limiting
- Error handling and logging
- Progress tracking

### 2. Controller Layer
**File**: `src/controllers/db-integrity-check.controller.ts`

**Endpoints**:
- `GET /stats`: Get statistics about missing data
- `POST /scan`: Scan for missing data (read-only)
- `POST /run`: Run complete integrity check (scan + update)
- `POST /process-imeis`: Process specific IMEIs

### 3. Route Layer
**File**: `src/routes/db-integrity-check.route.ts`

Mounted at: `/api/db-integrity-check`

### 4. Admin UI
**File**: `public/db-integrity-check.html`

**Features**:
- Real-time statistics dashboard
- Configurable field selection (Model, Capacity, Color, Carrier)
- Batch size and delay configuration
- Progress tracking
- Results display with error reporting
- Read-only scan mode for preview

## Usage

### Accessing the Tool

Navigate to: `http://localhost:3001/db-integrity-check.html`

### Running an Integrity Check

1. **View Statistics**: Click "Refresh" to see current missing data statistics
2. **Configure Options**:
   - Select which fields to check (Model, Capacity, Color, Carrier)
   - Set max items to process (1-1000)
   - Set batch size (1-20) - number of parallel API calls
   - Set delay between batches (0-10000ms) - to avoid rate limiting
3. **Preview (Optional)**: Click "Scan Only" to see what would be processed without updating
4. **Run Check**: Click "Run Full Integrity Check" to scan and update records

### API Endpoints

#### Get Statistics
```bash
GET /api/db-integrity-check/stats
```

#### Scan for Missing Data
```bash
POST /api/db-integrity-check/scan
Content-Type: application/json

{
  "missingFields": ["model", "capacity", "color", "carrier"],
  "maxItems": 100
}
```

#### Run Integrity Check
```bash
POST /api/db-integrity-check/run
Content-Type: application/json

{
  "missingFields": ["model", "capacity", "color", "carrier"],
  "maxItems": 100,
  "batchSize": 5,
  "delayBetweenBatches": 1000
}
```

#### Process Specific IMEIs
```bash
POST /api/db-integrity-check/process-imeis
Content-Type: application/json

{
  "imeis": ["354058244522330", "357762268496654"],
  "batchSize": 5,
  "delayBetweenBatches": 1000
}
```

## Database Schema

The feature works with the `item` table which stores:
- `imei` (Primary Key)
- `model` (VARCHAR)
- `capacity` (VARCHAR) - maps to PhoneCheck "storage"
- `color` (VARCHAR)
- `carrier` (VARCHAR)
- `updated_at` (TIMESTAMP)

## PhoneCheck API Integration

The service uses the existing `PhonecheckService` to:
1. Fetch device details via `getDeviceDetails(imei)`
2. Abstract data using `abstractDeviceData(rawData)`
3. Map PhoneCheck fields to database fields:
   - `model` → `model`
   - `storage` → `capacity`
   - `color` → `color`
   - `carrier` → `carrier`

## Error Handling

- Individual IMEI failures don't stop the batch
- Errors are logged and reported in results
- Failed IMEIs are tracked separately from successful updates
- API failures are caught and reported per IMEI

## Performance Considerations

- **Batch Processing**: Processes IMEIs in configurable batches (default: 5)
- **Rate Limiting**: Configurable delay between batches (default: 1000ms)
- **Max Items**: Limits the number of records processed per run (default: 100)
- **Parallel Execution**: Batch items are processed in parallel using `Promise.all()`

## Safety Features

1. **Read-Only Scan Mode**: Preview what will be updated before running
2. **Confirmation Dialog**: Confirms before updating database
3. **Field-Level Updates**: Only updates missing fields, preserves existing data
4. **Transaction Safety**: Each update is independent (no transaction rollback on failures)
5. **Validation**: Only updates if PhoneCheck returns valid, non-"N/A" data

## Logging

All operations are logged using the application logger:
- Info: Scan results, batch progress, completion status
- Debug: Individual record updates
- Warn: PhoneCheck API failures for specific IMEIs
- Error: Processing failures

## Future Enhancements

Potential improvements:
- Scheduled automatic integrity checks
- Email notifications on completion
- Export results to CSV
- Undo/revert functionality
- Batch processing progress in real-time (WebSocket)
- Filter by date range or other criteria
- Support for additional missing fields

## Integration with Existing Systems

- Uses existing `PhonecheckService` for API calls
- Follows existing database connection pattern (DIRECT_URL)
- Uses existing logger utility
- Follows existing route registration pattern
- Compatible with existing admin tools structure
