# ✅ Migration Checklist

## 📋 Quick Reference

### **Tier 1: Critical (Week 1)**
- [x] Single Add ✅
- [ ] Bulk Add (Main)
- [ ] Inventory Manager
- [ ] Phonecheck Lookup

### **Tier 2: Important (Week 2)**
- [ ] Admin Dashboard (Charts) - ⚠️ Needs Chart.js
- [ ] Bulk Add v2 (3 pages)
- [ ] Bulk Add Audit

### **Tier 3: Admin Tools (Week 3)**
- [ ] SKU Master Management
- [ ] SKU Matching
- [ ] Data Cleanup

### **Tier 4: Analytics (Week 4)**
- [ ] SKU Inventory Dashboard
- [ ] SKU Matching Analysis
- [ ] Manager Workflow

---

## 🔧 Dependencies to Install

```bash
cd frontend

# For charts (Admin Dashboard)
npm install chart.js react-chartjs-2

# For file uploads (if needed)
npm install react-dropzone

# For date pickers (if needed)
npm install react-datepicker @types/react-datepicker
```

---

## 📝 Per-Page Checklist

### For Each Migration:

**Pre-Migration**
- [ ] Read original HTML file
- [ ] List all dependencies
- [ ] Identify API endpoints
- [ ] Note state management needs

**Migration**
- [ ] Create component file
- [ ] Convert JSX
- [ ] Replace Toast with useToastStore
- [ ] Replace fetch with apiClient
- [ ] Extract sub-components if needed
- [ ] Add TypeScript types

**Post-Migration**
- [ ] Add route to routes.tsx
- [ ] Add nav item to Sidebar.tsx
- [ ] Test all features
- [ ] Test error handling
- [ ] Test responsive design
- [ ] Update documentation

---

## 🎯 Current Status

**Completed**: 1/20 pages (5%)
**In Progress**: 0
**Remaining**: 19 pages

