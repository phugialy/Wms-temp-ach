# Backend Startup Guide

## Quick Start

### Option 1: TypeScript Backend (Recommended)
```bash
# From root directory
pnpm dev
```
This runs: `nodemon --watch src --exec ts-node src/index.ts`

### Option 2: CommonJS Backend (server.js)
```bash
# From root directory
pnpm server:dev
```
This runs: `nodemon server.js`

### Option 3: Run Both Backend + Frontend
```bash
# From root directory
pnpm dev:all
```
This runs both backend and frontend concurrently.

## Prerequisites

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Generate Prisma Client
```bash
pnpm prisma:generate
```

### 3. Environment Variables
Create a `.env` file in the root directory with:
```env
DATABASE_URL="your-database-url"
DIRECT_URL="your-direct-database-url"
PORT=3001
NODE_ENV=development
```

## Common Issues

### Issue 1: Prisma Client Not Generated
**Error:** `Cannot find module '@prisma/client'` or `PrismaClient is not defined`

**Solution:**
```bash
pnpm prisma:generate
```

### Issue 2: Database Connection Error
**Error:** `Can't reach database server` or connection timeout

**Solution:**
- Check `.env` file has correct `DATABASE_URL` and `DIRECT_URL`
- Verify database is accessible
- Check network/firewall settings

### Issue 3: TypeScript Compilation Errors
**Error:** Type errors when starting with `pnpm dev`

**Solution:**
- Run `pnpm type-check` to see all errors
- Fix type errors or use `pnpm server:dev` (uses server.js which doesn't need compilation)

### Issue 4: Port Already in Use
**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:**
- Kill the process using port 3001:
  ```bash
  # Windows PowerShell
  netstat -ano | findstr :3001
  taskkill /PID <PID> /F
  ```
- Or change PORT in `.env` file

## Verification

### Check if Backend is Running
```bash
# Test health endpoint
curl http://localhost:3001/health

# Or in browser
http://localhost:3001/health
```

### Check Backend Logs
The backend should show:
```
🚀 WMS Backend server running on port 3001
📊 Environment: development
🔗 Health check: http://localhost:3001/health
```

## Troubleshooting Steps

1. **Check Node.js version:**
   ```bash
   node --version  # Should be 18+ or 20+
   ```

2. **Verify dependencies:**
   ```bash
   pnpm install
   ```

3. **Generate Prisma client:**
   ```bash
   pnpm prisma:generate
   ```

4. **Check environment variables:**
   ```bash
   # Windows PowerShell
   Get-Content .env
   ```

5. **Try starting with verbose logging:**
   ```bash
   NODE_ENV=development pnpm dev
   ```

6. **Check for syntax errors:**
   ```bash
   pnpm type-check
   ```

## Which Backend to Use?

- **`src/index.ts`** (TypeScript) - Full TypeScript support, better type safety
- **`server.js`** (CommonJS) - Simpler, no compilation needed, faster startup

For development, both work. Use `pnpm dev` for TypeScript backend or `pnpm server:dev` for CommonJS backend.



