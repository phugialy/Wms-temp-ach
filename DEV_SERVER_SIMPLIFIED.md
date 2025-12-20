# Simplified Dev Server Setup

## Problem Solved

You were right - constantly building to `dist/` and cleaning artifacts was confusing and error-prone. The new setup:

✅ **Dev mode**: Serves from memory - NO `dist/` writes  
✅ **Production mode**: Only builds to `dist/` when needed  
✅ **Simple commands**: Just `pnpm dev` or `pnpm build`  
✅ **No cleanup needed**: Dev mode doesn't create artifacts  

## How It Works Now

### Development Mode (Memory-Based)

```bash
cd frontend
pnpm dev
```

**What happens:**
- Builds code in memory (no files written)
- Serves JavaScript/CSS directly from memory
- Proxies `/api/*` requests to backend (port 3001)
- Hot reload on file changes
- **No `dist/` folder needed!**

### Production Mode (Static Build)

```bash
cd frontend
pnpm build
```

**What happens:**
- Builds to `dist/` folder
- Generates optimized production files
- Creates `index.html` with correct references
- Only run this when deploying

## Commands Simplified

### Before (Confusing)
```bash
pnpm clean          # Remove old artifacts
pnpm build:clean    # Clean + build
pnpm build          # Build (but might have old files)
pnpm dev            # Dev (writes to dist/)
```

### Now (Simple)
```bash
pnpm dev            # Dev server (memory-based, no dist/)
pnpm build          # Production build (writes to dist/)
```

That's it! No cleanup commands needed.

## Architecture

### Dev Server (`turbopack-dev.js`)
- ✅ Builds in memory using esbuild + SWC
- ✅ Serves JavaScript/CSS from memory cache
- ✅ Proxies API calls to backend
- ✅ Hot reload with file watching
- ✅ No disk writes (except logs)

### Production Build (`turbopack-build.js`)
- ✅ Builds to `dist/assets/`
- ✅ Generates `dist/index.html`
- ✅ Optimized and minified
- ✅ Only used for deployment

## Benefits

1. **No Artifact Conflicts**
   - Dev mode doesn't touch `dist/`
   - Production builds are isolated
   - No more Farm/Vite/SWC conflicts

2. **Faster Development**
   - No disk I/O for builds
   - Instant hot reload
   - No cleanup needed

3. **Clear Separation**
   - Dev = memory
   - Prod = static files
   - No confusion

4. **Simpler Commands**
   - `pnpm dev` = development
   - `pnpm build` = production
   - That's all you need!

## Workflow

### Daily Development
```bash
# Terminal 1: Backend
pnpm dev

# Terminal 2: Frontend
cd frontend
pnpm dev
```

Access at: `http://localhost:3000`

### Production Deployment
```bash
cd frontend
pnpm build          # Build static files
# Deploy dist/ folder
```

## Troubleshooting

### "Backend server not available"
- Make sure backend is running on port 3001
- Check `BACKEND_PORT` environment variable if different

### "Build not ready"
- Wait a moment for initial build
- Check console for build errors
- Verify SWC is installed: `pnpm install`

### Old artifacts still showing?
- Dev mode doesn't use `dist/` anymore
- Clear browser cache (Ctrl+Shift+R)
- Restart dev server

## Migration Notes

- ✅ Removed `clean` script (not needed)
- ✅ Removed `build:clean` script (not needed)
- ✅ Removed `verify:rust` script (not needed)
- ✅ Dev server now memory-based
- ✅ Production build unchanged

## Next Steps

1. **Try it now:**
   ```bash
   cd frontend
   pnpm dev
   ```

2. **Verify:**
   - App loads at `http://localhost:3000`
   - No `dist/` folder created
   - Hot reload works
   - API calls proxy correctly

3. **Enjoy:**
   - No more cleanup commands
   - No more artifact conflicts
   - Simple, clear workflow


