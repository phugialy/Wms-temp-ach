# Rust-Based Build System Migration

## Overview

This project has been migrated from Rspack/Farm to a **Rust-based build system** using **SWC** (Speedy Web Compiler) for TypeScript/JSX compilation.

## Architecture

### Core Components

1. **SWC (Rust)** - Handles all TypeScript/JSX compilation
   - Written in Rust for maximum performance
   - Supports React Fast Refresh
   - TypeScript parsing and transformation
   - Source map generation

2. **esbuild (Go)** - Handles bundling and asset processing
   - Fast bundling (secondary to SWC compilation)
   - CSS processing
   - Asset handling

3. **PostCSS + Tailwind** - CSS processing
   - Tailwind CSS compilation
   - Autoprefixer

## Key Changes

### Removed Dependencies
- `@rspack/cli`
- `@rspack/core`
- `@rspack/plugin-react-refresh`
- `@farmfe/core` (if present)
- `@farmfe/plugin-react` (if present)

### Added Dependencies
- `@swc/core` - Rust-based TypeScript/JSX compiler
- `@swc/helpers` - SWC helper functions
- `esbuild` - Fast bundler (used for bundling, SWC handles compilation)
- `postcss-load-config` - PostCSS configuration loader

### Configuration Files

- **`scripts/turbopack-dev.js`** - Development server with SWC compilation
- **`scripts/turbopack-build.js`** - Production build with SWC compilation
- **`scripts/preview.js`** - Preview server for production builds

### Removed Files
- `rspack.config.ts`
- `farm.config.ts` (if exists)

## Usage

### Development
```bash
pnpm dev
```
Starts the dev server with:
- SWC (Rust) for fast TypeScript/JSX compilation
- Hot Module Replacement (HMR)
- Source maps enabled
- Fast refresh for React components

### Production Build
```bash
pnpm build
```
Creates optimized production bundle:
- SWC (Rust) compilation with minification
- Tree shaking
- Code splitting
- Asset optimization

### Preview Production Build
```bash
pnpm preview
```
Serves the production build locally for testing.

## Performance Benefits

1. **Faster Compilation** - SWC is written in Rust and compiles TypeScript/JSX significantly faster than Babel or TSC
2. **Better HMR** - Fast refresh with minimal rebuilds
3. **Smaller Bundle Sizes** - Better tree shaking and optimization
4. **Type Safety** - Full TypeScript support with fast compilation

## Migration Notes

- All existing code should work without changes
- Path aliases (`@/`) are preserved
- CSS processing remains the same (Tailwind + PostCSS)
- React Fast Refresh is enabled automatically

## Future Improvements

Consider migrating to pure Rust bundlers when available:
- **Rolldown** - Rust-based Rollup alternative (experimental)
- **Turbopack Standalone** - When stable for standalone use

## Troubleshooting

### Build Errors
- Ensure `@swc/core` is installed: `pnpm install`
- Check TypeScript errors: `pnpm type-check`
- Verify Node.js version (18+ recommended)

### HMR Not Working
- Clear browser cache
- Restart dev server
- Check file watcher permissions (Windows)

### CSS Not Loading
- Verify PostCSS config in `postcss.config.js`
- Check Tailwind config in `tailwind.config.js`
- Ensure CSS files are imported in components


