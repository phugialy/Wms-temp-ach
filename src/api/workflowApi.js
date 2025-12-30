const express = require('express');
const router = express.Router();

// Determine if we're in production (compiled JS) or development (TypeScript)
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;

// Try to load workflow routes (supports both compiled JS and TypeScript)
let workflowRoutes;
try {
  const path = require('path');
  const fs = require('fs');
  
  if (isProduction || isVercel) {
    // Production: Try multiple paths to find compiled routes
    const possiblePaths = [
      // Path 1: If this file is at dist/api/workflowApi.js, routes are at dist/routes/workflow.route.js
      path.join(__dirname, '../routes/workflow.route'),
      // Path 2: Absolute from project root
      path.join(process.cwd(), 'dist/routes/workflow.route'),
      // Path 3: Relative from current file location
      '../routes/workflow.route',
      // Path 4: Try from src (if dist doesn't exist)
      path.join(process.cwd(), 'src/routes/workflow.route'),
    ];
    
    let loaded = false;
    for (const routePath of possiblePaths) {
      try {
        // Try to require the route
        workflowRoutes = require(routePath);
        console.log(`✅ Workflow routes loaded from: ${routePath}`);
        loaded = true;
        break;
      } catch (err) {
        // Try next path
        continue;
      }
    }
    
    if (!loaded) {
      // Last resort: try with ts-node (shouldn't happen in production but fallback)
      console.warn('⚠️  Compiled routes not found, trying TypeScript fallback...');
      if (!require.extensions['.ts']) {
        require('ts-node/register/transpile-only');
      }
      workflowRoutes = require('../routes/workflow.route');
      console.log('✅ Workflow routes loaded from TypeScript (fallback)');
    }
  } else {
    // Development: Use TypeScript files with ts-node
    if (!require.extensions['.ts']) {
      require('ts-node/register/transpile-only');
    }
    workflowRoutes = require('../routes/workflow.route');
    console.log('✅ Workflow routes loaded from TypeScript (src/)');
  }
  
  // Handle both default export and named export
  workflowRoutes = workflowRoutes.default || workflowRoutes;
  
  // Verify we got a valid router
  if (!workflowRoutes) {
    throw new Error('Workflow routes loaded but is null/undefined');
  }
  
  if (typeof workflowRoutes !== 'function' && typeof workflowRoutes.use !== 'function') {
    console.error('❌ Workflow routes is not a valid Express router:', typeof workflowRoutes);
    throw new Error('Workflow routes did not export a valid Express router');
  }
  
  // Mount all routes from the workflow router
  router.use('/', workflowRoutes);
  
  console.log('✅ Workflow routes mounted successfully');
  console.log('✅ Available routes: /bulk-add, /executions, /stats, /stations/stats');
} catch (error) {
  console.error('❌ Failed to load workflow routes:', error.message);
  console.error('❌ Error stack:', error.stack);
  console.error('❌ Current directory:', process.cwd());
  console.error('❌ __dirname:', __dirname);
  console.log('⚠️  Make sure TypeScript is compiled (pnpm build:backend) or ts-node is installed');
  
  // Provide fallback error responses for all routes
  router.post('/bulk-add', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Workflow routes not available',
      message: 'TypeScript routes need to be compiled or ts-node installed',
      details: error.message
    });
  });
  
  router.get('/bulk-add', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Workflow routes not available',
      message: 'TypeScript routes need to be compiled or ts-node installed',
      details: error.message
    });
  });
  
  router.get('/executions', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Workflow routes not available',
      message: 'TypeScript routes need to be compiled or ts-node installed',
      details: error.message
    });
  });
  
  router.get('/stats', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Workflow routes not available',
      message: 'TypeScript routes need to be compiled or ts-node installed',
      details: error.message
    });
  });
}

module.exports = router;

