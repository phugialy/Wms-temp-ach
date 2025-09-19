# Complete Workflow: Bulk Add to SKU Matching

## Current System Architecture

### 1. **Bulk Add API** (`/api/imei-queue/bulkadd`)
- **Controller**: `ImeiQueueController.addToQueue()`
- **Service**: `DirectQueueService.addToQueue()`
- **Process**: 
  - Receives bulk IMEI data (chunked in 50-item batches)
  - Inserts raw data into `data_queue` table with `status = 'pending'`
  - Uses direct PostgreSQL connection via `DIRECT_URL`

### 2. **Queue Processing** (Manual Trigger)
- **Script**: `process-queue.js`
- **Service**: `QueueProcessor.processQueue()`
- **Process**:
  - Reads all `pending` items from `data_queue`
  - Processes each item into database tables:
    - `product` table (IMEI, brand, SKU)
    - `item` table (model, capacity, color, carrier, etc.)
    - `device_test` table (working status, notes, tester)
    - `sku_matching_queue` table (triggers SKU matching)
  - Marks `data_queue` items as `completed`

### 3. **SKU Matching** (Automatic Trigger)
- **Service**: `SkuMatchingAgent.processQueueEntry()`
- **Process**:
  - Reads from `sku_matching_queue` (status = 'pending')
  - Gets device data from `sku_matching_view`
  - Uses `CompleteSkuMatchingService.matchImeiToSku()`
  - Updates `sku_matching_results` table
  - Marks `sku_matching_queue` as `completed`

## Detailed Flow

```
Bulk Add API
    ↓
data_queue (status: pending)
    ↓
Manual: node process-queue.js
    ↓
product table ← item table ← device_test table
    ↓
sku_matching_queue (status: pending)
    ↓
Automatic: SkuMatchingAgent
    ↓
sku_matching_results table
```

## Key Components

### **DirectQueueService**
- Handles bulk data insertion into `data_queue`
- Uses direct PostgreSQL connection
- Processes items in chunks to prevent overwhelming database

### **QueueProcessor**
- Processes `data_queue` items into core database tables
- Handles all working statuses (YES, NO, PENDING, etc.)
- Maps raw data fields to proper database columns
- Inserts into `sku_matching_queue` for SKU matching

### **SkuMatchingAgent**
- Processes `sku_matching_queue` items
- Uses `CompleteSkuMatchingService` for matching logic
- Handles carrier status parsing from `device_notes`
- Updates `sku_matching_results` with matched SKUs

### **CompleteSkuMatchingService**
- Core SKU matching logic
- Parses `device_notes` for carrier status overrides
- Smart filtering based on device characteristics
- Scoring system for match quality
- Handles postfix filtering for bulk processing

## Current Status

✅ **Working Components:**
- Bulk add API (inserts into `data_queue`)
- Queue processing (processes into database tables)
- SKU matching (matches devices to SKUs)
- PENDING status handling (correctly included in `device_test`)

⚠️ **Manual Steps:**
- Queue processing requires running `node process-queue.js`
- No automatic triggers due to PostgreSQL JSONB operator issues

## Usage Instructions

1. **Bulk Add Data**: Use `/api/imei-queue/bulkadd` endpoint
2. **Process Queue**: Run `node process-queue.js` to process pending items
3. **SKU Matching**: Automatically triggered when items are added to `sku_matching_queue`
4. **View Results**: Check `sku_matching_results` table for matched SKUs

## Data Flow Summary

1. **Raw IMEI Data** → `data_queue` (pending)
2. **Queue Processing** → `product`, `item`, `device_test` tables
3. **SKU Matching** → `sku_matching_results` table
4. **Final Result**: Device matched to appropriate SKU with confidence score






