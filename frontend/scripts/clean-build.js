#!/usr/bin/env node

/**
 * Clean build artifacts script
 * Removes old Farm build artifacts and prepares for fresh SWC build
 */

import { existsSync, rmSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');
const assetsDir = join(distDir, 'assets');

console.log('🧹 Cleaning build artifacts...');

// Remove old Farm artifacts
if (existsSync(assetsDir)) {
  console.log('  Removing old assets...');
  rmSync(assetsDir, { recursive: true, force: true });
}

// Remove old index.html if it references Farm files
const indexPath = join(distDir, 'index.html');
if (existsSync(indexPath)) {
  const indexHtml = readFileSync(indexPath, 'utf8');
  // Check if it references old Farm-style index_*.js files
  if (indexHtml.includes('index_') && indexHtml.match(/index_\w+\.\w+\.js/)) {
    console.log('  Removing old Farm-generated index.html...');
    rmSync(indexPath, { force: true });
  }
}

console.log('✅ Clean complete! Ready for fresh SWC build.');

