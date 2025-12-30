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
      // In production, this file is at dist/api/workflowApi.js
      // Routes should be at dist/routes/workflow.route.js
      const path = require('path');
      const fs = require('fs');
      
      // Try to find the compiled route file
      // __dirname will be dist/api/ in production
      const routePath = path.join(__dirname, '../routes/workflow.route.js');
      const routePathNoExt = path.join(__dirname, '../routes/workflow.route');
      
      // Check if file exists, if not try without .js extension (Node.js will add it)
      if (fs.existsSync(routePath) || fs.existsSync(routePathNoExt)) {
        workflowRoutes = require(routePathNoExt);
        console.log('✅ Workflow routes loaded from compiled JavaScript:', routePathNoExt);
      } else {
        // Fallback: try relative require (Node.js will resolve it)
        workflowRoutes = require('../routes/workflow.route');
        console.log('✅ Workflow routes loaded from compiled JavaScript (fallback)');
      }
    } catch (error) {
      console.warn('⚠️  Compiled workflow routes not found, trying source...', error.message);
      console.warn('⚠️  Error details:', error.stack);
      // Fall through to try source with ts-node
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

