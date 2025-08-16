import React, { useState, useEffect } from 'react';

// Phonecheck API credentials - should be moved to environment variables
const PHONECHECK_USERNAME = process.env['REACT_APP_PHONECHECK_USERNAME'] || 'dncltechzoneinc';
const PHONECHECK_PASSWORD = process.env['REACT_APP_PHONECHECK_PASSWORD'] || '@Ustvmos817';

// API configuration
const PHONECHECK_CONFIG = {
  AUTH_URL: 'https://api.phonecheck.com/v2/auth/master/login',
  DEVICE_INFO_URL: 'https://api.phonecheck.com/v2/master/imei/device-info-legacy',
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  REQUEST_TIMEOUT: 30000,
};

// Types for Phonecheck data
interface PhonecheckData {
  title: string;
  model: string;
  model_name: string;
  imei: string;
  serial: string;
  carrier: string;
  color: string;
  memory: string;
  ram: string;
  first_received: string;
  latest_update: string;
  working: string;
  battery_health: string;
  bcc: string;
  mdm: string;
  grade: string;
  notes: string;
  failed: string;
  tester_name: string;
  repair_notes: string;
}

interface PhonecheckLookupProps {
  imei: string;
  isOpen: boolean;
  onClose: () => void;
  onDataReceived: (data: PhonecheckData) => void;
  autoLookup?: boolean; // New prop for controlling auto-lookup behavior
}

// API response types
interface AuthResponse {
  token: string;
}

// Enhanced Toast notification component
const Toast: React.FC<{ 
  message: string; 
  type: 'success' | 'error' | 'pending' | 'warning'; 
  onClose: () => void;
  duration?: number;
}> = ({ message, type, onClose, duration = 5000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      case 'pending':
        return 'bg-yellow-500 text-white';
      case 'warning':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-blue-500 text-white';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'pending':
        return '⏳';
      case 'warning':
        return '⚠';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${getToastStyles()} min-w-80`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="mr-2 font-bold">{getIcon()}</span>
          <span>{message}</span>
        </div>
        <button onClick={onClose} className="ml-4 text-white hover:text-gray-200 font-bold">
          ×
        </button>
      </div>
    </div>
  );
};

// Utility functions
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const validateIMEI = (imei: string): boolean => {
  if (!imei || imei.length < 8 || imei.length > 15) return false;
  return /^\d+$/.test(imei);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().replace('T', ' ').substring(0, 16);
  } catch {
    return dateStr;
  }
};

const PhonecheckLookup: React.FC<PhonecheckLookupProps> = ({ 
  imei, 
  isOpen, 
  onClose, 
  onDataReceived,
  autoLookup = true 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [phonecheckData, setPhonecheckData] = useState<PhonecheckData | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'pending' | 'warning' } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastRawData, setLastRawData] = useState<any>(null);

  // Get authentication token from Phonecheck API with retry logic
  const getAuthToken = async (username: string, password: string, attempt = 1): Promise<string> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PHONECHECK_CONFIG.REQUEST_TIMEOUT);

      const response = await fetch(PHONECHECK_CONFIG.AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Authentication failed (${response.status}): ${errorText}`);
      }
      
      const data = await response.json() as AuthResponse;
      if (!data.token) {
        throw new Error('No authentication token received');
      }
      
      return data.token;
    } catch (error) {
      if (attempt < PHONECHECK_CONFIG.RETRY_ATTEMPTS) {
        setToast({ 
          message: `Authentication attempt ${attempt} failed, retrying...`, 
          type: 'warning' 
        });
        await sleep(PHONECHECK_CONFIG.RETRY_DELAY * attempt);
        return getAuthToken(username, password, attempt + 1);
      }
      throw error;
    }
  };

  // Fetch phone data from Phonecheck API with retry logic
  const fetchPhoneData = async (imei: string, token: string, attempt = 1): Promise<any> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PHONECHECK_CONFIG.REQUEST_TIMEOUT);

      const url = `${PHONECHECK_CONFIG.DEVICE_INFO_URL}/${imei}?detailed=true`;
      const response = await fetch(url, {
        headers: { 'token_master': token },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 404) {
          throw new Error('Device not found in Phonecheck database');
        }
        throw new Error(`Device lookup failed (${response.status}): ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (attempt < PHONECHECK_CONFIG.RETRY_ATTEMPTS) {
        setToast({ 
          message: `Device lookup attempt ${attempt} failed, retrying...`, 
          type: 'warning' 
        });
        await sleep(PHONECHECK_CONFIG.RETRY_DELAY * attempt);
        return fetchPhoneData(imei, token, attempt + 1);
      }
      throw error;
    }
  };

  // Abstract and format the raw data from Phonecheck - MATCHING THE WORKING IMPLEMENTATION
  const abstractData = (rawData: any): PhonecheckData => {
    // Always use first object in array - EXACTLY like the working tool
    const raw = Array.isArray(rawData) ? rawData[0] : rawData;

    if (!raw) {
      throw new Error('API coming from Phonecheck for this device is unavailable');
    }

    // Parse ESNResponse if needed - EXACTLY like the working tool
    let esnResponse: any[] = [];
    if (raw.ESNResponse) {
      try {
        esnResponse = typeof raw.ESNResponse === 'string' ? JSON.parse(raw.ESNResponse) : raw.ESNResponse;
      } catch (e) {
        console.warn('Failed to parse ESNResponse:', e);
        esnResponse = [];
      }
    }

    // Get Carrier from ESNResponse if available - EXACTLY like the working tool
    let carrierFromESN = '';
    if (Array.isArray(esnResponse)) {
      const carrierObj = esnResponse.find((e: any) => e.Carrier);
      if (carrierObj) {
        carrierFromESN = carrierObj.Carrier;
      }
    }

    // Debug logging for RAM field - EXACTLY like the working tool
    console.log('=== RAM Debug ===');
    console.log('Raw RAM value:', raw.RAM);
    console.log('Raw RAM type:', typeof raw.RAM);
    console.log('All raw keys:', Object.keys(raw));

    // Return data structure EXACTLY matching the working tool
    return {
      title: ((raw.Model || '') + (raw.Memory ? ' ' + raw.Memory : '')).toUpperCase(),
      model: raw["Model#"] || '',
      model_name: raw.Model || '',
      imei: raw.IMEI || '',
      serial: raw.Serial || '',
      carrier: raw.Carrier || carrierFromESN || '',
      color: raw.Color || '',
      memory: raw.Memory || '',
      ram: raw.Ram || '', // Note: using 'Ram' not 'RAM' to match working tool
      first_received: formatDate(raw.DeviceCreatedDate),
      latest_update: formatDate(raw.DeviceUpdatedDate),
      working: raw.Working || '',
      battery_health: raw.BatteryHealthPercentage || '',
      bcc: raw.BatteryCycle || '',
      mdm: raw.MDM || '',
      grade: raw.Grade || '',
      notes: raw.Notes || '',
      failed: raw.Failed || '',
      tester_name: raw.TesterName || '',
      repair_notes: raw.Custom1 || '',
    };
  };

  // Main lookup function with enhanced error handling
  const performLookup = async () => {
    if (!validateIMEI(imei)) {
      setToast({ 
        message: 'Invalid IMEI format. Please enter 8-15 digits.', 
        type: 'error' 
      });
      return;
    }

    setIsLoading(true);
    setRetryCount(0);
    setLastError(null);
    setToast({ message: 'Authenticating with Phonecheck...', type: 'pending' });

    try {
      console.log('=== Starting API call ===');
      console.log('IMEI being processed:', imei);
      
      // Step 1: Get authentication token
      const token = await getAuthToken(PHONECHECK_USERNAME, PHONECHECK_PASSWORD);
      console.log('Token obtained successfully');
      
      setToast({ message: 'Fetching device information...', type: 'pending' });
      console.log('About to fetch phone data...');
      
      // Step 2: Fetch device data
      const rawData = await fetchPhoneData(imei, token);
      console.log('Raw data obtained:', rawData);
      setLastRawData(rawData);
      
      console.log('About to abstract data...');
      // Step 3: Abstract and format the data
      const formattedData = abstractData(rawData);
      console.log('Data abstracted:', formattedData);
      
      // Check if we have valid data - EXACTLY like the working tool
      if (!formattedData.model && !formattedData.imei) {
        console.log('No data found, showing failed device');
        setLastError('API coming from Phonecheck for this device is unavailable');
        setToast({ 
          message: 'Device not found in Phonecheck database', 
          type: 'error'
        });
        return;
      }
      
      setPhonecheckData(formattedData);
      onDataReceived(formattedData);
      
      setToast({ 
        message: 'Device information retrieved successfully!', 
        type: 'success'
      });

    } catch (error) {
      console.error('Phonecheck lookup error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setLastError(errorMessage);
      setToast({ 
        message: `Lookup failed: ${errorMessage}`, 
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Manual retry function
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    performLookup();
  };

  // Auto-perform lookup when component opens with valid IMEI
  useEffect(() => {
    if (isOpen && imei && validateIMEI(imei) && autoLookup) {
      performLookup();
    }
  }, [isOpen, imei, autoLookup]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPhonecheckData(null);
      setRetryCount(0);
      setLastError(null);
      setToast(null);
      setLastRawData(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Overlay */}
      <div className="fixed inset-0 z-50 overflow-hidden">
        <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        
        {/* Modal Content */}
        <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
          <div className="relative w-screen max-w-2xl">
            <div className="h-full flex flex-col bg-white shadow-xl">
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Phonecheck Device Lookup</h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                    aria-label="Close modal"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-500">IMEI: {imei}</p>
                {retryCount > 0 && (
                  <p className="mt-1 text-xs text-orange-600">Retry attempt: {retryCount}</p>
                )}
              </div>

              {/* Modal Content */}
              <div className="flex-1 px-6 py-4 overflow-y-auto">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-500">Fetching device information from Phonecheck...</p>
                    <p className="text-xs text-gray-400 mt-2">This may take a few moments</p>
                  </div>
                ) : lastError ? (
                  <div className="text-center py-8">
                    <div className="text-red-500 mb-4">
                      <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Lookup Failed</h4>
                    <p className="text-gray-600 mb-4">{lastError}</p>
                    <button
                      onClick={handleRetry}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Try Again
                    </button>
                  </div>
                ) : phonecheckData ? (
                  <div className="space-y-6">
                    {/* Device Title */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-bold text-blue-900 text-lg mb-2">{phonecheckData.title}</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
                        <div><span className="font-medium">Model:</span> {phonecheckData.model}</div>
                        <div><span className="font-medium">IMEI:</span> {phonecheckData.imei}</div>
                        <div><span className="font-medium">Serial:</span> {phonecheckData.serial || 'N/A'}</div>
                        <div><span className="font-medium">Carrier:</span> {phonecheckData.carrier}</div>
                      </div>
                    </div>

                    {/* Device Specifications */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Device Specifications</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="font-medium">Color:</span> {phonecheckData.color}</div>
                        <div><span className="font-medium">Memory:</span> {phonecheckData.memory || 'N/A'}</div>
                        <div><span className="font-medium">RAM:</span> {phonecheckData.ram || 'N/A'}</div>
                        <div><span className="font-medium">Grade:</span> {phonecheckData.grade}</div>
                      </div>
                    </div>

                    {/* Working Status */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Device Status</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Working Status:</span>
                          <span className={`px-2 py-1 rounded text-sm font-medium ${
                            phonecheckData.working.toLowerCase() === 'yes' 
                              ? 'bg-green-100 text-green-800' 
                              : phonecheckData.working.toLowerCase() === 'no'
                              ? 'bg-red-100 text-red-800'
                              : phonecheckData.working.toLowerCase() === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {phonecheckData.working.toUpperCase()}
                          </span>
                        </div>
                        <div><span className="font-medium">Battery Health:</span> {phonecheckData.battery_health}%</div>
                        <div><span className="font-medium">Battery Cycles:</span> {phonecheckData.bcc}</div>
                        <div><span className="font-medium">MDM Status:</span> {phonecheckData.mdm}</div>
                      </div>
                    </div>

                    {/* Notes and Issues */}
                    {(phonecheckData.notes || phonecheckData.failed || phonecheckData.repair_notes) && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-medium text-yellow-900 mb-3">Notes & Issues</h4>
                        <div className="space-y-2 text-sm">
                          {phonecheckData.notes && (
                            <div><span className="font-medium">Notes:</span> {phonecheckData.notes}</div>
                          )}
                          {phonecheckData.failed && (
                            <div><span className="font-medium">Failed:</span> {phonecheckData.failed}</div>
                          )}
                          {phonecheckData.repair_notes && (
                            <div><span className="font-medium">Repair Notes:</span> {phonecheckData.repair_notes}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Device History */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Device History</h4>
                      <div className="space-y-2 text-sm">
                        <div><span className="font-medium">First Received:</span> {phonecheckData.first_received || 'N/A'}</div>
                        <div><span className="font-medium">Latest Update:</span> {phonecheckData.latest_update || 'N/A'}</div>
                        <div><span className="font-medium">Tester:</span> {phonecheckData.tester_name}</div>
                      </div>
                    </div>

                    {/* Raw Data Debug (Development Only) */}
                    {process.env['NODE_ENV'] === 'development' && lastRawData && (
                      <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Raw Data (Debug)</h4>
                        <details>
                          <summary className="cursor-pointer text-sm text-gray-600">Click to view raw API response</summary>
                          <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto max-h-40">
                            {JSON.stringify(lastRawData, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No device information available</p>
                    <button
                      onClick={performLookup}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Lookup Device
                    </button>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    Powered by Phonecheck API
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Close
                    </button>
                    {phonecheckData && (
                      <button
                        onClick={() => {
                          onDataReceived(phonecheckData);
                          onClose();
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Use This Data
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
};

export default PhonecheckLookup;
export type { PhonecheckData };
