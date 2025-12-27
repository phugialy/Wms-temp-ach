# Farm Bundler Cleanup Summary

## Issue
The frontend was showing errors related to `_farm_module_system_` because old Farm build artifacts were still present in the `dist` folder, even though the project had migrated to SWC/Rust build system.

## Error Details
```
Uncaught TypeError: Cannot read properties of undefined (reading '_farm_module_system_')
at index 7f23.ec2d2013.js:1
```

This error occurred because:
1. Old Farm build artifacts (`index_*.js` files) were still in `dist/assets/`
2. `dist/index.html` was referencing these old Farm files
3. The new SWC build outputs `main.js` but the HTML wasn't updated

## Changes Made

### 1. Updated Build Script (`turbopack-build.js`)
- ✅ Added automatic cleanup of old build artifacts before building
- ✅ Added `generateIndexHtml()` function to create proper `index.html`
- ✅ Generates HTML that references SWC-built `main.js` files
- ✅ Removes old Farm artifacts automatically

### 2. Created Clean Script (`clean-build.js`)
- ✅ Standalone script to clean old Farm artifacts
- ✅ Can be run manually: `pnpm clean`
- ✅ Removes old `index_*.js` files and Farm-generated HTML

### 3. Updated Package Scripts
- ✅ Added `build:clean` script for clean rebuilds
- ✅ Added `clean` script for manual cleanup

### 4. Fixed References
- ✅ Updated `post-build.js` comment (deprecated, kept for reference)
- ✅ Updated `edgeFunctions.ts` comment about environment variables

## Files Modified

1. **`frontend/scripts/turbopack-build.js`**
   - Added cleanup logic
   - Added `generateIndexHtml()` function
   - Now generates proper `index.html` automatically

2. **`frontend/scripts/clean-build.js`** (NEW)
   - Standalone cleanup script
   - Removes old Farm artifacts

3. **`frontend/package.json`**
   - Added `clean` script
   - Added `build:clean` script

4. **`frontend/scripts/post-build.js`**
   - Updated comment (deprecated)

5. **`frontend/src/services/edgeFunctions.ts`**
   - Updated comment about environment variables

## How to Fix

### Option 1: Clean and Rebuild (Recommended)
```bash
cd frontend
pnpm clean          # Remove old Farm artifacts
pnpm build          # Build with SWC
```

### Option 2: Use Clean Build Script
```bash
cd frontend
pnpm build:clean    # Clean + build in one command
```

### Option 3: Manual Cleanup
```bash
cd frontend
# Remove dist folder completely
rm -rf dist
# Rebuild
pnpm build
```

## Verification

After rebuilding, verify:

1. **Check `dist/index.html`**:
   - Should reference `/assets/main.js` or `/assets/main-[hash].js`
   - Should NOT reference `index_*.js` files

2. **Check `dist/assets/`**:
   - Should contain `main.js` or `main-[hash].js`
   - Should NOT contain `index_*.js` files

3. **Test the app**:
   - Start dev server: `pnpm dev`
   - Check browser console - no `_farm_module_system_` errors
   - App should load correctly

## Build Output Structure

### Old Farm Structure (Removed)
```
dist/
  assets/
    index_7f23.ec2d2013.js  ❌ Farm artifact
    index_4561.4c6565c6.css
  index.html                 ❌ References index_*.js
```

### New SWC Structure (Current)
```
dist/
  assets/
    main-[hash].js           ✅ SWC/esbuild output
    main-[hash].css
  index.html                 ✅ References main-[hash].js
```

## Prevention

The build script now automatically:
1. Cleans old artifacts before building
2. Generates correct `index.html`
3. Uses SWC (Rust) for compilation
4. Outputs to `main.js` format

## Notes

- The `post-build.js` script is deprecated but kept for reference
- All Farm dependencies were already removed from `package.json`
- The migration to SWC is complete, just needed to clean old artifacts
- Future builds will automatically clean and generate correct files



