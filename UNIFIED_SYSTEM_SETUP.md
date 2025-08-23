# 🎯 Unified System Setup Guide

## Overview
This guide will help you set up and test the unified system that bridges your old WMS APIs with the new IMEI-based system.

## 🚀 Quick Start

### Step 1: Execute Database Migration
Copy and paste this SQL into your Supabase SQL Editor:

```sql
-- Run the unified schema migration
-- Copy the entire content of migrations/004_unified_schema.sql
```

### Step 2: Start Your Server
```bash
npm start
# or
node src/index.ts
```

### Step 3: Test the Unified System
```bash
node test-unified-system.js
```

## 🔄 How the Unified System Works

### Data Flow
```
📥 New Data (PhoneCheck) 
    ↓
📋 imei_data_queue (Queue)
    ↓
⚡ process_imei_queue() (Auto-process)
    ↓
📊 imei_sku_info (Primary Data)
    ↓
🔄 TRIGGER (Auto-sync)
    ↓
📋 Item table (Legacy Compatible)
```

### What You Get
- ✅ **NEW IMEI System**: `imei_sku_info`, `imei_inspect_data`, `imei_units`
- ✅ **OLD WMS System**: `Item`, `Inventory` tables (auto-synced)
- ✅ **Both APIs Work**: `/api/imei-queue/*` AND `/api/inventory/*`
- ✅ **No Duplication**: Single source of truth
- ✅ **Automatic Sync**: Triggers keep both systems in sync

## 🧪 Testing the System

### Test 1: Add Data via NEW System
```bash
# This adds data to the IMEI system
curl -X POST http://localhost:3001/api/imei-queue/add \
  -H "Content-Type: application/json" \
  -d '{"items": [...], "source": "test"}'
```

### Test 2: Check NEW System
```bash
# Get data from IMEI system
curl http://localhost:3001/api/imei-queue/imei
```

### Test 3: Check OLD System (Auto-synced)
```bash
# Get data from legacy system (should be same data)
curl http://localhost:3001/api/inventory
```

### Test 4: Verify Consistency
Both endpoints should return the same device information!

## 📊 Expected Results

### Before Migration
- ❌ Old APIs: Work with old data
- ❌ New APIs: Work with new data
- ❌ Data: Split between systems

### After Migration
- ✅ Old APIs: Work with new data (auto-synced)
- ✅ New APIs: Work with new data
- ✅ Data: Unified, single source of truth

## 🔧 API Endpoints

### NEW IMEI System
```
POST   /api/imei-queue/add          # Add devices
GET    /api/imei-queue/imei         # Get all IMEI data
GET    /api/imei-queue/imei/:imei   # Get specific IMEI
GET    /api/imei-queue/stats        # Queue statistics
```

### OLD WMS System (Auto-synced)
```
GET    /api/inventory               # Get all inventory
GET    /api/inventory/search        # Search inventory
GET    /api/admin/inventory-summary # Admin dashboard data
```

### Archival System
```
POST   /api/imei-archival/archive   # Archive IMEI
GET    /api/imei-archival/stats     # Archive statistics
POST   /api/imei-archival/restore   # Restore archived data
```

## 🎯 What You'll See

### 1. Data Consistency
- Same IMEI appears in both systems
- Same SKU, brand, model, condition
- Same test results and battery health

### 2. API Compatibility
- Old frontend still works
- New IMEI APIs available
- Both return consistent data

### 3. No Data Loss
- All existing data preserved
- New data automatically synced
- Archival system protects data

## 🚨 Troubleshooting

### Issue: Prisma Generation Fails
```bash
# Windows permission issue - try:
taskkill /f /im node.exe
npx prisma generate
```

### Issue: Database Connection
```bash
# Check your .env file has correct DATABASE_URL
# Should point to your Supabase PostgreSQL instance
```

### Issue: Triggers Not Working
```bash
# Make sure you ran the SQL migration
# Check Supabase SQL Editor for any errors
```

## 🎉 Success Indicators

When the unified system is working correctly, you should see:

1. ✅ **Data added via NEW system** appears in OLD system
2. ✅ **Both APIs return same device count**
3. ✅ **Search works on both systems**
4. ✅ **Admin dashboard shows unified data**
5. ✅ **Archival system functions properly**

## 📈 Next Steps

Once the unified system is working:

1. **Test with real data**: Use your actual PhoneCheck data
2. **Update frontend**: Gradually migrate to new IMEI APIs
3. **Monitor performance**: Check sync triggers performance
4. **Plan migration**: Eventually remove old Item table

## 🆘 Need Help?

If you encounter issues:

1. Check the console logs for error messages
2. Verify the SQL migration ran successfully
3. Ensure your server is running on port 3001
4. Check that all API endpoints are accessible

The unified system gives you the best of both worlds - modern IMEI-based architecture with backward compatibility! 🚀
