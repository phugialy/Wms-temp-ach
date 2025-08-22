import React, { useState, useEffect } from 'react';

// Types for the form data
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

// Types for device info (placeholder for future API integration)
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

// Real function for fetching device info by IMEI
const fetchDeviceInfo = async (imei: string): Promise<DeviceInfo> => {
  console.log('Fetching device info for IMEI:', imei);
  
  try {
    // Call the PhoneCheck API to get real device data
    const response = await fetch(`/api/phonecheck/device/${imei}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch device info: ${response.status}`);
    }
    
    const deviceData = await response.json();
    
    // Convert PhoneCheck data to DeviceInfo format
    return {
      name: deviceData.title || deviceData.name || 'Unknown Device',
      brand: deviceData.make || deviceData.brand || 'Unknown',
      model: deviceData.model || deviceData.model_name || 'Unknown',
      storage: deviceData.memory || deviceData.storage || '',
      color: deviceData.color || '',
      carrier: deviceData.carrier || 'Unlocked',
      type: 'phone',
      condition: deviceData.working?.toLowerCase() === 'yes' ? 'used' : 'damaged'
    };
  } catch (error) {
    console.error('Error fetching device info:', error);
    // Return minimal data instead of mock data
    return {
      name: 'Device Info Unavailable',
      brand: 'Unknown',
      model: 'Unknown',
      storage: '',
      color: '',
      carrier: 'Unknown',
      type: 'phone',
      condition: 'unknown'
    };
  }
};

// Toast notification component
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
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

const InventoryPushAdmin: React.FC = () => {
  // Form state
  const [formData, setFormData] = useState<InventoryPushFormData>({
    name: '',
    brand: '',
    model: '',
    storage: '',
    color: '',
    carrier: '',
    type: 'phone',
    imei: '',
    serialNumber: '',
    condition: 'used',
    quantity: 1,
    location: ''
  });

  // UI state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  // Handle IMEI blur event
  const handleImeiBlur = async () => {
    if (!formData.imei.trim()) return;

    setIsLoading(true);
    try {
      const deviceData = await fetchDeviceInfo(formData.imei);
      setDeviceInfo(deviceData);
      setIsModalOpen(true);
      
      // Auto-fill form with fetched data
      setFormData(prev => ({
        ...prev,
        name: deviceData.name,
        brand: deviceData.brand,
        model: deviceData.model,
        storage: deviceData.storage,
        color: deviceData.color,
        carrier: deviceData.carrier,
        type: deviceData.type,
        condition: deviceData.condition
      }));
    } catch (error) {
      console.error('Error fetching device info:', error);
      setToast({ message: 'Failed to fetch device information', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/inventory-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setToast({ message: 'Inventory pushed successfully!', type: 'success' });
        handleCancel(); // Reset form
      } else {
        setToast({ message: result.error || 'Failed to push inventory', type: 'error' });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setToast({ message: 'Network error occurred', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle form reset
  const handleCancel = () => {
    setFormData({
      name: '',
      brand: '',
      model: '',
      storage: '',
      color: '',
      carrier: '',
      type: 'phone',
      imei: '',
      serialNumber: '',
      condition: 'used',
      quantity: 1,
      location: ''
    });
    setDeviceInfo(null);
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Inventory Push Admin</h1>
          <p className="mt-2 text-gray-600">Add or update inventory items in the warehouse</p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Item Information</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
                    Brand *
                  </label>
                  <input
                    type="text"
                    id="brand"
                    name="brand"
                    value={formData.brand}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                    Model *
                  </label>
                  <input
                    type="text"
                    id="model"
                    name="model"
                    value={formData.model}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="storage" className="block text-sm font-medium text-gray-700 mb-1">
                    Storage
                  </label>
                  <input
                    type="text"
                    id="storage"
                    name="storage"
                    value={formData.storage}
                    onChange={handleInputChange}
                    placeholder="e.g., 256GB"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    id="color"
                    name="color"
                    value={formData.color}
                    onChange={handleInputChange}
                    placeholder="e.g., Deep Purple"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="carrier" className="block text-sm font-medium text-gray-700 mb-1">
                    Carrier
                  </label>
                  <input
                    type="text"
                    id="carrier"
                    name="carrier"
                    value={formData.carrier}
                    onChange={handleInputChange}
                    placeholder="e.g., Unlocked"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Device Type and Condition */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                    Type *
                  </label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="phone">Phone</option>
                    <option value="tablet">Tablet</option>
                    <option value="laptop">Laptop</option>
                    <option value="watch">Watch</option>
                    <option value="accessory">Accessory</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="condition" className="block text-sm font-medium text-gray-700 mb-1">
                    Condition
                  </label>
                  <select
                    id="condition"
                    name="condition"
                    value={formData.condition}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="new">New</option>
                    <option value="used">Used</option>
                    <option value="refurbished">Refurbished</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </div>
              </div>

              {/* IMEI and Serial Number */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="imei" className="block text-sm font-medium text-gray-700 mb-1">
                    IMEI
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="imei"
                      name="imei"
                      value={formData.imei}
                      onChange={handleInputChange}
                      onBlur={handleImeiBlur}
                      placeholder="Enter IMEI to auto-fill"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {isLoading && (
                      <div className="absolute right-3 top-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    id="serialNumber"
                    name="serialNumber"
                    value={formData.serialNumber}
                    onChange={handleInputChange}
                    placeholder="Optional serial number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quantity and Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="1"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                    Location *
                  </label>
                  <select
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select location</option>
                    <option value="Warehouse A">Warehouse A</option>
                    <option value="Warehouse B">Warehouse B</option>
                    <option value="Warehouse C">Warehouse C</option>
                    <option value="Storage Room 1">Storage Room 1</option>
                    <option value="Storage Room 2">Storage Room 2</option>
                    <option value="Loading Dock">Loading Dock</option>
                  </select>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>

          {/* Preview Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Preview</h2>
            
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Item Details</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Name:</span> {formData.name || 'Not specified'}</div>
                  <div><span className="font-medium">Brand:</span> {formData.brand || 'Not specified'}</div>
                  <div><span className="font-medium">Model:</span> {formData.model || 'Not specified'}</div>
                  <div><span className="font-medium">Storage:</span> {formData.storage || 'Not specified'}</div>
                  <div><span className="font-medium">Color:</span> {formData.color || 'Not specified'}</div>
                  <div><span className="font-medium">Carrier:</span> {formData.carrier || 'Not specified'}</div>
                  <div><span className="font-medium">Type:</span> {formData.type}</div>
                  <div><span className="font-medium">Condition:</span> {formData.condition}</div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Inventory Details</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">IMEI:</span> {formData.imei || 'Not specified'}</div>
                  <div><span className="font-medium">Serial Number:</span> {formData.serialNumber || 'Not specified'}</div>
                  <div><span className="font-medium">Quantity:</span> {formData.quantity}</div>
                  <div><span className="font-medium">Location:</span> {formData.location || 'Not specified'}</div>
                </div>
              </div>

              {!formData.imei && !formData.serialNumber && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-800">
                        At least one of IMEI, Serial Number, or SKU must be provided.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Device Info Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
            <div className="relative w-screen max-w-md">
              <div className="h-full flex flex-col bg-white shadow-xl">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Device Information</h3>
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="flex-1 px-6 py-4 overflow-y-auto">
                  {/* TODO: Hook up modal with actual fetched data */}
                  {deviceInfo ? (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 mb-2">Fetched Device Info</h4>
                        <div className="space-y-2 text-sm text-blue-800">
                          <div><span className="font-medium">Name:</span> {deviceInfo.name}</div>
                          <div><span className="font-medium">Brand:</span> {deviceInfo.brand}</div>
                          <div><span className="font-medium">Model:</span> {deviceInfo.model}</div>
                          <div><span className="font-medium">Storage:</span> {deviceInfo.storage}</div>
                          <div><span className="font-medium">Color:</span> {deviceInfo.color}</div>
                          <div><span className="font-medium">Carrier:</span> {deviceInfo.carrier}</div>
                          <div><span className="font-medium">Type:</span> {deviceInfo.type}</div>
                          <div><span className="font-medium">Condition:</span> {deviceInfo.condition}</div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Auto-filled Form Data</h4>
                        <p className="text-sm text-gray-600">
                          The form has been automatically populated with the fetched device information. 
                          You can modify any fields before submitting.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p className="text-gray-500">Loading device information...</p>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-gray-200">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

export default InventoryPushAdmin; 