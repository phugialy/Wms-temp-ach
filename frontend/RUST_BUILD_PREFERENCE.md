# Rust Build System Preference

This project is configured to **prefer Rust-based builds** using SWC (Speedy Web Compiler) for optimal performance.

## Configuration

The build system automatically prefers Rust builds by default. This is controlled by the `PREFER_RUST_BUILD` environment variable.

### Default Behavior

- **Rust build (SWC) is enabled by default**
- All TypeScript/JSX files are compiled using SWC (Rust)
- esbuild (Go) is used for bundling and asset processing

### Environment Variable

You can control Rust build preference using the `PREFER_RUST_BUILD` environment variable:

```bash
# Enable Rust build (default)
PREFER_RUST_BUILD=true pnpm dev

# Disable Rust build (fallback to esbuild only)
PREFER_RUST_BUILD=false pnpm dev
```

## Verification

To verify that the Rust build system is available:

```bash
pnpm verify:rust
```

Or manually check:

```bash
node -e "import('@swc/core').then(() => console.log('✅ SWC available'))"
```

## Build System Architecture

### Compiler: SWC (Rust)
- **Language**: Rust
- **Purpose**: TypeScript/JSX compilation
- **Performance**: Extremely fast compilation
- **Location**: `@swc/core` package

### Bundler: esbuild (Go)
- **Language**: Go
- **Purpose**: Bundling and asset processing
- **Performance**: Fast bundling
- **Location**: `esbuild` package

## Troubleshooting

### Error: "Rust build system (SWC) is required but not available"

**Solution**: Install SWC dependencies:

```bash
cd frontend
pnpm install @swc/core @swc/helpers
```

### Error: "SWC (Rust) not available"

**Check**:
1. Verify `@swc/core` is installed: `pnpm list @swc/core`
2. Check Node.js version (18+ recommended)
3. Reinstall dependencies: `pnpm install`

### Connection Errors

If you encounter connection errors (Request ID: 0840dea1-46ab-47ff-9167-ded29fa38c59):

1. **Check internet connection**
2. **Verify VPN settings** (if applicable)
3. **Clear npm/pnpm cache**: `pnpm store prune`
4. **Reinstall dependencies**: `rm -rf node_modules && pnpm install`

## Performance Benefits

Using Rust builds provides:

1. **Faster Compilation** - 10-20x faster than Babel
2. **Better TypeScript Support** - Full TypeScript parsing
3. **Lower Memory Usage** - More efficient resource usage
4. **Production Ready** - Stable and battle-tested

## Related Files

- `scripts/turbopack-dev.js` - Development server with SWC
- `scripts/turbopack-build.js` - Production build with SWC
- `build.config.js` - Build configuration
- `RUST_BUILD_MIGRATION.md` - Migration documentation

