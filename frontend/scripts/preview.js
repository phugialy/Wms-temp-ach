#!/usr/bin/env node

/**
 * Preview server for production builds
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

const PORT = process.env.PORT || 3000;

const server = createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  let filePath = join(distDir, url === '/index.html' ? 'index.html' : url.slice(1));
  
  // Handle assets
  if (url.startsWith('/assets/')) {
    filePath = join(distDir, url.slice(1));
  }
  
  try {
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    
    const content = readFileSync(filePath);
    const ext = filePath.split('.').pop();
    const contentType = {
      'html': 'text/html',
      'js': 'application/javascript',
      'css': 'text/css',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'svg': 'image/svg+xml',
    }[ext] || 'text/plain';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    res.writeHead(500);
    res.end(`Error: ${error.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Preview server running at http://localhost:${PORT}`);
  console.log('📦 Serving production build from dist/');
});


