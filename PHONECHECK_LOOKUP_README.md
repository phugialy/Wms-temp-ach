# PhonecheckLookup Component - WMS Integration

A React component that integrates with the Phonecheck API to lookup device information by IMEI and display it in a modal format similar to the existing DNCL Phonecheck system.

## 🚀 Features

### ✅ Real Phonecheck API Integration
- **Authentication**: Uses real Phonecheck API credentials
- **IMEI Lookup**: Fetches detailed device information from Phonecheck
- **Data Formatting**: Formats raw API data into structured display format
- **Error Handling**: Comprehensive error handling with user feedback

### ✅ Modal Display Interface
- **Slide-in Modal**: Right-side sliding modal for device information
- **Loading States**: Shows loading spinner during API calls
- **Toast Notifications**: Success, error, and pending status notifications
- **Responsive Design**: Works on all screen sizes

### ✅ Device Information Display
- **Device Title**: Formatted device name with specifications
- **Basic Info**: Model, IMEI, Serial, Carrier
- **Specifications**: Color, Memory, RAM, Grade
- **Device Status**: Working status, Battery health, Cycles, MDM
- **Notes & Issues**: Notes, Failed tests, Repair notes
- **Device History**: First received, Latest update, Tester name

### ✅ Integration with IMEI Input Form
- **Seamless Flow**: Automatically opens when IMEI is entered
- **Data Conversion**: Converts Phonecheck data to WMS format
- **Status Indicators**: Shows working status and battery health
- **Use Data Button**: Allows user to use Phonecheck data in WMS

## 📁 Files Created

```
src/
└── components/
    ├── PhonecheckLookup.tsx    # Main Phonecheck lookup component
    └── IMEIInputForm.tsx       # Updated to integrate with Phonecheck
```

## 🔧 API Integration

### Phonecheck API Endpoints
- **Authentication**: `https://api.phonecheck.com/v2/auth/master/login`
- **Device Lookup**: `https://api.phonecheck.com/v2/master/imei/device-info-legacy/{imei}?detailed=true`

### Credentials (Should be moved to environment variables)
```typescript
const PHONECHECK_USERNAME = 'dncltechzoneinc';
const PHONECHECK_PASSWORD = '@Ustvmos817';
```

## 📊 Data Flow

1. **User enters IMEI** → IMEI validation (8-15 digits)
2. **IMEI blur event** → Triggers Phonecheck lookup modal
3. **Authentication** → Gets token from Phonecheck API
4. **Device lookup** → Fetches device information
5. **Data formatting** → Converts raw data to structured format
6. **Modal display** → Shows device information in modal
7. **User action** → Can use data or close modal
8. **Data conversion** → Converts to WMS format for inventory

## 🎨 UI Components

### Modal Structure
- **Header**: Title with close button and IMEI display
- **Content**: Scrollable device information sections
- **Footer**: Close and "Use This Data" buttons

### Information Sections
- **Device Title**: Blue header with device name
- **Specifications**: Gray section with device specs
- **Device Status**: Working status with color coding
- **Notes & Issues**: Yellow section for problems
- **Device History**: Historical information

### Status Indicators
- **Working Status**: Green (PASS), Red (FAILED), Yellow (PENDING)
- **Battery Health**: Percentage display
- **Loading States**: Spinner during API calls

## 🔍 Data Mapping

### Phonecheck → WMS Conversion
```typescript
const convertedDeviceInfo: DeviceInfo = {
  name: data.title,                                    // Full device title
  brand: data.model_name.split(' ')[0] || 'Unknown',  // Extract brand
  model: data.model_name,                              // Full model name
  storage: data.memory,                                // Memory capacity
  color: data.color,                                   // Device color
  carrier: data.carrier,                               // Carrier information
  type: 'phone',                                       // Device type
  condition: data.working.toLowerCase() === 'yes' ? 'used' : 'damaged'
};
```

### Phonecheck Data Structure
```typescript
interface PhonecheckData {
  title: string;           // Device title
  model: string;           // Model number
  model_name: string;      // Model name
  imei: string;            // IMEI number
  serial: string;          // Serial number
  carrier: string;         // Carrier
  color: string;           // Color
  memory: string;          // Memory
  ram: string;             // RAM
  working: string;         // Working status
  battery_health: string;  // Battery health %
  bcc: string;             // Battery cycles
  mdm: string;             // MDM status
  grade: string;           // Device grade
  notes: string;           // Notes
  failed: string;          // Failed tests
  tester_name: string;     // Tester name
  repair_notes: string;    // Repair notes
  // ... and more
}
```

## 🛠 Usage

### Basic Integration
```tsx
import PhonecheckLookup from './components/PhonecheckLookup';

const [showPhonecheck, setShowPhonecheck] = useState(false);
const [imei, setImei] = useState('');

const handleDataReceived = (data: PhonecheckData) => {
  // Handle the received Phonecheck data
  console.log('Phonecheck data:', data);
};

<PhonecheckLookup
  imei={imei}
  isOpen={showPhonecheck}
  onClose={() => setShowPhonecheck(false)}
  onDataReceived={handleDataReceived}
/>
```

### With IMEI Input Form
The component is already integrated with the IMEI input form. When a user enters an IMEI and the field loses focus, the Phonecheck lookup modal automatically opens.

## 🔒 Security Considerations

### API Credentials
- **Current**: Hardcoded in component (for development)
- **Recommended**: Move to environment variables
- **Production**: Use secure credential management

### Environment Variables Setup
```env
PHONECHECK_USERNAME=your_username
PHONECHECK_PASSWORD=your_password
```

## 🧪 Testing

### Manual Testing
1. Enter a valid IMEI (8-15 digits)
2. Wait for Phonecheck modal to open
3. Verify loading states and API calls
4. Check data display and formatting
5. Test "Use This Data" functionality

### API Testing
```bash
# Test authentication
curl -X POST https://api.phonecheck.com/v2/auth/master/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dncltechzoneinc","password":"@Ustvmos817"}'

# Test device lookup (replace TOKEN and IMEI)
curl -X GET "https://api.phonecheck.com/v2/master/imei/device-info-legacy/123456789012345?detailed=true" \
  -H "token_master: YOUR_TOKEN_HERE"
```

## 🚀 Next Steps

1. **Environment Variables**: Move credentials to .env file
2. **Error Handling**: Add retry logic for failed API calls
3. **Caching**: Cache frequently looked up IMEIs
4. **Bulk Lookup**: Support for multiple IMEI lookups
5. **Offline Mode**: Cache data for offline access
6. **Analytics**: Track lookup usage and success rates

## 🔧 Configuration

### Component Props
```typescript
interface PhonecheckLookupProps {
  imei: string;                    // IMEI to lookup
  isOpen: boolean;                 // Modal open state
  onClose: () => void;             // Close handler
  onDataReceived: (data: PhonecheckData) => void; // Data received handler
}
```

### Styling
- **Tailwind CSS**: All styling uses Tailwind classes
- **Responsive**: Mobile-first responsive design
- **Accessible**: Proper ARIA labels and keyboard navigation

---

**Ready to use!** The PhonecheckLookup component provides seamless integration between your WMS system and the Phonecheck API, giving you real device information for inventory management.
