const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting WMS System...\n');

// Check if we're in the right directory
const packageJsonPath = path.join(process.cwd(), 'package.json');
const fs = require('fs');

if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ package.json not found. Please run this from the project root directory.');
    process.exit(1);
}

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found. Please create one with your database configuration.');
    process.exit(1);
}

console.log('✅ Environment check passed');
console.log('📦 Starting TypeScript server...\n');

// Start the TypeScript server
const serverProcess = spawn('npm', ['start'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
});

serverProcess.on('error', (error) => {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
});

serverProcess.on('close', (code) => {
    if (code !== 0) {
        console.error(`❌ Server exited with code ${code}`);
    } else {
        console.log('✅ Server stopped gracefully');
    }
});

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    serverProcess.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...');
    serverProcess.kill('SIGTERM');
    process.exit(0);
});

console.log('🎯 Server starting...');
console.log('📱 Frontend will be available at: http://localhost:3001');
console.log('🔗 API endpoints will be available at: http://localhost:3001/api/*');
console.log('👨‍💼 Operator Dashboard: http://localhost:3001/operator-dashboard.html');
console.log('\n⏳ Waiting for server to start...');
console.log('💡 Press Ctrl+C to stop the server');

