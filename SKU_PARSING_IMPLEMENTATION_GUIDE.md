# SKU Parsing System Implementation Guide

## 🏗️ **System Architecture Deep Dive**

### **Core Components**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM COMPONENTS                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

1. EnhancedGoogleSheetsService.ts    - Main sync orchestrator
2. sku-reference-tables.sql          - Database schema & functions
3. PL/pgSQL Functions                - Pattern matching engine
4. Reference Tables                  - Pattern storage & management
5. SKU Master Table                  - Final parsed data storage
```

---

## 🔧 **Implementation Details**

### **1. EnhancedGoogleSheetsService.ts Architecture**

```typescript
export class EnhancedGoogleSheetsService {
  // Core Properties
  private spreadsheetId: string;
  private sheets: any;
  private useApiKey: boolean;
  
  // Pattern Storage (Legacy - being replaced by database)
  private brandPatterns: Record<string, RegExp>;
  private capacityPatterns: Array<{ pattern: RegExp; format: Function }>;
  private colorMappings: Record<string, string>;
  private carrierMappings: Record<string, string>;
  
  // Main Entry Point
  async syncSkusWithTags(syncType: string, forceFullSync: boolean): Promise<SyncResult> {
    // 1. Initialize database connection
    // 2. Get existing SKUs for comparison
    // 3. Process each Google Sheet
    // 4. Parse each SKU using hybrid approach
    // 5. Upsert to database
    // 6. Return sync results
  }
  
  // Core Parsing Method
  async parseSkuWithTags(skuCode: string, description: string, sheetName: string): Promise<DeviceInfo> {
    // 1. Try database parsing first
    // 2. Check completeness
    // 3. Fallback to local parsing
    // 4. Merge results
    // 5. Generate tags
  }
}
```

### **2. Database Schema Architecture**

```sql
-- Core Reference Tables
CREATE TABLE sku_brand_reference (
    id SERIAL PRIMARY KEY,
    brand_name VARCHAR(50) NOT NULL,
    brand_code VARCHAR(20) NOT NULL UNIQUE,
    sku_patterns TEXT[] NOT NULL,  -- Array of patterns
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Pattern Storage Strategy
-- Example: Samsung patterns
INSERT INTO sku_brand_reference (brand_name, brand_code, sku_patterns) VALUES
('SAMSUNG', 'SAMSUNG', ARRAY['SAMSUNG', 'GALAXY', 'S23', 'S22', 'S21', 'S20', 'S10', 'NOTE', 'TAB-', 'WATCH-', 'ZFLIP', 'FOLD']);
```

### **3. PL/pgSQL Function Architecture**

```sql
-- Master Parsing Function
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

-- Individual Field Parsing Functions
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

---

## 🔄 **Data Flow Implementation**

### **1. Input Processing**

```typescript
// Input: Raw data from Google Sheets
interface SheetRow {
  sku_code: string;        // "S23-ULTRA-256-BLK-VG"
  description: string;     // "Samsung Galaxy S23 Ultra 256GB Black Very Good"
  price?: string;
  condition?: string;
  row_number: number;
}

// Processing: Normalize and prepare
const sku = (skuCode || '').toUpperCase().trim();
const desc = (description || '').toLowerCase();
```

### **2. Database Parsing Flow**

```typescript
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
          brand: parsed.brand || '',
          model: parsed.model || '',
          capacity: parsed.capacity || '',
          color: parsed.color || '',
          carrier: parsed.carrier || '',
          post_fix: parsed.postfix || '',
          device_type: parsed.device_type || 'PHONE'
        };
      }
    } finally {
      await client.end();
    }
  } catch (error) {
    console.warn(`Database parsing failed for SKU ${sku}:`, error.message);
  }
  
  return null;
}
```

### **3. Pattern Matching Algorithm**

```sql
-- Pattern Matching Logic
SELECT brand_name 
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

-- Algorithm Steps:
-- 1. Check if SKU contains any pattern from the array
-- 2. Use length-based priority (longer patterns win)
-- 3. Return the best match
-- 4. Fallback to empty string if no match
```

### **4. Result Merging Logic**

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

## 🎯 **Pattern Management System**

### **1. Adding New Patterns**

```sql
-- Add new brand patterns
INSERT INTO sku_brand_reference (brand_name, brand_code, sku_patterns, description) VALUES
('XIAOMI', 'XIAOMI', ARRAY['XIAOMI', 'MI-', 'REDMI', 'POCO'], 'Xiaomi devices')
ON CONFLICT (brand_code) DO NOTHING;

-- Add new model patterns
INSERT INTO sku_model_reference (brand_id, model_name, model_code, sku_patterns, device_type, description) VALUES
(6, 'Redmi Note 12', 'REDMI-NOTE-12', ARRAY['REDMI-NOTE-12', 'REDMINOTE12'], 'PHONE', 'Redmi Note 12 series')
ON CONFLICT (model_code) DO NOTHING;

-- Add new color patterns
INSERT INTO sku_color_reference (color_name, color_code, sku_patterns, description) VALUES
('MINT', 'MINT', ARRAY['MINT'], 'Mint color')
ON CONFLICT (color_code) DO NOTHING;
```

### **2. Pattern Validation**

```typescript
// Validate pattern before adding
private validatePattern(pattern: string, type: string): boolean {
  // Check for valid characters
  if (!/^[A-Z0-9\-_]+$/i.test(pattern)) {
    return false;
  }
  
  // Check for minimum length
  if (pattern.length < 2) {
    return false;
  }
  
  // Check for conflicts
  if (this.hasConflictingPattern(pattern, type)) {
    return false;
  }
  
  return true;
}
```

### **3. Pattern Learning System**

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

// Extract new patterns from SKU segments
private extractNewPatterns(segments: string[], brand: string): string[] {
  const newPatterns: string[] = [];
  
  for (const segment of segments) {
    // Check if pattern already exists
    if (!this.patternExists(segment, brand)) {
      newPatterns.push(segment);
    }
  }
  
  return newPatterns;
}
```

---

## 🔧 **Performance Optimization**

### **1. Database Indexes**

```sql
-- Critical indexes for performance
CREATE INDEX idx_sku_brand_reference_code ON sku_brand_reference(brand_code);
CREATE INDEX idx_sku_model_reference_brand ON sku_model_reference(brand_id);
CREATE INDEX idx_sku_model_reference_code ON sku_model_reference(model_code);

-- Array operation indexes (GIN indexes for array operations)
CREATE INDEX idx_sku_brand_patterns ON sku_brand_reference USING GIN(sku_patterns);
CREATE INDEX idx_sku_model_patterns ON sku_model_reference USING GIN(sku_patterns);
CREATE INDEX idx_sku_color_patterns ON sku_color_reference USING GIN(sku_patterns);
CREATE INDEX idx_sku_capacity_patterns ON sku_capacity_reference USING GIN(sku_patterns);
CREATE INDEX idx_sku_carrier_patterns ON sku_carrier_reference USING GIN(sku_patterns);
CREATE INDEX idx_sku_postfix_patterns ON sku_postfix_reference USING GIN(sku_patterns);
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
private async parseWithConnection<T>(operation: (client: Client) => Promise<T>): Promise<T> {
  const client = this.createClient();
  try {
    await client.connect();
    return await operation(client);
  } finally {
    await client.end();
  }
}
```

### **3. Batch Processing**

```typescript
// Process SKUs in batches
async processBatch(skus: SheetRow[], batchSize: number = 50): Promise<SyncResult> {
  const results: SyncResult[] = [];
  
  for (let i = 0; i < skus.length; i += batchSize) {
    const batch = skus.slice(i, i + batchSize);
    const batchResult = await this.processBatchInternal(batch);
    results.push(batchResult);
  }
  
  return this.mergeResults(results);
}
```

---

## 🚀 **Advanced Features**

### **1. Confidence Scoring**

```sql
-- Add confidence scoring to patterns
ALTER TABLE sku_brand_reference ADD COLUMN confidence_score INTEGER DEFAULT 100;
ALTER TABLE sku_model_reference ADD COLUMN confidence_score INTEGER DEFAULT 100;

-- Use confidence in matching
SELECT brand_name 
FROM sku_brand_reference
WHERE is_active = true
AND EXISTS (
    SELECT 1 FROM unnest(sku_patterns) as pattern
    WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
)
ORDER BY confidence_score DESC, LENGTH(pattern) DESC
LIMIT 1;
```

### **2. Pattern Audit Trail**

```sql
-- Track pattern changes
CREATE TABLE sku_pattern_audit (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(20) NOT NULL,
  pattern_value TEXT NOT NULL,
  action VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
  old_value TEXT,
  new_value TEXT,
  added_by VARCHAR(50),
  added_at TIMESTAMP DEFAULT NOW()
);

-- Trigger to log changes
CREATE OR REPLACE FUNCTION log_pattern_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO sku_pattern_audit (pattern_type, pattern_value, action, new_value, added_by)
    VALUES ('BRAND', NEW.brand_name, 'INSERT', NEW.brand_name, current_user);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO sku_pattern_audit (pattern_type, pattern_value, action, old_value, new_value, added_by)
    VALUES ('BRAND', NEW.brand_name, 'UPDATE', OLD.brand_name, NEW.brand_name, current_user);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO sku_pattern_audit (pattern_type, pattern_value, action, old_value, added_by)
    VALUES ('BRAND', OLD.brand_name, 'DELETE', OLD.brand_name, current_user);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brand_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON sku_brand_reference
  FOR EACH ROW EXECUTE FUNCTION log_pattern_changes();
```

### **3. Pattern Usage Analytics**

```sql
-- Track pattern usage
CREATE TABLE sku_pattern_usage (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(20) NOT NULL,
  pattern_value TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_used TIMESTAMP DEFAULT NOW(),
  success_rate DECIMAL(5,2) DEFAULT 100.00
);

-- Update usage statistics
CREATE OR REPLACE FUNCTION update_pattern_usage(pattern_type VARCHAR, pattern_value TEXT, success BOOLEAN)
RETURNS VOID AS $$
BEGIN
  INSERT INTO sku_pattern_usage (pattern_type, pattern_value, usage_count, success_rate)
  VALUES (pattern_type, pattern_value, 1, CASE WHEN success THEN 100.00 ELSE 0.00 END)
  ON CONFLICT (pattern_type, pattern_value) 
  DO UPDATE SET 
    usage_count = sku_pattern_usage.usage_count + 1,
    last_used = NOW(),
    success_rate = (sku_pattern_usage.success_rate * sku_pattern_usage.usage_count + 
                   CASE WHEN success THEN 100.00 ELSE 0.00 END) / 
                   (sku_pattern_usage.usage_count + 1);
END;
$$ LANGUAGE plpgsql;
```

---

## 🔍 **Monitoring & Analytics**

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
  completenessRate: number;
}

// Calculate metrics
private calculateMetrics(results: SyncResult[]): ParsingMetrics {
  const total = results.reduce((sum, r) => sum + r.totalSkus, 0);
  const database = results.reduce((sum, r) => sum + r.databaseParsed, 0);
  const local = results.reduce((sum, r) => sum + r.localParsed, 0);
  const merged = results.reduce((sum, r) => sum + r.mergedParsed, 0);
  const failed = results.reduce((sum, r) => sum + r.failedSkus, 0);
  
  return {
    totalSkus: total,
    databaseParsed: database,
    localParsed: local,
    mergedParsed: merged,
    failedParsed: failed,
    averageParseTime: this.calculateAverageParseTime(results),
    accuracyRate: (database + merged) / total * 100,
    completenessRate: this.calculateCompletenessRate(results)
  };
}
```

### **2. Quality Metrics**

```sql
-- Quality metrics view
CREATE OR REPLACE VIEW sku_parsing_quality AS
SELECT 
  COUNT(*) as total_skus,
  COUNT(CASE WHEN brand IS NOT NULL AND brand != '' THEN 1 END) as with_brand,
  COUNT(CASE WHEN model IS NOT NULL AND model != '' THEN 1 END) as with_model,
  COUNT(CASE WHEN capacity IS NOT NULL AND capacity != '' THEN 1 END) as with_capacity,
  COUNT(CASE WHEN color IS NOT NULL AND color != '' THEN 1 END) as with_color,
  COUNT(CASE WHEN brand IS NOT NULL AND brand != '' AND model IS NOT NULL AND model != '' 
             AND capacity IS NOT NULL AND capacity != '' AND color IS NOT NULL AND color != '' 
             THEN 1 END) as complete_skus,
  ROUND(COUNT(CASE WHEN brand IS NOT NULL AND brand != '' THEN 1 END) * 100.0 / COUNT(*), 2) as brand_completeness,
  ROUND(COUNT(CASE WHEN model IS NOT NULL AND model != '' THEN 1 END) * 100.0 / COUNT(*), 2) as model_completeness,
  ROUND(COUNT(CASE WHEN capacity IS NOT NULL AND capacity != '' THEN 1 END) * 100.0 / COUNT(*), 2) as capacity_completeness,
  ROUND(COUNT(CASE WHEN color IS NOT NULL AND color != '' THEN 1 END) * 100.0 / COUNT(*), 2) as color_completeness,
  ROUND(COUNT(CASE WHEN brand IS NOT NULL AND brand != '' AND model IS NOT NULL AND model != '' 
                   AND capacity IS NOT NULL AND capacity != '' AND color IS NOT NULL AND color != '' 
                   THEN 1 END) * 100.0 / COUNT(*), 2) as overall_completeness
FROM sku_master;
```

---

## 🎯 **Key Implementation Benefits**

### **1. Scalability**
- **Database-driven**: Handles thousands of patterns efficiently
- **Indexed queries**: Fast pattern matching even with large datasets
- **Connection pooling**: Manages database connections effectively
- **Batch processing**: Efficient handling of large datasets

### **2. Maintainability**
- **Separation of concerns**: Logic separated from data
- **No code deployment**: Pattern updates via database only
- **Version control**: Track pattern changes over time
- **Audit trail**: Monitor system changes

### **3. Flexibility**
- **Dynamic patterns**: Add new patterns without code changes
- **Context-aware**: Brand-specific model matching
- **Fallback system**: Multiple parsing strategies
- **Extensible**: Easy to add new device types/brands

### **4. Performance**
- **Optimized queries**: Database indexes for fast lookups
- **Batch processing**: Efficient handling of large datasets
- **Caching**: Reduce redundant database calls
- **Connection management**: Proper resource cleanup

This implementation provides a robust, scalable foundation for SKU parsing that can grow with your business needs while maintaining high accuracy and performance.


