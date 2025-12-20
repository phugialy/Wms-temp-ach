#!/usr/bin/env node

/**
 * Development server using SWC (Rust) for compilation
 * Serves from memory - NO dist/ folder writes in dev mode
 * Only production builds write to dist/
 */

import { build } from 'esbuild';
import { createServer } from 'http';
import { request as httpRequest } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';
import tailwindcssPostcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';
import chokidar from 'chokidar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const PORT = process.env.PORT || 3000;
const BACKEND_PORT = process.env.BACKEND_PORT || 3001;
const isDev = process.env.NODE_ENV !== 'production';

// Explicitly prefer Rust build (SWC)
const PREFER_RUST_BUILD = process.env.PREFER_RUST_BUILD !== 'false';

// SWC loader configuration
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
        refresh: false,
        development: isDev,
      },
    },
    target: 'es2022',
    loose: false,
    externalHelpers: false,
  },
  module: {
    type: 'es6',
  },
  sourceMaps: isDev,
};

// In-memory build cache
let buildCache = {
  js: null,
  css: null,
  lastBuild: 0,
};

async function buildInMemory() {
  try {
    // Verify SWC (Rust) is available
    if (PREFER_RUST_BUILD) {
      try {
        await import('@swc/core');
      } catch (error) {
        console.error('❌ SWC (Rust) not available. Please install: pnpm install @swc/core');
        throw new Error('Rust build system (SWC) is required but not available');
      }
    }
    
    const entryPoint = join(rootDir, 'src/main.tsx');
    const cssPath = join(rootDir, 'src/index.css');
    
    // Build JavaScript bundle in memory
    const result = await build({
      entryPoints: [entryPoint],
      bundle: true,
      write: false, // Don't write to disk!
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      jsx: 'preserve',
      loader: {
        '.ts': 'ts',
        '.tsx': 'js',
        '.css': 'css',
        '.json': 'json',
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify('development'),
      },
      sourcemap: isDev ? 'inline' : false,
      minify: false,
      treeShaking: true,
      alias: {
        '@': join(rootDir, 'src'),
      },
      plugins: [
        {
          name: 'swc-loader',
          setup(build) {
            build.onLoad({ filter: /\.(ts|tsx)$/ }, async (args) => {
              try {
                const source = readFileSync(args.path, 'utf-8');
                const { code } = await import('@swc/core').then(m => 
                  m.transform(source, {
                    ...swcOptions,
                    filename: args.path,
                  })
                );
                return {
                  contents: code,
                  loader: 'js',
                };
              } catch (error) {
                console.error(`❌ Error transforming ${args.path}:`, error);
                throw error;
              }
            });
          },
        },
      ],
    });
    
    // Process CSS
    let css = '';
    if (existsSync(cssPath)) {
      const cssContent = readFileSync(cssPath, 'utf-8');
      const processed = await postcss([tailwindcssPostcss, autoprefixer]).process(cssContent, {
        from: cssPath,
      });
      css = processed.css;
    }
    
    // Update cache
    buildCache.js = result.outputFiles[0].text;
    buildCache.css = css;
    buildCache.lastBuild = Date.now();
    
    console.log('✅ Build complete (in-memory)');
    return true;
  } catch (error) {
    console.error('❌ Build failed:', error);
    return false;
  }
}

// Dev server with API proxy
const server = createServer(async (req, res) => {
  const fullUrl = req.url || '/';
  const url = fullUrl.split('?')[0];
  
  try {
    // Proxy API requests to backend
    if (url.startsWith('/api/')) {
      return new Promise((resolve) => {
        // Use full URL (including query string) for the proxy path
        const proxyReq = httpRequest({
          hostname: 'localhost',
          port: BACKEND_PORT,
          path: fullUrl, // Use full URL with query parameters
          method: req.method,
          headers: {
            'Content-Type': 'application/json',
            ...(req.headers['authorization'] ? { 'Authorization': req.headers['authorization'] } : {}),
          },
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res);
          proxyRes.on('end', resolve);
        });
        
        proxyReq.on('error', (err) => {
          console.error('Proxy error:', err.message);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Backend server not available', details: err.message }));
          resolve();
        });
        
        // Forward request body
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          req.pipe(proxyReq);
        } else {
          proxyReq.end();
        }
      });
    }
    
    // Serve CSS
    if (url === '/assets/main.css') {
      if (buildCache.css) {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(buildCache.css);
        return;
      }
    }
    
    // Serve JavaScript bundle
    if (url === '/assets/main.js') {
      if (buildCache.js) {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(buildCache.js);
        return;
      } else {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('Build not ready. Please wait...');
        return;
      }
    }
    
    // Serve index.html for all routes (React Router)
    const html = readFileSync(join(rootDir, 'index.html'), 'utf-8')
      .replace('<!-- Script will be injected by build system -->', 
               '<link rel="stylesheet" href="/assets/main.css">\n    <script type="module" src="/assets/main.js"></script>');
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500);
    res.end(`Error: ${error.message}`);
  }
});

// Start dev server
if (isDev) {
  console.log('🔄 Starting dev server with SWC (Rust-based compiler)...');
  console.log(`📦 Serving from memory (no dist/ writes)`);
  console.log(`🔗 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 Backend proxy: http://localhost:${BACKEND_PORT}`);
  
  // Initial build
  await buildInMemory();
  
  // File watcher
  const watcher = chokidar.watch([
    join(rootDir, 'src/**/*.{ts,tsx,css}'),
    join(rootDir, 'index.html'),
  ], {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true,
  });
  
  let rebuildTimeout;
  watcher.on('all', async (event, path) => {
    clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(async () => {
      console.log(`🔄 File changed: ${path}`);
      await buildInMemory();
    }, 100);
  });
  
  server.listen(PORT, () => {
    console.log(`🚀 Dev server running at http://localhost:${PORT}`);
    console.log('👀 Watching for file changes...');
    console.log('💡 No dist/ folder needed - everything served from memory!');
  });
} else {
  await buildInMemory();
  process.exit(0);
}
