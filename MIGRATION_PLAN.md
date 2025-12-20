# Migration Plan: Vite → esbuild

## Why esbuild?
- ✅ **Simple** - Minimal configuration
- ✅ **Fast** - Extremely fast builds
- ✅ **No dev server** - Just build and serve from backend
- ✅ **No proxy issues** - Everything goes through Express
- ✅ **TypeScript support** - Built-in
- ✅ **React support** - Via plugin

## Migration Steps

1. Install esbuild and dependencies
2. Create esbuild config
3. Update package.json scripts
4. Replace `import.meta.env` with process.env
5. Update HTML entry point
6. Remove Vite dependencies
7. Test build and dev workflow

## Benefits

- **Simpler**: No proxy configuration needed
- **Faster builds**: esbuild is extremely fast
- **Unified**: Everything served from Express backend
- **No proxy errors**: Direct API calls to backend
- **Easier debugging**: Single server, no proxy layer

