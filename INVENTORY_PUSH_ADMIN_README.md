# Inventory Push Admin Component

A comprehensive React component for managing inventory push operations in the WMS system.

## Features

### ✅ Form Fields
- **name** (string, required)
- **brand** (string, required)
- **model** (string, required)
- **storage** (string, optional)
- **color** (string, optional)
- **carrier** (string, optional)
- **type** (dropdown, default: "phone")
- **imei** (string, triggers mock fetch on blur)
- **serialNumber** (string, optional)
- **condition** (dropdown, default: "used")
- **quantity** (number, required)
- **location** (dropdown, required)

### ✅ IMEI Auto-fill Feature
- **OnBlur trigger**: Calls `mockFetchDeviceInfo(imei)` when IMEI field loses focus
- **Mock API**: Currently returns hardcoded device data (iPhone 14 Pro)
- **Auto-population**: Fetched data automatically fills form fields
- **Loading state**: Shows spinner during API call

### ✅ Modal/Side Panel
- **Slides in from right**: Responsive modal with slide animation
- **Device info display**: Shows fetched device information
- **Placeholder structure**: Ready for real API integration
- **Auto-close**: Click outside or close button to dismiss

### ✅ Form Actions
- **Submit**: POSTs to `/api/admin/inventory-push` endpoint
- **Cancel**: Resets form and closes modal
- **Validation**: Enforces required fields and data types

### ✅ Toast Notifications
- **Success**: Green notification for successful submissions
- **Error**: Red notification for errors
- **Auto-dismiss**: Disappears after 5 seconds
- **Manual close**: Click × to dismiss immediately

### ✅ Responsive Design
- **Desktop**: 2-column layout (form + preview)
- **Mobile**: Single column layout
- **Tailwind CSS**: Clean, admin-focused styling
- **Accessible**: Proper labels, focus states, and ARIA attributes

## Usage

### Basic Integration

```tsx
import InventoryPushAdmin from './components/InventoryPushAdmin';

function App() {
  return (
    <div>
      <InventoryPushAdmin />
    </div>
  );
}
```

### With Next.js

```tsx
// pages/admin/inventory-push.tsx
import InventoryPushAdmin from '../../components/InventoryPushAdmin';

export default function InventoryPushPage() {
  return <InventoryPushAdmin />;
}
```

## API Integration

### Current Mock Function

```tsx
const mockFetchDeviceInfo = async (imei: string): Promise<DeviceInfo> => {
  // TODO: Replace mockFetchDeviceInfo with real API
  console.log('Mock API call for IMEI:', imei);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    name: 'iPhone 14 Pro',
    brand: 'Apple',
    model: 'iPhone 14 Pro',
    storage: '256GB',
    color: 'Deep Purple',
    carrier: 'Unlocked',
    type: 'phone',
    condition: 'used'
  };
};
```

### Real API Integration

Replace the mock function with your actual API call:

```tsx
const fetchDeviceInfo = async (imei: string): Promise<DeviceInfo> => {
  const response = await fetch(`/api/devices/${imei}`);
  if (!response.ok) {
    throw new Error('Failed to fetch device info');
  }
  return response.json();
};
```

## Form Data Structure

```tsx
interface InventoryPushFormData {
  name: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  carrier: string;
  type: string;
  imei: string;
  serialNumber: string;
  condition: string;
  quantity: number;
  location: string;
}
```

## Validation Rules

- **Required fields**: name, brand, model, type, quantity, location
- **IMEI/Serial Number**: At least one must be provided
- **Quantity**: Must be positive integer
- **Type options**: phone, tablet, laptop, watch, accessory, other
- **Condition options**: new, used, refurbished, damaged
- **Location options**: Predefined warehouse locations

## Styling

The component uses Tailwind CSS classes for styling:

- **Colors**: Blue primary, gray neutrals, green/red for success/error
- **Spacing**: Consistent padding and margins
- **Shadows**: Subtle shadows for depth
- **Borders**: Rounded corners and clean borders
- **Hover states**: Interactive feedback on buttons and inputs

## TODO Items

The component includes TODO comments for future development:

1. **Replace mock API**: `// TODO: Replace mockFetchDeviceInfo with real API`
2. **Modal data integration**: `// TODO: Hook up modal with actual fetched data`
3. **Error handling**: Enhance error handling for different scenarios
4. **Loading states**: Add more granular loading states
5. **Form validation**: Add client-side validation before submission

## Dependencies

- **React**: 18+ with hooks
- **TypeScript**: For type safety
- **Tailwind CSS**: For styling (make sure it's configured in your project)

## Browser Support

- Modern browsers with ES6+ support
- Responsive design works on mobile and desktop
- Accessibility features for screen readers

## Testing

The component is ready for testing with:

- Form submission testing
- API integration testing
- Responsive design testing
- Accessibility testing
- Error handling testing

## Future Enhancements

1. **Real-time validation**: Validate fields as user types
2. **Barcode scanning**: Add barcode scanner integration
3. **Bulk upload**: Support for CSV/Excel file uploads
4. **History**: Show recent inventory push history
5. **Advanced search**: Search existing inventory before adding
6. **Image upload**: Add product image upload capability 