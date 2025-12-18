import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '../components/ui/Spinner';
import { edgeFunctions } from '../services/edgeFunctions';
import { useToastStore } from '../stores/toastStore';
import { api } from '../services/api';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import { 
  TrendingUp, 
  Package, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw,
  Plus,
  Layers,
  Search,
  Activity,
  Database,
  Zap,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

interface DashboardStats {
  totalItems: number;
  workingItems: number;
  failedItems: number;
  pendingItems: number;
  lastHour: number;
  lastDay: number;
}

export const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    loadDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);
      setLoading(true);
      
      // Try Edge Function first (faster)
      try {
        const response = await edgeFunctions.getInventoryStats();
        
        if (response.success && response.data) {
          const data = response.data;
          setStats({
            totalItems: data.total_items || 0,
            workingItems: data.working_items || 0,
            failedItems: data.failed_items || 0,
            pendingItems: data.pending_items || 0,
            lastHour: data.last_hour || 0,
            lastDay: data.last_day || 0,
          });
          setLoading(false);
          return;
        }
      } catch (edgeError: any) {
        // Fallback to Express API
        console.debug('Edge Function failed, using Express API:', edgeError);
      }
      
      // Fallback to Express API
      try {
        const response = await api.get('/admin/inventory-stats');
        if (response.data && response.data.success) {
          const data = response.data.data;
          setStats({
            totalItems: data.total_items || 0,
            workingItems: data.working_items || 0,
            failedItems: data.failed_items || 0,
            pendingItems: data.pending_items || 0,
            lastHour: data.last_hour || 0,
            lastDay: data.last_day || 0,
          });
        }
      } catch (apiError: any) {
        if (apiError.response?.status !== 404) {
          throw apiError;
        }
        // 404 is handled below
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load dashboard data';
      setError(errorMessage);
      console.error('Failed to load dashboard data:', err);
      addToast('Failed to load dashboard data. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center space-y-4">
          <Spinner size="lg" />
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to Load Dashboard</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadDashboardData} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const workingPercentage = stats ? Math.round((stats.workingItems / stats.totalItems) * 100) : 0;
  const failedPercentage = stats ? Math.round((stats.failedItems / stats.totalItems) * 100) : 0;
  const pendingPercentage = stats ? Math.round((stats.pendingItems / stats.totalItems) * 100) : 0;

  // Chart data
  const doughnutData = {
    labels: ['Working', 'Pending', 'Failed'],
    datasets: [
      {
        data: [stats?.workingItems || 0, stats?.pendingItems || 0, stats?.failedItems || 0],
        backgroundColor: [
          'rgb(34, 197, 94)', // green-500
          'rgb(251, 191, 36)', // amber-400
          'rgb(239, 68, 68)', // red-500
        ],
        borderWidth: 0,
      },
    ],
  };

  const barData = {
    labels: ['Last Hour', 'Last 24 Hours'],
    datasets: [
      {
        label: 'Items Added',
        data: [stats?.lastHour || 0, stats?.lastDay || 0],
        backgroundColor: 'rgb(59, 130, 246)', // blue-500
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          usePointStyle: true,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 13,
        },
      },
    },
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time inventory overview and analytics
          </p>
        </div>
        <Button
          onClick={loadDashboardData}
          disabled={loading}
          variant="outline"
          size="lg"
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Items */}
        <Card className="relative overflow-hidden border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Items
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalItems.toLocaleString() || 0}</div>
            {stats && stats.lastDay > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600 font-medium">+{stats.lastDay}</span> in last 24h
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Working Items */}
        <Card className="relative overflow-hidden border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Working
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats?.workingItems.toLocaleString() || 0}
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{workingPercentage}% of total</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${workingPercentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Failed Items */}
        <Card className="relative overflow-hidden border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {stats?.failedItems.toLocaleString() || 0}
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{failedPercentage}% of total</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-500"
                  style={{ width: `${failedPercentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Items */}
        <Card className="relative overflow-hidden border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {stats?.pendingItems.toLocaleString() || 0}
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{pendingPercentage}% of total</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${pendingPercentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Distribution */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Status Distribution
            </CardTitle>
            <CardDescription>Current inventory status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] flex items-center justify-center">
              {stats && (stats.workingItems > 0 || stats.pendingItems > 0 || stats.failedItems > 0) ? (
                <Doughnut data={doughnutData} options={chartOptions} />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity Chart */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>Items added in the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] flex items-center justify-center">
              {stats && (stats.lastHour > 0 || stats.lastDay > 0) ? (
                <Bar data={barData} options={chartOptions} />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & System Status */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Actions */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common operations and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-between h-auto py-3" asChild>
              <Link to="/single-add">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                    <Plus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Add Single Item</div>
                    <div className="text-xs text-muted-foreground">Add a new device to inventory</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-between h-auto py-3" asChild>
              <Link to="/bulk-add">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <Layers className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Bulk Add Items</div>
                    <div className="text-xs text-muted-foreground">Add multiple devices at once</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-between h-auto py-3" asChild>
              <Link to="/inventory">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                    <Search className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">View Inventory</div>
                    <div className="text-xs text-muted-foreground">Browse and manage all items</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              System Status
            </CardTitle>
            <CardDescription>Current system health and connectivity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium">Database Connection</span>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                Active
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium">Edge Functions</span>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                Available
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-sm font-medium">API Endpoints</span>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                Operational
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
