const express = require('express');
const router = express.Router();

// Try to load TypeScript workflow routes
let workflowRoutes;
try {
  // Use ts-node/register/transpile-only to skip type checking completely
  // This is the recommended way to avoid type errors in development
  if (!require.extensions['.ts']) {
    // Use the transpile-only loader which skips all type checking
    require('ts-node/register/transpile-only');
  }
  const workflowModule = require('../routes/workflow.route');
  workflowRoutes = workflowModule.default || workflowModule;
  
  // Mount all routes from the workflow router
  router.use('/', workflowRoutes);
  
  console.log('✅ Workflow routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load workflow routes:', error.message);
  console.log('⚠️  Make sure ts-node is installed: pnpm add -D ts-node');
  
  // Provide fallback error responses
  router.post('/bulk-add', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Workflow routes not available',
      message: 'TypeScript routes need to be compiled or ts-node installed'
    });
  });
  
  router.get('/executions', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Workflow routes not available',
      message: 'TypeScript routes need to be compiled or ts-node installed'
    });
  });
  
  router.get('/stats', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Workflow routes not available',
      message: 'TypeScript routes need to be compiled or ts-node installed'
    });
  });
}

module.exports = router;

