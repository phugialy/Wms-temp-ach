# IMEI Input Form - WMS System

A simple, focused UI for adding devices to the warehouse inventory using IMEI numbers.

## 🚀 Features

### ✅ Simple IMEI Input
- **Single field**: Just enter the 15-digit IMEI number
- **Auto-validation**: Only allows numeric input, max 15 characters
- **Real-time feedback**: Shows loading spinner during device lookup

### ✅ Automatic Device Detection
- **IMEI lookup**: Automatically fetches device information when IMEI is entered
- **Device preview**: Shows fetched device details before adding to inventory
- **Mock API**: Currently uses mock data (ready for real API integration)

### ✅ Database Integration
- **Inventory push**: Adds device to database via `/api/admin/inventory-push` endpoint
- **Auto SKU generation**: Creates SKU based on device specifications
- **Location assignment**: Automatically assigns to "Warehouse A"

### ✅ User Experience
- **Toast notifications**: Success/error feedback
- **Form validation**: Ensures IMEI is at least 14 digits
- **Reset functionality**: Clear form and start over
- **Responsive design**: Works on mobile and desktop

## 📁 Files Created

```
src/
├── components/
│   └── IMEIInputForm.tsx          # Main React component
├── pages/
│   └── IMEIInputPage.tsx          # Page wrapper component
public/
└── index.html                     # Standalone HTML version
```

## 🛠 Usage

### Option 1: Standalone HTML (Recommended for testing)
1. Start the backend server:
   ```bash
   pnpm dev
   ```

2. Open in browser:
   ```
   http://localhost:3000
   ```

### Option 2: React Component Integration
```tsx
import IMEIInputForm from './components/IMEIInputForm';

function App() {
  return <IMEIInputForm />;
}
```

## 🔧 API Integration

### Current Mock Function
```tsx
const mockFetchDeviceInfo = async (imei: string): Promise<DeviceInfo> => {
  // TODO: Replace with real API call
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
Replace the mock function with your actual device lookup API:
```tsx
const fetchDeviceInfo = async (imei: string): Promise<DeviceInfo> => {
  const response = await fetch(`/api/devices/lookup/${imei}`);
  if (!response.ok) {
    throw new Error('Device not found');
  }
  return response.json();
};
```

## 📊 Data Flow

1. **User enters IMEI** → Input validation (numbers only, max 15 chars)
2. **IMEI blur event** → Triggers device info fetch
3. **Device info fetched** → Shows preview with device details
4. **User clicks "Add to Inventory"** → Submits to backend API
5. **Backend processes** → Creates/updates item and inventory records
6. **Success response** → Shows success toast, resets form

## 🗄 Database Schema Integration

The form integrates with your existing database schema:

- **Items table**: Creates new item record with IMEI
- **Inventory table**: Creates inventory record with quantity and location
- **SKU generation**: Auto-generates SKU using existing utility
- **Validation**: Uses existing Zod schemas

## 🎨 UI Components

### Form Elements
- **IMEI Input**: Large, focused input field with validation
- **Loading Spinner**: Shows during device lookup
- **Device Preview**: Blue info box with device details
- **Action Buttons**: Reset and Add to Inventory

### Notifications
- **Success Toast**: Green notification for successful additions
- **Error Toast**: Red notification for errors
- **Auto-dismiss**: Disappears after 5 seconds

### Styling
- **Tailwind CSS**: Clean, modern design
- **Responsive**: Works on all screen sizes
- **Accessible**: Proper labels and focus states

## 🔍 Validation Rules

- **IMEI required**: Must be provided
- **IMEI length**: Minimum 14 digits (standard IMEI length)
- **IMEI format**: Numbers only, automatically cleaned
- **Device info**: Optional (falls back to "Unknown" values)

## 🚀 Next Steps

1. **Replace mock API**: Connect to real device lookup service
2. **Add barcode scanning**: Integrate with barcode scanner
3. **Multiple locations**: Allow user to select warehouse location
4. **Bulk import**: Support for multiple IMEI entries
5. **History view**: Show recently added devices

## 🧪 Testing

### Manual Testing
1. Enter a 15-digit IMEI (e.g., `123456789012345`)
2. Wait for device info to load
3. Review device details
4. Click "Add to Inventory"
5. Verify success message

### API Testing
```bash
curl -X POST http://localhost:3000/api/admin/inventory-push \
  -H "Content-Type: application/json" \
  -d '{
    "name": "iPhone 14 Pro",
    "brand": "Apple",
    "model": "iPhone 14 Pro",
    "storage": "256GB",
    "color": "Deep Purple",
    "carrier": "Unlocked",
    "type": "phone",
    "imei": "123456789012345",
    "serialNumber": "",
    "quantity": 1,
    "location": "Warehouse A"
  }'
```

## 🔧 Configuration

### Environment Variables
- `PORT`: Server port (default: 3000)
- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: Environment (development/production)

### Default Values
- **Location**: "Warehouse A"
- **Quantity**: 1
- **Condition**: "used"
- **Type**: "phone"

---

**Ready to use!** The IMEI input form provides a simple, focused interface for adding devices to your warehouse inventory system.
