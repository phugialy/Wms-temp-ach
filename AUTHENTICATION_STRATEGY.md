# Authentication & Route Protection Strategy

## Overview
This document outlines the comprehensive authentication and route protection strategy for the WMS application. All pages and API endpoints must require authentication.

## Current Issues Identified

### 1. **Hardcoded User in main.tsx** ❌
**Problem**: `main.tsx` sets a default user, bypassing authentication
```typescript
// REMOVE THIS:
useAuthStore.getState().setUser({
  id: '1',
  name: 'Operator',
  role: 'OPERATOR',
})
```

### 2. **No App-Level Auth Check** ⚠️
**Problem**: App doesn't check authentication on initial load before rendering routes

### 3. **Missing Catch-All Route** ⚠️
**Problem**: Unknown routes might not be protected

### 4. **Backend API Not Protected** ⚠️
**Problem**: Backend routes don't verify authentication tokens

## Proposed Solution

### Frontend Protection Strategy

#### 1. **App Initialization**
- Remove hardcoded user from `main.tsx`
- Initialize auth store with `isLoading: true`
- Check session on app startup
- Show loading screen until auth check completes

#### 2. **Route Protection Levels**

**Level 1: Public Routes** (No auth required)
- `/login`
- `/register`
- `/verify-email`

**Level 2: Protected Routes** (Auth required)
- All routes under `/` (dashboard, inventory, etc.)
- Use `ProtectedRoute` wrapper

**Level 3: Role-Based Routes** (Auth + Role check)
- `/admin-panel` - ADMIN only
- `/admin-approvals` - ADMIN only
- `/db-integrity-check` - ADMIN/MANAGER only

#### 3. **ProtectedRoute Component**
- Checks `isAuthenticated` from auth store
- Shows loading spinner while checking
- Redirects to `/login` if not authenticated
- Preserves intended destination for redirect after login

#### 4. **Catch-All Route**
- Redirect unknown routes to `/login` or `/dashboard` (if authenticated)

### Backend Protection Strategy

#### 1. **Authentication Middleware**
- Verify Supabase JWT token on all API routes
- Extract user info from token
- Verify user exists in `wms_users` table
- Check `is_active` and `is_verified` flags

#### 2. **Public Endpoints** (No auth required)
- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/verify-email`

#### 3. **Protected Endpoints** (Auth required)
- All other `/api/*` routes

#### 4. **Role-Based Endpoints** (Auth + Role check)
- `/api/admin/*` - ADMIN only
- Some specific endpoints may require MANAGER role

## Implementation Plan

### Phase 1: Frontend Fixes
1. ✅ Remove hardcoded user from `main.tsx`
2. ✅ Add app-level auth initialization
3. ✅ Ensure all routes use `ProtectedRoute`
4. ✅ Add catch-all route
5. ✅ Improve `ProtectedRoute` to handle edge cases

### Phase 2: Backend Protection
1. ✅ Create authentication middleware
2. ✅ Apply middleware to all protected routes
3. ✅ Add role-based access control
4. ✅ Return proper 401/403 errors

### Phase 3: Testing
1. ✅ Test unauthenticated access (should redirect to login)
2. ✅ Test authenticated access (should work normally)
3. ✅ Test role-based access (should restrict appropriately)
4. ✅ Test API endpoints (should require auth)

## Security Best Practices

1. **Never trust client-side checks alone** - Always verify on backend
2. **Use HTTPS in production** - Protect tokens in transit
3. **Token expiration** - Supabase handles this automatically
4. **Secure storage** - Use httpOnly cookies or secure localStorage
5. **CSRF protection** - Consider adding CSRF tokens for state-changing operations

## User Flow

### Unauthenticated User
1. User visits any route → `ProtectedRoute` checks auth
2. Not authenticated → Redirect to `/login`
3. User logs in → Redirect to intended destination or `/dashboard`

### Authenticated User
1. User visits route → `ProtectedRoute` checks auth
2. Authenticated → Render requested page
3. If role required → Check role, allow or deny

### Session Expired
1. API call returns 401 → Interceptor catches it
2. Clear auth state → Redirect to `/login`
3. Show message: "Session expired, please login again"

