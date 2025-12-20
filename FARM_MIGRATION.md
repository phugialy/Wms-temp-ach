# Migration to Farm (Rust-based Bundler)

## Why Farm?

✅ **Rust-based** - Extremely fast, written in Rust  
✅ **Vite-compatible** - Similar API, easy migration  
✅ **Production-ready** - Stable and actively maintained  
✅ **Fast HMR** - Hot module replacement  
✅ **Better with large projects** - Handles many modules efficiently  
✅ **Consistent** - Same behavior in dev and production  

## What Changed

### Removed:
- ❌ esbuild
- ❌ esbuild.config.js
- ❌ cross-env

### Added:
- ✅ `@farmfe/core` - Farm bundler
- ✅ `@farmfe/plugin-react` - React plugin
- ✅ `farm.config.ts` - Farm configuration

## Installation

```bash
cd frontend
pnpm install
```

## Usage

### Development:
```bash
# Start Farm dev server (with HMR)
pnpm dev

# Or use unified command
pnpm dev:ui
```

### Production Build:
```bash
pnpm build
```

## Configuration

Farm config is in `farm.config.ts`:
- **Input**: `index.html` (like Vite)
- **Output**: `dist/` directory
- **Proxy**: `/api` → `http://localhost:3001`
- **HMR**: Enabled for fast development
- **Sourcemaps**: Enabled in development

## Benefits Over esbuild

1. **Dev Server**: Farm includes a dev server (like Vite)
2. **HMR**: Hot module replacement out of the box
3. **Vite-like**: Similar API, familiar if you used Vite
4. **Rust Performance**: Extremely fast builds
5. **Better DX**: Better error messages and debugging

## Benefits Over Vite

1. **Rust-based**: Faster than Vite in many cases
2. **Better with large projects**: Handles many modules better
3. **Consistent**: Same behavior in dev/prod
4. **No proxy issues**: Better proxy handling

## Notes

- Farm uses `import.meta.env` like Vite (no changes needed)
- Configuration is similar to Vite
- Dev server runs on port 3000 (same as before)
- Proxy configured for `/api` routes

