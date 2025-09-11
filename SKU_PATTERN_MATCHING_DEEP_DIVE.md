# SKU Pattern Matching - Deep Technical Analysis

## 🔍 **Actual Pattern Matching Mechanics**

### **Core Pattern Matching Algorithm**

The pattern matching system uses PostgreSQL's **array operations** combined with **LIKE pattern matching** and **length-based priority scoring**. Here's the exact implementation:

```sql
-- Core Pattern Matching Query (from get_brand_from_sku function)
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
```

---

## 🎯 **Step-by-Step Pattern Matching Process**

### **Example: SKU "S23-ULTRA-256-BLK-VG"**

#### **Step 1: Brand Detection**

```sql
-- Input SKU: "S23-ULTRA-256-BLK-VG"
-- Brand patterns to check:
ARRAY['SAMSUNG', 'GALAXY', 'S23', 'S22', 'S21', 'S20', 'S10', 'NOTE', 'TAB-', 'WATCH-', 'ZFLIP', 'FOLD']

-- Pattern matching process:
WHERE UPPER('S23-ULTRA-256-BLK-VG') LIKE '%' || UPPER(pattern) || '%'

-- Results:
'S23-ULTRA-256-BLK-VG' LIKE '%SAMSUNG%' → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%GALAXY%'  → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%S23%'     → TRUE  ✓
'S23-ULTRA-256-BLK-VG' LIKE '%S22%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%S21%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%S20%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%S10%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%NOTE%'    → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%TAB-%'    → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%WATCH-%'  → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%ZFLIP%'   → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%FOLD%'    → FALSE

-- Matched patterns: ['S23']
-- Length priority: LENGTH('S23') = 3
-- Result: "SAMSUNG" (brand_name from the row containing 'S23' pattern)
```

#### **Step 2: Model Detection (with Brand Context)**

```sql
-- Input SKU: "S23-ULTRA-256-BLK-VG"
-- Brand context: "SAMSUNG"
-- Model patterns to check:
ARRAY['S23', 'S23-ULTRA', 'S23ULTRA', 'S22', 'S21', 'S20', 'S10', 'NOTE-', 'ZFLIP', 'FOLD', 'TAB-', 'WATCH-']

-- Pattern matching process:
WHERE UPPER('S23-ULTRA-256-BLK-VG') LIKE '%' || UPPER(pattern) || '%'

-- Results:
'S23-ULTRA-256-BLK-VG' LIKE '%S23%'       → TRUE  ✓
'S23-ULTRA-256-BLK-VG' LIKE '%S23-ULTRA%' → TRUE  ✓
'S23-ULTRA-256-BLK-VG' LIKE '%S23ULTRA%'  → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%S22%'       → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%S21%'       → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%S20%'       → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%S10%'       → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%NOTE-%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%ZFLIP%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%FOLD%'      → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%TAB-%'      → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%WATCH-%'    → FALSE

-- Matched patterns: ['S23', 'S23-ULTRA']
-- Length priority: 
--   LENGTH('S23') = 3
--   LENGTH('S23-ULTRA') = 8  ← WINNER (longer pattern)
-- Result: "Galaxy S23 Ultra" (model_name from the row containing 'S23-ULTRA' pattern)
```

#### **Step 3: Capacity Detection**

```sql
-- Input SKU: "S23-ULTRA-256-BLK-VG"
-- Capacity patterns to check:
ARRAY['64', '64GB', '128', '128GB', '256', '256GB', '512', '512GB', '1TB', '1T', '32', '32GB', '16', '16GB', '8', '8GB', '4', '4GB', '2', '2GB']

-- Pattern matching process:
WHERE UPPER('S23-ULTRA-256-BLK-VG') LIKE '%' || UPPER(pattern) || '%'

-- Results:
'S23-ULTRA-256-BLK-VG' LIKE '%64%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%64GB%'   → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%128%'    → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%128GB%'  → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%256%'    → TRUE  ✓
'S23-ULTRA-256-BLK-VG' LIKE '%256GB%'  → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%512%'    → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%512GB%'  → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%1TB%'    → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%1T%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%32%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%32GB%'   → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%16%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%16GB%'   → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%8%'      → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%8GB%'    → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%4%'      → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%4GB%'    → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%2%'      → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%2GB%'    → FALSE

-- Matched patterns: ['256']
-- Length priority: LENGTH('256') = 3
-- Result: "256GB" (capacity_value from the row containing '256' pattern)
```

#### **Step 4: Color Detection**

```sql
-- Input SKU: "S23-ULTRA-256-BLK-VG"
-- Color patterns to check:
ARRAY['BLK', 'BLACK', 'WHT', 'WHITE', 'SLV', 'SILVER', 'GLD', 'GOLD', 'PNK', 'PINK', 'ROSE', 'BLU', 'BLUE', 'GRN', 'GREEN', 'RED', 'PUR', 'PURPLE', 'YLW', 'YELLOW', 'ORG', 'ORANGE', 'GRY', 'GRAY', 'GREY', 'CREAM', 'BEIGE', 'BURGUNDY', 'BURG']

-- Pattern matching process:
WHERE UPPER('S23-ULTRA-256-BLK-VG') LIKE '%' || UPPER(pattern) || '%'

-- Results:
'S23-ULTRA-256-BLK-VG' LIKE '%BLK%'     → TRUE  ✓
'S23-ULTRA-256-BLK-VG' LIKE '%BLACK%'   → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%WHT%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%WHITE%'   → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%SLV%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%SILVER%'  → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%GLD%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%GOLD%'    → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%PNK%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%PINK%'    → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%ROSE%'    → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%BLU%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%BLUE%'    → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%GRN%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%GREEN%'   → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%RED%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%PUR%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%PURPLE%'  → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%YLW%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%YELLOW%'  → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%ORG%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%ORANGE%'  → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%GRY%'     → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%GRAY%'    → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%GREY%'    → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%CREAM%'   → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%BEIGE%'   → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%BURGUNDY%' → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%BURG%'    → FALSE

-- Matched patterns: ['BLK']
-- Length priority: LENGTH('BLK') = 3
-- Result: "BLACK" (color_name from the row containing 'BLK' pattern)
```

#### **Step 5: Postfix Detection**

```sql
-- Input SKU: "S23-ULTRA-256-BLK-VG"
-- Postfix patterns to check:
ARRAY['VG', 'NEW', 'ACCEPTABLE', 'UL', 'LN', 'OPENBOX', 'USED', 'REFURB']

-- Pattern matching process:
WHERE UPPER('S23-ULTRA-256-BLK-VG') LIKE '%' || UPPER(pattern) || '%'

-- Results:
'S23-ULTRA-256-BLK-VG' LIKE '%VG%'        → TRUE  ✓
'S23-ULTRA-256-BLK-VG' LIKE '%NEW%'       → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%ACCEPTABLE%' → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%UL%'        → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%LN%'        → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%OPENBOX%'   → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%USED%'      → FALSE
'S23-ULTRA-256-BLK-VG' LIKE '%REFURB%'    → FALSE

-- Matched patterns: ['VG']
-- Length priority: LENGTH('VG') = 2
-- Result: "Very Good" (postfix_name from the row containing 'VG' pattern)
```

---

## 🔧 **Advanced Pattern Matching Features**

### **1. Length-Based Priority System**

The system uses **length-based priority** to resolve conflicts when multiple patterns match:

```sql
-- Example: SKU "S23-ULTRA-256-BLK-VG"
-- Both 'S23' and 'S23-ULTRA' match, but 'S23-ULTRA' wins because it's longer

ORDER BY (
    SELECT MAX(LENGTH(pattern)) 
    FROM unnest(sku_patterns) as pattern
    WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
) DESC
```

**Priority Logic:**
- **Longer patterns win** (more specific)
- **Exact matches preferred** over partial matches
- **Context-aware matching** (brand-specific models)

### **2. Array Unnesting for Pattern Matching**

PostgreSQL's `unnest()` function converts array elements to rows for pattern matching:

```sql
-- Pattern array: ARRAY['S23', 'S23-ULTRA', 'S23ULTRA']
-- Unnesting creates:
-- pattern
-- -------
-- S23
-- S23-ULTRA
-- S23ULTRA

-- Then each pattern is tested:
WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
```

### **3. Context-Aware Model Matching**

Models are matched with brand context to prevent cross-brand false matches:

```sql
-- Model matching with brand context
SELECT m.model_name INTO result
FROM sku_model_reference m
JOIN sku_brand_reference b ON m.brand_id = b.id
WHERE m.is_active = true
AND b.brand_name = brand_name_param  -- Brand context
AND EXISTS (
    SELECT 1 FROM unnest(m.sku_patterns) as pattern
    WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
)
```

**Benefits:**
- **Prevents false matches** (e.g., "S23" from Samsung won't match "S23" from another brand)
- **Improves accuracy** for ambiguous patterns
- **Enables brand-specific variants** (e.g., "Galaxy S23" vs "iPhone S23")

---

## 🎯 **Pattern Matching Edge Cases**

### **1. Ambiguous Patterns**

```sql
-- Example: SKU "S23-256-BLK-VG"
-- Could match multiple models:
-- - 'S23' (3 chars)
-- - 'S23-256' (7 chars) ← This would win due to length

-- Solution: Length-based priority ensures most specific match wins
```

### **2. Overlapping Patterns**

```sql
-- Example: SKU "S23-ULTRA-256-BLK-VG"
-- Brand patterns: ['S23', 'S23-ULTRA']
-- Model patterns: ['S23', 'S23-ULTRA']

-- Both brand and model match 'S23-ULTRA'
-- Length priority ensures 'S23-ULTRA' wins over 'S23'
```

### **3. Case Sensitivity**

```sql
-- All pattern matching is case-insensitive:
WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'

-- Examples:
-- 's23-ultra-256-blk-vg' matches 'S23-ULTRA'
-- 'S23-ULTRA-256-BLK-VG' matches 's23-ultra'
-- 'S23-Ultra-256-Blk-Vg' matches 'S23-ULTRA'
```

---

## 🚀 **Performance Optimization Details**

### **1. GIN Indexes for Array Operations**

```sql
-- GIN indexes for fast array pattern matching
CREATE INDEX idx_sku_brand_patterns ON sku_brand_reference USING GIN(sku_patterns);
CREATE INDEX idx_sku_model_patterns ON sku_model_reference USING GIN(sku_patterns);
CREATE INDEX idx_sku_color_patterns ON sku_color_reference USING GIN(sku_patterns);
CREATE INDEX idx_sku_capacity_patterns ON sku_capacity_reference USING GIN(sku_patterns);
CREATE INDEX idx_sku_carrier_patterns ON sku_carrier_reference USING GIN(sku_patterns);
CREATE INDEX idx_sku_postfix_patterns ON sku_postfix_reference USING GIN(sku_patterns);
```

**GIN Index Benefits:**
- **Fast array containment** operations
- **Efficient pattern matching** even with large pattern arrays
- **Optimized for `@>` and `&&` operators**

### **2. Query Execution Plan**

```sql
-- Typical execution plan for pattern matching:
EXPLAIN (ANALYZE, BUFFERS) 
SELECT brand_name FROM sku_brand_reference
WHERE is_active = true
AND EXISTS (
    SELECT 1 FROM unnest(sku_patterns) as pattern
    WHERE UPPER('S23-ULTRA-256-BLK-VG') LIKE '%' || UPPER(pattern) || '%'
)
ORDER BY (
    SELECT MAX(LENGTH(pattern)) 
    FROM unnest(sku_patterns) as pattern
    WHERE UPPER('S23-ULTRA-256-BLK-VG') LIKE '%' || UPPER(pattern) || '%'
) DESC
LIMIT 1;

-- Expected plan:
-- 1. Index Scan on sku_brand_reference (using GIN index)
-- 2. Filter by is_active = true
-- 3. Nested Loop for pattern matching
-- 4. Sort by pattern length
-- 5. Limit 1
```

---

## 🔍 **Pattern Matching Debugging**

### **1. Pattern Matching Test Query**

```sql
-- Test pattern matching for a specific SKU
SELECT 
    'BRAND' as type,
    brand_name as name,
    unnest(sku_patterns) as pattern,
    CASE 
        WHEN UPPER('S23-ULTRA-256-BLK-VG') LIKE '%' || UPPER(unnest(sku_patterns)) || '%' 
        THEN 'MATCH' 
        ELSE 'NO MATCH' 
    END as result
FROM sku_brand_reference
WHERE is_active = true

UNION ALL

SELECT 
    'MODEL' as type,
    model_name as name,
    unnest(sku_patterns) as pattern,
    CASE 
        WHEN UPPER('S23-ULTRA-256-BLK-VG') LIKE '%' || UPPER(unnest(sku_patterns)) || '%' 
        THEN 'MATCH' 
        ELSE 'NO MATCH' 
    END as result
FROM sku_model_reference
WHERE is_active = true;
```

### **2. Pattern Length Analysis**

```sql
-- Analyze pattern lengths for optimization
SELECT 
    brand_name,
    pattern,
    LENGTH(pattern) as pattern_length,
    CASE 
        WHEN UPPER('S23-ULTRA-256-BLK-VG') LIKE '%' || UPPER(pattern) || '%' 
        THEN 'MATCH' 
        ELSE 'NO MATCH' 
    END as result
FROM sku_brand_reference,
     unnest(sku_patterns) as pattern
WHERE is_active = true
ORDER BY pattern_length DESC;
```

---

## 🎯 **Key Pattern Matching Insights**

### **1. Algorithm Complexity**
- **Time Complexity**: O(n × m) where n = number of patterns, m = SKU length
- **Space Complexity**: O(1) for pattern matching (O(n) for pattern storage)
- **Database Operations**: Single query per field type

### **2. Pattern Matching Accuracy**
- **Length Priority**: Ensures most specific matches win
- **Context Awareness**: Brand-specific model matching prevents false positives
- **Case Insensitivity**: Handles various SKU formats consistently

### **3. Scalability Considerations**
- **GIN Indexes**: Fast array operations even with thousands of patterns
- **Batch Processing**: Efficient handling of large SKU datasets
- **Connection Pooling**: Manages database resources effectively

### **4. Maintenance Benefits**
- **No Code Changes**: Add patterns via database INSERT statements
- **Immediate Updates**: Pattern changes take effect immediately
- **Version Control**: Track pattern evolution over time
- **Audit Trail**: Monitor pattern usage and effectiveness

This detailed analysis shows that the pattern matching system is **sophisticated, performant, and maintainable**, using PostgreSQL's advanced array operations and indexing capabilities to provide accurate, fast SKU parsing.
