import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Table,
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Space,
  Statistic,
  Row,
  Col,
  Tag,
  DatePicker,
  TimePicker,
  Checkbox,
  Descriptions,
  Alert,
  App,
  Tabs,
  Form,
  Switch,
  Divider,
} from 'antd';
import {
  PlayCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  HistoryOutlined,
  SettingOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import {
  workflowService,
  type CronJobExecution,
  type WorkflowStats,
  type DeviceInfo,
  type BulkAddWorkflowParams,
} from '../services/workflowService';
import {
  cronScheduleService,
  type CronJobSchedule,
  type CreateCronScheduleParams,
} from '../services/cronScheduleService';

const { RangePicker } = DatePicker;
const { Search } = Input;

// Types are imported from workflowService

const AVAILABLE_STATIONS = [
  'dncltz1', 'dncltz2', 'dncltz3', 'dncltz4', 'dncltz5',
  'dncltz6', 'dncltz7', 'dncltz8', 'dncltz9', 'dncltz10'
];

const AVAILABLE_LOCATIONS = [
  'DNCL-Inspection',
  'DNCL-Testing',
  'DNCL-Storage',
  'DNCL-Warehouse-A',
  'DNCL-Warehouse-B',
  'DNCL-Processing',
  'DNCL-QC',
  'DNCL-Shipping'
];

export const CronJobManagementModern = () => {
  const { message } = App.useApp();
  const [executions, setExecutions] = useState<CronJobExecution[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<CronJobExecution | null>(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [executionDevices, setExecutionDevices] = useState<DeviceInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Manual trigger form states
  const [triggerForm, setTriggerForm] = useState({
    stations: [] as string[],
    dateRange: [dayjs().subtract(1, 'day'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs],
    location: '',
  });
  const [triggering, setTriggering] = useState(false);
  
  // Cron Schedule Management states
  const [cronSchedules, setCronSchedules] = useState<CronJobSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<CronJobSchedule | null>(null);
  const [scheduleForm] = Form.useForm();
  
  // Use ref to track loading state to avoid race conditions
  const isLoadingRef = useRef(false);
  const hasInitialLoadRef = useRef(false);

  useEffect(() => {
    console.log('[CronJobManagement] ========== COMPONENT MOUNTED ==========');
    console.log('[CronJobManagement] Initial state check:', {
      isLoadingRef: isLoadingRef.current,
      hasInitialLoad: hasInitialLoadRef.current,
      loadingState: loading,
      executionsCount: executions.length,
      timestamp: new Date().toISOString()
    });
    
    // CRITICAL: Always reset ref on mount to ensure clean state
    // This handles React StrictMode double-mounting in development
    const wasLoading = isLoadingRef.current;
    isLoadingRef.current = false;
    console.log('[CronJobManagement] Reset isLoadingRef:', { wasLoading, now: isLoadingRef.current });
    
    // Only load on initial mount, not on re-renders
    if (!hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true;
      console.log('[CronJobManagement] ✅ First mount - triggering initial data load');
      console.log('[CronJobManagement] Calling loadData(true) in next tick...');
      
      // Use requestAnimationFrame to ensure React has finished mounting
      // This is more reliable than setTimeout for ensuring clean state
      requestAnimationFrame(() => {
        console.log('[CronJobManagement] requestAnimationFrame callback - calling loadData(true)');
        console.log('[CronJobManagement] isLoadingRef before loadData:', isLoadingRef.current);
        loadData(true); // Force initial load - bypasses guard
      });
    } else {
      console.log('[CronJobManagement] ⚠️ Subsequent mount detected (React StrictMode?) - skipping initial load');
      console.log('[CronJobManagement] If you see this and no data loaded, there may be a React StrictMode issue');
    }
    // Auto-refresh removed - user can manually refresh using the Refresh button
  }, []);

  const loadData = async (force: boolean = false) => {
    console.log('[CronJobManagement] ===== loadData() called =====', {
      force,
      isLoadingRef: isLoadingRef.current,
      loadingState: loading,
      timestamp: new Date().toISOString()
    });
    
    // Prevent duplicate concurrent requests unless forced
    if (isLoadingRef.current && !force) {
      console.warn('[CronJobManagement] ⚠️ Load data already in progress, skipping...');
      console.warn('[CronJobManagement] Use force=true to override, or wait for current request to complete');
      console.warn('[CronJobManagement] Current state:', {
        isLoadingRef: isLoadingRef.current,
        loadingState: loading
      });
      return;
    }
    
    try {
      console.log('[CronJobManagement] ✅ Proceeding with data load');
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);
      console.log('[CronJobManagement] ===== Starting data load =====', { force });
      console.log('[CronJobManagement] isLoadingRef set to:', isLoadingRef.current);
      console.log('[CronJobManagement] Calling workflowService.getExecutionHistory()...');
      console.log('[CronJobManagement] Calling workflowService.getWorkflowStats()...');
      
      // Use Promise.allSettled to handle partial failures gracefully
      const [executionsResult, statsResult] = await Promise.allSettled([
        workflowService.getExecutionHistory(100, 0),
        workflowService.getWorkflowStats(),
      ]);
      
      console.log('[CronJobManagement] API calls completed:', {
        executions: executionsResult.status,
        stats: statsResult.status,
      });

      // Handle executions data
      if (executionsResult.status === 'fulfilled' && executionsResult.value) {
        console.log(`[CronJobManagement] Loaded ${executionsResult.value.length} executions`);
        setExecutions(executionsResult.value);
      } else {
        console.warn('[CronJobManagement] Failed to load execution history:', executionsResult.status === 'rejected' ? executionsResult.reason : 'No data');
        if (executionsResult.status === 'rejected') {
          const errorMsg = executionsResult.reason?.message || 'Failed to load execution history';
          setError(`Failed to load execution history: ${errorMsg}`);
          message.warning('Failed to load execution history. Check backend connection.');
        } else {
          setExecutions([]); // Set empty array instead of showing warning
        }
      }

      // Handle stats data
      if (statsResult.status === 'fulfilled' && statsResult.value) {
        console.log('[CronJobManagement] Loaded workflow stats');
        setStats(statsResult.value);
      } else {
        console.warn('[CronJobManagement] Failed to load stats:', statsResult.status === 'rejected' ? statsResult.reason : 'No data');
        if (statsResult.status === 'rejected') {
          const errorMsg = statsResult.reason?.message || 'Failed to load workflow statistics';
          if (!error) {
            setError(`Failed to load workflow statistics: ${errorMsg}`);
          }
          message.warning('Failed to load workflow statistics. Check backend connection.');
        }
        // Don't set stats to null, keep previous stats if available
      }
      
      console.log('[CronJobManagement] Data loading complete');
    } catch (error) {
      console.error('[CronJobManagement] Error loading cron job data:', error);
      console.error('[CronJobManagement] Error stack:', error instanceof Error ? error.stack : 'No stack');
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to load cron job data: ${errorMsg}`);
      
      // Ensure we set empty arrays on error so UI doesn't stay stuck
      if (executions.length === 0) {
        setExecutions([]);
      }
      
      if (error instanceof Error) {
        message.error(`Failed to load cron job data: ${error.message}`);
      } else {
        message.error('Failed to load cron job data. Please check if the backend server is running.');
      }
    } finally {
      console.log('[CronJobManagement] Setting loading to false');
      isLoadingRef.current = false;
      setLoading(false);
    }
  };

  const loadExecutionDevices = async (executionId: string) => {
    setLoadingDevices(true);
    setExecutionDevices([]); // Clear previous data
    try {
      console.log(`[CronJobManagement] Loading devices for execution: ${executionId}`);
      const result = await workflowService.getExecutionDevices(executionId);
      if (result && result.devices) {
        console.log(`[CronJobManagement] Loaded ${result.devices.length} devices`);
        setExecutionDevices(result.devices);
        if (result.devices.length === 0) {
          message.warning('No device details found for this execution. This may be an older execution.');
        }
      } else {
        console.warn('[CronJobManagement] No devices in response');
        message.warning('No device details available for this execution.');
      }
    } catch (error) {
      console.error('[CronJobManagement] Error loading execution devices:', error);
      message.error('Failed to load device list. Please try again.');
    } finally {
      setLoadingDevices(false);
    }
  };

  const exportToCSV = () => {
    if (executionDevices.length === 0) {
      message.warning('No device data to export. Please load the device list first.');
      return;
    }

    try {
      // Prepare CSV headers
      const headers = ['IMEI', 'Station', 'Brand', 'Model', 'Capacity', 'Color', 'Carrier', 'Processed At'];
      
      // Prepare CSV rows
      const rows = executionDevices.map(device => [
        device.imei,
        device.station || 'N/A',
        device.brand || 'N/A',
        device.model || 'N/A',
        device.capacity || 'N/A',
        device.color || 'N/A',
        device.carrier || 'N/A',
        device.processedAt ? formatDate(device.processedAt) : 'N/A',
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with execution ID and timestamp
      const executionId = selectedExecution?.id ? selectedExecution.id.slice(-8) : 'unknown';
      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      link.setAttribute('download', `cron-job-devices_${executionId}_${timestamp}.csv`);
      
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success(`Exported ${executionDevices.length} devices to CSV`);
    } catch (error) {
      console.error('[CronJobManagement] Error exporting to CSV:', error);
      message.error('Failed to export to CSV. Please try again.');
    }
  };

  const exportToExcel = () => {
    if (executionDevices.length === 0) {
      message.warning('No device data to export. Please load the device list first.');
      return;
    }

    try {
      // Prepare data for Excel
      const excelData = executionDevices.map(device => ({
        'IMEI': device.imei,
        'Station': device.station || 'N/A',
        'Brand': device.brand || 'N/A',
        'Model': device.model || 'N/A',
        'Capacity': device.capacity || 'N/A',
        'Color': device.color || 'N/A',
        'Carrier': device.carrier || 'N/A',
        'Processed At': device.processedAt ? formatDate(device.processedAt) : 'N/A',
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Devices');

      // Set column widths for better readability
      const columnWidths = [
        { wch: 18 }, // IMEI
        { wch: 12 }, // Station
        { wch: 12 }, // Brand
        { wch: 20 }, // Model
        { wch: 12 }, // Capacity
        { wch: 12 }, // Color
        { wch: 12 }, // Carrier
        { wch: 20 }, // Processed At
      ];
      worksheet['!cols'] = columnWidths;

      // Generate filename with execution ID and timestamp
      const executionId = selectedExecution?.id ? selectedExecution.id.slice(-8) : 'unknown';
      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      const filename = `cron-job-devices_${executionId}_${timestamp}.xlsx`;

      // Write file
      XLSX.writeFile(workbook, filename);
      
      message.success(`Exported ${executionDevices.length} devices to Excel`);
    } catch (error) {
      console.error('[CronJobManagement] Error exporting to Excel:', error);
      message.error('Failed to export to Excel. Please try again.');
    }
  };

  const handleTriggerWorkflow = async () => {
    if (triggerForm.stations.length === 0) {
      message.warning('Please select at least one station');
      return;
    }

    if (!triggerForm.location) {
      message.warning('Please select a location');
      return;
    }

    if (!triggerForm.dateRange || triggerForm.dateRange.length !== 2) {
      message.warning('Please select a date range');
      return;
    }

    setTriggering(true);
    try {
      const params: BulkAddWorkflowParams = {
        stations: triggerForm.stations,
        dateFrom: triggerForm.dateRange[0].format('YYYY-MM-DD'),
        dateTo: triggerForm.dateRange[1].format('YYYY-MM-DD'),
        location: triggerForm.location,
        triggerSource: 'manual',
      };

      console.log('[CronJobManagement] Triggering workflow with params:', params);
      const result = await workflowService.executeBulkAddWorkflow(params);

      if (result.success) {
        message.success(`Workflow triggered successfully! Execution ID: ${result.executionId}`);
        setShowTriggerModal(false);
        // Reset form
        setTriggerForm({
          stations: [],
          dateRange: [dayjs().subtract(1, 'day'), dayjs()],
          location: '',
        });
        // Reload data after a short delay
        setTimeout(() => {
          loadData();
        }, 1000);
      } else {
        message.error(`Failed to trigger workflow: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[CronJobManagement] Error triggering workflow:', error);
      message.error(`Failed to trigger workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTriggering(false);
    }
  };

  const getFilteredExecutions = () => {
    let filtered = executions;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(exec => exec.status === statusFilter);
    }

    // Filter by workflow type
    if (workflowFilter !== 'all') {
      filtered = filtered.filter(exec => exec.workflowType === workflowFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(exec => 
        exec.id.toLowerCase().includes(query) ||
        exec.location?.toLowerCase().includes(query) ||
        exec.stations.some(s => s.toLowerCase().includes(query)) ||
        exec.errorMessage?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, string> = {
      completed: 'success',
      running: 'processing',
      failed: 'error',
      pending: 'default',
    };
    return <Badge status={colorMap[status] as any} text={status.toUpperCase()} />;
  };

  const columns: ColumnsType<CronJobExecution> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{id.slice(-8)}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => getStatusBadge(status),
    },
    {
      title: 'Stations',
      dataIndex: 'stations',
      key: 'stations',
      width: 150,
      render: (stations: string[]) => (
        <div>
          {stations.slice(0, 2).map(s => (
            <Tag key={s} style={{ marginBottom: 4 }}>{s}</Tag>
          ))}
          {stations.length > 2 && <Tag>+{stations.length - 2}</Tag>}
        </div>
      ),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 150,
    },
    {
      title: 'Date Range',
      key: 'dateRange',
      width: 200,
      render: (_, record) => (
        <div style={{ fontSize: '12px' }}>
          <div>From: {record.dateFrom ? formatDate(record.dateFrom) : 'N/A'}</div>
          <div>To: {record.dateTo ? formatDate(record.dateTo) : 'N/A'}</div>
        </div>
      ),
    },
    {
      title: 'Devices',
      key: 'devices',
      width: 150,
      render: (_, record) => (
        <div>
          <div>Found: <strong>{record.devicesFound}</strong></div>
          <div style={{ color: '#52c41a' }}>Added: <strong>{record.devicesAdded}</strong></div>
          {record.devicesFailed > 0 && (
            <div style={{ color: '#ff4d4f' }}>Failed: <strong>{record.devicesFailed}</strong></div>
          )}
        </div>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 100,
      render: (ms: number | null) => ms ? `${(ms / 1000).toFixed(1)}s` : 'N/A',
    },
    {
      title: 'Started',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 150,
      render: (date: string | null) => formatDate(date),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              console.log('[CronJobManagement] Opening details for execution:', record.id);
              setSelectedExecution(record);
              setExecutionDevices([]); // Clear device list - user must click "Show IMEI List" button to load
              setShowDetailsModal(true);
            }}
            size="small"
          >
            View
          </Button>
        </Space>
      ),
    },
  ];

  const filteredExecutions = getFilteredExecutions();

  // Early return if there's a critical error
  if (error && executions.length === 0 && !loading) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Failed to Load Data"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => loadData(true)}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  // Load cron schedules
  const loadCronSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const schedules = await cronScheduleService.getCronSchedules();
      setCronSchedules(schedules);
    } catch (error) {
      console.error('[CronJobManagement] Error loading cron schedules:', error);
      message.error('Failed to load cron schedules');
    } finally {
      setLoadingSchedules(false);
    }
  };

  // Handle create/update cron schedule
  const handleSaveSchedule = async (values: any) => {
    try {
      const params: CreateCronScheduleParams = {
        name: values.name,
        workflowType: 'bulk-add',
        stations: values.stations,
        location: values.location,
        dateRangeDays: values.dateRangeDays || 1,
        scheduleTime: values.scheduleTime.format('HH:mm'),
        timezone: values.timezone || 'UTC',
        frequency: values.frequency,
        weeklyDays: values.frequency === 'weekly' ? values.weeklyDays : undefined,
        description: values.description,
      };

      let result;
      if (editingSchedule) {
        result = await cronScheduleService.updateCronSchedule(editingSchedule.id, params);
      } else {
        result = await cronScheduleService.createCronSchedule(params);
      }

      if (result.success) {
        message.success(editingSchedule ? 'Cron schedule updated successfully' : 'Cron schedule created successfully');
        setShowScheduleModal(false);
        setEditingSchedule(null);
        scheduleForm.resetFields();
        loadCronSchedules();
      } else {
        message.error(result.error || 'Failed to save cron schedule');
      }
    } catch (error) {
      console.error('[CronJobManagement] Error saving cron schedule:', error);
      message.error('Failed to save cron schedule');
    }
  };

  // Handle toggle active status
  const handleToggleSchedule = async (schedule: CronJobSchedule) => {
    try {
      const result = await cronScheduleService.toggleCronSchedule(schedule.id, !schedule.isActive);
      if (result.success) {
        message.success(`Cron schedule ${!schedule.isActive ? 'activated' : 'deactivated'}`);
        loadCronSchedules();
      } else {
        message.error(result.error || 'Failed to toggle cron schedule');
      }
    } catch (error) {
      console.error('[CronJobManagement] Error toggling cron schedule:', error);
      message.error('Failed to toggle cron schedule');
    }
  };

  // Handle delete schedule
  const handleDeleteSchedule = async (schedule: CronJobSchedule) => {
    Modal.confirm({
      title: 'Delete Cron Schedule',
      content: `Are you sure you want to delete "${schedule.name}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const result = await cronScheduleService.deleteCronSchedule(schedule.id);
          if (result.success) {
            message.success('Cron schedule deleted successfully');
            loadCronSchedules();
          } else {
            message.error(result.error || 'Failed to delete cron schedule');
          }
        } catch (error) {
          console.error('[CronJobManagement] Error deleting cron schedule:', error);
          message.error('Failed to delete cron schedule');
        }
      },
    });
  };

  // Load schedules on mount
  useEffect(() => {
    loadCronSchedules();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Cron Job Management</h1>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>Bulk device import workflow</div>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => setShowTriggerModal(true)}
            disabled={triggering}
          >
            Manual Trigger
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              console.log('[CronJobManagement] Refresh button clicked');
              console.log('[CronJobManagement] Current loading state:', loading);
              loadData(true); // Force refresh even if already loading
            }}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {error && (
        <Alert
          message="Warning"
          description={error}
          type="warning"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs
        defaultActiveKey="executions"
        items={[
          {
            key: 'executions',
            label: (
              <span>
                <HistoryOutlined />
                Execution History
              </span>
            ),
            children: (
              <div>
                {/* Statistics Cards */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Executions"
                value={stats.total}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Completed"
                value={stats.completed}
                valueStyle={{ color: '#3f8600' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Failed"
                value={stats.failed}
                valueStyle={{ color: '#cf1322' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Running"
                value={stats.running}
                valueStyle={{ color: '#1890ff' }}
                prefix={<SyncOutlined spin={stats.running > 0} />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Average Statistics */}
      {stats && stats.averages && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Avg Devices Found"
                value={stats.averages.devicesFound}
                precision={0}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Avg Devices Added"
                value={stats.averages.devicesAdded}
                precision={0}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Avg Duration"
                value={stats.averages.durationMs / 1000}
                suffix="s"
                precision={1}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <div>
            <span style={{ marginRight: 8 }}>Status:</span>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
            >
              <Select.Option value="all">All</Select.Option>
              <Select.Option value="completed">Completed</Select.Option>
              <Select.Option value="running">Running</Select.Option>
              <Select.Option value="failed">Failed</Select.Option>
              <Select.Option value="pending">Pending</Select.Option>
            </Select>
          </div>
          <div>
            <span style={{ marginRight: 8 }}>Workflow:</span>
            <Select
              value={workflowFilter}
              onChange={setWorkflowFilter}
              style={{ width: 120 }}
            >
              <Select.Option value="all">All</Select.Option>
              <Select.Option value="bulk-add">Bulk Add</Select.Option>
            </Select>
          </div>
          <Search
            placeholder="Search by ID, location, station..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </Space>
      </Card>

      {/* Executions Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredExecutions}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} executions`,
          }}
          onRow={(record) => ({
            onClick: () => {
              console.log('[CronJobManagement] Row clicked:', record.id);
              setSelectedExecution(record);
              setExecutionDevices([]); // Clear device list when opening - user must click button to load
              setShowDetailsModal(true);
            },
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
              </div>
            ),
          },
          {
            key: 'schedules',
            label: (
              <span>
                <SettingOutlined />
                Cron Management
              </span>
            ),
            children: (
              <div>
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Scheduled Cron Jobs</h3>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                        Create and manage automated workflow schedules
                      </div>
                    </div>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingSchedule(null);
                        scheduleForm.resetFields();
                        scheduleForm.setFieldsValue({
                          frequency: 'daily',
                          dateRangeDays: 1,
                          timezone: 'UTC',
                          scheduleTime: dayjs('02:00', 'HH:mm'),
                        });
                        setShowScheduleModal(true);
                      }}
                    >
                      Create Schedule
                    </Button>
                  </div>

                  <Table
                    dataSource={cronSchedules}
                    rowKey="id"
                    loading={loadingSchedules}
                    columns={[
                      {
                        title: 'Name',
                        dataIndex: 'name',
                        key: 'name',
                        width: 200,
                        render: (name: string, record: CronJobSchedule) => (
                          <div>
                            <div style={{ fontWeight: 500 }}>{name}</div>
                            {record.description && (
                              <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.description}</div>
                            )}
                          </div>
                        ),
                      },
                      {
                        title: 'Schedule',
                        key: 'schedule',
                        width: 200,
                        render: (_, record: CronJobSchedule) => (
                          <div>
                            <div><strong>Time:</strong> {record.scheduleTime}</div>
                            <div><strong>Frequency:</strong> {record.frequency === 'daily' ? 'Daily' : 'Weekly'}</div>
                            {record.frequency === 'weekly' && record.weeklyDays.length > 0 && (
                              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                                Days: {record.weeklyDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}
                              </div>
                            )}
                          </div>
                        ),
                      },
                      {
                        title: 'Workflow',
                        key: 'workflow',
                        width: 250,
                        render: (_, record: CronJobSchedule) => (
                          <div>
                            <div><strong>Stations:</strong> {record.stations.length} selected</div>
                            <div><strong>Location:</strong> {record.location}</div>
                            <div><strong>Date Range:</strong> Last {record.dateRangeDays} day(s)</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Status',
                        key: 'status',
                        width: 150,
                        render: (_, record: CronJobSchedule) => (
                          <div>
                            <Switch
                              checked={record.isActive}
                              onChange={() => handleToggleSchedule(record)}
                              checkedChildren="Active"
                              unCheckedChildren="Inactive"
                            />
                            <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                              {record.nextRunAt ? `Next: ${formatDate(record.nextRunAt)}` : 'No next run'}
                            </div>
                          </div>
                        ),
                      },
                      {
                        title: 'Runs',
                        key: 'runs',
                        width: 120,
                        render: (_, record: CronJobSchedule) => (
                          <div>
                            <div>Total: <strong>{record.totalRuns}</strong></div>
                            <div style={{ color: '#3f8600' }}>Success: <strong>{record.successfulRuns}</strong></div>
                            {record.failedRuns > 0 && (
                              <div style={{ color: '#cf1322' }}>Failed: <strong>{record.failedRuns}</strong></div>
                            )}
                          </div>
                        ),
                      },
                      {
                        title: 'Actions',
                        key: 'actions',
                        width: 150,
                        fixed: 'right' as const,
                        render: (_, record: CronJobSchedule) => (
                          <Space>
                            <Button
                              type="link"
                              icon={<EditOutlined />}
                              onClick={() => {
                                setEditingSchedule(record);
                                const [hours, minutes] = record.scheduleTime.split(':');
                                scheduleForm.setFieldsValue({
                                  name: record.name,
                                  stations: record.stations,
                                  location: record.location,
                                  dateRangeDays: record.dateRangeDays,
                                  scheduleTime: dayjs(`${hours}:${minutes}`, 'HH:mm'),
                                  timezone: record.timezone,
                                  frequency: record.frequency,
                                  weeklyDays: record.weeklyDays,
                                  description: record.description,
                                });
                                setShowScheduleModal(true);
                              }}
                              size="small"
                            >
                              Edit
                            </Button>
                            <Button
                              type="link"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => handleDeleteSchedule(record)}
                              size="small"
                            >
                              Delete
                            </Button>
                          </Space>
                        ),
                      },
                    ]}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                    }}
                  />
                </Card>
              </div>
            ),
          },
        ]}
        style={{ marginTop: 16 }}
      />

      {/* Trigger Workflow Modal */}
      <Modal
        title="Trigger Bulk-Add Workflow"
        open={showTriggerModal}
        onOk={handleTriggerWorkflow}
        onCancel={() => setShowTriggerModal(false)}
        confirmLoading={triggering}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Stations *</label>
            <Checkbox.Group
              options={AVAILABLE_STATIONS}
              value={triggerForm.stations}
              onChange={(values) => setTriggerForm({ ...triggerForm, stations: values as string[] })}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Date Range *</label>
            <RangePicker
              value={triggerForm.dateRange}
              onChange={(dates) => {
                if (dates) {
                  setTriggerForm({ ...triggerForm, dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] });
                }
              }}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Location *</label>
            <Select
              value={triggerForm.location}
              onChange={(value) => setTriggerForm({ ...triggerForm, location: value })}
              style={{ width: '100%' }}
              placeholder="Select location"
            >
              {AVAILABLE_LOCATIONS.map(loc => (
                <Select.Option key={loc} value={loc}>{loc}</Select.Option>
              ))}
            </Select>
          </div>
        </Space>
      </Modal>

      {/* Execution Details Modal */}
      <Modal
        title={`Execution Details - ${selectedExecution?.id.slice(-8)}`}
        open={showDetailsModal}
        onCancel={() => {
          console.log('[CronJobManagement] Modal closed, clearing device list');
          setShowDetailsModal(false);
          setSelectedExecution(null);
          setExecutionDevices([]);
        }}
        footer={null}
        width={1000}
      >
        {selectedExecution && (
          <div>
            <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Status" span={1}>
                {getStatusBadge(selectedExecution.status)}
              </Descriptions.Item>
              <Descriptions.Item label="Workflow Type" span={1}>
                {selectedExecution.workflowType}
              </Descriptions.Item>
              <Descriptions.Item label="Trigger Source" span={1}>
                {selectedExecution.triggerSource}
              </Descriptions.Item>
              <Descriptions.Item label="Location" span={1}>
                {selectedExecution.location || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Stations" span={2}>
                {selectedExecution.stations.map(s => <Tag key={s}>{s}</Tag>)}
              </Descriptions.Item>
              <Descriptions.Item label="Date From" span={1}>
                {selectedExecution.dateFrom ? formatDate(selectedExecution.dateFrom) : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Date To" span={1}>
                {selectedExecution.dateTo ? formatDate(selectedExecution.dateTo) : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Started At" span={1}>
                {selectedExecution.startedAt ? formatDate(selectedExecution.startedAt) : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Completed At" span={1}>
                {selectedExecution.completedAt ? formatDate(selectedExecution.completedAt) : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Duration" span={1}>
                {selectedExecution.durationMs ? `${(selectedExecution.durationMs / 1000).toFixed(1)}s` : 'N/A'}
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Statistic title="Devices Found" value={selectedExecution.devicesFound} />
              </Col>
              <Col span={6}>
                <Statistic title="Devices Processed" value={selectedExecution.devicesProcessed} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Devices Added"
                  value={selectedExecution.devicesAdded}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              {selectedExecution.devicesFailed > 0 && (
                <Col span={6}>
                  <Statistic
                    title="Devices Failed"
                    value={selectedExecution.devicesFailed}
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Col>
              )}
            </Row>

            {selectedExecution.errorMessage && (
              <Alert
                message="Error"
                description={selectedExecution.errorMessage}
                type="error"
                showIcon
                style={{ marginBottom: 24 }}
              />
            )}

            {/* Devices List Section - Show when devices were added */}
            {(selectedExecution.devicesAdded && Number(selectedExecution.devicesAdded) > 0) ? (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Device List</h3>
                    {Number(selectedExecution.devicesAdded) || 0} devices were added in this execution
                    {executionDevices.length > 0 && ` • ${executionDevices.length} devices currently displayed`}
                  </div>
                  <Space>
                    {executionDevices.length > 0 && (
                      <>
                        <Button
                          icon={<FileTextOutlined />}
                          onClick={exportToCSV}
                          disabled={executionDevices.length === 0}
                        >
                          Export CSV
                        </Button>
                        <Button
                          icon={<FileExcelOutlined />}
                          onClick={exportToExcel}
                          disabled={executionDevices.length === 0}
                        >
                          Export Excel
                        </Button>
                      </>
                    )}
                    <Button
                      type="primary"
                      icon={<EyeOutlined />}
                      onClick={async () => {
                        console.log('[CronJobManagement] devicesAdded:', selectedExecution.devicesAdded);
                        if (selectedExecution.id) {
                          await loadExecutionDevices(selectedExecution.id);
                        }
                      }}
                      loading={loadingDevices}
                    >
                      {executionDevices.length > 0 ? 'Reload Device List' : '🔍 Show IMEI List'}
                    </Button>
                  </Space>
                </div>

                {loadingDevices && (
                  <div style={{ marginTop: 16 }}>Loading device list...</div>
                )}

                {executionDevices.length > 0 && (
                  <Table
                    dataSource={executionDevices}
                    rowKey="imei"
                    pagination={{
                      pageSize: 20,
                      showSizeChanger: true,
                      showTotal: (total) => `Total ${total} devices`,
                    }}
                    columns={[
                      {
                        title: 'IMEI',
                        dataIndex: 'imei',
                        key: 'imei',
                        render: (imei: string) => <span style={{ fontFamily: 'monospace' }}>{imei}</span>,
                      },
                      {
                        title: 'Station',
                        dataIndex: 'station',
                        key: 'station',
                      },
                      {
                        title: 'Brand',
                        dataIndex: 'brand',
                        key: 'brand',
                      },
                      {
                        title: 'Model',
                        dataIndex: 'model',
                        key: 'model',
                      },
                      {
                        title: 'Capacity',
                        dataIndex: 'capacity',
                        key: 'capacity',
                      },
                      {
                        title: 'Color',
                        dataIndex: 'color',
                        key: 'color',
                      },
                      {
                        title: 'Carrier',
                        dataIndex: 'carrier',
                        key: 'carrier',
                      },
                      {
                        title: 'Processed At',
                        dataIndex: 'processedAt',
                        key: 'processedAt',
                        render: (date: string) => formatDate(date),
                      },
                    ]}
                  />
                )}

                {executionDevices.length === 0 && !loadingDevices && (
                  <Alert
                    message="No Device Details Available"
                    description={
                      <div>
                        <p>This execution added <strong>{selectedExecution.devicesAdded} devices</strong> to the database.</p>
                        <p>
                          Click the <strong>"🔍 Show IMEI List"</strong> button above to fetch and display all device IMEIs, 
                          or this might be an older execution that doesn't have device metadata stored.
                        </p>
                      </div>
                    }
                    type="info"
                    showIcon
                  />
                )}
              </div>
            ) : (
              <Alert
                message="No Devices Added"
                description="This execution did not add any devices to the database."
                type="info"
                showIcon
              />
            )}
          </div>
        )}
      </Modal>

      <style>{`
        .ant-table-row-completed {
          background-color: #f6ffed !important;
        }
        .ant-table-row-completed:hover {
          background-color: #d9f7be !important;
        }
        .ant-table-row-failed {
          background-color: #fff1f0 !important;
        }
        .ant-table-row-failed:hover {
          background-color: #ffccc7 !important;
        }
        .ant-table-row-running {
          background-color: #e6f7ff !important;
        }
        .ant-table-row-running:hover {
          background-color: #bae7ff !important;
        }
      `}</style>

      {/* Create/Edit Cron Schedule Modal */}
      <Modal
        title={editingSchedule ? 'Edit Cron Schedule' : 'Create Cron Schedule'}
        open={showScheduleModal}
        onOk={() => scheduleForm.submit()}
        onCancel={() => {
          setShowScheduleModal(false);
          setEditingSchedule(null);
          scheduleForm.resetFields();
        }}
        width={700}
        okText={editingSchedule ? 'Update' : 'Create'}
      >
        <Form
          form={scheduleForm}
          layout="vertical"
          onFinish={handleSaveSchedule}
          initialValues={{
            frequency: 'daily',
            dateRangeDays: 1,
            timezone: 'UTC',
            scheduleTime: dayjs('02:00', 'HH:mm'),
          }}
        >
          <Form.Item
            name="name"
            label="Schedule Name"
            rules={[{ required: true, message: 'Please enter a schedule name' }]}
          >
            <Input placeholder="e.g., Daily Morning Import" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={2} placeholder="Optional description for this schedule" />
          </Form.Item>

          <Divider orientation="left" style={{ margin: '16px 0' }}>Workflow Parameters</Divider>

          <Form.Item
            name="stations"
            label="Stations *"
            rules={[{ required: true, message: 'Please select at least one station' }]}
          >
            <Checkbox.Group options={AVAILABLE_STATIONS} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="location"
            label="Location *"
            rules={[{ required: true, message: 'Please select a location' }]}
          >
            <Select placeholder="Select location" style={{ width: '100%' }}>
              {AVAILABLE_LOCATIONS.map(loc => (
                <Select.Option key={loc} value={loc}>{loc}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="dateRangeDays"
            label="Date Range (Days Back)"
            rules={[{ required: true, message: 'Please specify date range' }]}
            tooltip="How many days back to process (e.g., 1 = yesterday, 7 = last week)"
          >
            <Input type="number" min={1} max={30} />
          </Form.Item>

          <Divider orientation="left" style={{ margin: '16px 0' }}>Schedule Configuration</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="scheduleTime"
                label="Schedule Time *"
                rules={[{ required: true, message: 'Please select a time' }]}
              >
                <TimePicker
                  format="HH:mm"
                  style={{ width: '100%' }}
                  placeholder="Select time"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="timezone"
                label="Timezone"
                rules={[{ required: true, message: 'Please select timezone' }]}
              >
                <Select style={{ width: '100%' }}>
                  <Select.Option value="UTC">UTC</Select.Option>
                  <Select.Option value="America/New_York">Eastern Time (ET)</Select.Option>
                  <Select.Option value="America/Chicago">Central Time (CT)</Select.Option>
                  <Select.Option value="America/Denver">Mountain Time (MT)</Select.Option>
                  <Select.Option value="America/Los_Angeles">Pacific Time (PT)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="frequency"
            label="Frequency *"
            rules={[{ required: true, message: 'Please select frequency' }]}
          >
            <Select style={{ width: '100%' }}>
              <Select.Option value="daily">Daily</Select.Option>
              <Select.Option value="weekly">Weekly</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.frequency !== currentValues.frequency}
          >
            {({ getFieldValue }) => {
              const frequency = getFieldValue('frequency');
              if (frequency === 'weekly') {
                return (
                  <Form.Item
                    name="weeklyDays"
                    label="Select Days *"
                    rules={[{ required: true, message: 'Please select at least one day' }]}
                  >
                    <Checkbox.Group style={{ width: '100%' }}>
                      <Row>
                        <Col span={8}><Checkbox value={0}>Sunday</Checkbox></Col>
                        <Col span={8}><Checkbox value={1}>Monday</Checkbox></Col>
                        <Col span={8}><Checkbox value={2}>Tuesday</Checkbox></Col>
                        <Col span={8}><Checkbox value={3}>Wednesday</Checkbox></Col>
                        <Col span={8}><Checkbox value={4}>Thursday</Checkbox></Col>
                        <Col span={8}><Checkbox value={5}>Friday</Checkbox></Col>
                        <Col span={8}><Checkbox value={6}>Saturday</Checkbox></Col>
                      </Row>
                    </Checkbox.Group>
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .ant-table-row-completed {
          background-color: #f6ffed !important;
        }
        .ant-table-row-completed:hover {
          background-color: #d9f7be !important;
        }
        .ant-table-row-failed {
          background-color: #fff1f0 !important;
        }
        .ant-table-row-failed:hover {
          background-color: #ffccc7 !important;
        }
        .ant-table-row-running {
          background-color: #e6f7ff !important;
        }
        .ant-table-row-running:hover {
          background-color: #bae7ff !important;
        }
      `}</style>
    </div>
  );
};
