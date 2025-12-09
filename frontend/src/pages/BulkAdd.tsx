import { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { ProgressModal } from '../components/ui/ProgressModal';
import { useToastStore } from '../stores/toastStore';
import { apiClient } from '../services/api';

interface Device {
  imei?: string;
  serialNumber?: string;
  brand?: string;
  model?: string;
  name?: string;
  color?: string;
  capacity?: string;
  storage?: string;
  working?: string | boolean;
  workingStatus?: string;
  failed?: boolean | string;
  batteryHealth?: string | number;
  condition?: string;
  defects?: string;
  notes?: string;
  custom1?: string;
  type?: string;
  location?: string;
  quantity?: number;
  carrier?: string;
  status?: 'success' | 'error';
  error?: string;
}

interface ProcessedDevice extends Device {
  status: 'success' | 'error';
  error?: string;
}

const AVAILABLE_STATIONS = [
  { id: 'dncltz1', name: 'dncltz1' },
  { id: 'dncltz2', name: 'dncltz2' },
  { id: 'dncltz3', name: 'dncltz3' },
  { id: 'dncltz4', name: 'dncltz4' },
  { id: 'dncltz5', name: 'dncltz5' },
  { id: 'dncltz6', name: 'dncltz6' },
  { id: 'dncltz7', name: 'dncltz7' },
  { id: 'dncltz8', name: 'dncltz8' },
  { id: 'dncltz9', name: 'dncltz9' },
  { id: 'dncltz10', name: 'dncltz10' },
];

const AVAILABLE_LOCATIONS = [
  { id: 'inspection', name: 'DNCL-Inspection', description: 'Device inspection area' },
  { id: 'testing', name: 'DNCL-Testing', description: 'Device testing area' },
  { id: 'storage', name: 'DNCL-Storage', description: 'General storage area' },
  { id: 'warehouse-a', name: 'DNCL-Warehouse-A', description: 'Warehouse section A' },
  { id: 'warehouse-b', name: 'DNCL-Warehouse-B', description: 'Warehouse section B' },
  { id: 'processing', name: 'DNCL-Processing', description: 'Device processing area' },
  { id: 'qc', name: 'DNCL-QC', description: 'Quality control area' },
  { id: 'shipping', name: 'DNCL-Shipping', description: 'Shipping preparation area' },
];

export const BulkAdd = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pulledDevices, setPulledDevices] = useState<Device[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedDevice[]>([]);
  const [showResults, setShowResults] = useState(false);
  
  // Progress modal state
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);

  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    // Set default date range to last 7 days
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(sevenDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Step 1: Pull devices from Phonecheck station
  const pullDevicesFromStation = async () => {
    if (!selectedStation || !startDate || !endDate) {
      addToast('Please select station and date range', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post('/phonecheck/pull-devices', {
        station: selectedStation,
        startDate: startDate,
        endDate: endDate,
      });

      if (response.success && response.data) {
        // Handle different response structures
        let devices: Device[] = [];
        if (Array.isArray(response.data)) {
          devices = response.data;
        } else if (response.data.devices && Array.isArray(response.data.devices)) {
          devices = response.data.devices;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          devices = response.data.data;
        }

        if (devices.length > 0) {
          setPulledDevices(devices);
          setStep(2);
          addToast(`Successfully pulled ${devices.length} devices`, 'success');
        } else {
          addToast('No devices found for the selected criteria', 'warning');
        }
      } else {
        addToast(response.error || 'Failed to pull devices', 'error');
      }
    } catch (error: any) {
      addToast(error.message || 'Network error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Process pulled devices
  const processPulledDevices = async () => {
    if (!selectedLocation) {
      addToast('Please select a target location', 'error');
      return;
    }

    if (pulledDevices.length === 0) {
      addToast('No devices to process', 'warning');
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post('/phonecheck/process-bulk', {
        station: selectedStation,
        startDate: startDate,
        endDate: endDate,
        location: selectedLocation,
      });

      if (response.success && response.data) {
        // Handle different response structures
        let processed: ProcessedDevice[] = [];
        if (response.data.processed && Array.isArray(response.data.processed)) {
          processed = response.data.processed.map((item: any) => ({
            ...item,
            status: item.status || 'success',
          }));
        } else if (response.data.devices && Array.isArray(response.data.devices)) {
          processed = response.data.devices.map((item: any) => ({
            ...item,
            status: item.status || 'success',
          }));
        } else if (Array.isArray(response.data)) {
          processed = response.data.map((item: any) => ({
            ...item,
            status: item.status || 'success',
          }));
        }

        if (processed.length > 0) {
          setProcessedData(processed);
          setShowResults(true);
          setStep(3);
          addToast(`Successfully processed ${processed.length} devices`, 'success');
        } else {
          addToast('No devices were processed', 'warning');
        }
      } else {
        addToast(response.error || 'Failed to process devices', 'error');
      }
    } catch (error: any) {
      addToast(error.message || 'Network error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Add processed devices to inventory
  const addToInventory = async () => {
    if (processedData.length === 0) {
      addToast('No devices to add', 'warning');
      return;
    }

    setLoading(true);
    setShowProgress(true);
    setProgress(0);
    setCurrentStep(1);

    try {
      // Filter valid items with IMEI
      const validItems = processedData.filter((item) => item.imei);
      
      if (validItems.length === 0) {
        addToast('No valid devices with IMEI to add', 'error');
        setShowProgress(false);
        setLoading(false);
        return;
      }

      // Prepare items for inventory
      const itemsToProcess = validItems.map((item) => ({
        imei: item.imei || '',
        serialNumber: item.serialNumber,
        brand: item.brand || 'Unknown',
        model: item.model || 'Unknown',
        capacity: item.capacity || item.storage || 'N/A',
        color: item.color || 'N/A',
        carrier: item.carrier || 'N/A',
        working_status: convertWorkingStatus(item),
        battery_health: item.batteryHealth || 'Unknown',
        location: selectedLocation || 'DNCL-Inspection',
        notes: item.notes || item.defects || '',
        quantity: 1,
      }));

      setCurrentStep(2);
      setProgress(25);

      const response = await apiClient.post('/inventory/bulk-add', {
        items: itemsToProcess,
        station: selectedStation,
        location: selectedLocation,
      });

      setProgress(75);
      setCurrentStep(3);

      if (response.success) {
        const addedCount = response.data?.processedItems || validItems.length;
        const errorCount = response.data?.failedItems || 0;

        setProgress(100);

        setTimeout(() => {
          setShowProgress(false);
          setLoading(false);

          if (addedCount > 0) {
            addToast(
              `Added ${addedCount} items to inventory${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
              addedCount > 0 ? 'success' : 'error'
            );

            // Clear data after successful addition
            setPulledDevices([]);
            setProcessedData([]);
            setShowResults(false);
            setStep(1);
          }
        }, 1000);
      } else {
        setShowProgress(false);
        setLoading(false);
        addToast(response.error || 'Failed to add items to inventory', 'error');
      }
    } catch (error: any) {
      setShowProgress(false);
      setLoading(false);
      addToast(error.message || 'Network error occurred', 'error');
    }
  };

  // Helper function to convert working status
  const convertWorkingStatus = (item: Device): string => {
    const working = (item.working || '').toString().toUpperCase();
    const workingStatus = (item.workingStatus || '').toString().toUpperCase();
    const failed = item.failed;

    if (working === 'YES' || working === 'PASS' || working === 'PASSED' || working === 'TRUE' ||
        workingStatus === 'YES' || workingStatus === 'PASS' || workingStatus === 'PASSED' || workingStatus === 'TRUE' ||
        failed === false || failed === 'false' || failed === 'PASSED') {
      return 'YES';
    }
    
    if (working === 'NO' || working === 'FAIL' || working === 'FAILED' || working === 'FALSE' ||
        workingStatus === 'NO' || workingStatus === 'FAIL' || workingStatus === 'FAILED' || workingStatus === 'FALSE' ||
        failed === true || failed === 'true' || failed === 'FAILED') {
      return 'NO';
    }

    return 'PENDING';
  };

  // Get working status display
  const getWorkingStatusDisplay = (item: Device) => {
    const status = convertWorkingStatus(item);
    const colorClass = 
      status === 'YES' ? 'bg-green-100 text-green-800' :
      status === 'NO' ? 'bg-red-100 text-red-800' :
      'bg-yellow-100 text-yellow-800';
    
    return { status, colorClass };
  };

  // Clear all data
  const clearAll = () => {
    setPulledDevices([]);
    setProcessedData([]);
    setShowResults(false);
    setStep(1);
    addToast('All data cleared', 'success');
  };

  // Count statistics
  const stats = {
    total: processedData.filter((item) => item.imei).length,
    working: processedData.filter((item) => convertWorkingStatus(item) === 'YES').length,
    notWorking: processedData.filter((item) => convertWorkingStatus(item) === 'NO').length,
    pending: processedData.filter((item) => convertWorkingStatus(item) === 'PENDING').length,
    withBattery: processedData.filter((item) => item.batteryHealth !== undefined).length,
    withDefects: processedData.filter((item) => item.defects).length,
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Bulk Add Devices from Phonecheck Station</h1>

      <ProgressModal
        isOpen={showProgress}
        progress={progress}
        currentStep={currentStep}
        totalSteps={3}
        onClose={() => setShowProgress(false)}
      />

      <Card className="mb-6">
        {/* Progress Steps Indicator */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  step >= 1 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'
                }`}
              >
                1
              </div>
              <span className="ml-2 font-medium">Pull IMEIs</span>
            </div>
            <div className={`flex-1 h-1 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  step >= 2 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'
                }`}
              >
                2
              </div>
              <span className="ml-2 font-medium">Process Devices</span>
            </div>
            <div className={`flex-1 h-1 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  step >= 3 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'
                }`}
              >
                3
              </div>
              <span className="ml-2 font-medium">Review & Add</span>
            </div>
          </div>
        </div>

        {/* Step 1: Pull Devices */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Station</label>
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Station</option>
                  {AVAILABLE_STATIONS.map((station) => (
                    <option key={station.id} value={station.name}>
                      {station.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={pullDevicesFromStation}
                disabled={loading || !selectedStation || !startDate || !endDate}
                loading={loading && step === 1}
              >
                <i className="fas fa-download"></i>
                Pull Devices from Station
              </Button>
              <Button onClick={clearAll} variant="secondary" disabled={loading}>
                Clear All
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Process Devices */}
        {step === 2 && (
          <div className="space-y-6">
            {pulledDevices.length > 0 ? (
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-900 mb-2">Step 2: Configure Processing</h3>
                <p className="text-green-700">
                  Successfully pulled {pulledDevices.length} devices. Now configure where to store them.
                </p>
              </div>
            ) : (
              <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">Step 2: No Devices Found</h3>
                <p className="text-yellow-700">
                  No devices were found for the selected criteria. Please go back to Step 1 and try different
                  parameters.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Location</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Target Location</option>
                  {AVAILABLE_LOCATIONS.map((location) => (
                    <option key={location.id} value={location.name} title={location.description}>
                      {location.name} - {location.description}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Choose where the processed devices will be stored in inventory
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Processing Summary</label>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Total Devices:</span>
                      <span className="ml-2 text-gray-600">{pulledDevices.length || 0}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Station:</span>
                      <span className="ml-2 text-gray-600">{selectedStation || 'Not selected'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Date Range:</span>
                      <span className="ml-2 text-gray-600">
                        {startDate && endDate ? `${startDate} to ${endDate}` : 'Not set'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Status:</span>
                      <span className="ml-2 text-gray-600">
                        {pulledDevices.length > 0 ? 'Ready to Process' : 'No devices found'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={processPulledDevices}
                disabled={loading || !selectedLocation || pulledDevices.length === 0}
                loading={loading}
                variant="success"
              >
                <i className="fas fa-cog"></i>
                Process Devices
              </Button>
              <Button onClick={() => setStep(1)} variant="secondary" disabled={loading}>
                Back to Step 1
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Add */}
        {step === 3 && showResults && processedData.length > 0 && (
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Processing Results</h3>
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-green-600">
                  ✓ {processedData.filter((item) => item.status === 'success').length} Ready
                </span>
                <span className="text-red-600">
                  ✕ {processedData.filter((item) => item.status === 'error').length} Errors
                </span>
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Inventory Push Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Total Items:</span>
                  <span className="ml-2 text-gray-600">{stats.total}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Working Status:</span>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center">
                      <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                      <span className="text-green-700">YES: {stats.working}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                      <span className="text-red-700">NO: {stats.notWorking}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                      <span className="text-yellow-700">PENDING: {stats.pending}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">With Battery Data:</span>
                  <span className="ml-2 text-gray-600">{stats.withBattery}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">With Defects:</span>
                  <span className="ml-2 text-gray-600">{stats.withDefects}</span>
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">IMEI</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Working Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {processedData
                    .filter((item) => item)
                    .map((item, index) => {
                      const { status: workingStatus, colorClass } = getWorkingStatusDisplay(item);
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm font-mono text-gray-900">{item.imei || 'N/A'}</td>
                          <td className="px-3 py-2 text-sm">
                            <div className="font-medium text-gray-900">{item.name || 'Unknown'}</div>
                            <div className="text-xs text-gray-500">
                              {item.brand} {item.model}
                            </div>
                            <div className="text-xs text-gray-400">
                              {item.storage || item.capacity} • {item.color}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
                              {workingStatus}
                            </span>
                            {item.batteryHealth && (
                              <div className="text-xs text-gray-500 mt-1">
                                Battery: {item.batteryHealth}%
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                item.status === 'success'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {item.status === 'success' ? 'Ready' : 'Error'}
                            </span>
                            {item.status !== 'success' && item.error && (
                              <div className="text-xs text-red-600 mt-1">{item.error}</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Add to Inventory Button */}
            {stats.total > 0 && (
              <div className="flex justify-center space-x-3">
                <Button onClick={addToInventory} disabled={loading} loading={loading} variant="success" size="lg">
                  <i className="fas fa-plus"></i>
                  Add {stats.total} Items to Inventory
                </Button>
                <Button onClick={clearAll} variant="secondary" disabled={loading}>
                  Clear All
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Loading Indicator */}
        {loading && !showProgress && (
          <div className="text-center py-8">
            <Spinner size="lg" />
            <p className="text-gray-600 mt-4">
              {step === 1
                ? 'Pulling devices from Phonecheck station...'
                : step === 2
                ? 'Processing device details...'
                : step === 3
                ? 'Adding to inventory...'
                : 'Processing...'}
            </p>
          </div>
        )}
      </Card>

      {/* Pulled Devices Summary (shown when devices are pulled) */}
      {pulledDevices.length > 0 && step >= 2 && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Pulled Devices Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-800">Total Devices:</span>
              <span className="ml-2 text-blue-600">{pulledDevices.length}</span>
            </div>
            <div>
              <span className="font-medium text-blue-800">Station:</span>
              <span className="ml-2 text-blue-600">{selectedStation}</span>
            </div>
            <div>
              <span className="font-medium text-blue-800">Date Range:</span>
              <span className="ml-2 text-blue-600">
                {startDate} to {endDate}
              </span>
            </div>
            <div>
              <span className="font-medium text-blue-800">Status:</span>
              <span className="ml-2 text-blue-600">{step >= 2 ? 'Processing...' : 'Ready to Process'}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
