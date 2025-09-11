# SKU Parsing System Flow Diagram

## 🔄 **Complete System Flow**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SKU PARSING SYSTEM FLOW                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│Google Sheets│───▶│Sync Service  │───▶│SKU Master   │───▶│SKU Matching │
│(Data Source)│    │(Parser)      │    │(Database)   │    │(Application)│
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌──────────────┐
                   │Reference     │
                   │Tables        │
                   │(Pattern DB)  │
                   └──────────────┘
```

## 🔍 **Detailed Parsing Logic Flow**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PARSE SKU WITH TAGS FLOW                              │
└─────────────────────────────────────────────────────────────────────────────────┘

Input: SKU Code + Description + Sheet Name
    │
    ▼
┌─────────────────┐
│ 1. Normalize    │
│    SKU Code     │
│    (UPPERCASE)  │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 2. Database     │
│    Parsing      │
│    (Primary)    │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 3. Check        │
│    Completeness │
│    (Brand+Model │
│    +Capacity+   │
│    Color)       │
└─────────────────┘
    │
    ▼
    ┌─────────────────┐
    │ Complete?       │
    │ YES ────────────┼───▶ Generate Tags ──▶ Return Result
    │ NO              │
    └─────────────────┘
    │
    ▼
┌─────────────────┐
│ 4. Local        │
│    Parsing      │
│    (Fallback)   │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 5. Merge        │
│    Results      │
│    (DB Priority)│
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 6. Generate     │
│    Tags Array   │
│    (For Matching)│
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 7. Return       │
│    Device Info  │
└─────────────────┘
```

## 🗄️ **Database Architecture Flow**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE PARSING FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

Input: "S23-ULTRA-256-BLK-VG"
    │
    ▼
┌─────────────────┐
│ parse_sku_      │
│ complete()      │
│ (Master Func)   │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ get_brand_      │
│ from_sku()      │
│                 │
│ Patterns:       │
│ ['S23', 'ULTRA']│
│                 │
│ Result:         │
│ "SAMSUNG"       │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ get_model_      │
│ from_sku()      │
│                 │
│ Brand Context:  │
│ "SAMSUNG"       │
│                 │
│ Patterns:       │
│ ['S23-ULTRA']   │
│                 │
│ Result:         │
│ "Galaxy S23     │
│ Ultra"          │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ get_capacity_   │
│ from_sku()      │
│                 │
│ Patterns:       │
│ ['256']         │
│                 │
│ Result:         │
│ "256GB"         │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ get_color_      │
│ from_sku()      │
│                 │
│ Patterns:       │
│ ['BLK']         │
│                 │
│ Result:         │
│ "BLACK"         │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ get_postfix_    │
│ from_sku()      │
│                 │
│ Patterns:       │
│ ['VG']          │
│                 │
│ Result:         │
│ "Very Good"     │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ get_device_     │
│ type_from_sku() │
│                 │
│ Patterns:       │
│ ['S23']         │
│                 │
│ Result:         │
│ "PHONE"         │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Return Complete │
│ Device Info     │
│                 │
│ {               │
│   brand: "SAMSUNG",│
│   model: "Galaxy S23 Ultra",│
│   capacity: "256GB",│
│   color: "BLACK",│
│   postfix: "Very Good",│
│   device_type: "PHONE"│
│ }               │
└─────────────────┘
```

## 🎯 **Pattern Matching Strategy**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PATTERN MATCHING STRATEGY                             │
└─────────────────────────────────────────────────────────────────────────────────┘

Input SKU: "S23-ULTRA-256-BLK-VG"
    │
    ▼
┌─────────────────┐
│ 1. Split SKU    │
│    into         │
│    segments     │
│                 │
│ ["S23", "ULTRA",│
│  "256", "BLK",  │
│  "VG"]          │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 2. For each     │
│    segment,     │
│    check        │
│    patterns     │
│                 │
│ Segment: "S23"  │
│ Patterns:       │
│ ['S23', 'S22',  │
│  'S21', ...]    │
│                 │
│ Match: "S23"    │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 3. Length       │
│    Priority     │
│                 │
│ "S23-ULTRA"     │
│ (8 chars)       │
│                 │
│ vs              │
│                 │
│ "S23"           │
│ (3 chars)       │
│                 │
│ Winner:         │
│ "S23-ULTRA"     │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 4. Context      │
│    Awareness    │
│                 │
│ Brand: "SAMSUNG"│
│ Model: "S23"    │
│                 │
│ Check if model  │
│ belongs to      │
│ brand           │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 5. Return       │
│    Best Match   │
│                 │
│ Based on:       │
│ - Length        │
│ - Context       │
│ - Confidence    │
└─────────────────┘
```

## 🔧 **Error Handling & Fallback Flow**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ERROR HANDLING & FALLBACK                            │
└─────────────────────────────────────────────────────────────────────────────────┘

Input: "UNKNOWN-DEVICE-123"
    │
    ▼
┌─────────────────┐
│ 1. Try Database │
│    Parsing      │
│                 │
│ Result: NULL    │
│ (No patterns    │
│  match)         │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 2. Try Local    │
│    Parsing      │
│                 │
│ Extract what    │
│ we can from     │
│ SKU structure   │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 3. Merge        │
│    Results      │
│                 │
│ Database: NULL  │
│ Local: Partial  │
│                 │
│ Final: Partial  │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 4. Log Missing  │
│    Patterns     │
│                 │
│ For future      │
│ pattern         │
│ learning        │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 5. Return       │
│    Partial      │
│    Result       │
│                 │
│ Better than     │
│ nothing         │
└─────────────────┘
```

## 📊 **Performance Optimization Flow**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PERFORMANCE OPTIMIZATION                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│Connection   │───▶│Query         │───▶│Index        │───▶│Result       │
│Pooling      │    │Optimization  │    │Usage        │    │Caching      │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
    │                   │                   │                   │
    ▼                   ▼                   ▼                   ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│Reuse        │    │Single        │    │GIN Indexes  │    │Memory       │
│Connections  │    │Function      │    │for Arrays   │    │Storage      │
│             │    │Call          │    │             │    │             │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
```

## 🚀 **Advanced Features Flow**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ADVANCED FEATURES FLOW                                │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│Pattern      │───▶│Confidence    │───▶│Audit        │───▶│Learning     │
│Learning     │    │Scoring       │    │Trail        │    │System       │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
    │                   │                   │                   │
    ▼                   ▼                   ▼                   ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│Auto-detect  │    │Weight        │    │Track        │    │Suggest      │
│New Patterns │    │Patterns      │    │Changes      │    │Improvements │
│             │    │by Success    │    │             │    │             │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
```

## 🎯 **Key Architectural Principles**

### **1. Separation of Concerns**
- **Data Layer**: Reference tables store patterns
- **Logic Layer**: PL/pgSQL functions handle parsing
- **Service Layer**: TypeScript orchestrates the flow
- **Application Layer**: Uses parsed data for matching

### **2. Fail-Safe Design**
- **Primary**: Database parsing (most accurate)
- **Secondary**: Local parsing (fallback)
- **Tertiary**: Manual pattern addition (edge cases)

### **3. Performance First**
- **Indexes**: Fast pattern lookups
- **Caching**: Reduce redundant queries
- **Batching**: Efficient bulk processing
- **Connection Management**: Proper resource cleanup

### **4. Maintainability**
- **No Code Changes**: Pattern updates via database
- **Version Control**: Track pattern evolution
- **Audit Trail**: Monitor system changes
- **Documentation**: Clear architecture documentation

This architecture provides a robust, scalable foundation for SKU parsing that can handle complex patterns while maintaining high performance and accuracy.
