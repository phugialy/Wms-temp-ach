import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

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

export const CronJobManagement = () => {
  const [executions, setExecutions] = useState<CronJobExecution[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<CronJobExecution | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [executionsRes, statsRes] = await Promise.all([
        fetch('/api/workflows/executions?limit=50'),
        fetch('/api/workflows/stats')
      ]);

      if (executionsRes.ok) {
        const executionsData = await executionsRes.json();
        setExecutions(executionsData.data || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Error loading cron job data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cron job data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cron Job Management</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage automated workflow executions
          </p>
        </div>
        <Button onClick={loadData} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

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

      {/* Executions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Executions</CardTitle>
          <CardDescription>Workflow execution history</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : executions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No executions found</div>
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
                  {executions.map((execution) => (
                    <TableRow key={execution.id}>
                      <TableCell className="font-mono text-xs">
                        {execution.id.slice(-8)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{execution.workflowType}</div>
                        <div className="text-xs text-muted-foreground">
                          {execution.triggerSource}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(execution.status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
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
                        <div className="text-sm">
                          <div>Found: {execution.devicesFound}</div>
                          <div className="text-green-600">Added: {execution.devicesAdded}</div>
                          {execution.devicesFailed > 0 && (
                            <div className="text-red-600">Failed: {execution.devicesFailed}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatDuration(execution.durationMs)}</TableCell>
                      <TableCell className="text-xs">
                        {formatDate(execution.startedAt)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(execution.completedAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedExecution(execution)}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution Details Modal */}
      {selectedExecution && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Execution Details</CardTitle>
                  <CardDescription>ID: {selectedExecution.id}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedExecution(null)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Workflow Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span> {selectedExecution.workflowType}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Trigger:</span> {selectedExecution.triggerSource}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span> {getStatusBadge(selectedExecution.status)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span> {selectedExecution.location || 'N/A'}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Stations</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedExecution.stations.map((station, idx) => (
                    <Badge key={idx} variant="outline">
                      {station}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Date Range</h3>
                <div className="text-sm">
                  <div>From: {new Date(selectedExecution.dateFrom).toLocaleString()}</div>
                  <div>To: {new Date(selectedExecution.dateTo).toLocaleString()}</div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Results</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Devices Found: <strong>{selectedExecution.devicesFound}</strong></div>
                  <div>Devices Processed: <strong>{selectedExecution.devicesProcessed}</strong></div>
                  <div className="text-green-600">Devices Added: <strong>{selectedExecution.devicesAdded}</strong></div>
                  {selectedExecution.devicesFailed > 0 && (
                    <div className="text-red-600">Devices Failed: <strong>{selectedExecution.devicesFailed}</strong></div>
                  )}
                  <div>Duration: <strong>{formatDuration(selectedExecution.durationMs)}</strong></div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Timestamps</h3>
                <div className="text-sm space-y-1">
                  <div>Created: {formatDate(selectedExecution.createdAt)}</div>
                  <div>Started: {formatDate(selectedExecution.startedAt)}</div>
                  <div>Completed: {formatDate(selectedExecution.completedAt)}</div>
                </div>
              </div>

              {selectedExecution.errorMessage && (
                <div>
                  <h3 className="font-semibold mb-2 text-red-600">Error</h3>
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                    {selectedExecution.errorMessage}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

