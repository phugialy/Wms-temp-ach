import { useState, useEffect, useRef, useCallback } from 'react';
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
  Tooltip,
  Empty,
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
  MailOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import * as XLSX from 'xlsx';

dayjs.extend(utc);
dayjs.extend(timezone);
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
import {
  emailSubscriptionService,
  type EmailSubscription,
  type CreateEmailSubscriptionParams,
} from '../services/emailSubscriptionService';

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
  'DNCL-Shipping',
  'DNCL-RETURN'
];

const WEEK_DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
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
  
  // Archive and retention states
  const [activeTab, setActiveTab] = useState<string>('executions');
  const [archiveExecutions, setArchiveExecutions] = useState<CronJobExecution[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [archiveRetentionDays, setArchiveRetentionDays] = useState<number>(() => {
    // Load from localStorage or default to 14 days
    const saved = localStorage.getItem('archiveRetentionDays');
    return saved ? parseInt(saved, 10) : 14;
  });
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  
  // Save retention days to localStorage when changed
  useEffect(() => {
    localStorage.setItem('archiveRetentionDays', archiveRetentionDays.toString());
  }, [archiveRetentionDays]);
  
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
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<CronJobSchedule | null>(null);
  const [scheduleForm] = Form.useForm();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<CronJobSchedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState(false);
  const [triggeringSchedule, setTriggeringSchedule] = useState<string | null>(null);
  const [triggeringAll, setTriggeringAll] = useState(false);
  
  // Email Subscription Management states
  const [emailSubscriptions, setEmailSubscriptions] = useState<EmailSubscription[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<EmailSubscription | null>(null);
  const [subscriptionForm] = Form.useForm();
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [testingEmail, setTestingEmail] = useState<string | null>(null);
  const [showDeleteSubscriptionModal, setShowDeleteSubscriptionModal] = useState(false);
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<EmailSubscription | null>(null);
  const [deletingSubscription, setDeletingSubscription] = useState(false);
  
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
      
      // Calculate date range: last 30 days for main history (increased from 7 to show more executions)
      const thirtyDaysAgo = dayjs().subtract(30, 'day').startOf('day').toISOString();
      const now = dayjs().endOf('day').toISOString();
      
      // Use Promise.allSettled to handle partial failures gracefully
      const [executionsResult, statsResult] = await Promise.allSettled([
        workflowService.getExecutionHistory(100, 0, thirtyDaysAgo, now), // Last 30 days to show previous deployment executions
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

  const handleTriggerWorkflow = async (e?: React.MouseEvent<HTMLElement>) => {
    // Prevent form submission and page reload
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

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

      console.log('[CronJobManagement] Workflow result:', result);

      if (result.success === true) {
        // Show success message with execution ID if available
        const successMsg = result.message || 
          (result.executionId 
            ? `Workflow triggered successfully! Execution ID: ${result.executionId}` 
            : 'Workflow triggered successfully!');
        message.success(successMsg);
        setShowTriggerModal(false);
        // Reset form
        setTriggerForm({
          stations: [],
          dateRange: [dayjs().subtract(1, 'day'), dayjs()],
          location: '',
        });
        // Reload data after a short delay (without page reload)
        setTimeout(() => {
          loadData();
        }, 1000);
      } else {
        // Show error message
        const errorMsg = result.error || result.message || 'Unknown error';
        console.error('[CronJobManagement] Workflow failed:', result);
        message.error(`Failed to trigger workflow: ${errorMsg}`);
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
      title: 'Schedule',
      key: 'schedule',
      width: 180,
      render: (_: any, record: CronJobExecution) => {
        // If we have schedule name from the API, show it
        if (record.scheduleName) {
          return (
            <div>
              <div style={{ fontWeight: 500, color: '#1890ff' }}>{record.scheduleName}</div>
              {record.scheduleTime && (
                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                  {record.scheduleTime} {record.scheduleFrequency === 'daily' ? '(Daily)' : '(Weekly)'}
                </div>
              )}
            </div>
          );
        }
        
        // For scheduled-cron executions without schedule_id (old executions)
        // Show that it was from a schedule, even if we can't identify which one
        if (record.triggerSource === 'scheduled-cron') {
          return (
            <div>
              <div style={{ fontWeight: 500, color: '#52c41a' }}>Scheduled Run</div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                (Schedule not linked)
              </div>
            </div>
          );
        }
        
        // Manual triggers
        if (record.triggerSource === 'manual') {
          return (
            <span style={{ color: '#8c8c8c', fontStyle: 'italic' }}>
              Manual Trigger
            </span>
          );
        }
        
        // Fallback for other trigger sources
        return (
          <span style={{ color: '#8c8c8c', fontStyle: 'italic' }}>
            {record.triggerSource || 'Unknown'}
          </span>
        );
      },
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
    setSavingSchedule(true);
    try {
      // Handle custom date range days
      let dateRangeDays = values.dateRangeDays;
      if (dateRangeDays === 'custom') {
        dateRangeDays = values.customDateRangeDays || values._actualDateRangeDays;
        if (!dateRangeDays || isNaN(dateRangeDays) || dateRangeDays < 1) {
          message.error('Please enter a valid number of days (1-90) for custom date range');
          return;
        }
      }
      
      // Validate dateRangeDays (0 is valid for "Today")
      if (dateRangeDays === undefined || dateRangeDays === null || dateRangeDays === '' || isNaN(dateRangeDays)) {
        message.error('Please select a valid date range option');
        return;
      }
      
      // Ensure it's a number and within valid range (0-90)
      dateRangeDays = parseInt(dateRangeDays);
      if (isNaN(dateRangeDays) || dateRangeDays < 0 || dateRangeDays > 90) {
        message.error('Date range must be between 0 (Today) and 90 days');
        return;
      }

      // Validate all required fields before building params
      if (!values.name || !values.name.trim()) {
        message.error('Schedule name is required');
        return;
      }
      
      if (!values.stations || values.stations.length === 0) {
        message.error('Please select at least one station');
        return;
      }
      
      if (!values.location || !values.location.trim()) {
        message.error('Location is required');
        return;
      }
      
      if (!values.scheduleTime) {
        message.error('Schedule time is required');
        return;
      }
      
      if (!values.frequency) {
        message.error('Frequency is required');
        return;
      }
      
      if (values.frequency === 'weekly' && (!values.weeklyDays || values.weeklyDays.length === 0)) {
        message.error('Please select at least one day for weekly schedule');
        return;
      }

      // Ensure stations is always an array (form validation should prevent empty, but be safe)
      const stationsArray = Array.isArray(values.stations) ? values.stations : [];
      if (stationsArray.length === 0) {
        message.error('Please select at least one station');
        setSavingSchedule(false);
        return;
      }

      const params: CreateCronScheduleParams = {
        name: values.name.trim(),
        workflowType: 'bulk-add',
        stations: stationsArray, // Always send as array
        location: values.location.trim(),
        dateRangeDays: dateRangeDays,
        scheduleTime: values.scheduleTime.format('HH:mm'),
        timezone: values.timezone || 'UTC',
        frequency: values.frequency,
        weeklyDays: values.frequency === 'weekly' ? values.weeklyDays : undefined,
        description: values.description?.trim() || undefined,
      };

      console.log('[CronJobManagement] Submitting schedule:', { 
        editingSchedule: !!editingSchedule, 
        editingScheduleId: editingSchedule?.id,
        params,
        stationsCount: params.stations.length,
        stations: params.stations
      });
      
      let result;
      if (editingSchedule) {
        console.log('[CronJobManagement] Updating schedule:', editingSchedule.id);
        result = await cronScheduleService.updateCronSchedule(editingSchedule.id, params);
      } else {
        console.log('[CronJobManagement] Creating new schedule');
        result = await cronScheduleService.createCronSchedule(params);
      }

      console.log('[CronJobManagement] Save result:', result);

      if (result.success) {
        message.success({
          content: editingSchedule ? 'Cron schedule updated successfully' : 'Cron schedule created successfully',
          duration: 3,
        });
        setShowScheduleModal(false);
        setEditingSchedule(null);
        scheduleForm.resetFields();
        loadCronSchedules();
      } else {
        console.error('[CronJobManagement] Save failed:', result.error);
        message.error({
          content: result.error || 'Failed to save cron schedule',
          duration: 5,
        });
      }
    } catch (error) {
      console.error('[CronJobManagement] Error saving cron schedule:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      message.error({
        content: `Failed to save cron schedule: ${errorMessage}`,
        duration: 5,
      });
    } finally {
      setSavingSchedule(false);
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

  // Handle delete schedule - show confirmation modal
  const handleDeleteSchedule = (schedule: CronJobSchedule) => {
    console.log('[CronJobManagement] Delete button clicked for schedule:', schedule.id, schedule.name);
    setScheduleToDelete(schedule);
    setShowDeleteModal(true);
  };

  // Confirm and execute delete
  const confirmDeleteSchedule = async () => {
    if (!scheduleToDelete) return;

    console.log('[CronJobManagement] Delete confirmed, calling deleteCronSchedule');
    setDeletingSchedule(true);
    
    try {
      const result = await cronScheduleService.deleteCronSchedule(scheduleToDelete.id);
      console.log('[CronJobManagement] Delete result:', result);
      console.log('[CronJobManagement] Delete result.success:', result.success);
      console.log('[CronJobManagement] Delete result.error:', result.error);
      
      if (result.success) {
        console.log('[CronJobManagement] Delete successful, reloading schedules');
        message.success('Cron schedule deleted successfully');
        setShowDeleteModal(false);
        setScheduleToDelete(null);
        await loadCronSchedules();
      } else {
        console.error('[CronJobManagement] Delete failed:', result.error);
        message.error(result.error || 'Failed to delete cron schedule');
      }
    } catch (error) {
      console.error('[CronJobManagement] Error deleting cron schedule:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      message.error(`Failed to delete cron schedule: ${errorMessage}`);
    } finally {
      setDeletingSchedule(false);
    }
  };

  // Cancel delete
  const cancelDeleteSchedule = () => {
    console.log('[CronJobManagement] Delete cancelled by user');
    setShowDeleteModal(false);
    setScheduleToDelete(null);
  };

  // Load schedules on mount
  useEffect(() => {
    loadCronSchedules();
  }, []);

  // Handle trigger single schedule
  const handleTriggerSchedule = useCallback(async (scheduleId: string, scheduleName: string) => {
    setTriggeringSchedule(scheduleId);
    try {
      const result = await cronScheduleService.triggerSchedule(scheduleId);
      if (result.success) {
        message.success(`Schedule "${scheduleName}" triggered successfully`);
        // Reload schedules to update lastRunAt
        await loadCronSchedules();
        // Reload execution history to show new execution
        await loadData(true);
      } else {
        message.error(result.error || `Failed to trigger schedule "${scheduleName}"`);
      }
    } catch (error) {
      console.error('[CronJobManagement] Error triggering schedule:', error);
      message.error(`Failed to trigger schedule "${scheduleName}"`);
    } finally {
      setTriggeringSchedule(null);
    }
  }, [message, loadCronSchedules, loadData]);

  // Handle trigger all schedules
  const handleTriggerAllSchedules = useCallback(async () => {
    const activeSchedules = cronSchedules.filter(s => s.isActive);
    if (activeSchedules.length === 0) {
      message.warning('No active schedules to trigger');
      return;
    }

    setTriggeringAll(true);
    try {
      const result = await cronScheduleService.triggerAllSchedules();
      if (result.success) {
        const total = result.total || 0;
        const successful = result.successful || 0;
        const failed = result.failed || 0;
        message.success(
          `Triggered ${total} schedules: ${successful} successful, ${failed} failed`,
          5
        );
        // Reload schedules to update lastRunAt
        await loadCronSchedules();
        // Reload execution history to show new executions
        await loadData(true);
      } else {
        message.error(result.error || 'Failed to trigger all schedules');
      }
    } catch (error) {
      console.error('[CronJobManagement] Error triggering all schedules:', error);
      message.error('Failed to trigger all schedules');
    } finally {
      setTriggeringAll(false);
    }
  }, [cronSchedules, message, loadCronSchedules, loadData]);

  // Load email subscriptions
  const loadEmailSubscriptions = useCallback(async () => {
    setLoadingSubscriptions(true);
    try {
      console.log('[CronJobManagement] Loading email subscriptions...');
      const result = await emailSubscriptionService.getAllSubscriptions(false);
      console.log('[CronJobManagement] Load subscriptions result:', result);
      if (result.success) {
        if (result.data) {
          setEmailSubscriptions(result.data);
          console.log('[CronJobManagement] Loaded', result.data.length, 'subscriptions');
        } else {
          // No data returned, set empty array
          setEmailSubscriptions([]);
          console.log('[CronJobManagement] No subscriptions found');
        }
      } else {
        console.error('[CronJobManagement] Failed to load subscriptions:', result.error);
        message.error(result.error || 'Failed to load email subscriptions');
        // Set empty array on error to clear stale data
        setEmailSubscriptions([]);
      }
    } catch (error) {
      console.error('[CronJobManagement] Error loading email subscriptions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      message.error(`Failed to load email subscriptions: ${errorMessage}`);
      // Set empty array on error to clear stale data
      setEmailSubscriptions([]);
    } finally {
      setLoadingSubscriptions(false);
    }
  }, [message]);

  // Load subscriptions when Email Reports tab is active
  useEffect(() => {
    if (activeTab === 'email-reports') {
      loadEmailSubscriptions();
    }
  }, [activeTab, loadEmailSubscriptions]);

  // Handle save subscription
  const handleSaveSubscription = useCallback(async () => {
    try {
      const values = await subscriptionForm.validateFields();
      setSavingSubscription(true);

      const params: CreateEmailSubscriptionParams = {
        name: values.name,
        description: values.description,
        scheduleIds: values.scheduleIds || [],
        locationFilter: values.locationFilter,
        emailRecipients: values.emailRecipients || [],
        deliveryMode: values.deliveryMode,
        scheduleTime: values.scheduleTime ? values.scheduleTime.format('HH:mm') : undefined,
        scheduleFrequency: values.scheduleFrequency,
        scheduleDays: values.scheduleDays,
        timezone: values.timezone || 'UTC',
        emailOnSuccess: values.emailOnSuccess !== false,
        emailOnFailure: values.emailOnFailure !== false,
        summaryOnly: values.summaryOnly || false,
      };

      if (editingSubscription) {
        const result = await emailSubscriptionService.updateSubscription(editingSubscription.id, params);
        if (result.success) {
          message.success('Email subscription updated successfully');
          setShowSubscriptionModal(false);
          setEditingSubscription(null);
          subscriptionForm.resetFields();
          // Reload subscriptions after successful update
          try {
            await loadEmailSubscriptions();
          } catch (loadError) {
            console.error('[CronJobManagement] Error reloading subscriptions after update:', loadError);
            // Don't show error to user as the update was successful
          }
        } else {
          message.error(result.error || 'Failed to update subscription');
        }
      } else {
        const result = await emailSubscriptionService.createSubscription(params);
        if (result.success) {
          message.success('Email subscription created successfully');
          setShowSubscriptionModal(false);
          setEditingSubscription(null);
          subscriptionForm.resetFields();
          // Reload subscriptions after successful create
          try {
            await loadEmailSubscriptions();
          } catch (loadError) {
            console.error('[CronJobManagement] Error reloading subscriptions after create:', loadError);
            // Don't show error to user as the create was successful, but log it
            message.warning('Subscription created but failed to refresh the list. Please click Refresh.');
          }
        } else {
          message.error(result.error || 'Failed to create subscription');
        }
      }
    } catch (error) {
      console.error('[CronJobManagement] Error saving subscription:', error);
      if (error && typeof error === 'object' && 'errorFields' in error) {
        // Form validation errors
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      message.error(`Failed to save subscription: ${errorMessage}`);
    } finally {
      setSavingSubscription(false);
    }
  }, [editingSubscription, subscriptionForm, loadEmailSubscriptions, message]);

  // Handle delete subscription
  const confirmDeleteSubscription = useCallback(async () => {
    if (!subscriptionToDelete) return;
    setDeletingSubscription(true);
    try {
      const result = await emailSubscriptionService.deleteSubscription(subscriptionToDelete.id);
      if (result.success) {
        message.success('Email subscription deleted successfully');
        setShowDeleteSubscriptionModal(false);
        setSubscriptionToDelete(null);
        await loadEmailSubscriptions();
      } else {
        message.error(result.error || 'Failed to delete subscription');
      }
    } catch (error) {
      console.error('[CronJobManagement] Error deleting subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      message.error(`Failed to delete subscription: ${errorMessage}`);
    } finally {
      setDeletingSubscription(false);
    }
  }, [subscriptionToDelete, loadEmailSubscriptions, message]);

  const cancelDeleteSubscription = () => {
    setShowDeleteSubscriptionModal(false);
    setSubscriptionToDelete(null);
  };

  // Load archive data when Archive tab is active
  const loadArchiveData = useCallback(async () => {
    setLoadingArchive(true);
    try {
      // Load executions older than 7 days, up to retention period
      const retentionDate = dayjs().subtract(archiveRetentionDays, 'day').startOf('day').toISOString();
      const sevenDaysAgo = dayjs().subtract(7, 'day').startOf('day').toISOString();
      
      console.log('[CronJobManagement] Loading archive data:', {
        retentionDate,
        sevenDaysAgo,
        retentionDays: archiveRetentionDays
      });
      
      const archiveData = await workflowService.getExecutionHistory(1000, 0, retentionDate, sevenDaysAgo);
      console.log('[CronJobManagement] Loaded archive data:', archiveData.length, 'executions');
      setArchiveExecutions(archiveData);
    } catch (error) {
      console.error('[CronJobManagement] Error loading archive:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      message.error(`Failed to load archive data: ${errorMsg}`);
      setArchiveExecutions([]);
    } finally {
      setLoadingArchive(false);
    }
  }, [archiveRetentionDays, message]);

  // Load archive when tab is switched to Archive
  useEffect(() => {
    if (activeTab === 'archive') {
      loadArchiveData();
    }
  }, [activeTab, loadArchiveData]);

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

      {/* Total Statistics by Period */}
      {stats && stats.totals && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, color: '#595959' }}>
                Total Statistics
              </div>
            </Col>
          </Row>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#1890ff' }}>
                  Daily
                </div>
                <Statistic
                  title="Devices Found"
                  value={stats.totals.daily.devicesFound}
                  precision={0}
                  style={{ marginBottom: 16 }}
                />
                <Statistic
                  title="Devices Added"
                  value={stats.totals.daily.devicesAdded}
                  precision={0}
                  style={{ marginBottom: 16 }}
                />
                <Statistic
                  title="Duration"
                  value={Math.round(stats.totals.daily.durationMs / 1000)}
                  suffix="s"
                  precision={0}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#52c41a' }}>
                  Weekly
                </div>
                <Statistic
                  title="Devices Found"
                  value={stats.totals.weekly.devicesFound}
                  precision={0}
                  style={{ marginBottom: 16 }}
                />
                <Statistic
                  title="Devices Added"
                  value={stats.totals.weekly.devicesAdded}
                  precision={0}
                  style={{ marginBottom: 16 }}
                />
                <Statistic
                  title="Duration"
                  value={Math.round(stats.totals.weekly.durationMs / 1000)}
                  suffix="s"
                  precision={0}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#fa8c16' }}>
                  Monthly
                </div>
                <Statistic
                  title="Devices Found"
                  value={stats.totals.monthly.devicesFound}
                  precision={0}
                  style={{ marginBottom: 16 }}
                />
                <Statistic
                  title="Devices Added"
                  value={stats.totals.monthly.devicesAdded}
                  precision={0}
                  style={{ marginBottom: 16 }}
                />
                <Statistic
                  title="Duration"
                  value={Math.round(stats.totals.monthly.durationMs / 1000)}
                  suffix="s"
                  precision={0}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Execution History Description */}
      <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 16 }}>
        Execution history for last 7 days
      </div>

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
                    <Space>
                      <Button
                        type="default"
                        icon={<PlayCircleOutlined />}
                        onClick={handleTriggerAllSchedules}
                        loading={triggeringAll}
                        disabled={triggeringAll || cronSchedules.filter(s => s.isActive).length === 0}
                      >
                        Run All Schedules
                      </Button>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setEditingSchedule(null);
                          scheduleForm.resetFields();
                          scheduleForm.setFieldsValue({
                            frequency: 'daily',
                            weeklyDays: [],
                            dateRangeDays: 1, // Default to "Yesterday"
                            customDateRangeDays: undefined,
                            timezone: 'UTC',
                            scheduleTime: dayjs('02:00', 'HH:mm'),
                          });
                          setShowScheduleModal(true);
                        }}
                      >
                        Create Schedule
                      </Button>
                    </Space>
                  </div>

                  <Table
                    dataSource={cronSchedules}
                    rowKey="id"
                    loading={loadingSchedules}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            <span>
                              <div style={{ marginBottom: 8 }}>No cron schedules configured</div>
                              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                                Click "Create Schedule" to set up your first automated workflow
                              </div>
                            </span>
                          }
                        />
                      ),
                    }}
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
                        render: (_, record: CronJobSchedule) => {
                          const getDateRangeLabel = (days: number) => {
                            if (days === 1) return 'Yesterday';
                            if (days === 2) return 'Last 2 Days';
                            if (days === 3) return 'Last 3 Days';
                            if (days === 7) return 'Last Week';
                            if (days === 14) return 'Last 2 Weeks';
                            if (days === 30) return 'Last Month';
                            return `Last ${days} days`;
                          };
                          
                          return (
                            <div>
                              <div><strong>Stations:</strong> {record.stations.length} selected</div>
                              <div><strong>Location:</strong> {record.location}</div>
                              <div><strong>Date Range:</strong> {getDateRangeLabel(record.dateRangeDays)}</div>
                            </div>
                          );
                        },
                      },
                      {
                        title: 'Status',
                        key: 'status',
                        width: 150,
                        render: (_, record: CronJobSchedule) => (
                          <div>
                            <Tooltip title={record.isActive ? 'Schedule is active and will run automatically' : 'Schedule is inactive and will not run'}>
                              <Switch
                                checked={record.isActive}
                                onChange={() => handleToggleSchedule(record)}
                                checkedChildren="Active"
                                unCheckedChildren="Inactive"
                                loading={loadingSchedules}
                              />
                            </Tooltip>
                            <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                              {record.nextRunAt ? (
                                <Tooltip title={`Next scheduled execution time in ${record.timezone}`}>
                                  Next: {formatDate(record.nextRunAt)}
                                </Tooltip>
                              ) : (
                                'No next run'
                              )}
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
                            <Tooltip title="Run schedule now">
                              <Button
                                type="link"
                                icon={<PlayCircleOutlined />}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handleTriggerSchedule(record.id, record.name);
                                }}
                                loading={triggeringSchedule === record.id}
                                size="small"
                                disabled={triggeringSchedule !== null || triggeringAll}
                              >
                                Run
                              </Button>
                            </Tooltip>
                            <Tooltip title="Edit schedule">
                              <Button
                                type="link"
                                icon={<EditOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent table row click
                                  setEditingSchedule(record);
                                const [hours, minutes] = record.scheduleTime.split(':');
                                
                                // Determine if dateRangeDays should be "custom" or a preset
                                const dateRangeDays = record.dateRangeDays ?? 1; // Default to 1 if undefined
                                // Valid presets: 0 (Today), 1, 2, 3, 7, 14, 30
                                const validPresets = [0, 1, 2, 3, 7, 14, 30];
                                const isCustom = !validPresets.includes(dateRangeDays);
                                
                                // Reset form first to clear any previous values
                                scheduleForm.resetFields();
                                
                                // Set all form values
                                scheduleForm.setFieldsValue({
                                  name: record.name || '',
                                  stations: record.stations || [],
                                  location: record.location || '',
                                  dateRangeDays: isCustom ? 'custom' : dateRangeDays,
                                  customDateRangeDays: isCustom ? dateRangeDays : undefined,
                                  scheduleTime: dayjs(`${hours}:${minutes}`, 'HH:mm'),
                                  timezone: record.timezone || 'UTC',
                                  frequency: record.frequency || 'daily',
                                  weeklyDays: record.weeklyDays || [],
                                  description: record.description || '',
                                });
                                setShowScheduleModal(true);
                              }}
                              size="small"
                              disabled={loadingSchedules}
                            >
                              Edit
                            </Button>
                            </Tooltip>
                            <Tooltip title="Delete schedule">
                              <Button
                                type="link"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent table row click
                                  console.log('[CronJobManagement] Delete button clicked, calling handleDeleteSchedule');
                                  handleDeleteSchedule(record);
                                }}
                                size="small"
                                disabled={loadingSchedules}
                              >
                                Delete
                              </Button>
                            </Tooltip>
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
          {
            key: 'archive',
            label: (
              <span>
                <FileTextOutlined />
                Archive
              </span>
            ),
            children: (
              <div>
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Archive</h3>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                        Executions older than 7 days (Retention: {archiveRetentionDays} days)
                      </div>
                    </div>
                    <Space>
                      <Button
                        icon={<SettingOutlined />}
                        onClick={() => setShowRetentionModal(true)}
                      >
                        Retention Settings
                      </Button>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={loadArchiveData}
                        loading={loadingArchive}
                      >
                        Refresh
                      </Button>
                    </Space>
                  </div>
                </Card>

                <Card>
                  <Table
                    columns={columns}
                    dataSource={archiveExecutions.filter(e => {
                      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
                      if (workflowFilter !== 'all' && e.workflowType !== workflowFilter) return false;
                      if (searchQuery) {
                        const query = searchQuery.toLowerCase();
                        return (
                          e.id.toLowerCase().includes(query) ||
                          e.location?.toLowerCase().includes(query) ||
                          e.stations.some(s => s.toLowerCase().includes(query))
                        );
                      }
                      return true;
                    })}
                    rowKey="id"
                    loading={loadingArchive}
                    scroll={{ x: 1200 }}
                    pagination={{
                      pageSize: 20,
                      showSizeChanger: true,
                      showTotal: (total) => `Total ${total} archived executions`,
                    }}
                    onRow={(record) => ({
                      onClick: () => {
                        setSelectedExecution(record);
                        setExecutionDevices([]);
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
            key: 'email-reports',
            label: (
              <span>
                <MailOutlined />
                Email Reports
              </span>
            ),
            children: (
              <div>
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Email Report Subscriptions</h3>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                        Manage email subscriptions for cron job execution reports
                      </div>
                    </div>
                    <Space>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={loadEmailSubscriptions}
                        loading={loadingSubscriptions}
                      >
                        Refresh
                      </Button>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                        setEditingSubscription(null);
                        subscriptionForm.resetFields();
                        subscriptionForm.setFieldsValue({
                          deliveryMode: 'immediate',
                          emailOnSuccess: true,
                          emailOnFailure: true,
                          summaryOnly: false,
                          isActive: true,
                          timezone: 'UTC',
                          scheduleIds: [],
                          emailRecipients: [],
                        });
                        setShowSubscriptionModal(true);
                      }}
                    >
                      Create Subscription
                    </Button>
                    </Space>
                  </div>

                  <Table
                    dataSource={emailSubscriptions}
                    rowKey="id"
                    loading={loadingSubscriptions}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            <span>
                              <div style={{ marginBottom: 8 }}>No email subscriptions configured</div>
                              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                                Create a subscription to receive email reports for cron job executions
                              </div>
                            </span>
                          }
                        />
                      ),
                    }}
                    columns={[
                      {
                        title: 'Name',
                        dataIndex: 'name',
                        key: 'name',
                        width: 200,
                        render: (name: string, record: EmailSubscription) => (
                          <div>
                            <div style={{ fontWeight: 500 }}>{name}</div>
                            {record.description && (
                              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                                {record.description}
                              </div>
                            )}
                          </div>
                        ),
                      },
                      {
                        title: 'Recipients',
                        dataIndex: 'emailRecipients',
                        key: 'emailRecipients',
                        width: 250,
                        render: (recipients: string[]) => (
                          <div>
                            {recipients.slice(0, 2).map((email, idx) => (
                              <Tag key={idx} style={{ marginBottom: 4 }}>{email}</Tag>
                            ))}
                            {recipients.length > 2 && (
                              <Tag>+{recipients.length - 2} more</Tag>
                            )}
                          </div>
                        ),
                      },
                      {
                        title: 'Delivery Mode',
                        dataIndex: 'deliveryMode',
                        key: 'deliveryMode',
                        width: 150,
                        render: (mode: string, record: EmailSubscription) => {
                          if (mode === 'immediate') {
                            return <Tag color="blue">Immediate</Tag>;
                          }
                          return (
                            <div>
                              <Tag color="green">Scheduled</Tag>
                              {record.scheduleTime && record.scheduleFrequency && (
                                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                                  {record.scheduleTime} ({record.scheduleFrequency})
                                </div>
                              )}
                            </div>
                          );
                        },
                      },
                      {
                        title: 'Cron Jobs',
                        dataIndex: 'scheduleIds',
                        key: 'scheduleIds',
                        width: 150,
                        render: (scheduleIds: string[]) => {
                          if (scheduleIds.length === 0) {
                            return <Tag color="default">All Schedules</Tag>;
                          }
                          return <Tag>{scheduleIds.length} schedule{scheduleIds.length !== 1 ? 's' : ''}</Tag>;
                        },
                      },
                      {
                        title: 'Status',
                        dataIndex: 'isActive',
                        key: 'isActive',
                        width: 100,
                        render: (isActive: boolean, record: EmailSubscription) => (
                          <Switch
                            checked={isActive}
                            onChange={async (checked) => {
                              const result = await emailSubscriptionService.updateSubscription(record.id, { isActive: checked });
                              if (result.success) {
                                message.success(`Subscription ${checked ? 'activated' : 'deactivated'}`);
                                loadEmailSubscriptions();
                              } else {
                                message.error(result.error || 'Failed to update subscription');
                              }
                            }}
                            checkedChildren="Active"
                            unCheckedChildren="Inactive"
                          />
                        ),
                      },
                      {
                        title: 'Actions',
                        key: 'actions',
                        width: 200,
                        fixed: 'right' as const,
                        render: (_: any, record: EmailSubscription) => (
                          <Space>
                            <Button
                              type="link"
                              icon={<SendOutlined />}
                              onClick={async () => {
                                setTestingEmail(record.id);
                                const result = await emailSubscriptionService.sendTestEmail(record.id);
                                if (result.success) {
                                  message.success('Test email sent successfully');
                                } else {
                                  message.error(result.error || 'Failed to send test email');
                                }
                                setTestingEmail(null);
                              }}
                              loading={testingEmail === record.id}
                              size="small"
                            >
                              Test
                            </Button>
                            <Button
                              type="link"
                              icon={<EditOutlined />}
                              onClick={() => {
                                setEditingSubscription(record);
                                subscriptionForm.setFieldsValue({
                                  name: record.name,
                                  description: record.description,
                                  scheduleIds: record.scheduleIds,
                                  locationFilter: record.locationFilter,
                                  emailRecipients: record.emailRecipients,
                                  deliveryMode: record.deliveryMode,
                                  scheduleTime: record.scheduleTime ? dayjs(record.scheduleTime, 'HH:mm') : undefined,
                                  scheduleFrequency: record.scheduleFrequency,
                                  scheduleDays: record.scheduleDays,
                                  timezone: record.timezone || 'UTC',
                                  emailOnSuccess: record.emailOnSuccess,
                                  emailOnFailure: record.emailOnFailure,
                                  summaryOnly: record.summaryOnly,
                                  isActive: record.isActive,
                                });
                                setShowSubscriptionModal(true);
                              }}
                              size="small"
                            >
                              Edit
                            </Button>
                            <Button
                              type="link"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => {
                                setSubscriptionToDelete(record);
                                setShowDeleteSubscriptionModal(true);
                              }}
                              size="small"
                            >
                              Delete
                            </Button>
                          </Space>
                        ),
                      },
                    ]}
                    scroll={{ x: 1000 }}
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
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: 16 }}
      />

      {/* Archive Retention Settings Modal */}
      <Modal
        title="Archive Retention Settings"
        open={showRetentionModal}
        onOk={() => {
          setShowRetentionModal(false);
          if (activeTab === 'archive') {
            loadArchiveData();
          }
        }}
        onCancel={() => setShowRetentionModal(false)}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Retention Period (Days)</div>
          <Input
            type="number"
            min={1}
            max={365}
            value={archiveRetentionDays}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (!isNaN(value) && value >= 1 && value <= 365) {
                setArchiveRetentionDays(value);
              }
            }}
            addonAfter="days"
            style={{ width: '100%' }}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
            Executions older than this period will be automatically removed from the archive.
            Default: 14 days. Range: 1-365 days.
          </div>
        </div>
      </Modal>

      {/* Trigger Workflow Modal */}
      <Modal
        title="Trigger Bulk-Add Workflow"
        open={showTriggerModal}
        onOk={(e) => {
          e?.preventDefault();
          handleTriggerWorkflow(e);
        }}
        onCancel={() => setShowTriggerModal(false)}
        confirmLoading={triggering}
        width={600}
        destroyOnClose
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

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
            <span>Delete Cron Schedule</span>
          </div>
        }
        open={showDeleteModal}
        onOk={confirmDeleteSchedule}
        onCancel={cancelDeleteSchedule}
        okText="Delete"
        okType="danger"
        cancelText="Cancel"
        confirmLoading={deletingSchedule}
        okButtonProps={{ 
          disabled: deletingSchedule,
          danger: true,
        }}
        cancelButtonProps={{ 
          disabled: deletingSchedule,
        }}
        maskClosable={!deletingSchedule}
        closable={!deletingSchedule}
        width={500}
      >
        {scheduleToDelete && (
          <div style={{ padding: '8px 0' }}>
            <Alert
              message="Warning: This action cannot be undone"
              description={
                <div>
                  <p style={{ marginBottom: 12, fontWeight: 500 }}>
                    Are you sure you want to delete the schedule <strong>"{scheduleToDelete.name}"</strong>?
                  </p>
                  <div style={{ 
                    backgroundColor: '#fafafa', 
                    padding: 12, 
                    borderRadius: 4,
                    marginTop: 12,
                    fontSize: 13,
                    color: '#666'
                  }}>
                    <div><strong>Schedule Details:</strong></div>
                    <div>• Frequency: {scheduleToDelete.frequency === 'daily' ? 'Daily' : 'Weekly'}</div>
                    <div>• Time: {scheduleToDelete.scheduleTime} ({scheduleToDelete.timezone})</div>
                    <div>• Stations: {scheduleToDelete.stations.length} selected</div>
                    <div>• Location: {scheduleToDelete.location}</div>
                    <div>• Total Runs: {scheduleToDelete.totalRuns}</div>
                  </div>
                  <p style={{ marginTop: 16, marginBottom: 0, color: '#ff4d4f', fontWeight: 500 }}>
                    All schedule data and execution history will be permanently removed.
                  </p>
                </div>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          </div>
        )}
      </Modal>

      {/* Create/Edit Cron Schedule Modal */}
      <Modal
        title={editingSchedule ? 'Edit Cron Schedule' : 'Create Cron Schedule'}
        open={showScheduleModal}
        onOk={() => scheduleForm.submit()}
        onCancel={() => {
          if (!savingSchedule) {
            setShowScheduleModal(false);
            setEditingSchedule(null);
            scheduleForm.resetFields();
            // Reset to default values after cancel
            scheduleForm.setFieldsValue({
              frequency: 'daily',
              weeklyDays: [],
              dateRangeDays: 1,
              customDateRangeDays: undefined,
              timezone: 'UTC',
              scheduleTime: dayjs('02:00', 'HH:mm'),
            });
          }
        }}
        width={700}
        okText={editingSchedule ? 'Update' : 'Create'}
        confirmLoading={savingSchedule}
        okButtonProps={{ 
          disabled: savingSchedule,
          loading: savingSchedule,
        }}
        cancelButtonProps={{ 
          disabled: savingSchedule,
        }}
        maskClosable={!savingSchedule}
        closable={!savingSchedule}
      >
        <Form
          form={scheduleForm}
          layout="vertical"
          onFinish={handleSaveSchedule}
          initialValues={{
            frequency: 'daily',
            weeklyDays: [],
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
            label="Process Data From"
            rules={[{ required: true, message: 'Please select a date range option' }]}
            tooltip="Select which date to process. Phonecheck API requires same date for from/to, with time range from 1 AM (or 00:00 for today) to the time the schedule runs."
          >
            <Select 
              placeholder="Select date range"
              onChange={(value) => {
                // Clear custom value when switching to preset
                if (value !== 'custom') {
                  scheduleForm.setFieldsValue({ 
                    dateRangeDays: value,
                    customDateRangeDays: undefined,
                  });
                } else {
                  scheduleForm.setFieldsValue({ dateRangeDays: value });
                }
              }}
            >
              <Select.Option value={0}>
                Today (from midnight to run time)
              </Select.Option>
              <Select.Option value={1}>
                Yesterday (from 1 AM to run time)
              </Select.Option>
              <Select.Option value={2}>
                2 Days Ago (from 1 AM to run time)
              </Select.Option>
              <Select.Option value={3}>
                3 Days Ago (from 1 AM to run time)
              </Select.Option>
              <Select.Option value={7}>
                7 Days Ago (from 1 AM to run time)
              </Select.Option>
              <Select.Option value={14}>
                14 Days Ago (from 1 AM to run time)
              </Select.Option>
              <Select.Option value={30}>
                30 Days Ago (from 1 AM to run time)
              </Select.Option>
              <Select.Option value="custom">
                Custom Days Ago (from 1 AM to run time)
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.dateRangeDays !== currentValues.dateRangeDays
            }
          >
            {({ getFieldValue }) => {
              const dateRangeDays = getFieldValue('dateRangeDays');
              const timezoneValue = getFieldValue('timezone') || 'UTC';
              const customDays = getFieldValue('customDateRangeDays');
              
              if (dateRangeDays === 'custom') {
                return (
                  <Form.Item
                    name="customDateRangeDays"
                    label="Custom Days Back"
                    rules={[
                      { required: true, message: 'Please enter number of days' },
                      { type: 'number', min: 1, max: 90, message: 'Must be between 1 and 90 days' }
                    ]}
                    tooltip="Enter the number of days back to process (1-90)"
                  >
                    <Input 
                      type="number" 
                      min={1} 
                      max={90}
                      placeholder="e.g., 5"
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value > 0 && value <= 90) {
                          scheduleForm.setFieldsValue({ 
                            customDateRangeDays: value,
                          });
                        } else if (e.target.value === '') {
                          // Clear the value if input is empty
                          scheduleForm.setFieldsValue({ 
                            customDateRangeDays: undefined,
                          });
                        }
                      }}
                    />
                    {customDays && !isNaN(customDays) && customDays > 0 && (
                      <div style={{ 
                        marginTop: 8, 
                        padding: '8px 12px', 
                        backgroundColor: '#e6f7ff', 
                        borderRadius: 4,
                        fontSize: 12,
                        color: '#1890ff',
                        border: '1px solid #91d5ff'
                      }}>
                        <strong>Preview:</strong> Will process{' '}
                        <strong>{dayjs().tz(timezoneValue).subtract(customDays, 'day').format('MMM D, YYYY')}</strong>
                        {' '}({customDays === 1 ? 'Yesterday' : `${customDays} days ago`})
                        <br />
                        <span style={{ fontSize: 11, color: '#666' }}>
                          Time range: 01:00 to current time when schedule runs
                        </span>
                      </div>
                    )}
                  </Form.Item>
                );
              }
              
              if (dateRangeDays && typeof dateRangeDays === 'number') {
                // Calculate and show preview
                // Phonecheck API requires same date for from/to, with time range from 1 AM (or 00:00 for today) to current time
                try {
                  const now = dayjs().tz(timezoneValue);
                  let targetDate: dayjs.Dayjs;
                  let timeRange: string;
                  
                  if (dateRangeDays === 0) {
                    targetDate = now;
                    timeRange = '00:00 to current time';
                  } else {
                    targetDate = now.subtract(dateRangeDays, 'day');
                    timeRange = '01:00 to current time';
                  }
                  
                  const dateLabel = dateRangeDays === 0 
                    ? 'Today' 
                    : dateRangeDays === 1 
                    ? 'Yesterday' 
                    : `${dateRangeDays} days ago`;
                  
                  return (
                    <div style={{ 
                      marginTop: 8, 
                      padding: '8px 12px', 
                      backgroundColor: '#e6f7ff', 
                      borderRadius: 4,
                      fontSize: 12,
                      color: '#1890ff',
                      border: '1px solid #91d5ff'
                    }}>
                      <strong>Preview:</strong> Will process <strong>{targetDate.format('MMM D, YYYY')}</strong> ({dateLabel})
                      <br />
                      <span style={{ fontSize: 11, color: '#666' }}>
                        Time range: {timeRange} when schedule runs
                      </span>
                    </div>
                  );
                } catch (error) {
                  // Fallback if timezone is invalid
                  const now = dayjs();
                  let targetDate: dayjs.Dayjs;
                  let timeRange: string;
                  
                  if (dateRangeDays === 0) {
                    targetDate = now;
                    timeRange = '00:00 to current time';
                  } else {
                    targetDate = now.subtract(dateRangeDays, 'day');
                    timeRange = '01:00 to current time';
                  }
                  
                  const dateLabel = dateRangeDays === 0 
                    ? 'Today' 
                    : dateRangeDays === 1 
                    ? 'Yesterday' 
                    : `${dateRangeDays} days ago`;
                  
                  return (
                    <div style={{ 
                      marginTop: 8, 
                      padding: '8px 12px', 
                      backgroundColor: '#e6f7ff', 
                      borderRadius: 4,
                      fontSize: 12,
                      color: '#1890ff',
                      border: '1px solid #91d5ff'
                    }}>
                      <strong>Preview:</strong> Will process <strong>{targetDate.format('MMM D, YYYY')}</strong> ({dateLabel})
                      <br />
                      <span style={{ fontSize: 11, color: '#666' }}>
                        Time range: {timeRange} when schedule runs
                      </span>
                    </div>
                  );
                }
              }
              
              return null;
            }}
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
            <div style={{ display: 'none' }}>
              <Input />
            </div>
          </Form.Item>

          <Form.Item
            label="Schedule Frequency *"
            required
            tooltip="Select 'Daily' to run every day, or select specific days of the week"
          >
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => 
                prevValues.frequency !== currentValues.frequency || 
                JSON.stringify(prevValues.weeklyDays) !== JSON.stringify(currentValues.weeklyDays)
              }
            >
              {({ getFieldValue }) => {
                const frequency = getFieldValue('frequency');
                const weeklyDays = getFieldValue('weeklyDays') || [];
                
                return (
                  <div>
                    <div style={{ marginBottom: 12 }}>
                      <Button
                        type={frequency === 'daily' ? 'primary' : 'default'}
                        onClick={() => {
                          scheduleForm.setFieldsValue({
                            frequency: 'daily',
                            weeklyDays: [],
                          });
                        }}
                        style={{
                          minWidth: 100,
                          height: 40,
                          fontWeight: 500,
                        }}
                      >
                        Daily
                      </Button>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
                        Or select specific days of the week:
                      </div>
                      <Space wrap>
                        {WEEK_DAYS.map(day => {
                          const isSelected = weeklyDays.includes(day.value);
                          
                          return (
                            <Button
                              key={day.value}
                              type={isSelected ? 'primary' : 'default'}
                              onClick={() => {
                                const currentDays = getFieldValue('weeklyDays') || [];
                                let newDays: number[];
                                
                                if (isSelected) {
                                  // Remove day
                                  newDays = currentDays.filter((d: number) => d !== day.value);
                                } else {
                                  // Add day
                                  newDays = [...currentDays, day.value].sort();
                                }
                                
                                scheduleForm.setFieldsValue({
                                  frequency: newDays.length > 0 ? 'weekly' : 'daily',
                                  weeklyDays: newDays,
                                });
                              }}
                              style={{
                                minWidth: 60,
                                height: 36,
                              }}
                            >
                              {day.label}
                            </Button>
                          );
                        })}
                      </Space>
                    </div>
                  </div>
                );
              }}
            </Form.Item>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.frequency !== currentValues.frequency || 
              JSON.stringify(prevValues.weeklyDays) !== JSON.stringify(currentValues.weeklyDays)
            }
          >
            {({ getFieldValue }) => {
              const frequency = getFieldValue('frequency');
              const weeklyDays = getFieldValue('weeklyDays') || [];
              
              if (frequency === 'weekly' && weeklyDays.length > 0) {
                return (
                  <div style={{ 
                    marginTop: -8, 
                    marginBottom: 16, 
                    padding: '8px 12px', 
                    backgroundColor: '#e6f7ff', 
                    borderRadius: 4,
                    fontSize: 12,
                    color: '#1890ff',
                    border: '1px solid #91d5ff'
                  }}>
                    <strong>Selected days:</strong> {weeklyDays.map((d: number) => WEEK_DAYS[d]?.label).join(', ')}
                  </div>
                );
              }
              
              if (frequency === 'daily') {
                return (
                  <div style={{ 
                    marginTop: -8, 
                    marginBottom: 16, 
                    padding: '8px 12px', 
                    backgroundColor: '#e6f7ff', 
                    borderRadius: 4,
                    fontSize: 12,
                    color: '#1890ff',
                    border: '1px solid #91d5ff'
                  }}>
                    <strong>Schedule will run every day</strong>
                  </div>
                );
              }
              
              return null;
            }}
          </Form.Item>

          <Form.Item
            name="weeklyDays"
            hidden
          >
            <Input />
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

      {/* Email Subscription Form Modal */}
      <Modal
        title={editingSubscription ? 'Edit Email Subscription' : 'Create Email Subscription'}
        open={showSubscriptionModal}
        onOk={handleSaveSubscription}
        onCancel={() => {
          setShowSubscriptionModal(false);
          setEditingSubscription(null);
          subscriptionForm.resetFields();
        }}
        okText={editingSubscription ? 'Update' : 'Create'}
        cancelText="Cancel"
        confirmLoading={savingSubscription}
        width={800}
        maskClosable={!savingSubscription}
        closable={!savingSubscription}
      >
        <Form
          form={subscriptionForm}
          layout="vertical"
          initialValues={{
            deliveryMode: 'immediate',
            emailOnSuccess: true,
            emailOnFailure: true,
            summaryOnly: false,
            isActive: true,
            timezone: 'UTC',
            scheduleIds: [],
            emailRecipients: [],
          }}
        >
          <Form.Item
            name="name"
            label="Subscription Name"
            rules={[{ required: true, message: 'Please enter subscription name' }]}
          >
            <Input placeholder="e.g., Daily Morning Summary" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>

          <Divider orientation="left">Cron Jobs to Monitor</Divider>

          <Form.Item
            name="scheduleIds"
            label="Select Cron Jobs"
            tooltip="Leave empty to monitor all schedules"
          >
            <Select
              mode="multiple"
              placeholder="Select cron jobs (empty = all schedules)"
              allowClear
            >
              {cronSchedules.map(schedule => (
                <Select.Option key={schedule.id} value={schedule.id}>
                  {schedule.name} ({schedule.scheduleTime})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="locationFilter"
            label="Filter by Location (Optional)"
          >
            <Select placeholder="All locations" allowClear>
              {AVAILABLE_LOCATIONS.map(loc => (
                <Select.Option key={loc} value={loc}>{loc}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Divider orientation="left">Email Recipients</Divider>

          <Form.Item
            name="emailRecipients"
            label="Email Addresses"
            rules={[
              { required: true, message: 'Please add at least one email recipient' },
              { type: 'array', min: 1, message: 'Please add at least one email recipient' },
            ]}
          >
            <Select
              mode="tags"
              placeholder="Enter email addresses and press Enter"
              tokenSeparators={[',', ' ']}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Divider orientation="left">Delivery Schedule</Divider>

          <Form.Item
            name="deliveryMode"
            label="Delivery Mode"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="immediate">Immediate (send after each execution)</Select.Option>
              <Select.Option value="scheduled">Scheduled Summary (send at specified time)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.deliveryMode !== currentValues.deliveryMode}
          >
            {({ getFieldValue }) => {
              const deliveryMode = getFieldValue('deliveryMode');
              if (deliveryMode === 'scheduled') {
                return (
                  <>
                    <Form.Item
                      name="scheduleTime"
                      label="Schedule Time"
                      rules={[{ required: true, message: 'Please select schedule time' }]}
                    >
                      <TimePicker format="HH:mm" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                      name="scheduleFrequency"
                      label="Frequency"
                      rules={[{ required: true, message: 'Please select frequency' }]}
                    >
                      <Select>
                        <Select.Option value="daily">Daily</Select.Option>
                        <Select.Option value="weekly">Weekly</Select.Option>
                        <Select.Option value="monthly">Monthly</Select.Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      noStyle
                      shouldUpdate={(prevValues, currentValues) => prevValues.scheduleFrequency !== currentValues.scheduleFrequency}
                    >
                      {({ getFieldValue }) => {
                        const frequency = getFieldValue('scheduleFrequency');
                        if (frequency === 'weekly') {
                          return (
                            <Form.Item
                              name="scheduleDays"
                              label="Days of Week"
                              rules={[{ required: true, message: 'Please select at least one day' }]}
                            >
                              <Checkbox.Group>
                                {WEEK_DAYS.map(day => (
                                  <Checkbox key={day.value} value={day.value}>
                                    {day.label}
                                  </Checkbox>
                                ))}
                              </Checkbox.Group>
                            </Form.Item>
                          );
                        }
                        return null;
                      }}
                    </Form.Item>

                    <Form.Item
                      name="timezone"
                      label="Timezone"
                    >
                      <Select>
                        <Select.Option value="UTC">UTC</Select.Option>
                        <Select.Option value="America/New_York">America/New_York (EST/EDT)</Select.Option>
                        <Select.Option value="America/Chicago">America/Chicago (CST/CDT)</Select.Option>
                        <Select.Option value="America/Denver">America/Denver (MST/MDT)</Select.Option>
                        <Select.Option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</Select.Option>
                      </Select>
                    </Form.Item>
                  </>
                );
              }
              return null;
            }}
          </Form.Item>

          <Divider orientation="left">Email Preferences</Divider>

          <Form.Item
            name="emailOnSuccess"
            valuePropName="checked"
          >
            <Checkbox>Send email on successful executions</Checkbox>
          </Form.Item>

          <Form.Item
            name="emailOnFailure"
            valuePropName="checked"
          >
            <Checkbox>Send email on failed executions</Checkbox>
          </Form.Item>

          <Form.Item
            name="summaryOnly"
            valuePropName="checked"
            tooltip="If enabled, only send aggregated summary reports, not individual execution details"
          >
            <Checkbox>Summary only (aggregated reports)</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete Subscription Confirmation Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
            <span>Delete Email Subscription</span>
          </div>
        }
        open={showDeleteSubscriptionModal}
        onOk={confirmDeleteSubscription}
        onCancel={cancelDeleteSubscription}
        okText="Delete"
        okType="danger"
        cancelText="Cancel"
        confirmLoading={deletingSubscription}
        okButtonProps={{ 
          disabled: deletingSubscription,
          danger: true,
        }}
        cancelButtonProps={{ 
          disabled: deletingSubscription,
        }}
        maskClosable={!deletingSubscription}
        closable={!deletingSubscription}
        width={500}
      >
        {subscriptionToDelete && (
          <div style={{ padding: '8px 0' }}>
            <Alert
              message="Warning: This action cannot be undone"
              description={
                <div>
                  <p style={{ marginBottom: 12, fontWeight: 500 }}>
                    Are you sure you want to delete the subscription <strong>"{subscriptionToDelete.name}"</strong>?
                  </p>
                  <div style={{ 
                    backgroundColor: '#fafafa', 
                    padding: 12, 
                    borderRadius: 4,
                    marginTop: 12,
                    fontSize: 13,
                    color: '#666'
                  }}>
                    <div><strong>Subscription Details:</strong></div>
                    <div>• Recipients: {subscriptionToDelete.emailRecipients.length} email(s)</div>
                    <div>• Delivery: {subscriptionToDelete.deliveryMode === 'immediate' ? 'Immediate' : 'Scheduled'}</div>
                    {subscriptionToDelete.scheduleIds.length > 0 && (
                      <div>• Cron Jobs: {subscriptionToDelete.scheduleIds.length} selected</div>
                    )}
                    {subscriptionToDelete.scheduleIds.length === 0 && (
                      <div>• Cron Jobs: All schedules</div>
                    )}
                  </div>
                  <p style={{ marginTop: 16, marginBottom: 0, color: '#ff4d4f', fontWeight: 500 }}>
                    This subscription will stop receiving email reports immediately.
                  </p>
                </div>
              }
              type="warning"
              showIcon
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
