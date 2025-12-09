# WMS Frontend - React SPA

Modern React Single Page Application for the Warehouse Management System.

## 🚀 Quick Start

### Development

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/        # Reusable components
│   │   ├── ui/            # UI primitives (Button, Toast, Card, etc.)
│   │   ├── forms/         # Form components
│   │   └── layout/        # Layout components (Sidebar, Header, etc.)
│   ├── pages/             # Page components
│   ├── stores/            # Zustand state management
│   ├── services/          # API clients
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript types
│   ├── utils/             # Utility functions
│   ├── routes.tsx         # React Router configuration
│   └── main.tsx           # Application entry point
├── public/                # Static assets
└── package.json
```

## 🛠 Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool (10-100x faster than Webpack)
- **React Router** - Client-side routing
- **Zustand** - State management
- **Axios** - HTTP client
- **Tailwind CSS** - Utility-first CSS

## 🔧 Configuration

### API Proxy

The Vite dev server is configured to proxy API requests to the backend:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

This means all `/api/*` requests will be forwarded to your Express backend.

## 📝 Development Notes

### Adding New Pages

1. Create a new component in `src/pages/`
2. Add route in `src/routes.tsx`
3. Add navigation item in `src/components/layout/Sidebar.tsx`

### Using Toast Notifications

```typescript
import { useToastStore } from '../stores/toastStore';

const addToast = useToastStore((state) => state.addToast);

// Success
addToast('Operation successful!', 'success');

// Error
addToast('Something went wrong', 'error');

// Warning
addToast('Please check your input', 'warning');

// Info
addToast('Processing...', 'info');
```

### Making API Calls

```typescript
import { apiClient } from '../services/api';

// GET request
const response = await apiClient.get('/admin/locations');
if (response.success) {
  console.log(response.data);
}

// POST request
const response = await apiClient.post('/admin/inventory-push', {
  imei: '123456789012345',
  location: 'Warehouse A',
});
```

## 🎨 Styling

This project uses Tailwind CSS for styling. All components use utility classes.

### Custom Components

Reusable UI components are in `src/components/ui/`:
- `Button` - Styled buttons with variants
- `Card` - Card container
- `Toast` - Notification system
- `Spinner` - Loading indicator

## 🚦 Next Steps

1. ✅ Project setup complete
2. ✅ Shared components created
3. ✅ Routing configured
4. ✅ Dashboard layout ready
5. ⏳ Migrate remaining pages from HTML
6. ⏳ Add authentication
7. ⏳ Add error boundaries
8. ⏳ Performance optimization

## 📚 Resources

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vite.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [React Router](https://reactrouter.com)
- [Zustand](https://zustand-demo.pmnd.rs)
