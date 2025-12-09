import { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { WorkingStatusBadge } from '../components/ui/WorkingStatusBadge';
import { useToastStore } from '../stores/toastStore';
import { apiClient } from '../services/api';

interface PhonecheckDeviceData {
  deviceName?: string;
  brand?: string;
  model?: string;
  modelNumber?: string;
  storage?: string;
  color?: string;
  carrier?: string;
  imei?: string;
  serialNumber?: string;
  condition?: string;
  working?: string;
  workingStatus?: string;
  batteryHealth?: string | number;
  batteryCycle?: string | number;
  mdm?: string;
  notes?: string;
  failed?: string | boolean;
  testerName?: string;
  repairNotes?: string;
  firstReceived?: string;
  lastUpdate?: string;
  checkDate?: string;
  source?: string;
}

interface Location {
  id: string;
  name: string;
  type?: string;
}

export const Phonecheck = () => {
  const [imei, setImei] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceData, setDeviceData] = useState<PhonecheckDeviceData | null>(null);
  const [rawData, setRawData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [showRawData, setShowRawData] = useState(false);
  const [showFullPackage, setShowFullPackage] = useState(false);
  const [addingToInventory, setAddingToInventory] = useState(false);

  const addToast = useToastStore((state) => state.addToast);

  // Fetch locations on mount
  useEffect(() => {
    fetchLocations();
  }, []);

  // Auto-trigger lookup when IMEI is 15 digits
  useEffect(() => {
    const cleanIMEI = imei.replace(/\D/g, '');
    if (cleanIMEI.length === 15 && !loading && !deviceData) {
      performLookup(cleanIMEI);
    } else if (cleanIMEI.length !== 15) {
      // Reset when IMEI is not 15 digits
      setDeviceData(null);
      setRawData(null);
      setError(null);
    }
  }, [imei]);

  const fetchLocations = async () => {
    try {
      const response = await apiClient.get<{ success: boolean; locations?: Location[] }>('/admin/locations');
      if (response.success && response.data && 'locations' in response.data) {
        const locs = (response.data as any).locations || [];
        setLocations(locs);
        if (locs.length > 0) {
          setSelectedLocation(locs[0].name);
        }
      } else if (Array.isArray(response.data)) {
        setLocations(response.data);
        if (response.data.length > 0) {
          setSelectedLocation(response.data[0].name);
        }
      }
    } catch (error: any) {
      console.error('Error fetching locations:', error);
      // Use default locations if API fails
      setLocations([
        { id: 'DNCL-Inspection', name: 'DNCL-Inspection' },
        { id: 'DNCL-Testing', name: 'DNCL-Testing' },
        { id: 'DNCL-Storage', name: 'DNCL-Storage' },
      ]);
      setSelectedLocation('DNCL-Inspection');
    }
  };

  const validateIMEI = (imeiValue: string): boolean => {
    const cleanIMEI = imeiValue.replace(/\D/g, '');
    return cleanIMEI.length === 15;
  };

  const performLookup = async (imeiValue?: string) => {
    const targetIMEI = imeiValue || imei.replace(/\D/g, '');
    
    if (!validateIMEI(targetIMEI)) {
      addToast('Please enter a valid 15-digit IMEI', 'error');
      return;
    }

    setLoading(true);
    setError(null);
    setDeviceData(null);
    setRawData(null);

    try {
      const response = await apiClient.post<{
        success: boolean;
        data?: PhonecheckDeviceData;
        rawData?: any;
        error?: string;
      }>('/phonecheck/lookup', { imei: targetIMEI });

      if (response.success && response.data) {
        setDeviceData(response.data as PhonecheckDeviceData);
        // Get raw data from response
        const responseData = response as any;
        if (responseData.rawData) {
          setRawData(responseData.rawData);
        } else {
          // If no raw data, use the abstracted data as fallback for display
          setRawData(response.data);
        }
        addToast('Device information retrieved successfully', 'success');
      } else {
        throw new Error(response.error || 'Failed to retrieve device information');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to lookup device';
      setError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleIMEIChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setImei(value);
  };

  const handleAddToInventory = async () => {
    if (!deviceData || !deviceData.imei) {
      addToast('Device data is required', 'error');
      return;
    }

    if (!selectedLocation) {
      addToast('Please select a location', 'error');
      return;
    }

    setAddingToInventory(true);

    try {
      // Prepare inventory data
      const inventoryData = {
        name: deviceData.deviceName,
        brand: deviceData.brand || 'Unknown',
        model: deviceData.model,
        storage: deviceData.storage,
        color: deviceData.color,
        carrier: deviceData.carrier,
        type: 'PHONE',
        imei: deviceData.imei,
        serialNumber: deviceData.serialNumber,
        condition: deviceData.condition || 'UNKNOWN',
        batteryHealth: deviceData.batteryHealth,
        working: deviceData.working || deviceData.workingStatus || 'PENDING',
        defects: deviceData.failed ? String(deviceData.failed) : undefined,
        notes: deviceData.notes,
        custom1: deviceData.repairNotes,
        quantity: 1,
        location: selectedLocation,
        testResults: rawData || deviceData,
      };

      const response = await apiClient.post('/admin/inventory-push', inventoryData);

      if (response.success) {
        addToast('Device added to inventory successfully!', 'success');
        // Reset form
        setImei('');
        setDeviceData(null);
        setRawData(null);
        setError(null);
      } else {
        throw new Error(response.error || 'Failed to add to inventory');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to add to inventory';
      addToast(errorMessage, 'error');
    } finally {
      setAddingToInventory(false);
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Phonecheck Device Lookup</h1>
      <p className="text-sm text-gray-500 mb-6">Look up device information by IMEI and add to inventory</p>

      <Card className="mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            performLookup();
          }}
          className="space-y-6"
        >
          <div>
            <label htmlFor="imei" className="block text-sm font-medium text-gray-700 mb-2">
              IMEI Number
            </label>
            <div className="flex space-x-3">
              <input
                type="text"
                id="imei"
                value={imei}
                onChange={handleIMEIChange}
                placeholder="Enter IMEI number (15 digits)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={20}
              />
              <Button
                type="button"
                onClick={() => performLookup()}
                disabled={loading || !validateIMEI(imei)}
                loading={loading}
              >
                <i className="fas fa-search"></i>
                Lookup
              </Button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {imei.replace(/\D/g, '').length}/15 digits • Phonecheck lookup will automatically start when you enter a valid 15-digit IMEI
            </p>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <select
              id="location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {locations.map((location) => (
                <option key={location.id} value={location.name}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-red-800 mb-1">Error</h3>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
                <Button onClick={() => performLookup()} variant="secondary" size="sm">
                  Retry
                </Button>
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <Spinner size="lg" />
              <h3 className="text-xl font-semibold text-gray-900 mt-4 mb-2">Fetching Device Information</h3>
              <p className="text-gray-600">Looking up IMEI: {imei.replace(/\D/g, '')}</p>
            </div>
          )}

          {deviceData && !loading && (
            <div className="mt-6 space-y-6">
              {/* Success Header */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <h3 className="text-xl font-bold text-green-900">Phonecheck Data Ready</h3>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => setShowFullPackage(!showFullPackage)}
                      variant={showFullPackage ? 'secondary' : 'primary'}
                      size="sm"
                    >
                      {showFullPackage ? 'Hide' : 'Show'} Full Package
                    </Button>
                    {rawData && (
                      <Button
                        onClick={() => setShowRawData(!showRawData)}
                        variant={showRawData ? 'secondary' : 'primary'}
                        size="sm"
                      >
                        {showRawData ? 'Hide' : 'Show'} Raw Data
                      </Button>
                    )}
                  </div>
                </div>

                {/* Quick Summary Table */}
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="grid grid-cols-6 gap-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                    <div className="font-bold text-gray-800 text-xs uppercase tracking-wider text-center">
                      DEVICE NAME
                    </div>
                    <div className="font-bold text-gray-800 text-xs uppercase tracking-wider text-center">
                      MODEL NUMBER
                    </div>
                    <div className="font-bold text-gray-800 text-xs uppercase tracking-wider text-center">IMEI</div>
                    <div className="font-bold text-gray-800 text-xs uppercase tracking-wider text-center">
                      WORKING STATUS
                    </div>
                    <div className="font-bold text-gray-800 text-xs uppercase tracking-wider text-center">
                      LAST UPDATE
                    </div>
                    <div className="font-bold text-gray-800 text-xs uppercase tracking-wider text-center">
                      TESTER NAME
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-4 p-4 hover:bg-gray-50">
                    <div className="text-gray-900 font-semibold text-sm text-center break-words">
                      {deviceData.deviceName || 'N/A'}
                    </div>
                    <div className="text-gray-700 text-sm font-mono text-center break-all">
                      {deviceData.modelNumber || 'N/A'}
                    </div>
                    <div className="text-gray-700 text-sm font-mono text-center break-all">
                      {deviceData.imei || 'N/A'}
                    </div>
                    <div className="flex justify-center items-center">
                      <WorkingStatusBadge status={deviceData.working || deviceData.workingStatus} />
                    </div>
                    <div className="text-gray-700 text-sm text-center">
                      {formatDate(deviceData.lastUpdate)}
                    </div>
                    <div className="text-gray-700 text-sm font-medium text-center break-words">
                      {deviceData.testerName || 'N/A'}
                    </div>
                  </div>

                  {/* Notes, Defects, Repair Notes */}
                  {(deviceData.notes || deviceData.failed || deviceData.repairNotes) && (
                    <div className="border-t border-gray-200">
                      <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50">
                        <div className="font-bold text-gray-800 text-xs uppercase tracking-wider text-center">
                          NOTES
                        </div>
                        <div className="font-bold text-gray-800 text-xs uppercase tracking-wider text-center">
                          DEFECTS
                        </div>
                        <div className="font-bold text-gray-800 text-xs uppercase tracking-wider text-center">
                          REPAIR NOTES
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 p-4 hover:bg-gray-50">
                        <div className="text-gray-700 text-sm text-center min-h-[2rem] flex items-center justify-center">
                          {deviceData.notes ? (
                            <span className="inline-flex items-center px-3 py-2 rounded-full text-xs font-medium bg-blue-100 text-blue-800 break-words max-w-full">
                              {deviceData.notes}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm italic">N/A</span>
                          )}
                        </div>
                        <div className="text-gray-700 text-sm text-center min-h-[2rem] flex items-center justify-center">
                          {deviceData.failed ? (
                            <span className="inline-flex items-center px-3 py-2 rounded-full text-xs font-medium bg-red-100 text-red-800 break-words max-w-full">
                              {String(deviceData.failed)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm italic">N/A</span>
                          )}
                        </div>
                        <div className="text-gray-700 text-sm text-center min-h-[2rem] flex items-center justify-center">
                          {deviceData.repairNotes ? (
                            <span className="inline-flex items-center px-3 py-2 rounded-full text-xs font-medium bg-purple-100 text-purple-800 break-words max-w-full">
                              {deviceData.repairNotes}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm italic">N/A</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Full Package Data Display */}
              {showFullPackage && (
                <Card>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <h4 className="text-lg font-bold text-blue-900">Full Data Package (Going to Database)</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(deviceData).map(([key, value]) => {
                      if (key === 'source' || key === 'checkDate') return null;
                      return (
                        <div key={key} className="bg-gray-50 p-4 rounded-lg border">
                          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide text-center block mb-2">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </label>
                          <p className="text-sm text-gray-900 font-medium text-center break-words">
                            {value !== null && value !== undefined ? String(value) : 'N/A'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Raw Data Display */}
              {showRawData && rawData && (
                <Card>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    <h4 className="text-lg font-bold text-gray-900">Raw Phonecheck API Response</h4>
                  </div>
                  <div className="bg-white p-4 rounded-lg border shadow-sm overflow-auto max-h-80">
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                      {JSON.stringify(rawData, null, 2)}
                    </pre>
                  </div>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <Button onClick={handleAddToInventory} loading={addingToInventory} variant="success" size="lg">
                  <i className="fas fa-plus"></i>
                  Add to Inventory
                </Button>
                <Button
                  onClick={() => {
                    setImei('');
                    setDeviceData(null);
                    setRawData(null);
                    setError(null);
                  }}
                  variant="secondary"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
};
