import React, { useState, useEffect } from 'react';
import PhonecheckLookup, { PhonecheckData } from './PhonecheckLookup';

interface IMEIFormData {
  imei: string;
}

interface DeviceInfo {
  name: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  carrier: string;
  type: string;
  condition: string;
}

// Toast notification component
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`}>
      <div className="flex items-center justify-between">
        <span>{message}</span>
        <button onClick={onClose} className="ml-4 text-white hover:text-gray-200">
          ×
        </button>
      </div>
    </div>
  );
};

const IMEIInputForm: React.FC = () => {
  const [formData, setFormData] = useState<IMEIFormData>({
    imei: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showPhonecheck, setShowPhonecheck] = useState(false);
  const [phonecheckData, setPhonecheckData] = useState<PhonecheckData | null>(null);

  // Debug useEffect to monitor showPhonecheck state
  useEffect(() => {
    console.log('showPhonecheck state changed to:', showPhonecheck);
  }, [showPhonecheck]);

  // Handle IMEI input change
  const handleImeiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    // Only allow numbers and limit to 15 characters (standard IMEI length)
    const cleanValue = value.replace(/\D/g, '').slice(0, 15);
    setFormData({ imei: cleanValue });
  };

  // Handle IMEI blur event to fetch device info
  const handleImeiBlur = async () => {
    console.log('=== IMEI Blur Event ===');
    console.log('IMEI:', formData.imei);
    console.log('IMEI length:', formData.imei.length);
    console.log('Should trigger Phonecheck:', formData.imei.trim() && formData.imei.length >= 14);
    
    if (!formData.imei.trim() || formData.imei.length < 14) {
      console.log('IMEI validation failed - not triggering Phonecheck');
      return;
    }

    console.log('Triggering Phonecheck lookup modal...');
    console.log('Current showPhonecheck state:', showPhonecheck);
    
    // Show Phonecheck lookup instead of mock data
    setShowPhonecheck(true);
    
    // Check state after setting
    setTimeout(() => {
      console.log('showPhonecheck state after setState:', showPhonecheck);
    }, 100);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.imei.trim()) {
      setToast({ message: 'Please enter an IMEI', type: 'error' });
      return;
    }

    if (formData.imei.length < 14) {
      setToast({ message: 'IMEI must be at least 14 digits', type: 'error' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare the data for the API
      const inventoryData = {
        name: deviceInfo?.name || 'Unknown Device',
        brand: deviceInfo?.brand || 'Unknown',
        model: deviceInfo?.model || 'Unknown',
        storage: deviceInfo?.storage || '',
        color: deviceInfo?.color || '',
        carrier: deviceInfo?.carrier || '',
        type: deviceInfo?.type || 'phone',
        imei: formData.imei,
        serialNumber: '',
        quantity: 1,
        location: 'Warehouse A' // Default location
      };

      const response = await fetch('/api/admin/inventory-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inventoryData),
      });

      const result = await response.json();

      if (response.ok) {
        setToast({ message: 'Device added successfully!', type: 'success' });
        // Reset form
        setFormData({ imei: '' });
        setDeviceInfo(null);
      } else {
        setToast({ message: result.error || 'Failed to add device', type: 'error' });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setToast({ message: 'Network error occurred', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Phonecheck data received
  const handlePhonecheckDataReceived = (data: PhonecheckData) => {
    console.log('=== Phonecheck Data Received ===');
    console.log('Raw Phonecheck data:', data);
    
    setPhonecheckData(data);
    
    // Convert Phonecheck data to DeviceInfo format
    const convertedDeviceInfo: DeviceInfo = {
      name: data.title,
      brand: data.model_name.split(' ')[0] || 'Unknown', // Extract brand from model name
      model: data.model_name,
      storage: data.memory,
      color: data.color,
      carrier: data.carrier,
      type: 'phone',
      condition: data.working.toLowerCase() === 'yes' ? 'used' : 'damaged'
    };
    
    console.log('Converted DeviceInfo:', convertedDeviceInfo);
    
    setDeviceInfo(convertedDeviceInfo);
    setShowPhonecheck(false);
  };

  // Handle form reset
  const handleReset = () => {
    setFormData({ imei: '' });
    setDeviceInfo(null);
    setPhonecheckData(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Add Device to Inventory</h1>
          <p className="mt-2 text-gray-600">Enter IMEI to automatically fetch device information and add to database</p>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* IMEI Input */}
            <div>
              <label htmlFor="imei" className="block text-sm font-medium text-gray-700 mb-2">
                IMEI Number *
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="imei"
                  name="imei"
                  value={formData.imei}
                  onChange={handleImeiChange}
                  onBlur={handleImeiBlur}
                  placeholder="Enter 15-digit IMEI"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  maxLength={15}
                />
                {isLoading && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  </div>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Enter the 15-digit IMEI number. Device information will be automatically fetched.
              </p>
            </div>

                          {/* Device Info Preview */}
              {deviceInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-3">Device Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="font-medium">Name:</span> {deviceInfo.name}</div>
                    <div><span className="font-medium">Brand:</span> {deviceInfo.brand}</div>
                    <div><span className="font-medium">Model:</span> {deviceInfo.model}</div>
                    <div><span className="font-medium">Storage:</span> {deviceInfo.storage}</div>
                    <div><span className="font-medium">Color:</span> {deviceInfo.color}</div>
                    <div><span className="font-medium">Carrier:</span> {deviceInfo.carrier}</div>
                    <div><span className="font-medium">Type:</span> {deviceInfo.type}</div>
                    <div><span className="font-medium">Condition:</span> {deviceInfo.condition}</div>
                  </div>
                  
                  {/* Phonecheck Status */}
                  {phonecheckData && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-800">Phonecheck Status:</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          phonecheckData.working.toLowerCase() === 'yes' 
                            ? 'bg-green-100 text-green-800' 
                            : phonecheckData.working.toLowerCase() === 'no'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {phonecheckData.working.toUpperCase()}
                        </span>
                      </div>
                      {phonecheckData.battery_health && (
                        <div className="text-xs text-blue-700 mt-1">
                          Battery: {phonecheckData.battery_health}%
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.imei.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Adding...' : 'Add to Inventory'}
              </button>
            </div>
          </form>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">How it works</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Enter the 15-digit IMEI number</li>
                  <li>Device information will be automatically fetched</li>
                  <li>Review the device details</li>
                  <li>Click "Add to Inventory" to save to database</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phonecheck Lookup Modal */}
      <PhonecheckLookup
        imei={formData.imei}
        isOpen={showPhonecheck}
        onClose={() => {
          console.log('PhonecheckLookup onClose called');
          setShowPhonecheck(false);
        }}
        onDataReceived={(data) => {
          console.log('PhonecheckLookup onDataReceived called with:', data);
          handlePhonecheckDataReceived(data);
        }}
      />

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default IMEIInputForm;
