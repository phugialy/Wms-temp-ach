# Route Cleanup Plan

## Routes to Deactivate

### Frontend Routes (frontend/src/routes.tsx)

#### ✅ Keep (Active Routes)
- `/` - Dashboard
- `/dashboard` - Dashboard
- `/single-add` - Device Add (Single)
- `/bulk-add` - Device Add (Bulk)
- `/inventory` - Inventory Modern
- `/phonecheck` - Phonecheck
- `/cron-jobs` - Cron Job Management
- `/admin-panel` - Admin Panel
- `/admin-approvals` - Admin Approvals
- `/db-integrity-check` - DB Integrity Check
- `/account-settings` - Account Settings
- `/bulk-verification` - Bulk Verification

#### ❌ Remove/Deactivate (Old/Legacy Routes)
1. `/inventory-old` - Old inventory version (replaced by `/inventory`)
2. `/device-add` - Duplicate of `/single-add` and `/bulk-add`
3. `/sku-master` - Placeholder "Coming Soon"
4. `/sku-matching` - Placeholder "Coming Soon"
5. `/data-cleanup` - Placeholder "Coming Soon"
6. `/queue-management` - Placeholder "Coming Soon"
7. `/reports` - Placeholder "Coming Soon"
8. `/audit` - Placeholder "Coming Soon"

### Backend Routes (src/index.ts)

#### ✅ Keep (Active API Routes)
- `/api/auth/*` - Authentication
- `/api/workflows/*` - Workflow management
- `/api/workflows/schedules/*` - Cron schedules
- `/api/phonecheck/*` - Phonecheck integration
- `/api/verification/*` - Bulk verification
- `/api/dashboard/*` - Dashboard data
- `/api/email/*` - Email services
- `/api/admin/*` - Admin operations
- `/api/db-integrity-check/*` - DB integrity

#### ❌ Remove/Deactivate (Legacy/Test Routes)
1. `/items` - Legacy route (non-API)
2. `/inventory` - Legacy route (non-API, use `/api/*` instead)
3. `/logs` - Legacy route
4. `/api/comprehensive-sku-test` - Test route
5. `/api/sample-match-results` - Test route
6. `/api/sku-matching-analysis` - Test route
7. `/api/generic-model-test` - Test route
8. `/api/performance-test` - Test route
9. `/api/enhanced-inventory` - Possibly duplicate
10. `/api/bulk-inventory` - Possibly duplicate
11. `/api/imei-queue` - Possibly unused
12. `/api/imei-archival` - Possibly unused
13. `/api/hybrid-queue` - Possibly unused
14. `/api/simple-imei` - Possibly duplicate
15. `/api/input` - Clean input (possibly test)

## Implementation Strategy

### Option 1: Comment Out (Safe - Easy to Restore)
- Comment out old routes
- Add comments explaining why they're disabled
- Easy to restore if needed

### Option 2: Remove Completely (Clean - Harder to Restore)
- Delete route registrations
- Remove unused imports
- Cleaner codebase

### Option 3: Add Deprecation Warnings (Gradual)
- Keep routes but add deprecation warnings
- Redirect to new routes
- Remove after migration period

## Recommendation

**Use Option 1 (Comment Out)** for now:
- Safe and reversible
- Easy to identify what was removed
- Can clean up later if confirmed unused

