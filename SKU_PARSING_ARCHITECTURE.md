# SKU Parsing System Architecture & Logic Flow

## 🏗️ **System Architecture Overview**

### **High-Level Architecture**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Google Sheets │───▶│  Sync Service    │───▶│   SKU Master    │
│   (Data Source) │    │  (Parser)        │    │   (Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ Reference Tables │
                       │ (Pattern Engine) │
                       └──────────────────┘
```

---

## 🔄 **Detailed Logic Flow**

### **1. Sync Service Entry Point**

```typescript
// EnhancedGoogleSheetsService.ts - Main sync method
async syncSkusWithTags(syncType: string = 'enhanced', forceFullSync: boolean = false): Promise<SyncResult> {
  const client = this.createClient();
  await client.connect();
  
  // 1. Get existing SKUs for comparison
  const existingSkus = await this.getExistingSkus(client);
  
  // 2. Get all sheet names
  const sheetNames = await this.getSheetNames();
  
  // 3. Process each sheet
  for (const sheetName of sheetNames) {
    const rows = await this.readSheetData(sheetName);
    
    // 4. Process each SKU with enhanced parsing
    for (const row of rows) {
      const deviceInfo = await this.parseSkuWithTags(row.sku_code, row.description, sheetName);
      // ... upsert logic
    }
  }
}
```

### **2. Core Parsing Logic Flow**

```typescript
async parseSkuWithTags(skuCode: string, description: string, sheetName: string): Promise<DeviceInfo> {
  const sku = (skuCode || '').toUpperCase().trim();
  const desc = (description || '').toLowerCase();
  
  // STEP 1: Try database parsing first (most accurate)
  const dbParsedInfo = await this.parseUsingDatabaseReference(sku);
  
  // STEP 2: Check if database parsing is complete
  if (dbParsedInfo && this.isCompleteDeviceInfo(dbParsedInfo)) {
    const tags = this.generateTags(dbParsedInfo, sku);
    return { ...dbParsedInfo, sku_tags: tags, tag_count: tags.length };
  }
  
  // STEP 3: Fallback to enhanced local parsing
  const deviceInfo = this.extractDeviceInfo(sku, desc, sheetName);
  
  // STEP 4: Merge database results with local parsing
  const mergedInfo = this.mergeDeviceInfo(dbParsedInfo, deviceInfo);
  
  // STEP 5: Generate tags array for SKU matching
  const tags = this.generateTags(mergedInfo, sku);
  
  return { ...mergedInfo, sku_tags: tags, tag_count: tags.length };
}
```

---

## 🗄️ **Database Architecture**

### **Reference Tables Structure**

```sql
-- Core reference tables with relationships
sku_brand_reference (1) ──┐
                          ├── sku_model_reference (many)
sku_color_reference (1) ──┤
                          ├── sku_capacity_reference (1)
sku_carrier_reference (1)─┤
                          ├── sku_postfix_reference (1)
sku_device_type_reference─┘
```

### **Table Relationships & Dependencies**

```sql
-- Brand → Model relationship
CREATE TABLE sku_model_reference (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER REFERENCES sku_brand_reference(id), -- Foreign key
    model_name VARCHAR(100) NOT NULL,
    model_code VARCHAR(50) NOT NULL UNIQUE,
    sku_patterns TEXT[] NOT NULL, -- Array of patterns
    device_type VARCHAR(20) DEFAULT 'PHONE',
    is_active BOOLEAN DEFAULT true
);
```

### **Pattern Storage Strategy**

```sql
-- Example: Samsung Galaxy S23 patterns
INSERT INTO sku_model_reference (brand_id, model_name, model_code, sku_patterns) VALUES
(2, 'Galaxy S23', 'S23', ARRAY['S23', 'S23-ULTRA', 'S23ULTRA', 'S23-PLUS', 'S23PLUS']);

-- Pattern matching uses array operations
WHERE EXISTS (
    SELECT 1 FROM unnest(sku_patterns) as pattern
    WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
)
```

---

## ⚙️ **PL/pgSQL Function Architecture**

### **Function Hierarchy**

```
parse_sku_complete() [Master Function]
├── get_brand_from_sku()
├── get_model_from_sku()
├── get_capacity_from_sku()
├── get_color_from_sku()
├── get_carrier_from_sku()
├── get_postfix_from_sku()
└── get_device_type_from_sku()
```

### **Core Function Logic**

```sql
-- Master parsing function
CREATE OR REPLACE FUNCTION parse_sku_complete(sku_code TEXT)
RETURNS TABLE(brand TEXT, model TEXT, capacity TEXT, color TEXT, carrier TEXT, postfix TEXT, device_type TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        get_brand_from_sku(sku_code) as brand,
        get_model_from_sku(sku_code, get_brand_from_sku(sku_code)) as model,
        get_capacity_from_sku(sku_code) as capacity,
        get_color_from_sku(sku_code) as color,
        get_carrier_from_sku(sku_code) as carrier,
        get_postfix_from_sku(sku_code) as postfix,
        get_device_type_from_sku(sku_code) as device_type;
END;
$$ LANGUAGE plpgsql;
```

### **Pattern Matching Algorithm**

```sql
-- Individual field parsing function
CREATE OR REPLACE FUNCTION get_brand_from_sku(sku_code TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    SELECT brand_name INTO result
    FROM sku_brand_reference
    WHERE is_active = true
    AND EXISTS (
        SELECT 1 FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    )
    ORDER BY (
        SELECT MAX(LENGTH(pattern)) 
        FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    ) DESC
    LIMIT 1;
    
    RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql;
```

**Algorithm Logic:**
1. **Pattern Matching**: Check if SKU contains any pattern from the array
2. **Length Priority**: Longer patterns take precedence (e.g., "S23-ULTRA" beats "S23")
3. **Active Filter**: Only use active patterns
4. **Fallback**: Return empty string if no match found

---

## 🔄 **Data Flow Architecture**

### **1. Input Processing**

```typescript
// Input: Raw SKU from Google Sheets
const input = {
  sku_code: "S23-ULTRA-256-BLK-VG",
  description: "Samsung Galaxy S23 Ultra 256GB Black Very Good",
  sheet_name: "Samsung_Devices"
};
```

### **2. Database Parsing Flow**

```sql
-- Step 1: Brand Detection
SELECT brand_name FROM sku_brand_reference 
WHERE sku_patterns @> ARRAY['S23', 'ULTRA'] -- Array contains
-- Result: "SAMSUNG"

-- Step 2: Model Detection (with brand context)
SELECT model_name FROM sku_model_reference m
JOIN sku_brand_reference b ON m.brand_id = b.id
WHERE b.brand_name = 'SAMSUNG' 
AND m.sku_patterns @> ARRAY['S23-ULTRA']
-- Result: "Galaxy S23 Ultra"

-- Step 3: Capacity Detection
SELECT capacity_value FROM sku_capacity_reference
WHERE sku_patterns @> ARRAY['256']
-- Result: "256GB"

-- Step 4: Color Detection
SELECT color_name FROM sku_color_reference
WHERE sku_patterns @> ARRAY['BLK']
-- Result: "BLACK"

-- Step 5: Postfix Detection
SELECT postfix_name FROM sku_postfix_reference
WHERE sku_patterns @> ARRAY['VG']
-- Result: "Very Good"
```

### **3. Result Merging Logic**

```typescript
private mergeDeviceInfo(
  dbInfo: DeviceInfo | null,
  localInfo: DeviceInfo
): DeviceInfo {
  if (!dbInfo) return localInfo;
  
  return {
    brand: dbInfo.brand || localInfo.brand,      // Database priority
    model: dbInfo.model || localInfo.model,      // Database priority
    capacity: dbInfo.capacity || localInfo.capacity,
    color: dbInfo.color || localInfo.color,
    carrier: dbInfo.carrier || localInfo.carrier,
    post_fix: dbInfo.post_fix || localInfo.post_fix,
    device_type: dbInfo.device_type || localInfo.device_type
  };
}
```

---

## 🎯 **Pattern Matching Strategies**

### **1. Exact Match Strategy**

```sql
-- Direct pattern matching
WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
```

**Examples:**
- `S23-ULTRA-256-BLK` contains `S23` → Match
- `PIXEL-7-128-WHT` contains `PIXEL-7` → Match

### **2. Length-Based Priority**

```sql
-- Longer patterns win
ORDER BY (
    SELECT MAX(LENGTH(pattern)) 
    FROM unnest(sku_patterns) as pattern
    WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
) DESC
```

**Examples:**
- `S23-ULTRA` (8 chars) beats `S23` (3 chars)
- `PIXEL-7-PRO` (10 chars) beats `PIXEL-7` (7 chars)

### **3. Context-Aware Matching**

```sql
-- Model matching with brand context
SELECT m.model_name FROM sku_model_reference m
JOIN sku_brand_reference b ON m.brand_id = b.id
WHERE b.brand_name = $1  -- Brand context
AND m.sku_patterns @> ARRAY[$2]  -- Pattern match
```

**Benefits:**
- Prevents cross-brand false matches
- Improves accuracy for ambiguous patterns
- Enables brand-specific model variants

---

## 🔧 **Performance Optimization**

### **1. Database Indexes**

```sql
-- Critical indexes for performance
CREATE INDEX idx_sku_brand_reference_code ON sku_brand_reference(brand_code);
CREATE INDEX idx_sku_model_reference_brand ON sku_model_reference(brand_id);
CREATE INDEX idx_sku_model_reference_code ON sku_model_reference(model_code);

-- Array operation indexes
CREATE INDEX idx_sku_brand_patterns ON sku_brand_reference USING GIN(sku_patterns);
CREATE INDEX idx_sku_model_patterns ON sku_model_reference USING GIN(sku_patterns);
```

### **2. Connection Management**

```typescript
// Efficient connection handling
private createClient(): Client {
  return new Client({
    connectionString: process.env['DIRECT_URL'],
    connectionTimeoutMillis: 30000,
  });
}

// Proper connection cleanup
try {
  const result = await client.query('SELECT * FROM parse_sku_complete($1::text)', [sku]);
  // Process result
} finally {
  await client.end(); // Always cleanup
}
```

### **3. Batch Processing**

```typescript
// Process SKUs in batches to avoid connection exhaustion
const batchSize = 50;
for (let i = 0; i < rows.length; i += batchSize) {
  const batch = rows.slice(i, i + batchSize);
  await Promise.all(batch.map(row => this.processSku(row)));
}
```

---

## 🚀 **Advanced Features**

### **1. Pattern Learning System**

```typescript
// Auto-learn patterns from successful matches
async learnPatternsFromMatches() {
  const successfulMatches = await this.getSuccessfulMatches();
  
  for (const match of successfulMatches) {
    const segments = this.segmentSku(match.sku_code);
    const newPatterns = this.extractNewPatterns(segments, match.brand);
    
    if (newPatterns.length > 0) {
      await this.addPatternsToDatabase(newPatterns);
    }
  }
}
```

### **2. Confidence Scoring**

```sql
-- Add confidence scoring to patterns
ALTER TABLE sku_brand_reference ADD COLUMN confidence_score INTEGER DEFAULT 100;
ALTER TABLE sku_model_reference ADD COLUMN confidence_score INTEGER DEFAULT 100;

-- Use confidence in matching
ORDER BY confidence_score DESC, LENGTH(pattern) DESC
```

### **3. Pattern Audit Trail**

```sql
-- Track pattern changes
CREATE TABLE sku_pattern_audit (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(20) NOT NULL,
  pattern_value TEXT NOT NULL,
  action VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
  added_by VARCHAR(50),
  added_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📊 **Monitoring & Analytics**

### **1. Parsing Performance Metrics**

```typescript
interface ParsingMetrics {
  totalSkus: number;
  databaseParsed: number;
  localParsed: number;
  mergedParsed: number;
  failedParsed: number;
  averageParseTime: number;
  accuracyRate: number;
}
```

### **2. Pattern Usage Analytics**

```sql
-- Track pattern usage
CREATE TABLE sku_pattern_usage (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(20) NOT NULL,
  pattern_value TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_used TIMESTAMP DEFAULT NOW()
);
```

### **3. Quality Metrics**

```typescript
// Calculate parsing quality
const qualityMetrics = {
  completeness: (completeSkus / totalSkus) * 100,
  accuracy: (accurateMatches / totalMatches) * 100,
  coverage: (coveredBrands / totalBrands) * 100
};
```

---

## 🔄 **Error Handling & Resilience**

### **1. Graceful Degradation**

```typescript
try {
  // Try database parsing first
  const dbResult = await this.parseUsingDatabaseReference(sku);
  if (dbResult && this.isCompleteDeviceInfo(dbResult)) {
    return dbResult;
  }
} catch (error) {
  console.warn(`Database parsing failed for ${sku}:`, error.message);
  // Continue to local parsing
}

// Fallback to local parsing
return this.extractDeviceInfo(sku, desc, sheetName);
```

### **2. Data Validation**

```typescript
private isCompleteDeviceInfo(info: DeviceInfo): boolean {
  return !!(info.brand && info.model && info.capacity && info.color);
}

private validateParsedData(info: DeviceInfo): boolean {
  // Validate brand exists
  if (info.brand && !this.validBrands.includes(info.brand)) {
    return false;
  }
  
  // Validate capacity format
  if (info.capacity && !info.capacity.match(/^\d+[GM]B$/)) {
    return false;
  }
  
  return true;
}
```

### **3. Recovery Mechanisms**

```typescript
// Retry logic for database connections
async parseWithRetry(sku: string, maxRetries: number = 3): Promise<DeviceInfo> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.parseSkuWithTags(sku, '', '');
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await this.delay(1000 * attempt); // Exponential backoff
    }
  }
}
```

---

## 🎯 **Key Architectural Benefits**

### **1. Scalability**
- **Database-driven**: Handles thousands of patterns efficiently
- **Indexed queries**: Fast pattern matching even with large datasets
- **Connection pooling**: Manages database connections effectively

### **2. Maintainability**
- **Separation of concerns**: Logic separated from data
- **No code deployment**: Pattern updates via database only
- **Version control**: Track pattern changes over time

### **3. Flexibility**
- **Dynamic patterns**: Add new patterns without code changes
- **Context-aware**: Brand-specific model matching
- **Fallback system**: Multiple parsing strategies

### **4. Performance**
- **Optimized queries**: Database indexes for fast lookups
- **Batch processing**: Efficient handling of large datasets
- **Caching**: Reduce redundant database calls

This architecture provides a robust, scalable foundation for SKU parsing that can grow with your business needs while maintaining high accuracy and performance.
