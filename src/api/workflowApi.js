const express = require('express');
const router = express.Router();

// Determine if we're in production (compiled JS) or development (TypeScript)
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;

// Try to load workflow routes (supports both compiled JS and TypeScript)
let workflowRoutes;
try {
  if (isProduction || isVercel) {
    // Production: Use compiled JavaScript from dist/
    try {
      // When this file is in dist/api/workflowApi.js, routes are in dist/routes/workflow.route.js
      workflowRoutes = require('../routes/workflow.route');
      console.log('✅ Workflow routes loaded from compiled JavaScript (dist/)');
    } catch (error) {
      console.warn('⚠️  Compiled workflow routes not found, trying source...', error.message);
      throw error; // Fall through to try source
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
  
  // Mount all routes from the workflow router
  router.use('/', workflowRoutes);
  
  console.log('✅ Workflow routes mounted successfully');
} catch (error) {
  console.error('❌ Failed to load workflow routes:', error.message);
  console.error('❌ Error stack:', error.stack);
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

