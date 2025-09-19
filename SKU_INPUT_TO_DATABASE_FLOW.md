# SKU Input-to-Database Flow Analysis

## 🔄 **Complete Input-to-Database Flow**

### **Input Sources & Data Structure**

#### **1. Google Sheets Input**
```typescript
// Raw input from Google Sheets
interface SheetRow {
  sku_code: string;        // "S23-ULTRA-256-BLK-VG"
  description: string;     // "Samsung Galaxy S23 Ultra 256GB Black Very Good"
  price?: string;          // "$899.99"
  condition?: string;      // "Very Good"
  row_number: number;      // 15
}

// Sheet metadata
interface SheetMetadata {
  sheetName: string;       // "Samsung_Devices"
  spreadsheetId: string;   // "18Zo9Z9n7D6j0dzYpPTj9_zgrg0poNFJ5rU5iss593qo"
  rowCount: number;        // 150
}
```

#### **2. Input Processing Pipeline**

```
Google Sheets → Sheet Reading → Row Filtering → SKU Parsing → Database Upsert
```

---

## 🔍 **Detailed Input Processing Flow**

### **Step 1: Sheet Data Reading**

```typescript
// EnhancedGoogleSheetsService.ts - readSheetData()
async readSheetData(sheetName: string): Promise<SheetRow[]> {
  try {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A:Z`,  // Read all columns
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    });

    const rows = response.data.values || [];
    
    // Transform raw data to structured format
    return rows
      .slice(1) // Skip header row
      .map((rowData: any[], index: number) => ({
        sku_code: rowData.sku_code || rowData.sku || '',
        description: rowData.description || rowData.product_description || '',
        price: rowData.price || '',
        condition: rowData.condition || '',
        row_number: index + 2 // +2 because we skipped header and arrays are 0-indexed
      }))
      .filter((row: SheetRow) => row.sku_code && row.sku_code.trim());
  } catch (error) {
    console.error(`❌ Error reading sheet ${sheetName}:`, error);
    throw error;
  }
}
```

**Input Processing:**
- **Raw Data**: `[["S23-ULTRA-256-BLK-VG", "Samsung Galaxy S23 Ultra 256GB Black Very Good", "$899.99", "Very Good"], ...]`
- **Structured Data**: `[{sku_code: "S23-ULTRA-256-BLK-VG", description: "Samsung Galaxy S23 Ultra 256GB Black Very Good", ...}, ...]`
- **Filtering**: Remove empty SKU codes

### **Step 2: SKU Parsing with Hybrid Approach**

```typescript
// EnhancedGoogleSheetsService.ts - parseSkuWithTags()
async parseSkuWithTags(skuCode: string, description: string, sheetName: string): Promise<DeviceInfo> {
  const sku = (skuCode || '').toUpperCase().trim();        // "S23-ULTRA-256-BLK-VG"
  const desc = (description || '').toLowerCase();          // "samsung galaxy s23 ultra 256gb black very good"
  
  // STEP 1: Try database parsing first (most accurate)
  const dbParsedInfo = await this.parseUsingDatabaseReference(sku);
  
  // STEP 2: Check if database parsing is complete
  if (dbParsedInfo && this.isCompleteDeviceInfo(dbParsedInfo)) {
    const tags = this.generateTags(dbParsedInfo, sku);
    return {
      ...dbParsedInfo,
      sku_tags: tags,
      tag_count: tags.length
    };
  }
  
  // STEP 3: Fallback to enhanced local parsing
  const deviceInfo = this.extractDeviceInfo(sku, desc, sheetName);
  
  // STEP 4: Merge database results with local parsing
  const mergedInfo = this.mergeDeviceInfo(dbParsedInfo, deviceInfo);
  
  // STEP 5: Generate tags array for SKU matching
  const tags = this.generateTags(mergedInfo, sku);
  
  return {
    ...mergedInfo,
    sku_tags: tags,
    tag_count: tags.length
  };
}
```

**Input Transformation:**
- **Input**: `skuCode: "S23-ULTRA-256-BLK-VG", description: "Samsung Galaxy S23 Ultra 256GB Black Very Good"`
- **Normalized**: `sku: "S23-ULTRA-256-BLK-VG", desc: "samsung galaxy s23 ultra 256gb black very good"`
- **Output**: `DeviceInfo` with parsed fields

---

## 🗄️ **Database Parsing Flow**

### **Step 1: Database Reference Parsing**

```typescript
// EnhancedGoogleSheetsService.ts - parseUsingDatabaseReference()
private async parseUsingDatabaseReference(sku: string): Promise<DeviceInfo | null> {
  try {
    const client = this.createClient();
    await client.connect();
    
    try {
      // Single function call to parse entire SKU
      const result = await client.query('SELECT * FROM parse_sku_complete($1::text)', [sku]);
      const parsed = result.rows[0];
      
      if (parsed) {
        return {
          brand: parsed.brand || '',           // "SAMSUNG"
          model: parsed.model || '',           // "Galaxy S23 Ultra"
          capacity: parsed.capacity || '',     // "256GB"
          color: parsed.color || '',           // "BLACK"
          carrier: parsed.carrier || '',       // "UNLOCKED"
          post_fix: parsed.postfix || '',      // "Very Good"
          device_type: parsed.device_type || 'PHONE'  // "PHONE"
        };
      }
    } finally {
      await client.end();
    }
  } catch (error) {
    console.warn(`⚠️ Database parsing failed for SKU ${sku}:`, error.message);
  }
  
  return null;
}
```

**Database Query Flow:**
```sql
-- Input: "S23-ULTRA-256-BLK-VG"
-- Query: SELECT * FROM parse_sku_complete('S23-ULTRA-256-BLK-VG')
-- Result: {
--   brand: "SAMSUNG",
--   model: "Galaxy S23 Ultra", 
--   capacity: "256GB",
--   color: "BLACK",
--   carrier: "UNLOCKED",
--   postfix: "Very Good",
--   device_type: "PHONE"
-- }
```

### **Step 2: Local Parsing Fallback**

```typescript
// EnhancedGoogleSheetsService.ts - extractDeviceInfo()
private extractDeviceInfo(sku: string, desc: string, sheetName: string): DeviceInfo {
  let brand = '';
  let model = '';
  let capacity = '';
  let color = '';
  let carrier = '';
  let post_fix = '';
  let device_type = 'PHONE';
  
  // Enhanced brand detection with better logic
  brand = this.detectBrand(sku, desc, sheetName);
  
  // Extract capacity with improved patterns
  capacity = this.extractCapacity(sku, desc);
  
  // Extract color with improved mapping
  color = this.extractColor(sku, desc);
  
  // Extract carrier with improved mapping
  carrier = this.extractCarrier(sku, desc);
  
  // Extract postfix (condition/grade indicators)
  post_fix = this.extractPostfix(sku);
  
  // Determine device type
  device_type = this.detectDeviceType(sku, desc);
  
  // Enhanced model extraction
  model = this.extractModel(sku, desc, brand, device_type);
  
  return {
    brand,
    model,
    capacity,
    color,
    carrier,
    post_fix,
    device_type
  };
}
```

**Local Parsing Examples:**
```typescript
// Brand Detection
detectBrand("S23-ULTRA-256-BLK-VG", "samsung galaxy s23 ultra", "Samsung_Devices")
// Result: "SAMSUNG" (from sheet name + SKU pattern)

// Capacity Extraction
extractCapacity("S23-ULTRA-256-BLK-VG", "samsung galaxy s23 ultra 256gb")
// Result: "256GB" (from regex pattern /(\d+)\s*(GB|TB)/i)

// Color Extraction
extractColor("S23-ULTRA-256-BLK-VG", "samsung galaxy s23 ultra black")
// Result: "BLACK" (from color mapping BLK → BLACK)
```

---

## 🔄 **Database Update Flow**

### **Step 1: SKU Data Preparation**

```typescript
// EnhancedGoogleSheetsService.ts - syncSkusWithTags()
for (const row of rows) {
  try {
    // Parse SKU with hybrid approach
    const deviceInfo = await this.parseSkuWithTags(row.sku_code, row.description, sheetName);
    
    // Prepare SKU data for database
    const skuData: SkuData = {
      ...deviceInfo,                    // Parsed device info
      sku_code: row.sku_code,           // "S23-ULTRA-256-BLK-VG"
      source_tab: sheetName,            // "Samsung_Devices"
      sheet_row_id: row.row_number,     // 15
      is_active: true,
      last_synced: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Check if SKU needs updating
    const existingSku = existingSkus.get(skuData.sku_code);
    
    if (forceFullSync || this.hasSkuChanged(existingSku, deviceInfo)) {
      const result = await this.upsertSkuWithTags(client, skuData);
      // ... handle result
    }
  } catch (error) {
    console.error(`❌ Error processing SKU ${row.sku_code}:`, error);
    failedSkus++;
  }
}
```

**Data Structure Transformation:**
```typescript
// Input Row
{
  sku_code: "S23-ULTRA-256-BLK-VG",
  description: "Samsung Galaxy S23 Ultra 256GB Black Very Good",
  row_number: 15
}

// Parsed Device Info
{
  brand: "SAMSUNG",
  model: "Galaxy S23 Ultra",
  capacity: "256GB",
  color: "BLACK",
  carrier: "UNLOCKED",
  post_fix: "Very Good",
  device_type: "PHONE",
  sku_tags: ["SAMSUNG", "Galaxy S23 Ultra", "256GB", "BLACK", "Very Good"],
  tag_count: 5
}

// Final SKU Data
{
  sku_code: "S23-ULTRA-256-BLK-VG",
  brand: "SAMSUNG",
  model: "Galaxy S23 Ultra",
  capacity: "256GB",
  color: "BLACK",
  carrier: "UNLOCKED",
  post_fix: "Very Good",
  device_type: "PHONE",
  source_tab: "Samsung_Devices",
  sheet_row_id: 15,
  sku_tags: ["SAMSUNG", "Galaxy S23 Ultra", "256GB", "BLACK", "Very Good"],
  tag_count: 5,
  is_active: true,
  last_synced: "2024-01-15T10:30:00Z",
  created_at: "2024-01-15T10:30:00Z",
  updated_at: "2024-01-15T10:30:00Z"
}
```

### **Step 2: Database Upsert Operation**

```typescript
// EnhancedGoogleSheetsService.ts - upsertSkuWithTags()
async upsertSkuWithTags(client: Client, skuData: SkuData): Promise<{ id: number; sku_code: string; isNew: boolean }> {
  try {
    const upsertQuery = `
      INSERT INTO sku_master (
        sku_code, brand, model, capacity, color, carrier, post_fix, 
        device_type, source_tab, sheet_row_id, sku_tags, tag_count,
        is_active, last_synced, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), NOW())
      ON CONFLICT (sku_code) DO UPDATE SET
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        capacity = EXCLUDED.capacity,
        color = EXCLUDED.color,
        carrier = EXCLUDED.carrier,
        post_fix = EXCLUDED.post_fix,
        device_type = EXCLUDED.device_type,
        source_tab = EXCLUDED.source_tab,
        sheet_row_id = EXCLUDED.sheet_row_id,
        sku_tags = EXCLUDED.sku_tags,
        tag_count = EXCLUDED.tag_count,
        is_active = EXCLUDED.is_active,
        last_synced = EXCLUDED.last_synced,
        updated_at = NOW()
      RETURNING id, sku_code, (xmax = 0) AS is_new
    `;
    
    const result = await client.query(upsertQuery, [
      skuData.sku_code,      // "S23-ULTRA-256-BLK-VG"
      skuData.brand,         // "SAMSUNG"
      skuData.model,         // "Galaxy S23 Ultra"
      skuData.capacity,      // "256GB"
      skuData.color,         // "BLACK"
      skuData.carrier,       // "UNLOCKED"
      skuData.post_fix,      // "Very Good"
      skuData.device_type,   // "PHONE"
      skuData.source_tab,    // "Samsung_Devices"
      skuData.sheet_row_id,  // 15
      skuData.sku_tags,      // ["SAMSUNG", "Galaxy S23 Ultra", "256GB", "BLACK", "Very Good"]
      skuData.tag_count,     // 5
      true                   // is_active
    ]);
    
    return {
      id: result.rows[0].id,
      sku_code: result.rows[0].sku_code,
      isNew: result.rows[0].is_new
    };
    
  } catch (error) {
    console.error(`❌ Error upserting SKU ${skuData.sku_code}:`, error);
    throw error;
  }
}
```

**Database Operation:**
```sql
-- INSERT (new SKU)
INSERT INTO sku_master (sku_code, brand, model, capacity, color, carrier, post_fix, device_type, source_tab, sheet_row_id, sku_tags, tag_count, is_active, last_synced, created_at, updated_at)
VALUES ('S23-ULTRA-256-BLK-VG', 'SAMSUNG', 'Galaxy S23 Ultra', '256GB', 'BLACK', 'UNLOCKED', 'Very Good', 'PHONE', 'Samsung_Devices', 15, ARRAY['SAMSUNG', 'Galaxy S23 Ultra', '256GB', 'BLACK', 'Very Good'], 5, true, NOW(), NOW(), NOW());

-- UPDATE (existing SKU)
UPDATE sku_master SET
  brand = 'SAMSUNG',
  model = 'Galaxy S23 Ultra',
  capacity = '256GB',
  color = 'BLACK',
  carrier = 'UNLOCKED',
  post_fix = 'Very Good',
  device_type = 'PHONE',
  source_tab = 'Samsung_Devices',
  sheet_row_id = 15,
  sku_tags = ARRAY['SAMSUNG', 'Galaxy S23 Ultra', '256GB', 'BLACK', 'Very Good'],
  tag_count = 5,
  is_active = true,
  last_synced = NOW(),
  updated_at = NOW()
WHERE sku_code = 'S23-ULTRA-256-BLK-VG';
```

---

## 📊 **Change Detection & Optimization**

### **Step 1: Change Detection Logic**

```typescript
// EnhancedGoogleSheetsService.ts - hasSkuChanged()
private hasSkuChanged(existingSku: ExistingSku | undefined, newDeviceInfo: DeviceInfo): boolean {
  if (!existingSku) return true; // New SKU
  
  // Check if any field has changed
  if (existingSku.brand !== newDeviceInfo.brand) return true;
  if (existingSku.model !== newDeviceInfo.model) return true;
  if (existingSku.capacity !== newDeviceInfo.capacity) return true;
  if (existingSku.color !== newDeviceInfo.color) return true;
  if (existingSku.carrier !== newDeviceInfo.carrier) return true;
  if (existingSku.post_fix !== newDeviceInfo.post_fix) return true;
  if (existingSku.device_type !== newDeviceInfo.device_type) return true;
  
  // Check if tags have changed
  if (this.haveTagsChanged(existingSku.sku_tags, newDeviceInfo.sku_tags)) return true;
  
  return false;
}

private haveTagsChanged(existingTags: string[], newTags: string[]): boolean {
  if (existingTags.length !== newTags.length) return true;
  
  const existingTagsSorted = [...existingTags].sort();
  const newTagsSorted = [...newTags].sort();
  
  for (let i = 0; i < existingTagsSorted.length; i++) {
    if (existingTagsSorted[i] !== newTagsSorted[i]) return true;
  }
  
  return false;
}
```

**Change Detection Examples:**
```typescript
// Example 1: No changes (skip update)
existingSku: {
  brand: "SAMSUNG",
  model: "Galaxy S23 Ultra",
  capacity: "256GB",
  color: "BLACK",
  sku_tags: ["SAMSUNG", "Galaxy S23 Ultra", "256GB", "BLACK"]
}

newDeviceInfo: {
  brand: "SAMSUNG",
  model: "Galaxy S23 Ultra", 
  capacity: "256GB",
  color: "BLACK",
  sku_tags: ["SAMSUNG", "Galaxy S23 Ultra", "256GB", "BLACK"]
}
// Result: hasSkuChanged() = false → SKIP UPDATE

// Example 2: Changes detected (perform update)
existingSku: {
  brand: "SAMSUNG",
  model: "Galaxy S23",  // Different model
  capacity: "128GB",    // Different capacity
  color: "BLACK",
  sku_tags: ["SAMSUNG", "Galaxy S23", "128GB", "BLACK"]
}

newDeviceInfo: {
  brand: "SAMSUNG",
  model: "Galaxy S23 Ultra",  // Updated model
  capacity: "256GB",          // Updated capacity
  color: "BLACK",
  sku_tags: ["SAMSUNG", "Galaxy S23 Ultra", "256GB", "BLACK"]
}
// Result: hasSkuChanged() = true → PERFORM UPDATE
```

---

## 🔄 **Sync Logging & Monitoring**

### **Step 1: Sync Log Creation**

```typescript
// EnhancedGoogleSheetsService.ts - createSyncLog()
async createSyncLog(client: Client, syncType: string): Promise<number> {
  const result = await client.query(`
    INSERT INTO sku_sync_log (sync_type, status, started_at)
    VALUES ($1, 'running', NOW())
    RETURNING id
  `, [syncType]);
  
  return result.rows[0].id;
}
```

### **Step 2: Sync Progress Tracking**

```typescript
// EnhancedGoogleSheetsService.ts - syncSkusWithTags()
let totalSkus = 0;
let newSkus = 0;
let updatedSkus = 0;
let skippedSkus = 0;
let failedSkus = 0;

// Process each SKU
for (const row of rows) {
  try {
    const deviceInfo = await this.parseSkuWithTags(row.sku_code, row.description, sheetName);
    const skuData: SkuData = { ...deviceInfo, ...row };
    
    const existingSku = existingSkus.get(skuData.sku_code);
    
    if (forceFullSync || this.hasSkuChanged(existingSku, deviceInfo)) {
      const result = await this.upsertSkuWithTags(client, skuData);
      totalSkus++;
      
      if (result.isNew) {
        newSkus++;
      } else {
        updatedSkus++;
      }
    } else {
      skippedSkus++;
    }
  } catch (error) {
    failedSkus++;
  }
}
```

### **Step 3: Sync Completion Logging**

```typescript
// EnhancedGoogleSheetsService.ts - updateSyncLog()
async updateSyncLog(client: Client, syncLogId: number, status: string, data: any): Promise<void> {
  await client.query(`
    UPDATE sku_sync_log 
    SET status = $1, 
        total_skus = $2,
        new_skus = $3,
        updated_skus = $4,
        failed_skus = $5,
        skipped_skus = $6,
        error_message = $7,
        completed_at = NOW()
    WHERE id = $8
  `, [
    status,                    // 'success' or 'failed'
    data.totalSkus || 0,      // 150
    data.newSkus || 0,        // 25
    data.updatedSkus || 0,    // 100
    data.failedSkus || 0,     // 5
    data.skippedSkus || 0,    // 20
    data.errorMessage || null,
    syncLogId
  ]);
}
```

**Sync Log Example:**
```sql
-- Sync log entry
INSERT INTO sku_sync_log (sync_type, status, started_at, total_skus, new_skus, updated_skus, failed_skus, skipped_skus, completed_at)
VALUES ('enhanced', 'success', '2024-01-15T10:30:00Z', 150, 25, 100, 5, 20, '2024-01-15T10:35:00Z');
```

---

## 🎯 **Key Input-to-Database Insights**

### **1. Data Flow Efficiency**
- **Incremental Updates**: Only update SKUs that have changed
- **Batch Processing**: Process multiple SKUs in single transaction
- **Change Detection**: Avoid unnecessary database writes
- **Connection Management**: Proper database connection handling

### **2. Parsing Accuracy**
- **Hybrid Approach**: Database parsing first, local parsing fallback
- **Context Awareness**: Sheet name provides additional context
- **Pattern Matching**: Sophisticated regex and database pattern matching
- **Data Validation**: Ensure parsed data quality

### **3. Error Handling**
- **Graceful Degradation**: Continue processing even if individual SKUs fail
- **Comprehensive Logging**: Track all operations and failures
- **Retry Logic**: Handle temporary database issues
- **Data Integrity**: Maintain consistent database state

### **4. Performance Optimization**
- **Connection Pooling**: Efficient database resource management
- **Batch Operations**: Reduce database round trips
- **Index Usage**: Leverage database indexes for fast lookups
- **Memory Management**: Process large datasets efficiently

This comprehensive flow ensures that SKU data from Google Sheets is accurately parsed, validated, and efficiently stored in the database while maintaining data integrity and performance.


