#!/usr/bin/env node

/**
 * Production build using SWC (Rust) for compilation
 */

import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Explicitly prefer Rust build (SWC)
const PREFER_RUST_BUILD = process.env.PREFER_RUST_BUILD !== 'false'; // Default to true

const swcOptions = {
  jsc: {
    parser: {
      syntax: 'typescript',
      tsx: true,
      decorators: false,
      dynamicImport: true,
    },
    transform: {
      react: {
        runtime: 'automatic',
        refresh: false, // Disable React Refresh
        development: false,
      },
    },
    target: 'es2022',
    loose: false,
    externalHelpers: false,
    minify: {
      compress: true,
      mangle: true,
    },
  },
  module: {
    type: 'es6',
  },
  minify: true,
};

async function buildProduction() {
  try {
    // Verify SWC (Rust) is available
    if (PREFER_RUST_BUILD) {
      try {
        await import('@swc/core');
        console.log('✅ Using SWC (Rust-based compiler) for TypeScript/JSX transformation');
      } catch (error) {
        console.error('❌ SWC (Rust) not available. Please install: pnpm install @swc/core');
        throw new Error('Rust build system (SWC) is required but not available');
      }
    }
    
    // Clean old build artifacts (especially Farm remnants)
    const distDir = join(rootDir, 'dist');
    const assetsDir = join(distDir, 'assets');
    if (existsSync(assetsDir)) {
      console.log('🧹 Cleaning old build artifacts...');
      rmSync(assetsDir, { recursive: true, force: true });
    }
    
    console.log('🏗️  Building production bundle with SWC (Rust)...');
    
    const entryPoint = join(rootDir, 'src/main.tsx');
    
    await build({
      entryPoints: [entryPoint],
      bundle: true,
      outdir: join(rootDir, 'dist/assets'),
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      jsx: 'automatic',
      loader: {
        '.ts': 'ts',
        '.tsx': 'tsx',
        '.css': 'css',
        '.json': 'json',
        '.svg': 'dataurl',
        '.png': 'file',
        '.jpg': 'file',
        '.jpeg': 'file',
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      sourcemap: false,
      minify: true,
      treeShaking: true,
      splitting: true,
      chunkNames: '[name]-[hash]',
      entryNames: '[name]-[hash]',
      assetNames: '[name]-[hash]',
      alias: {
        '@': join(rootDir, 'src'),
      },
      plugins: [
        {
          name: 'swc-loader',
          setup(build) {
            build.onLoad({ filter: /\.(ts|tsx)$/ }, async (args) => {
              const { code } = await import('@swc/core').then(m => 
                m.transform(readFileSync(args.path, 'utf-8'), {
                  ...swcOptions,
                  filename: args.path,
                })
              );
              return {
                contents: code,
                loader: 'js',
              };
            });
          },
        },
      ],
    });
    
    // Generate index.html with correct asset references
    await generateIndexHtml();
    
    console.log('✅ Production build complete!');
    console.log('📦 Output: dist/assets/');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function generateIndexHtml() {
  const distDir = join(rootDir, 'dist');
  const assetsDir = join(distDir, 'assets');
  
  if (!existsSync(assetsDir)) {
    console.warn('⚠️  Assets directory not found, skipping index.html generation');
    return;
  }
  
  // Find the main JS file (should be main.js or main-[hash].js)
  const files = readdirSync(assetsDir);
  const jsFiles = files.filter(f => f.startsWith('main') && f.endsWith('.js'));
  const cssFiles = files.filter(f => f.endsWith('.css'));
  
  if (jsFiles.length === 0) {
    console.warn('⚠️  No main.js file found in assets');
    return;
  }
  
  // Use the first main.js file (or main-[hash].js)
  const mainJs = jsFiles[0];
  const cssLinks = cssFiles.map(css => 
    `    <link rel="stylesheet" href="/assets/${css}">`
  ).join('\n');
  
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📦</text></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
${cssLinks}
    <title>WMS - Warehouse Management System</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${mainJs}"></script>
  </body>
</html>
`;
  
  const indexPath = join(distDir, 'index.html');
  writeFileSync(indexPath, html, 'utf8');
  console.log(`✅ Generated index.html with ${mainJs}`);
}

buildProduction();

