# TypeScript Migration Plan

## Current State
- **Mixed codebase**: Both `.js` and `.ts` files in `src/`
- **Build target**: TypeScript (`dist/index.js` from `src/index.ts`)
- **Legacy server**: `server.js` (JavaScript) for development
- **New services**: `EnhancedGoogleSheetsService.ts` (TypeScript)

## Migration Strategy

### Phase 1: Core Services Migration
1. **Convert core services to TypeScript**:
   - `CompleteSkuMatchingService.js` → `CompleteSkuMatchingService.ts`
   - `googleSheetsService.js` → `googleSheetsService.ts`
   - `QueueProcessor.js` → `QueueProcessor.ts`
   - `OperatorService.js` → `OperatorService.ts`

### Phase 2: API Routes Migration
2. **Convert API routes to TypeScript**:
   - `skuMasterApi.js` → `skuMasterApi.ts`
   - `imeiQueueApi.js` → `imeiQueueApi.ts`
   - `bulkDataApi.js` → `bulkDataApi.ts`

### Phase 3: Controllers Migration
3. **Convert controllers to TypeScript**:
   - `ImeiQueueController-Enhanced.js` → `ImeiQueueController-Enhanced.ts`
   - All remaining `.js` controllers

### Phase 4: Services Migration
4. **Convert remaining services to TypeScript**:
   - All `.js` services in `src/services/`

### Phase 5: Cleanup
5. **Remove legacy files**:
   - `server.js` (replace with TypeScript build)
   - All `.js` files in `src/`

## Benefits
- ✅ **Consistent build**: Single TypeScript build process
- ✅ **Type safety**: Full TypeScript benefits
- ✅ **Better IDE support**: IntelliSense, refactoring
- ✅ **Easier maintenance**: Single language codebase
- ✅ **Future-proof**: Ready for production builds

## Build Commands
- **Development**: `npm run dev` (TypeScript with ts-node)
- **Production**: `npm run build` → `npm start` (compiled JavaScript)
- **Legacy**: `npm run server` (remove after migration)

## Next Steps
1. Start with core services migration
2. Test each migration step
3. Update imports and dependencies
4. Remove legacy JavaScript files
5. Update documentation
