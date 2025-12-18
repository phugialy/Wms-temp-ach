import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Modal } from '@/components/ui/Modal';
import { useToastStore } from '../stores/toastStore';

interface CronJobExecution {
  id: string;
  workflowType: string;
  triggerSource: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stations: string[];
  dateFrom: string;
  dateTo: string;
  location: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  devicesFound: number;
  devicesProcessed: number;
  devicesAdded: number;
  devicesFailed: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  averages: {
    devicesFound: number;
    devicesAdded: number;
    durationMs: number;
  };
}

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

const CRON_SCHEDULE = '0 2 * * *'; // Daily at 2 AM UTC (from vercel.json)

export const CronJobManagement = () => {
  const [executions, setExecutions] = useState<CronJobExecution[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<CronJobExecution | null>(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Manual trigger form states
  const [triggerForm, setTriggerForm] = useState({
    stations: [] as string[],
    dateFrom: '',
    dateTo: '',
    location: '',
  });
  const [triggering, setTriggering] = useState(false);
  
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    loadData();
    // Refresh every 10 seconds to keep data up to date
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Set default dates for trigger form
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    setTriggerForm(prev => ({
      ...prev,
      dateFrom: yesterday.toISOString().split('T')[0],
      dateTo: today.toISOString().split('T')[0],
    }));
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [executionsRes, statsRes] = await Promise.all([
        fetch('/api/workflows/executions?limit=100'),
        fetch('/api/workflows/stats')
      ]);

      if (executionsRes.ok) {
        const executionsData = await executionsRes.json();
        if (executionsData.success) {
          setExecutions(executionsData.data || []);
        } else {
          console.error('API returned error:', executionsData.error);
          addToast(executionsData.error || 'Failed to load executions', 'error');
        }
      } else {
        const errorData = await executionsRes.json().catch(() => ({}));
        console.error('Failed to load executions:', errorData);
        addToast(errorData.error || 'Failed to load executions', 'error');
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.data);
        } else {
          console.error('API returned error:', statsData.error);
          addToast(statsData.error || 'Failed to load stats', 'error');
        }
      } else {
        const errorData = await statsRes.json().catch(() => ({}));
        console.error('Failed to load stats:', errorData);
        addToast(errorData.error || 'Failed to load stats', 'error');
      }
    } catch (error) {
      console.error('Error loading cron job data:', error);
      addToast('Failed to load cron job data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleManualTrigger = async () => {
    if (!triggerForm.stations.length || !triggerForm.dateFrom || !triggerForm.dateTo || !triggerForm.location) {
      addToast('Please fill in all required fields', 'error');
      return;
    }

    setTriggering(true);
    try {
      const response = await fetch('/api/workflows/bulk-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stations: triggerForm.stations,
          dateFrom: triggerForm.dateFrom,
          dateTo: triggerForm.dateTo,
          location: triggerForm.location,
          triggerSource: 'manual'
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        addToast(`Workflow triggered successfully! Execution ID: ${result.executionId}`, 'success');
        setShowTriggerModal(false);
        setTriggerForm({
          stations: [],
          dateFrom: '',
          dateTo: '',
          location: '',
        });
        // Reload data after a short delay
        setTimeout(loadData, 2000);
      } else {
        addToast(result.error || 'Failed to trigger workflow', 'error');
      }
    } catch (error) {
      console.error('Error triggering workflow:', error);
      addToast('Failed to trigger workflow', 'error');
    } finally {
      setTriggering(false);
    }
  };

  const handleRetryExecution = async (execution: CronJobExecution) => {
    if (!confirm(`Retry this workflow execution with the same parameters?`)) {
      return;
    }

    setTriggering(true);
    try {
      const response = await fetch('/api/workflows/bulk-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stations: execution.stations,
          dateFrom: execution.dateFrom,
          dateTo: execution.dateTo,
          location: execution.location || '',
          triggerSource: 'manual-retry'
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        addToast(`Workflow retried successfully! New Execution ID: ${result.executionId}`, 'success');
        setTimeout(loadData, 2000);
      } else {
        addToast(result.error || 'Failed to retry workflow', 'error');
      }
    } catch (error) {
      console.error('Error retrying workflow:', error);
      addToast('Failed to retry workflow', 'error');
    } finally {
      setTriggering(false);
    }
  };

  const toggleStation = (station: string) => {
    setTriggerForm(prev => ({
      ...prev,
      stations: prev.stations.includes(station)
        ? prev.stations.filter(s => s !== station)
        : [...prev.stations, station]
    }));
  };

  const getFilteredExecutions = () => {
    let filtered = [...executions];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }

    // Workflow filter
    if (workflowFilter !== 'all') {
      filtered = filtered.filter(e => e.workflowType === workflowFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.id.toLowerCase().includes(query) ||
        e.workflowType.toLowerCase().includes(query) ||
        e.triggerSource.toLowerCase().includes(query) ||
        e.location?.toLowerCase().includes(query) ||
        e.stations.some(s => s.toLowerCase().includes(query))
      );
    }

    return filtered;
  };

  const getNextRunTime = () => {
    // Parse cron schedule: "0 2 * * *" = Daily at 2 AM UTC
    // This is a simplified calculation - in production, use a proper cron parser
    const now = new Date();
    const nextRun = new Date();
    nextRun.setUTCHours(2, 0, 0, 0);
    
    if (nextRun <= now) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }
    
    return nextRun;
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      running: 'secondary',
      failed: 'destructive',
      pending: 'outline'
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const filteredExecutions = getFilteredExecutions();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cron Job Management</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage automated workflow executions
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="default" 
            onClick={() => setShowTriggerModal(true)}
            disabled={triggering}
          >
            <i className="fas fa-play mr-2"></i>
            Manual Trigger
          </Button>
          <Button onClick={loadData} disabled={loading} variant="outline">
            <i className={`fas fa-sync-alt mr-2 ${loading ? 'animate-spin' : ''}`}></i>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Schedule Information */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule Configuration</CardTitle>
          <CardDescription>Current cron job schedule settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Schedule</div>
              <div className="text-lg font-mono font-semibold">{CRON_SCHEDULE}</div>
              <div className="text-xs text-muted-foreground mt-1">Daily at 2 AM UTC</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Next Run</div>
              <div className="text-lg font-semibold">
                {getNextRunTime().toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Workflow Type</div>
              <div className="text-lg font-semibold">bulk-add</div>
              <div className="text-xs text-muted-foreground mt-1">Bulk device import workflow</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Executions</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Failed</CardDescription>
              <CardTitle className="text-2xl text-red-600">{stats.failed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Running</CardDescription>
              <CardTitle className="text-2xl text-blue-600">{stats.running}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-2xl text-gray-600">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Average Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Average Devices Found</CardTitle>
              <CardDescription>Per execution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averages.devicesFound}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Average Devices Added</CardTitle>
              <CardDescription>Per execution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averages.devicesAdded}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Average Duration</CardTitle>
              <CardDescription>Per execution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(stats.averages.durationMs)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
          <CardDescription>Filter and search workflow executions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Workflow Type</label>
              <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workflows</SelectItem>
                  <SelectItem value="bulk-add">Bulk Add</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <Input
                placeholder="Search by ID, workflow, location, or station..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Showing {filteredExecutions.length} of {executions.length} executions
          </div>
        </CardContent>
      </Card>

      {/* Executions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Executions</CardTitle>
          <CardDescription>Workflow execution history and details</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
              <div className="mt-2 text-muted-foreground">Loading...</div>
            </div>
          ) : filteredExecutions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {executions.length === 0 ? 'No executions found' : 'No executions match your filters'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stations</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExecutions.map((execution) => (
                    <TableRow key={execution.id} className={execution.status === 'running' ? 'bg-blue-50' : ''}>
                      <TableCell className="font-mono text-xs">
                        {execution.id.slice(-8)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{execution.workflowType}</div>
                        <div className="text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {execution.triggerSource}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(execution.status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {execution.stations.slice(0, 2).map((station, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {station}
                            </Badge>
                          ))}
                          {execution.stations.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{execution.stations.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(execution.dateFrom).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          to {new Date(execution.dateTo).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>{execution.location || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div>Found: <strong>{execution.devicesFound}</strong></div>
                          <div className="text-green-600">Added: <strong>{execution.devicesAdded}</strong></div>
                          {execution.devicesFailed > 0 && (
                            <div className="text-red-600">Failed: <strong>{execution.devicesFailed}</strong></div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {execution.status === 'running' ? (
                          <div className="flex items-center gap-2">
                            <i className="fas fa-spinner fa-spin text-blue-600"></i>
                            <span>{formatDuration(execution.durationMs)}</span>
                          </div>
                        ) : (
                          formatDuration(execution.durationMs)
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(execution.startedAt)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(execution.completedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedExecution(execution);
                              setShowDetailsModal(true);
                            }}
                          >
                            <i className="fas fa-eye mr-1"></i>
                            View
                          </Button>
                          {execution.status === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetryExecution(execution)}
                              disabled={triggering}
                            >
                              <i className="fas fa-redo mr-1"></i>
                              Retry
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Trigger Modal */}
      <Modal
        isOpen={showTriggerModal}
        onClose={() => setShowTriggerModal(false)}
        title="Manually Trigger Workflow"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Stations *</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
              {AVAILABLE_STATIONS.map(station => (
                <label key={station} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={triggerForm.stations.includes(station)}
                    onChange={() => toggleStation(station)}
                    className="rounded"
                  />
                  <span className="text-sm">{station}</span>
                </label>
              ))}
            </div>
            {triggerForm.stations.length > 0 && (
              <div className="mt-2 text-sm text-muted-foreground">
                Selected: {triggerForm.stations.join(', ')}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Date From *</label>
              <Input
                type="date"
                value={triggerForm.dateFrom}
                onChange={(e) => setTriggerForm(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date To *</label>
              <Input
                type="date"
                value={triggerForm.dateTo}
                onChange={(e) => setTriggerForm(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Location *</label>
            <Select
              value={triggerForm.location}
              onValueChange={(value) => setTriggerForm(prev => ({ ...prev, location: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_LOCATIONS.map(location => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowTriggerModal(false)}
              disabled={triggering}
            >
              Cancel
            </Button>
            <Button
              onClick={handleManualTrigger}
              disabled={triggering || !triggerForm.stations.length || !triggerForm.dateFrom || !triggerForm.dateTo || !triggerForm.location}
            >
              {triggering ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Triggering...
                </>
              ) : (
                <>
                  <i className="fas fa-play mr-2"></i>
                  Trigger Workflow
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Execution Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedExecution(null);
        }}
        title="Execution Details"
        size="xl"
      >
        {selectedExecution && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Workflow Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Execution ID:</span>
                  <div className="font-mono font-semibold">{selectedExecution.id}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <div className="font-semibold">{selectedExecution.workflowType}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Trigger Source:</span>
                  <div>
                    <Badge variant="outline">{selectedExecution.triggerSource}</Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div>{getStatusBadge(selectedExecution.status)}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Location:</span>
                  <div className="font-semibold">{selectedExecution.location || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Stations</h3>
              <div className="flex flex-wrap gap-2">
                {selectedExecution.stations.map((station, idx) => (
                  <Badge key={idx} variant="outline" className="text-sm">
                    {station}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Date Range</h3>
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">From:</span>{' '}
                  <strong>{new Date(selectedExecution.dateFrom).toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">To:</span>{' '}
                  <strong>{new Date(selectedExecution.dateTo).toLocaleString()}</strong>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Execution Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 rounded-md">
                  <div className="text-xs text-muted-foreground">Devices Found</div>
                  <div className="text-2xl font-bold">{selectedExecution.devicesFound}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-md">
                  <div className="text-xs text-muted-foreground">Devices Processed</div>
                  <div className="text-2xl font-bold">{selectedExecution.devicesProcessed}</div>
                </div>
                <div className="p-3 bg-green-50 rounded-md">
                  <div className="text-xs text-muted-foreground">Devices Added</div>
                  <div className="text-2xl font-bold text-green-600">{selectedExecution.devicesAdded}</div>
                </div>
                {selectedExecution.devicesFailed > 0 && (
                  <div className="p-3 bg-red-50 rounded-md">
                    <div className="text-xs text-muted-foreground">Devices Failed</div>
                    <div className="text-2xl font-bold text-red-600">{selectedExecution.devicesFailed}</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Timing Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <div className="font-semibold">{formatDuration(selectedExecution.durationMs)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <div>{formatDate(selectedExecution.createdAt)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Started:</span>
                  <div>{formatDate(selectedExecution.startedAt)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed:</span>
                  <div>{formatDate(selectedExecution.completedAt)}</div>
                </div>
              </div>
            </div>

            {selectedExecution.errorMessage && (
              <div>
                <h3 className="font-semibold mb-3 text-red-600">Error Details</h3>
                <div className="text-sm text-red-600 bg-red-50 p-4 rounded-md border border-red-200">
                  <div className="font-semibold mb-2">Error Message:</div>
                  <div className="whitespace-pre-wrap">{selectedExecution.errorMessage}</div>
                </div>
              </div>
            )}

            {selectedExecution.status === 'failed' && (
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={() => {
                    handleRetryExecution(selectedExecution);
                    setShowDetailsModal(false);
                  }}
                  disabled={triggering}
                >
                  {triggering ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Retrying...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-redo mr-2"></i>
                      Retry This Execution
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

