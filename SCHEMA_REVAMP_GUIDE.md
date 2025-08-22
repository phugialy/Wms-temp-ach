# 🚀 WMS Schema Revamp & Supabase Integration Guide

## 📋 **Overview**

This guide will help you migrate your WMS (Warehouse Management System) from SQLite to Supabase PostgreSQL and implement the enhanced schema with improved features for device management, inventory tracking, and quality control.

## 🎯 **Key Improvements in the New Schema**

### **Enhanced Item Model**
- **Better Data Types**: Changed from `Float` to `Decimal` for precise pricing
- **Device-Specific Fields**: Added `condition`, `batteryHealth`, `screenCondition`, `bodyCondition`
- **Test Results**: JSON field for storing detailed device test data
- **Improved Indexing**: Added indexes for better query performance

### **Enhanced Inventory Management**
- **Reserved/Available Quantities**: Track reserved vs available inventory
- **Location Capacity**: Monitor location capacity and occupancy
- **Location Types**: Categorize locations (SHELF, BIN, PALLET, etc.)

### **Improved Processing Workflow**
- **Priority System**: Added priority levels (1-5) for processing queue
- **Enhanced Status Tracking**: More detailed status tracking throughout the workflow
- **QC Scoring**: Quality control scoring system (0-100)

### **New Device Testing Model**
- **Test History**: Track all device tests with results
- **Multiple Test Types**: Support for PHONECHECK, MANUAL, AUTOMATED tests
- **Test Results Storage**: JSON field for detailed test data

## 🔧 **Setup Instructions**

### **Step 1: Install Dependencies**

```bash
# Install new Supabase dependency
pnpm install

# Generate Prisma client with new schema
pnpm prisma:generate
```

### **Step 2: Configure Environment**

1. Copy the environment template:
```bash
copy env.template .env
```

2. Update your `.env` file with your Supabase credentials:
```env
# Database Configuration - Supabase
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Supabase Configuration
SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
SUPABASE_ANON_KEY="[YOUR-ANON-KEY]"

# Other configurations...
```

### **Step 3: Get Supabase Credentials**

1. Go to your Supabase project dashboard
2. Navigate to **Settings > Database**
3. Copy the connection string and replace placeholders
4. Go to **Settings > API** to get your anon key

### **Step 4: Deploy Schema to Supabase**

```bash
# Push the new schema to Supabase
pnpm prisma:push

# Verify the deployment
pnpm db:studio
```

### **Step 5: Test the Connection**

```bash
# Start the development server
pnpm dev
```

Visit `http://localhost:3001/health` to verify the server is running.

## 📊 **Database Migration Strategy**

### **Option 1: Fresh Start (Recommended for Development)**
```bash
# Reset and deploy fresh schema
pnpm db:reset
pnpm prisma:push
```

### **Option 2: Migrate Existing Data**
If you have existing data in SQLite:

1. **Export Current Data**:
```bash
# Create a data export script
node -e "
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function exportData() {
  const items = await prisma.item.findMany();
  const inventory = await prisma.inventory.findMany();
  // ... export other tables
  
  fs.writeFileSync('data-export.json', JSON.stringify({ items, inventory }, null, 2));
  await prisma.$disconnect();
}

exportData();
"
```

2. **Import to Supabase**:
```bash
# Use the seed script to import data
pnpm db:seed
```

## 🔍 **New API Endpoints**

The enhanced schema enables new API endpoints:

### **Device Testing**
- `POST /api/devices/test` - Record device test results
- `GET /api/devices/:id/tests` - Get device test history
- `GET /api/devices/tests/pending` - Get pending tests

### **Enhanced Inventory**
- `GET /api/inventory/available` - Get available inventory
- `GET /api/inventory/reserved` - Get reserved inventory
- `PUT /api/inventory/:id/reserve` - Reserve inventory

### **Quality Control**
- `GET /api/qc/pending` - Get pending QC approvals
- `POST /api/qc/:id/approve` - Approve QC item
- `POST /api/qc/:id/reject` - Reject QC item with reason

## 🎨 **Frontend Integration**

### **Real-time Updates**
The new Supabase client enables real-time updates:

```javascript
import { subscribeToTable } from '../lib/supabase';

// Subscribe to inventory changes
const subscription = subscribeToTable('Inventory', (payload) => {
  console.log('Inventory updated:', payload);
  // Update UI accordingly
});
```

### **Enhanced Device Management**
New fields enable better device tracking:

```javascript
// Example: Update device condition
const updateDeviceCondition = async (deviceId, condition, batteryHealth) => {
  const response = await fetch(`/api/devices/${deviceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ condition, batteryHealth })
  });
  return response.json();
};
```

## 🧪 **Testing the New Schema**

### **Test Scripts**
Use the existing test files to verify functionality:

```bash
# Test device creation with new fields
node test-enhanced-phonecheck-features.js

# Test inventory management
node test-inventory-push.js

# Test bulk operations
node test-bulk-add.js
```

### **Database Verification**
```bash
# Open Prisma Studio to verify data
pnpm db:studio
```

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Connection Errors**:
   - Verify DATABASE_URL format
   - Check Supabase project status
   - Ensure IP is whitelisted in Supabase

2. **Schema Push Failures**:
   - Check for syntax errors in schema.prisma
   - Verify PostgreSQL compatibility
   - Check Supabase database limits

3. **Performance Issues**:
   - Monitor query performance with indexes
   - Use connection pooling for high traffic
   - Implement caching where appropriate

### **Support**
- Check Supabase documentation: https://supabase.com/docs
- Review Prisma documentation: https://www.prisma.io/docs
- Check the project README.md for additional setup instructions

## 🎉 **Next Steps**

After successful migration:

1. **Update Frontend Components**: Integrate new fields and features
2. **Implement Real-time Features**: Use Supabase subscriptions
3. **Add Authentication**: Implement Supabase Auth
4. **Performance Optimization**: Monitor and optimize queries
5. **Backup Strategy**: Set up automated backups

---

**Need Help?** Check the project documentation or create an issue in the repository.
