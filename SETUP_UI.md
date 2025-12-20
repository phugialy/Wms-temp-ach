# UI Setup Guide

The frontend is now integrated with the backend and served from a single server.

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Build Frontend
```bash
pnpm build:frontend
```

### 3. Start Server (with UI)
```bash
pnpm server:with-ui
```

The app will be available at: **http://localhost:3001**

## Development Mode

### Option 1: Backend + Frontend Dev Server (Recommended for UI development)
```bash
pnpm dev:ui
```
- Backend runs on port 3001
- Frontend dev server runs on port 3000 (with hot reload)
- Access frontend at: http://localhost:3000
- API calls are proxied to backend

### Option 2: Backend Only (with built frontend)
```bash
pnpm server:dev
```
- Backend runs on port 3001
- Serves built frontend from `frontend/dist`
- Access at: http://localhost:3001

## Build Commands

- `pnpm build:frontend` - Build React frontend only
- `pnpm build:backend` - Build TypeScript backend only
- `pnpm build` - Build both frontend and backend

## Project Structure

```
.
├── frontend/          # React + Ant Design frontend
│   ├── src/
│   ├── dist/         # Built frontend (generated)
│   └── package.json
├── src/              # Backend TypeScript source
├── server.js         # Express server (serves frontend)
└── package.json      # Root package.json with workspace config
```

## Features

- ✅ Modern Ant Design UI components
- ✅ Professional layout with sidebar navigation
- ✅ Cron Job Management page
- ✅ Unified backend serving frontend
- ✅ pnpm workspace configuration
- ✅ Hot reload in development

## Notes

- The frontend build is served from `frontend/dist/`
- API routes are prefixed with `/api`
- All other routes serve the React SPA
- The server automatically detects if frontend is built

