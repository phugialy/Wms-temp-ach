import { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { useToastStore } from '../stores/toastStore';
import { apiClient } from '../services/api';
import type { DeviceInfo, Location } from '../types';

export const SingleAdd = () => {
  const [imei, setImei] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const response = await apiClient.get<{ success: boolean; locations?: Location[]; data?: Location[] }>('/admin/locations');
      
      // Handle different response formats
      let locationsArray: Location[] = [];
      
      if (response.success) {
        // API returns { success: true, locations: [...] }
        if ('locations' in response && Array.isArray(response.locations)) {
          locationsArray = response.locations;
        }
        // Or API returns { success: true, data: [...] }
        else if ('data' in response && Array.isArray(response.data)) {
          locationsArray = response.data;
        }
        // Or response.data is directly an array
        else if (Array.isArray((response as any).data)) {
          locationsArray = (response as any).data;
        }
      }
      
      if (locationsArray.length > 0) {
        setLocations(locationsArray);
        setSelectedLocation(locationsArray[0].name);
      } else {
        // Fallback to default locations if API fails or returns empty
        const defaultLocations: Location[] = [
          { id: 'DNCL-Inspection', name: 'DNCL Inspection' },
          { id: 'DNCL-Testing', name: 'DNCL Testing' },
          { id: 'DNCL-Storage', name: 'DNCL Storage' },
        ];
        setLocations(defaultLocations);
        setSelectedLocation(defaultLocations[0].name);
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
      // Use default locations on error
      const defaultLocations: Location[] = [
        { id: 'DNCL-Inspection', name: 'DNCL Inspection' },
        { id: 'DNCL-Testing', name: 'DNCL Testing' },
        { id: 'DNCL-Storage', name: 'DNCL Storage' },
      ];
      setLocations(defaultLocations);
      setSelectedLocation(defaultLocations[0].name);
    }
  };

  const handleLookup = async () => {
    if (!imei.trim()) {
      addToast('Please enter an IMEI', 'error');
      return;
    }

    setLoading(true);
    setDeviceInfo(null);

    try {
      const response = await apiClient.post<DeviceInfo>('/phonecheck/lookup', { imei: imei.trim() });
      if (response.success && response.data) {
        setDeviceInfo(response.data);
        addToast('Device information retrieved successfully', 'success');
      } else {
        addToast(response.error || 'Failed to lookup IMEI', 'error');
      }
    } catch (error: any) {
      addToast(error.message || 'Network error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToInventory = async () => {
    if (!deviceInfo) return;

    setLoading(true);

    try {
      const response = await apiClient.post('/admin/inventory-push', {
        ...deviceInfo,
        location: selectedLocation,
        quantity: 1,
      });

      if (response.success) {
        addToast('Device added to inventory successfully', 'success');
        setImei('');
        setDeviceInfo(null);
      } else {
        addToast(response.error || 'Failed to add device', 'error');
      }
    } catch (error: any) {
      addToast(error.message || 'Network error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Single Add Device</h1>

      <Card className="mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              IMEI Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={imei}
                onChange={(e) => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="Enter 15-digit IMEI"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={15}
              />
              <Button onClick={handleLookup} loading={loading} disabled={!imei.trim()}>
                <i className="fas fa-search"></i>
                Lookup
              </Button>
            </div>
          </div>

          {locations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {loading && !deviceInfo && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {deviceInfo && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Device Information</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-sm text-gray-600">Brand</div>
              <div className="font-medium">{deviceInfo.brand || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Model</div>
              <div className="font-medium">{deviceInfo.model || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Color</div>
              <div className="font-medium">{deviceInfo.color || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Capacity</div>
              <div className="font-medium">{deviceInfo.capacity || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Condition</div>
              <div className="font-medium">{deviceInfo.condition || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">IMEI</div>
              <div className="font-medium font-mono">{deviceInfo.imei}</div>
            </div>
          </div>
          <Button onClick={handleAddToInventory} loading={loading} variant="success" size="lg">
            <i className="fas fa-plus"></i>
            Add to Inventory
          </Button>
        </Card>
      )}
    </div>
  );
};

