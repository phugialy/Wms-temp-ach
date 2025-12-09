import { useState, useEffect, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Modal } from '../components/ui/Modal';
import { WorkingStatusBadge } from '../components/ui/WorkingStatusBadge';
import { useToastStore } from '../stores/toastStore';
import { api } from '../services/api';
import { edgeFunctions } from '../services/edgeFunctions';

interface InventoryItem {
  imei: string; // Primary identifier
  id?: string; // Fallback if available
  name?: string;
  device_name?: string; // From inventory_view
  brand?: string;
  model?: string;
  serialNumber?: string;
  storage?: string;
  capacity?: string;
  color?: string;
  carrier?: string;
  working?: string;
  working_status?: string; // From inventory_view
  workingStatus?: string; // Alias
  condition?: string;
  battery_health?: string | number; // From inventory_view
  batteryHealth?: string | number; // Alias
  location?: string;
  defects?: string;
  notes?: string;
  repair_notes?: string; // From inventory_view
  custom1?: string;
  created_at?: string;
  updated_at?: string;
}

interface Statistics {
  total: number;
  brands: Record<string, number>;
  carriers: Record<string, number>;
  conditions: Record<string, number>;
  workingStatus: {
    YES: number;
    NO: number;
    PENDING: number;
    [key: string]: number;
  };
  phonecheckData: {
    withDefects: number;
    withNotes: number;
    withCustom1: number;
  };
}

export const Inventory = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterCarrier, setFilterCarrier] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterWorkingStatus, setFilterWorkingStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  
  const [stats, setStats] = useState<Statistics>({
    total: 0,
    brands: {},
    carriers: {},
    conditions: {},
    workingStatus: {
      YES: 0,
      NO: 0,
      PENDING: 0,
    },
    phonecheckData: {
      withDefects: 0,
      withNotes: 0,
      withCustom1: 0,
    },
  });

  const addToast = useToastStore((state) => state.addToast);

  // Load statistics from Edge Function (with Express fallback)
  const loadStats = async () => {
    try {
      // Try Edge Function first
      const response = await edgeFunctions.getInventoryStats();
      
      if (response.success && response.data) {
        const apiStats = response.data;
        setStats({
          total: apiStats.total_items || 0,
          brands: {}, // Will be calculated from current page data
          carriers: {}, // Will be calculated from current page data
          conditions: {}, // Will be calculated from current page data
          workingStatus: {
            YES: apiStats.working_items || 0,
            NO: apiStats.failed_items || 0,
            PENDING: apiStats.pending_items || 0,
          },
          phonecheckData: {
            withDefects: 0, // Not available from stats endpoint
            withNotes: 0,
            withCustom1: 0,
          },
        });
        setTotalItems(apiStats.total_items || 0);
      }
    } catch (error: any) {
      // Fallback to Express API if Edge Function fails
      try {
        const fallbackResponse = await api.get<{ success: boolean; stats?: any }>('/inventory/stats');
        if (fallbackResponse.data && fallbackResponse.data.success && fallbackResponse.data.stats) {
          const apiStats = fallbackResponse.data.stats;
          setStats({
            total: apiStats.totalItems || 0,
            brands: {},
            carriers: {},
            conditions: {},
            workingStatus: {
              YES: apiStats.passedTests || 0,
              NO: apiStats.failedTests || 0,
              PENDING: apiStats.pendingTests || 0,
            },
            phonecheckData: {
              withDefects: 0,
              withNotes: 0,
              withCustom1: 0,
            },
          });
          setTotalItems(apiStats.totalItems || 0);
        }
      } catch (fallbackError: any) {
        if (fallbackError.response?.status !== 404) {
          console.error('Error loading stats (both Edge Function and Express failed):', fallbackError);
        }
      }
    }
  };

  // Load paginated inventory data
  const loadInventoryPage = async (page: number, limit: number) => {
    try {
      setLoading(true);
      const offset = (page - 1) * limit;
      
      // Build query params
      const params: any = {
        limit: limit.toString(),
        offset: offset.toString(),
      };
      
      // Add search if provided
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      // Add filters if provided
      const filter: any = {};
      if (filterWorkingStatus) {
        filter.working = filterWorkingStatus;
      }
      if (filterBrand || filterCarrier || filterCondition || filterDate) {
        // Note: These filters need to be handled server-side
        // For now, we'll do client-side filtering on the paginated results
        // TODO: Add server-side filter support in API
      }
      
      if (Object.keys(filter).length > 0) {
        params.filter = JSON.stringify(filter);
      }
      
      // Try Edge Function first
      let response: any;
      try {
        const edgeResponse = await edgeFunctions.getInventoryPage(limit, offset, searchTerm);
        if (edgeResponse.success) {
          response = {
            data: {
              success: true,
              data: edgeResponse.data || [],
              pagination: edgeResponse.pagination,
            },
          };
        } else {
          throw new Error('Edge Function returned unsuccessful response');
        }
      } catch (edgeError) {
        // Fallback to Express API
        console.warn('Edge Function failed, using Express API:', edgeError);
        response = await api.get<{
          success: boolean;
          data?: InventoryItem[];
          pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
        }>('/inventory', { params });
      }
      
      if (response.data && response.data.success) {
        const data = response.data.data || [];
        setInventory(data);
        
        if (response.data.pagination) {
          setTotalItems(response.data.pagination.total);
        }
        
        // Calculate stats from current page (for brand/carrier/condition breakdowns)
        calculatePageStats(data);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Error fetching inventory:', error);
      }
      addToast(error.message || 'Failed to load inventory data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics from current page data (for filter dropdowns)
  const calculatePageStats = (data: InventoryItem[]) => {
    const pageStats = {
      brands: {} as Record<string, number>,
      carriers: {} as Record<string, number>,
      conditions: {} as Record<string, number>,
    };

    data.forEach((item) => {
      const brand = item.brand || 'Unknown';
      pageStats.brands[brand] = (pageStats.brands[brand] || 0) + 1;

      const carrier = item.carrier || 'Unknown';
      pageStats.carriers[carrier] = (pageStats.carriers[carrier] || 0) + 1;

      const condition = item.condition || 'Unknown';
      pageStats.conditions[condition] = (pageStats.conditions[condition] || 0) + 1;
    });

    // Merge with existing stats (keep totals from API)
    setStats((prev) => ({
      ...prev,
      brands: { ...prev.brands, ...pageStats.brands },
      carriers: { ...prev.carriers, ...pageStats.carriers },
      conditions: { ...prev.conditions, ...pageStats.conditions },
    }));
  };

  // Filter and sort inventory (client-side on current page)
  // Note: Search is handled server-side via API, but other filters are client-side for now
  const filteredInventory = useMemo(() => {
    let filtered = [...inventory];

    // Brand filter (client-side)
    if (filterBrand) {
      filtered = filtered.filter((item) => item.brand === filterBrand);
    }

    // Carrier filter (client-side)
    if (filterCarrier) {
      filtered = filtered.filter((item) => item.carrier === filterCarrier);
    }

    // Condition filter (client-side)
    if (filterCondition) {
      filtered = filtered.filter((item) => item.condition === filterCondition);
    }

    // Working status filter (client-side, but also sent to API)
    if (filterWorkingStatus) {
      filtered = filtered.filter((item) => {
        const working = (item.working || item.working_status || item.workingStatus || '').toUpperCase();
        return working === filterWorkingStatus.toUpperCase();
      });
    }

    // Date filter (client-side)
    if (filterDate && filterDate.trim()) {
      const selectedDateStr = filterDate.trim();
      filtered = filtered.filter((item) => {
        const itemDateStr = item.updated_at || item.created_at;
        if (!itemDateStr || typeof itemDateStr !== 'string') return false;
        const itemDateOnly = itemDateStr.split('T')[0];
        return itemDateOnly === selectedDateStr;
      });
    }

    // Sort (client-side)
    filtered.sort((a, b) => {
      let aVal: any = a[sortBy as keyof InventoryItem];
      let bVal: any = b[sortBy as keyof InventoryItem];

      if (sortBy === 'created_at' || sortBy === 'updated_at') {
        aVal = aVal || '';
        bVal = bVal || '';
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [inventory, filterBrand, filterCarrier, filterCondition, filterWorkingStatus, filterDate, sortBy, sortOrder]);
  
  // Reload inventory when search/filters change (reset to page 1)
  useEffect(() => {
    // Reset to page 1 when filters change and reload
    setCurrentPage(1);
    loadInventoryPage(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterWorkingStatus]); // Only reload on search and working status (server-side filters)
  
  // Reload when page or pageSize changes
  useEffect(() => {
    if (currentPage > 0 && pageSize > 0) {
      loadInventoryPage(currentPage, pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  // Get unique values for filters (from current page + accumulated stats)
  const uniqueBrands = useMemo(() => {
    const pageBrands = [...new Set(inventory.map((item) => item.brand).filter(Boolean))];
    const statsBrands = Object.keys(stats.brands);
    return [...new Set([...pageBrands, ...statsBrands])].sort();
  }, [inventory, stats.brands]);
  
  const uniqueCarriers = useMemo(() => {
    const pageCarriers = [...new Set(inventory.map((item) => item.carrier).filter(Boolean))];
    const statsCarriers = Object.keys(stats.carriers);
    return [...new Set([...pageCarriers, ...statsCarriers])].sort();
  }, [inventory, stats.carriers]);
  
  const uniqueConditions = useMemo(() => {
    const pageConditions = [...new Set(inventory.map((item) => item.condition).filter(Boolean))];
    const statsConditions = Object.keys(stats.conditions);
    return [...new Set([...pageConditions, ...statsConditions])].sort();
  }, [inventory, stats.conditions]);

  // Handle item selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  };

  const selectAll = () => {
    const filteredIds = filteredInventory.map((item) => item.imei || item.id || '');
    setSelectedItems(filteredIds);
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  // Delete items
  const deleteItems = async () => {
    try {
      // TODO: Implement bulk delete API
      addToast('Bulk delete functionality coming soon', 'info');
      setShowDeleteModal(false);
      setSelectedItems([]);
    } catch (error: any) {
      addToast(error.message || 'Failed to delete items', 'error');
    }
  };

  // Edit item
  const handleEdit = (item: InventoryItem) => {
    setEditingItem({ ...item });
    setShowEditModal(true);
  };

  // Delete single item
  const handleDelete = (itemId: string) => {
    setSelectedItems([itemId]);
    setShowDeleteModal(true);
  };

  // Update item
  const updateItem = async (itemData: InventoryItem) => {
    const itemId = itemData.imei || itemData.id;
    if (!itemId) {
      addToast('Item ID is required', 'error');
      return;
    }

    try {
      // Try admin inventory update endpoint first, fallback to regular inventory update
      let response;
      try {
        response = await api.put(`/admin/inventory/${itemId}`, itemData);
      } catch {
        // Fallback to regular inventory endpoint
        response = await api.put(`/inventory/${itemId}`, itemData);
      }
      
      // Check if response has success field (ApiResponse) or is direct data
      if (response.data && typeof response.data === 'object' && 'success' in response.data) {
        const apiResponse = response.data as any;
        if (apiResponse.success) {
          addToast('Item updated successfully', 'success');
          setShowEditModal(false);
          setEditingItem(null);
          // Reload current page
          loadInventoryPage(currentPage, pageSize);
        } else {
          addToast(apiResponse.error || 'Failed to update item', 'error');
        }
      } else {
        // Direct success
        addToast('Item updated successfully', 'success');
        setShowEditModal(false);
        setEditingItem(null);
        // Reload current page
        loadInventoryPage(currentPage, pageSize);
      }
    } catch (error: any) {
      addToast(error.response?.data?.error || error.message || 'Failed to update item', 'error');
    }
  };

  // Export to CSV (current page or all filtered items)
  const exportToCSV = async () => {
    try {
      // For now, export current page. TODO: Add "Export All" option that fetches all filtered items
      const headers = [
        'ID',
        'Name',
        'Brand',
        'Model',
        'Storage',
        'Color',
        'Carrier',
        'IMEI',
        'Serial Number',
        'Working Status',
        'Condition',
        'Battery Health',
        'Location',
        'Last Updated',
      ];

      const csvContent = [
        headers.join(','),
        ...filteredInventory.map((item) =>
          [
            item.imei || item.id || '',
            `"${item.name || item.device_name || ''}"`,
            `"${item.brand || ''}"`,
            `"${item.model || ''}"`,
            `"${item.storage || item.capacity || ''}"`,
            `"${item.color || ''}"`,
            `"${item.carrier || ''}"`,
            item.imei || '',
            `"${item.serialNumber || ''}"`,
            `"${item.working || item.working_status || item.workingStatus || 'PENDING'}"`,
            `"${item.condition || ''}"`,
            item.battery_health || item.batteryHealth || '',
            `"${item.location || ''}"`,
            (item.updated_at || item.created_at) || '',
          ].join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_page_${currentPage}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      addToast(`Exported ${filteredInventory.length} items from current page to CSV`, 'success');
    } catch (error: any) {
      addToast('Failed to export CSV', 'error');
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilterDate('');
    setFilterBrand('');
    setFilterCarrier('');
    setFilterCondition('');
    setFilterWorkingStatus('');
    setSearchTerm('');
  };

  // Initial load: Stats + first page
  useEffect(() => {
    const initializeData = async () => {
      // Load stats first (fast, non-blocking)
      loadStats();
      // Then load first page
      loadInventoryPage(1, pageSize);
    };
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Enhanced Inventory Manager</h1>
      <p className="text-sm text-gray-500 mb-6">Comprehensive device inventory management with PhoneCheck integration</p>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <i className="fas fa-boxes text-blue-600 text-xl"></i>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <i className="fas fa-check-circle text-green-600 text-xl"></i>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Passed Tests</p>
              <p className="text-2xl font-bold text-gray-900">{stats.workingStatus?.YES || 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-lg">
              <i className="fas fa-times-circle text-red-600 text-xl"></i>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Failed Tests</p>
              <p className="text-2xl font-bold text-gray-900">{stats.workingStatus?.NO || 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <i className="fas fa-clock text-yellow-600 text-xl"></i>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending Tests</p>
              <p className="text-2xl font-bold text-gray-900">{stats.workingStatus?.PENDING || 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <i className="fas fa-mobile-alt text-purple-600 text-xl"></i>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">PhoneCheck Data</p>
              <p className="text-2xl font-bold text-gray-900">
                {(stats.phonecheckData?.withDefects || 0) +
                  (stats.phonecheckData?.withNotes || 0) +
                  (stats.phonecheckData?.withCustom1 || 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Controls Bar */}
      <Card className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Search */}
          <div className="flex-1 sm:max-w-xs">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search devices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button onClick={() => setShowFilters(!showFilters)} variant="secondary">
              <i className="fas fa-filter"></i>
              Filters
            </Button>
            <Button onClick={exportToCSV} variant="success">
              <i className="fas fa-download"></i>
              Export CSV
            </Button>
            <Button
              onClick={() => {
                loadInventoryPage(currentPage, pageSize);
              }}
              loading={loading}
            >
              <i className="fas fa-sync-alt"></i>
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                <select
                  value={filterBrand}
                  onChange={(e) => setFilterBrand(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Brands</option>
                  {uniqueBrands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
                <select
                  value={filterCarrier}
                  onChange={(e) => setFilterCarrier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Carriers</option>
                  {uniqueCarriers.map((carrier) => (
                    <option key={carrier} value={carrier}>
                      {carrier}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Working Status</label>
                <select
                  value={filterWorkingStatus}
                  onChange={(e) => setFilterWorkingStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="YES">Passed</option>
                  <option value="NO">Failed</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                <select
                  value={filterCondition}
                  onChange={(e) => setFilterCondition(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Conditions</option>
                  {uniqueConditions.map((condition) => (
                    <option key={condition} value={condition}>
                      {condition}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Updated On</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="updated_at">Last Updated</option>
                  <option value="created_at">Date Created</option>
                  <option value="name">Name</option>
                  <option value="brand">Brand</option>
                  <option value="working">Working Status</option>
                  <option value="condition">Condition</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">&nbsp;</label>
                <Button onClick={clearAllFilters} variant="secondary" className="w-full">
                  Clear All Filters
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Selection Controls */}
      {selectedItems.length > 0 && (
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-900">{selectedItems.length} item(s) selected</span>
              <button onClick={clearSelection} className="text-sm text-blue-600 hover:text-blue-800">
                Clear selection
              </button>
            </div>
            <Button onClick={() => setShowDeleteModal(true)} variant="danger">
              <i className="fas fa-trash"></i>
              Delete Selected
            </Button>
          </div>
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <Card>
          <div className="text-center py-12">
            <Spinner size="lg" />
            <p className="text-gray-500 text-lg mt-4">Loading inventory...</p>
          </div>
        </Card>
      ) : filteredInventory.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <i className="fas fa-search text-gray-400 text-4xl mb-4"></i>
            <p className="text-gray-500 text-lg">No items found matching your criteria.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === filteredInventory.length && filteredInventory.length > 0}
                      onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
                      className="rounded border-gray-300"
                      disabled={filteredInventory.length === 0}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Device
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IMEI/Serial
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Storage/Color
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Carrier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Working Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Condition
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.map((item) => (
                  <tr key={item.imei || item.id || `item-${Math.random()}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.imei || item.id || '')}
                        onChange={() => toggleItemSelection(item.imei || item.id || '')}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.name || item.device_name || 'N/A'}</div>
                        <div className="text-sm text-gray-500">
                          {item.brand || 'N/A'} • {item.model || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono">{item.imei || 'N/A'}</div>
                      {item.serialNumber && (
                        <div className="text-xs text-gray-500 font-mono">{item.serialNumber}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.storage || item.capacity || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{item.color || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.carrier || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <WorkingStatusBadge status={item.working || item.working_status || item.workingStatus} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.condition === 'EXCELLENT'
                            ? 'bg-green-100 text-green-800'
                            : item.condition === 'GOOD'
                            ? 'bg-blue-100 text-blue-800'
                            : item.condition === 'FAIR'
                            ? 'bg-yellow-100 text-yellow-800'
                            : item.condition === 'POOR'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {item.condition || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.location || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(item.updated_at || item.created_at)
                        ? new Date(item.updated_at || item.created_at!).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <i className="fas fa-edit mr-1"></i>Edit
                      </button>
                      <button onClick={() => handleDelete(item.imei || item.id || '')} className="text-red-600 hover:text-red-900">
                        <i className="fas fa-trash mr-1"></i>Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <Card className="mt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * pageSize, totalItems)}</span> of{' '}
              <span className="font-medium">{totalItems}</span> items
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">Items per page:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
                variant="secondary"
                size="sm"
              >
                <i className="fas fa-chevron-left"></i>
                Previous
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, Math.ceil(totalItems / pageSize)) }, (_, i) => {
                  const totalPages = Math.ceil(totalItems / pageSize);
                  let pageNum: number;
                  
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={loading}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <Button
                onClick={() => setCurrentPage((prev) => Math.min(Math.ceil(totalItems / pageSize), prev + 1))}
                disabled={currentPage >= Math.ceil(totalItems / pageSize) || loading}
                variant="secondary"
                size="sm"
              >
                Next
                <i className="fas fa-chevron-right"></i>
              </Button>
            </div>
          </div>
        </Card>
      )}
      
      {/* Results Summary */}
      {totalItems > 0 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Page {currentPage} of {Math.ceil(totalItems / pageSize)} ({totalItems} total items)
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Deletion"
        size="sm"
      >
        <p className="text-sm text-gray-500 mb-6">
          Are you sure you want to delete {selectedItems.length} item(s)? This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-3">
          <Button onClick={() => setShowDeleteModal(false)} variant="secondary">
            Cancel
          </Button>
          <Button onClick={deleteItems} variant="danger">
            Delete
          </Button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingItem(null);
        }}
        title="Edit Item"
        size="md"
      >
        {editingItem && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateItem(editingItem);
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingItem.name || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Working Status</label>
                <select
                  value={editingItem.working || editingItem.working_status || editingItem.workingStatus || 'PENDING'}
                  onChange={(e) => setEditingItem({ ...editingItem, working: e.target.value, working_status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="YES">Passed</option>
                  <option value="NO">Failed</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                <input
                  type="text"
                  value={editingItem.brand || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, brand: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <input
                  type="text"
                  value={editingItem.model || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={editingItem.location || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                <input
                  type="text"
                  value={editingItem.condition || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, condition: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <Button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                }}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button type="submit">Update Item</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
