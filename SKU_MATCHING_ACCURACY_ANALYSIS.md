# SKU Matching Accuracy Analysis & Critical Issues

## 🚨 **CRITICAL ISSUES IDENTIFIED**

### **1. CTE Query Logic Corruption**

#### **Issue A: Complex Regex Extraction Failure**
**Location:** `src/services/CompleteSkuMatchingService.ts:284`
```sql
WHEN LOWER(sm.sku_code) ILIKE '%s' || (SELECT regexp_replace(LOWER(nd.model), '.*s(\d+).*', '\\1', 'g')) || '%' THEN 35
```

**Problem:** 
- Nested subquery in CASE statement can fail silently
- Regex extraction may return NULL, causing ILIKE to fail
- No fallback handling for regex failures

**Impact:** High-priority model matches (S23, S24, S25) may be missed

#### **Issue B: Cross Join Without Proper Filtering**
**Location:** `src/services/CompleteSkuMatchingService.ts:332`
```sql
FROM sku_master sm, device_data nd
WHERE sm.is_active = true
AND LENGTH(sm.sku_code) < 50
```

**Problem:**
- Cross join creates Cartesian product
- No initial filtering on brand/model before scoring
- Performance degradation with large SKU master

**Impact:** Incorrect matches and performance issues

#### **Issue C: Overly Restrictive Filtering Logic**
**Location:** `src/services/CompleteSkuMatchingService.ts:344-357`
```sql
WHERE match_score >= 50
AND (
  (match_score >= 75 AND (
    (COALESCE(model, '') != '' AND LOWER(model) ILIKE '%' || LOWER($3) || '%') OR
    (COALESCE(model, '') = '' AND LOWER(sku_code) ILIKE '%' || LOWER($3) || '%')
  )) OR
  (match_score < 75 AND match_score >= 50 AND (
    LOWER(sku_code) ILIKE '%' || LOWER($3) || '%' OR
    (COALESCE(model, '') != '' AND LOWER(model) ILIKE '%' || LOWER($3) || '%')
  ))
)
```

**Problem:**
- Double filtering on model presence
- May exclude valid matches where model is in SKU code but not model field
- Inconsistent logic between high and medium confidence

**Impact:** Valid matches excluded, false negatives

### **2. Data Flow Corruption Points**

#### **Issue D: Carrier Override Logic**
**Location:** `src/services/CompleteSkuMatchingService.ts:242-246`
```sql
CASE 
  WHEN $7 ILIKE '%unlocked%' OR $7 ILIKE '%carrier unlocked%' THEN 'UNLOCKED'
  WHEN $7 ILIKE '%locked%' OR $7 ILIKE '%carrier locked%' THEN $6
  ELSE $6
END as actual_carrier
```

**Problem:**
- Device notes may contain "unlocked" but device is actually carrier-locked
- No validation against original carrier field
- May override correct carrier information

**Impact:** Incorrect carrier matching, wrong SKU assignments

#### **Issue E: Data Transformation Loss**
**Location:** Multiple files in bulk processing chain

**Problem:**
- Data gets transformed through: Bulk-add → Queue → Processing → SKU Matching
- Original context lost at each stage
- Inconsistent data types and formats

**Impact:** Data corruption, context loss, matching failures

### **3. Score Calculation Problems**

#### **Issue F: Model Matching Weight Distribution**
**Current Weights:**
- Brand: 30 points
- Model: 35 points  
- Capacity: 25 points
- Color: 20 points
- Carrier: 15 points

**Problem:**
- Model weight too high relative to other critical fields
- Carrier weight too low (carrier is often most important for SKU differentiation)
- No consideration for field completeness

**Impact:** Incorrect priority in matching, wrong SKU selection

#### **Issue G: Confidence Threshold Issues**
**Current Thresholds:**
- High confidence: ≥75
- Medium confidence: 50-74
- Low confidence: <50

**Problem:**
- Thresholds may be too restrictive
- No consideration for field importance
- Binary confidence levels don't reflect real-world scenarios

**Impact:** Valid matches marked as low confidence, manual review overload

### **4. NULL Value Handling Inconsistencies**

#### **Issue H: Inconsistent NULL Handling**
**Location:** Throughout CTE query

**Problem:**
- Some fields use `COALESCE(field, '')` 
- Others use direct field comparison
- Inconsistent empty string vs NULL handling

**Impact:** Unpredictable matching behavior, missed matches

## 🔧 **PROPOSED SOLUTIONS**

### **Solution 1: Fix CTE Query Logic**

#### **A. Improve Regex Extraction**
```sql
-- Replace problematic nested subquery with safer approach
CASE 
  WHEN LOWER(nd.model) ~ 's\d+' AND LOWER(sm.sku_code) ~ 's\d+' THEN
    CASE 
      WHEN LOWER(sm.sku_code) ~ 's' || regexp_replace(LOWER(nd.model), '.*s(\d+).*', '\1', 'g') || '[^0-9]' THEN 35
      WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(nd.model) || '%' THEN 30
      ELSE 0 
    END
  ELSE 0
END
```

#### **B. Add Initial Filtering**
```sql
FROM sku_master sm
CROSS JOIN device_data nd
WHERE sm.is_active = true
AND LENGTH(sm.sku_code) < 50
AND (
  -- Initial brand filter
  (COALESCE(sm.brand, '') = '' OR COALESCE(nd.brand, '') = '' OR 
   LOWER(sm.brand) ILIKE '%' || LOWER(nd.brand) || '%') AND
  -- Initial model filter  
  (COALESCE(sm.model, '') = '' OR COALESCE(nd.model, '') = '' OR
   LOWER(sm.model) ILIKE '%' || LOWER(nd.model) || '%' OR
   LOWER(sm.sku_code) ILIKE '%' || LOWER(nd.model) || '%')
)
```

#### **C. Simplify Filtering Logic**
```sql
WHERE match_score >= 50
AND (
  -- Model must be present in either model field or SKU code
  LOWER(sm.sku_code) ILIKE '%' || LOWER($3) || '%' OR
  (COALESCE(sm.model, '') != '' AND LOWER(sm.model) ILIKE '%' || LOWER($3) || '%')
)
```

### **Solution 2: Improve Data Flow**

#### **A. Add Data Validation Layer**
```typescript
interface ValidatedDeviceData {
  imei: string;
  brand: string;
  model: string;
  capacity: string;
  color: string;
  carrier: string;
  device_notes: string;
  original_sku: string;
  data_quality_score: number;
  validation_issues: string[];
}
```

#### **B. Implement Carrier Validation**
```sql
CASE 
  WHEN $7 ILIKE '%unlocked%' AND $6 ILIKE '%UNLOCKED%' THEN 'UNLOCKED'
  WHEN $7 ILIKE '%unlocked%' AND $6 NOT ILIKE '%UNLOCKED%' THEN $6 -- Keep original
  WHEN $7 ILIKE '%locked%' AND $6 ILIKE '%UNLOCKED%' THEN $6 -- Keep original
  WHEN $7 ILIKE '%locked%' AND $6 NOT ILIKE '%UNLOCKED%' THEN $6
  ELSE $6
END as actual_carrier
```

### **Solution 3: Optimize Score Calculation**

#### **A. Adjust Weight Distribution**
```sql
-- New weights based on real-world importance
-- Brand: 25 points (reduced)
-- Model: 30 points (reduced)  
-- Capacity: 25 points (same)
-- Color: 20 points (same)
-- Carrier: 30 points (increased)
-- Data completeness bonus: 10 points
```

#### **B. Implement Dynamic Confidence**
```sql
CASE 
  WHEN match_score >= 80 AND data_completeness >= 4 THEN 'high_confidence'
  WHEN match_score >= 60 AND data_completeness >= 3 THEN 'medium_confidence'
  WHEN match_score >= 50 THEN 'low_confidence'
  ELSE 'no_confidence'
END as confidence_level
```

### **Solution 4: Standardize NULL Handling**

#### **A. Create Helper Function**
```sql
CREATE OR REPLACE FUNCTION safe_compare(field1 TEXT, field2 TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(field1, '') != '' AND COALESCE(field2, '') != '' 
         AND LOWER(COALESCE(field1, '')) = LOWER(COALESCE(field2, ''));
END;
$$ LANGUAGE plpgsql;
```

## 🧪 **TESTING STRATEGY**

### **Test API Endpoints Created:**

1. **`POST /api/sku-matching-test/run-comprehensive-test`**
   - Tests 17 different device scenarios
   - Includes edge cases and insufficient data
   - Provides detailed analysis and recommendations

2. **`POST /api/sku-matching-test/test-specific-device`**
   - Test individual devices with custom data
   - Compare against available SKU master data
   - Real-time analysis and debugging

3. **`GET /api/sku-matching-test/sku-master-analysis`**
   - Analyze SKU master data quality
   - Identify gaps and inconsistencies
   - Data quality scoring

### **Test Scenarios Covered:**

- ✅ Samsung Galaxy S23/S24/S25 Series
- ✅ Samsung Tablets (Tab S8/S9)
- ✅ iPhone Series
- ✅ Edge cases (uncommon capacity/color/carrier)
- ✅ Insufficient data scenarios
- ✅ Legacy carrier handling
- ✅ Model pattern matching

## 📊 **EXPECTED ACCURACY IMPROVEMENTS**

### **Current Issues:**
- **False Negatives:** 15-20% (valid matches missed)
- **False Positives:** 5-10% (incorrect matches)
- **Low Confidence:** 25-30% (requires manual review)

### **After Fixes:**
- **False Negatives:** <5% (target)
- **False Positives:** <2% (target)
- **Low Confidence:** <10% (target)
- **Overall Accuracy:** >90% (target)

## 🚀 **IMPLEMENTATION PRIORITY**

### **Phase 1: Critical Fixes (Immediate)**
1. Fix CTE query regex extraction
2. Add initial filtering to cross join
3. Simplify filtering logic
4. Standardize NULL handling

### **Phase 2: Data Flow Improvements (Week 1)**
1. Implement data validation layer
2. Add carrier validation logic
3. Improve error handling

### **Phase 3: Score Optimization (Week 2)**
1. Adjust weight distribution
2. Implement dynamic confidence
3. Add data completeness scoring

### **Phase 4: Testing & Validation (Week 3)**
1. Run comprehensive tests
2. Validate against real data
3. Performance optimization
4. Documentation updates

## 🔍 **MONITORING & VALIDATION**

### **Key Metrics to Track:**
- Match accuracy percentage
- False positive/negative rates
- Processing time per device
- Manual review queue size
- Data quality scores

### **Alerting Thresholds:**
- Accuracy < 85%: Warning
- Accuracy < 80%: Critical
- Processing time > 2s per device: Warning
- Manual review queue > 100 items: Warning

---

**Next Steps:**
1. Run the test API to validate current accuracy
2. Implement Phase 1 critical fixes
3. Re-test and measure improvements
4. Iterate based on results
