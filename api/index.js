// Vercel serverless function entry point for Express app
// This file is used by Vercel to handle all API routes
const app = require('../server.js');

// Export the Express app for Vercel serverless functions
// Vercel will automatically handle routing to this function for /api/* routes
module.exports = app;

