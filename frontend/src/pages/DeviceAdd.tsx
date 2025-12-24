import { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Descriptions,
  Alert,
  Tabs,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Progress,
  Divider,
  App,
  Spin,
  Empty,
  Modal,
  DatePicker,
} from 'antd';
import dayjs from 'dayjs';
import {
  PlusOutlined,
  SearchOutlined,
  AppstoreOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '../services/api';
import { useToastStore } from '../stores/toastStore';
import type { DeviceInfo, Location } from '../types';

const { TextArea } = Input;

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

export const DeviceAdd = () => {
  const { message } = App.useApp();
  const addToast = useToastStore((state) => state.addToast);
  
  // Single Add State
  const [singleAddForm] = Form.useForm();
  const [singleLoading, setSingleLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);

  // Bulk Add State
  const [bulkAddForm] = Form.useForm();
  const [bulkLoading, setBulkLoading] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pulledDevices, setPulledDevices] = useState<Device[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedDevice[]>([]);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    loadLocations();
    // Set default date range for bulk add
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    bulkAddForm.setFieldsValue({
      startDate: dayjs(sevenDaysAgo),
      endDate: dayjs(today),
    });
  }, []);

  const loadLocations = async () => {
    try {
      const response = await apiClient.get<{ success: boolean; locations?: Location[]; data?: Location[] }>('/admin/locations');
      
      let locationsArray: Location[] = [];
      
      if (response.success) {
        if ('locations' in response && Array.isArray(response.locations)) {
          locationsArray = response.locations;
        } else if ('data' in response && Array.isArray(response.data)) {
          locationsArray = response.data;
        } else if (Array.isArray((response as any).data)) {
          locationsArray = (response as any).data;
        }
      }
      
      if (locationsArray.length > 0) {
        setLocations(locationsArray);
        singleAddForm.setFieldsValue({ location: locationsArray[0].name });
      } else {
        const defaultLocations: Location[] = [
          { id: 'DNCL-Inspection', name: 'DNCL Inspection' },
          { id: 'DNCL-Testing', name: 'DNCL Testing' },
          { id: 'DNCL-Storage', name: 'DNCL Storage' },
        ];
        setLocations(defaultLocations);
        singleAddForm.setFieldsValue({ location: defaultLocations[0].name });
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
      const defaultLocations: Location[] = [
        { id: 'DNCL-Inspection', name: 'DNCL Inspection' },
        { id: 'DNCL-Testing', name: 'DNCL Testing' },
        { id: 'DNCL-Storage', name: 'DNCL Storage' },
      ];
      setLocations(defaultLocations);
      singleAddForm.setFieldsValue({ location: defaultLocations[0].name });
    }
  };

  // Single Add Handlers
  const handleLookup = async () => {
    const imei = singleAddForm.getFieldValue('imei');
    if (!imei || !imei.trim()) {
      message.error('Please enter an IMEI');
      return;
    }

    setSingleLoading(true);
    setDeviceInfo(null);

    try {
      const response = await apiClient.post<DeviceInfo>('/phonecheck/lookup', { imei: imei.trim() });
      if (response.success && response.data) {
        setDeviceInfo(response.data);
        message.success('Device information retrieved successfully');
      } else {
        message.error(response.error || 'Failed to lookup IMEI');
      }
    } catch (error: any) {
      message.error(error.message || 'Network error occurred');
    } finally {
      setSingleLoading(false);
    }
  };

  const handleAddToInventory = async () => {
    if (!deviceInfo) return;

    setSingleLoading(true);

    try {
      const location = singleAddForm.getFieldValue('location');
      const response = await apiClient.post('/admin/inventory-push', {
        ...deviceInfo,
        location: location,
        quantity: 1,
      });

      if (response.success) {
        message.success('Device added to inventory successfully');
        singleAddForm.resetFields();
        setDeviceInfo(null);
        singleAddForm.setFieldsValue({ location: locations[0]?.name });
      } else {
        message.error(response.error || 'Failed to add device');
      }
    } catch (error: any) {
      message.error(error.message || 'Network error occurred');
    } finally {
      setSingleLoading(false);
    }
  };

  // Bulk Add Handlers
  const pullDevicesFromStation = async () => {
    const values = await bulkAddForm.validateFields(['station', 'startDate', 'endDate']);
    if (!values.station || !values.startDate || !values.endDate) {
      message.error('Please select station and date range');
      return;
    }

    setBulkLoading(true);

    try {
      const response = await apiClient.post('/phonecheck/pull-devices', {
        station: values.station,
        startDate: values.startDate.format('YYYY-MM-DD'),
        endDate: values.endDate.format('YYYY-MM-DD'),
      });

      if (response.success && response.data) {
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
          message.success(`Successfully pulled ${devices.length} devices`);
        } else {
          message.warning('No devices found for the selected criteria');
        }
      } else {
        message.error(response.error || 'Failed to pull devices');
      }
    } catch (error: any) {
      message.error(error.message || 'Network error occurred');
    } finally {
      setBulkLoading(false);
    }
  };

  const processPulledDevices = async () => {
    const values = await bulkAddForm.validateFields(['targetLocation']);
    if (!values.targetLocation) {
      message.error('Please select a target location');
      return;
    }

    if (pulledDevices.length === 0) {
      message.warning('No devices to process');
      return;
    }

    setBulkLoading(true);

    try {
      const station = bulkAddForm.getFieldValue('station');
      const startDate = bulkAddForm.getFieldValue('startDate');
      const endDate = bulkAddForm.getFieldValue('endDate');
      
      const response = await apiClient.post('/phonecheck/process-bulk', {
        station: station,
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
        location: values.targetLocation,
      });

      if (response.success && response.data) {
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
          setStep(3);
          message.success(`Successfully processed ${processed.length} devices`);
        } else {
          message.warning('No devices were processed');
        }
      } else {
        message.error(response.error || 'Failed to process devices');
      }
    } catch (error: any) {
      message.error(error.message || 'Network error occurred');
    } finally {
      setBulkLoading(false);
    }
  };

  const addToInventory = async () => {
    if (processedData.length === 0) {
      message.warning('No devices to add');
      return;
    }

    setBulkLoading(true);
    setShowProgress(true);
    setProgress(0);
    setCurrentStep(1);

    try {
      const validItems = processedData.filter((item) => item.imei);
      
      if (validItems.length === 0) {
        message.error('No valid devices with IMEI to add');
        setShowProgress(false);
        setBulkLoading(false);
        return;
      }

      const targetLocation = bulkAddForm.getFieldValue('targetLocation');
      const station = bulkAddForm.getFieldValue('station');

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
        location: targetLocation || 'DNCL-Inspection',
        notes: item.notes || item.defects || '',
        quantity: 1,
      }));

      setCurrentStep(2);
      setProgress(25);

      const response = await apiClient.post('/inventory/bulk-add', {
        items: itemsToProcess,
        station: station,
        location: targetLocation,
      });

      setProgress(75);
      setCurrentStep(3);

      if (response.success) {
        const addedCount = response.data?.processedItems || validItems.length;
        const errorCount = response.data?.failedItems || 0;

        setProgress(100);

        setTimeout(() => {
          setShowProgress(false);
          setBulkLoading(false);

          if (addedCount > 0) {
            message.success(
              `Added ${addedCount} items to inventory${errorCount > 0 ? `, ${errorCount} failed` : ''}`
            );

            setPulledDevices([]);
            setProcessedData([]);
            setStep(1);
            bulkAddForm.resetFields();
            const today = new Date();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(today.getDate() - 7);
            bulkAddForm.setFieldsValue({
              startDate: dayjs(sevenDaysAgo),
              endDate: dayjs(today),
            });
          }
        }, 1000);
      } else {
        setShowProgress(false);
        setBulkLoading(false);
        message.error(response.error || 'Failed to add items to inventory');
      }
    } catch (error: any) {
      setShowProgress(false);
      setBulkLoading(false);
      message.error(error.message || 'Network error occurred');
    }
  };

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

  const clearAll = () => {
    setPulledDevices([]);
    setProcessedData([]);
    setStep(1);
    bulkAddForm.resetFields();
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    bulkAddForm.setFieldsValue({
      startDate: dayjs(sevenDaysAgo),
      endDate: dayjs(today),
    });
    message.success('All data cleared');
  };

  // Bulk Add Statistics
  const bulkStats = {
    total: processedData.filter((item) => item.imei).length,
    working: processedData.filter((item) => convertWorkingStatus(item) === 'YES').length,
    notWorking: processedData.filter((item) => convertWorkingStatus(item) === 'NO').length,
    pending: processedData.filter((item) => convertWorkingStatus(item) === 'PENDING').length,
  };

  // Bulk Add Table Columns
  const bulkColumns: ColumnsType<ProcessedDevice> = [
    {
      title: 'IMEI',
      dataIndex: 'imei',
      key: 'imei',
      render: (text) => <span style={{ fontFamily: 'monospace' }}>{text || 'N/A'}</span>,
    },
    {
      title: 'Device',
      key: 'device',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.name || 'Unknown'}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
            {record.brand} {record.model}
          </div>
          <div style={{ fontSize: 12, color: '#bfbfbf' }}>
            {record.storage || record.capacity} • {record.color}
          </div>
        </div>
      ),
    },
    {
      title: 'Working Status',
      key: 'workingStatus',
      render: (_, record) => {
        const status = convertWorkingStatus(record);
        const color = status === 'YES' ? 'green' : status === 'NO' ? 'red' : 'orange';
        return (
          <div>
            <Tag color={color}>{status}</Tag>
            {record.batteryHealth && (
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                Battery: {record.batteryHealth}%
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'success' ? 'green' : 'red'}>
          {status === 'success' ? 'Ready' : 'Error'}
        </Tag>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'single',
      label: (
        <span>
          <PlusOutlined />
          Single Add
        </span>
      ),
      children: (
        <div>
          <Card>
            <Form form={singleAddForm} layout="vertical">
              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item
                    name="imei"
                    label="IMEI Number"
                    rules={[{ required: true, message: 'Please enter an IMEI' }]}
                  >
                    <Input
                      placeholder="Enter 15-digit IMEI"
                      maxLength={15}
                      onPressEnter={handleLookup}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 15);
                        singleAddForm.setFieldsValue({ imei: value });
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label=" " style={{ marginBottom: 0 }}>
                    <Button
                      type="primary"
                      icon={<SearchOutlined />}
                      onClick={handleLookup}
                      loading={singleLoading}
                      block
                    >
                      Lookup
                    </Button>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="location"
                label="Location"
                rules={[{ required: true, message: 'Please select a location' }]}
              >
                <Select placeholder="Select location">
                  {locations.map((loc) => (
                    <Select.Option key={loc.id} value={loc.name}>
                      {loc.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Form>

            {singleLoading && !deviceInfo && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: '#8c8c8c' }}>Looking up device information...</div>
              </div>
            )}

            {deviceInfo && (
              <div style={{ marginTop: 24 }}>
                <Divider>Device Information</Divider>
                <Descriptions column={2} bordered>
                  <Descriptions.Item label="Brand">{deviceInfo.brand || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Model">{deviceInfo.model || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Color">{deviceInfo.color || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Capacity">{deviceInfo.capacity || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Condition">{deviceInfo.condition || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="IMEI">
                    <span style={{ fontFamily: 'monospace' }}>{deviceInfo.imei}</span>
                  </Descriptions.Item>
                </Descriptions>
                <div style={{ marginTop: 24, textAlign: 'right' }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlusOutlined />}
                    onClick={handleAddToInventory}
                    loading={singleLoading}
                  >
                    Add to Inventory
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      ),
    },
    {
      key: 'bulk',
      label: (
        <span>
          <AppstoreOutlined />
          Bulk Add
        </span>
      ),
      children: (
        <div>
          <Modal
            title="Processing Devices"
            open={showProgress}
            footer={null}
            closable={false}
            maskClosable={false}
          >
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Progress
                percent={progress}
                status={progress === 100 ? 'success' : 'active'}
                format={(percent) => `${percent}%`}
              />
              <div style={{ marginTop: 16, color: '#8c8c8c' }}>
                Step {currentStep} of 3: {currentStep === 1 ? 'Preparing...' : currentStep === 2 ? 'Adding to inventory...' : 'Completing...'}
              </div>
            </div>
          </Modal>

          <Card>
            <Form form={bulkAddForm} layout="vertical">
              {/* Step Indicator */}
              <div style={{ marginBottom: 24 }}>
                <Row gutter={8} align="middle">
                  <Col flex="auto">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: step >= 1 ? '#1890ff' : '#f0f0f0',
                          color: step >= 1 ? '#fff' : '#8c8c8c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 500,
                        }}
                      >
                        1
                      </div>
                      <div style={{ flex: 1, height: 2, background: step >= 2 ? '#1890ff' : '#f0f0f0' }} />
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: step >= 2 ? '#1890ff' : '#f0f0f0',
                          color: step >= 2 ? '#fff' : '#8c8c8c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 500,
                        }}
                      >
                        2
                      </div>
                      <div style={{ flex: 1, height: 2, background: step >= 3 ? '#1890ff' : '#f0f0f0' }} />
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: step >= 3 ? '#1890ff' : '#f0f0f0',
                          color: step >= 3 ? '#fff' : '#8c8c8c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 500,
                        }}
                      >
                        3
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                      <span style={{ fontSize: 12, color: step >= 1 ? '#1890ff' : '#8c8c8c' }}>Pull IMEIs</span>
                      <span style={{ fontSize: 12, color: step >= 2 ? '#1890ff' : '#8c8c8c' }}>Process Devices</span>
                      <span style={{ fontSize: 12, color: step >= 3 ? '#1890ff' : '#8c8c8c' }}>Review & Add</span>
                    </div>
                  </Col>
                </Row>
              </div>

              {/* Step 1: Pull Devices */}
              {step === 1 && (
                <div>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        name="station"
                        label="Station"
                        rules={[{ required: true, message: 'Please select a station' }]}
                      >
                        <Select placeholder="Select station">
                          {AVAILABLE_STATIONS.map((station) => (
                            <Select.Option key={station.id} value={station.name}>
                              {station.name}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="startDate"
                        label="Start Date"
                        rules={[{ required: true, message: 'Please select start date' }]}
                      >
                        <DatePicker style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="endDate"
                        label="End Date"
                        rules={[{ required: true, message: 'Please select end date' }]}
                      >
                        <DatePicker style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Space>
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      onClick={pullDevicesFromStation}
                      loading={bulkLoading}
                    >
                      Pull Devices from Station
                    </Button>
                    <Button onClick={clearAll} disabled={bulkLoading}>
                      Clear All
                    </Button>
                  </Space>
                </div>
              )}

              {/* Step 2: Process Devices */}
              {step === 2 && (
                <div>
                  {pulledDevices.length > 0 ? (
                    <Alert
                      message={`Successfully pulled ${pulledDevices.length} devices`}
                      description="Now configure where to store them."
                      type="success"
                      showIcon
                      style={{ marginBottom: 24 }}
                    />
                  ) : (
                    <Alert
                      message="No devices found"
                      description="No devices were found for the selected criteria. Please go back to Step 1 and try different parameters."
                      type="warning"
                      showIcon
                      style={{ marginBottom: 24 }}
                    />
                  )}

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="targetLocation"
                        label="Target Location"
                        rules={[{ required: true, message: 'Please select a target location' }]}
                      >
                        <Select placeholder="Select target location">
                          {AVAILABLE_LOCATIONS.map((location) => (
                            <Select.Option key={location.id} value={location.name}>
                              {location.name} - {location.description}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Card size="small">
                        <Statistic title="Total Devices" value={pulledDevices.length} />
                      </Card>
                    </Col>
                  </Row>
                  <Space>
                    <Button
                      type="primary"
                      onClick={processPulledDevices}
                      loading={bulkLoading}
                      disabled={pulledDevices.length === 0}
                    >
                      Process Devices
                    </Button>
                    <Button onClick={() => setStep(1)} disabled={bulkLoading}>
                      Back to Step 1
                    </Button>
                  </Space>
                </div>
              )}

              {/* Step 3: Review & Add */}
              {step === 3 && processedData.length > 0 && (
                <div>
                  <Alert
                    message="Processing Results"
                    description={
                      <Space>
                        <span>
                          <CheckCircleOutlined style={{ color: '#52c41a' }} />{' '}
                          {processedData.filter((item) => item.status === 'success').length} Ready
                        </span>
                        <span>
                          <CloseCircleOutlined style={{ color: '#ff4d4f' }} />{' '}
                          {processedData.filter((item) => item.status === 'error').length} Errors
                        </span>
                      </Space>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 24 }}
                  />

                  <Row gutter={16} style={{ marginBottom: 24 }}>
                    <Col span={6}>
                      <Card>
                        <Statistic title="Total Items" value={bulkStats.total} />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card>
                        <Statistic
                          title="Working"
                          value={bulkStats.working}
                          valueStyle={{ color: '#3f8600' }}
                          prefix={<CheckCircleOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card>
                        <Statistic
                          title="Not Working"
                          value={bulkStats.notWorking}
                          valueStyle={{ color: '#cf1322' }}
                          prefix={<CloseCircleOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card>
                        <Statistic
                          title="Pending"
                          value={bulkStats.pending}
                          valueStyle={{ color: '#faad14' }}
                          prefix={<ClockCircleOutlined />}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Table
                    columns={bulkColumns}
                    dataSource={processedData}
                    rowKey={(record, index) => record.imei || `device-${index}`}
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />

                  <div style={{ marginTop: 24, textAlign: 'center' }}>
                    <Space>
                      <Button
                        type="primary"
                        size="large"
                        icon={<PlusOutlined />}
                        onClick={addToInventory}
                        loading={bulkLoading}
                        disabled={bulkStats.total === 0}
                      >
                        Add {bulkStats.total} Items to Inventory
                      </Button>
                      <Button onClick={clearAll} disabled={bulkLoading}>
                        Clear All
                      </Button>
                    </Space>
                  </div>
                </div>
              )}
            </Form>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Add Devices</h1>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
            Add single device or bulk import from Phonecheck stations
          </div>
        </div>
      </div>

      <Tabs defaultActiveKey="single" items={tabItems} size="large" />
    </div>
  );
};

