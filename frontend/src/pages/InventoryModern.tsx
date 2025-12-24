// TEMPORARY: This is the converted Ant Design version
// After testing, this will replace Inventory.tsx
// To test: Navigate to /inventory route in your app

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Modal,
  Form,
  Space,
  Statistic,
  Row,
  Col,
  Tag,
  DatePicker,
  Collapse,
  Alert,
  App,
  Typography,
  Empty,
  Popconfirm,
} from 'antd';
import {
  ReloadOutlined,
  ExportOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  SearchOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  MobileOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { api } from '../services/api';
import { edgeFunctions } from '../services/edgeFunctions';
import { useToastStore } from '../stores/toastStore';

const { Search } = Input;
const { Panel } = Collapse;
const { Title, Text } = Typography;

interface InventoryItem {
  imei: string;
  id?: string;
  name?: string;
  device_name?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  storage?: string;
  capacity?: string;
  color?: string;
  carrier?: string;
  working?: string;
  working_status?: string;
  workingStatus?: string;
  condition?: string;
  battery_health?: string | number;
  batteryHealth?: string | number;
  location?: string;
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

export const InventoryModern = () => {
  const { message } = App.useApp();
  const addToast = useToastStore((state) => state.addToast);
  const [form] = Form.useForm();
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterCarrier, setFilterCarrier] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterWorkingStatus, setFilterWorkingStatus] = useState('');
  const [filterDate, setFilterDate] = useState<any>(null);
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedItems, setSelectedItems] = useState<React.Key[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
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

  // Load statistics
  const loadStats = async () => {
    try {
      const response = await edgeFunctions.getInventoryStats();
      
      if (response.success && response.data) {
        const apiStats = response.data;
        setStats({
          total: apiStats.total_items || 0,
          brands: {},
          carriers: {},
          conditions: {},
          workingStatus: {
            YES: apiStats.working_items || 0,
            NO: apiStats.failed_items || 0,
            PENDING: apiStats.pending_items || 0,
          },
          phonecheckData: {
            withDefects: 0,
            withNotes: 0,
            withCustom1: 0,
          },
        });
        setTotalItems(apiStats.total_items || 0);
      }
    } catch (error: any) {
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
          console.error('Error loading stats:', fallbackError);
        }
      }
    }
  };

  // Load paginated inventory data
  const loadInventoryPage = async (page: number, limit: number) => {
    try {
      setLoading(true);
      const offset = (page - 1) * limit;
      
      const params: any = {
        limit: limit.toString(),
        offset: offset.toString(),
      };
      
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      const filter: any = {};
      if (filterWorkingStatus) {
        filter.working = filterWorkingStatus;
      }
      
      if (Object.keys(filter).length > 0) {
        params.filter = JSON.stringify(filter);
      }
      
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
        
        calculatePageStats(data);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Error fetching inventory:', error);
      }
      message.error(error.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics from current page data
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

    setStats((prev) => ({
      ...prev,
      brands: { ...prev.brands, ...pageStats.brands },
      carriers: { ...prev.carriers, ...pageStats.carriers },
      conditions: { ...prev.conditions, ...pageStats.conditions },
    }));
  };

  // Filter and sort inventory
  const filteredInventory = useMemo(() => {
    let filtered = [...inventory];

    if (filterBrand) {
      filtered = filtered.filter((item) => item.brand === filterBrand);
    }

    if (filterCarrier) {
      filtered = filtered.filter((item) => item.carrier === filterCarrier);
    }

    if (filterCondition) {
      filtered = filtered.filter((item) => item.condition === filterCondition);
    }

    if (filterWorkingStatus) {
      filtered = filtered.filter((item) => {
        const working = (item.working || item.working_status || item.workingStatus || '').toUpperCase();
        return working === filterWorkingStatus.toUpperCase();
      });
    }

    if (filterDate) {
      const selectedDateStr = filterDate.format('YYYY-MM-DD');
      filtered = filtered.filter((item) => {
        const itemDateStr = item.updated_at || item.created_at;
        if (!itemDateStr || typeof itemDateStr !== 'string') return false;
        const itemDateOnly = itemDateStr.split('T')[0];
        return itemDateOnly === selectedDateStr;
      });
    }

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
  
  useEffect(() => {
    setCurrentPage(1);
    loadInventoryPage(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterWorkingStatus]);
  
  useEffect(() => {
    if (currentPage > 0 && pageSize > 0) {
      loadInventoryPage(currentPage, pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

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

  const deleteItems = async () => {
    try {
      message.info('Bulk delete functionality coming soon');
      setSelectedItems([]);
    } catch (error: any) {
      message.error(error.message || 'Failed to delete items');
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem({ ...item });
    form.setFieldsValue({
      name: item.name || item.device_name,
      brand: item.brand,
      model: item.model,
      working_status: item.working || item.working_status || item.workingStatus || 'PENDING',
      location: item.location,
      condition: item.condition,
    });
    setShowEditModal(true);
  };

  const handleDelete = async (itemId: string) => {
    try {
      // TODO: Implement delete API
      message.info('Delete functionality coming soon');
    } catch (error: any) {
      message.error(error.message || 'Failed to delete item');
    }
  };

  const updateItem = async () => {
    if (!editingItem) return;
    
    try {
      const values = await form.validateFields();
      const itemId = editingItem.imei || editingItem.id;
      if (!itemId) {
        message.error('Item ID is required');
        return;
      }

      const itemData = { ...editingItem, ...values };
      
      let response;
      try {
        response = await api.put(`/admin/inventory/${itemId}`, itemData);
      } catch {
        response = await api.put(`/inventory/${itemId}`, itemData);
      }
      
      if (response.data && typeof response.data === 'object' && 'success' in response.data) {
        const apiResponse = response.data as any;
        if (apiResponse.success) {
          message.success('Item updated successfully');
          setShowEditModal(false);
          setEditingItem(null);
          form.resetFields();
          loadInventoryPage(currentPage, pageSize);
        } else {
          message.error(apiResponse.error || 'Failed to update item');
        }
      } else {
        message.success('Item updated successfully');
        setShowEditModal(false);
        setEditingItem(null);
        form.resetFields();
        loadInventoryPage(currentPage, pageSize);
      }
    } catch (error: any) {
      if (error.errorFields) {
        // Form validation errors
        return;
      }
      message.error(error.response?.data?.error || error.message || 'Failed to update item');
    }
  };

  const exportToCSV = async () => {
    try {
      const headers = [
        'ID', 'Name', 'Brand', 'Model', 'Storage', 'Color', 'Carrier',
        'IMEI', 'Serial Number', 'Working Status', 'Condition',
        'Battery Health', 'Location', 'Last Updated',
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

      message.success(`Exported ${filteredInventory.length} items from current page to CSV`);
    } catch (error: any) {
      message.error('Failed to export CSV');
    }
  };

  const clearAllFilters = () => {
    setFilterDate(null);
    setFilterBrand('');
    setFilterCarrier('');
    setFilterCondition('');
    setFilterWorkingStatus('');
    setSearchTerm('');
  };

  useEffect(() => {
    const initializeData = async () => {
      loadStats();
      loadInventoryPage(1, pageSize);
    };
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Table columns
  const columns: ColumnsType<InventoryItem> = [
    {
      title: 'Device',
      key: 'device',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.name || record.device_name || 'N/A'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.brand || 'N/A'} • {record.model || 'N/A'}
          </Text>
        </div>
      ),
    },
    {
      title: 'IMEI/Serial',
      key: 'imei',
      width: 180,
      render: (_, record) => (
        <div>
          <Text code>{record.imei || 'N/A'}</Text>
          {record.serialNumber && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }} code>
                {record.serialNumber}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Storage/Color',
      key: 'storage',
      width: 120,
      render: (_, record) => (
        <div>
          <div>{record.storage || record.capacity || 'N/A'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.color || 'N/A'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Carrier',
      dataIndex: 'carrier',
      key: 'carrier',
      width: 120,
      render: (text) => text || 'N/A',
    },
    {
      title: 'Working Status',
      key: 'working_status',
      width: 120,
      render: (_, record) => {
        const status = (record.working || record.working_status || record.workingStatus || '').toUpperCase();
        const color = status === 'YES' ? 'green' : status === 'NO' ? 'red' : 'orange';
        return <Tag color={color}>{status || 'PENDING'}</Tag>;
      },
    },
    {
      title: 'Condition',
      dataIndex: 'condition',
      key: 'condition',
      width: 120,
      render: (condition) => {
        if (!condition) return <Tag>UNKNOWN</Tag>;
        const colorMap: Record<string, string> = {
          EXCELLENT: 'green',
          GOOD: 'blue',
          FAIR: 'orange',
          POOR: 'red',
        };
        return <Tag color={colorMap[condition] || 'default'}>{condition}</Tag>;
      },
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 150,
      render: (text) => text || 'N/A',
    },
    {
      title: 'Last Updated',
      key: 'updated_at',
      width: 120,
      render: (_, record) => {
        const date = record.updated_at || record.created_at;
        return date ? new Date(date).toLocaleDateString() : 'N/A';
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete item"
            description="Are you sure you want to delete this item?"
            onConfirm={() => handleDelete(record.imei || record.id || '')}
            okText="Yes"
            cancelText="No"
            okType="danger"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Inventory Manager
          </Title>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
            Comprehensive device inventory management with PhoneCheck integration
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadInventoryPage(currentPage, pageSize)}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            icon={<ExportOutlined />}
            onClick={exportToCSV}
            disabled={filteredInventory.length === 0}
          >
            Export CSV
          </Button>
          {selectedItems.length > 0 && (
            <Popconfirm
              title="Delete selected items"
              description={`Are you sure you want to delete ${selectedItems.length} item(s)?`}
              onConfirm={deleteItems}
              okText="Yes"
              cancelText="No"
              okType="danger"
            >
              <Button type="primary" danger icon={<DeleteOutlined />}>
                Delete Selected ({selectedItems.length})
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={5}>
          <Card>
            <Statistic
              title="Total Items"
              value={stats.total}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card>
            <Statistic
              title="Passed Tests"
              value={stats.workingStatus?.YES || 0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card>
            <Statistic
              title="Failed Tests"
              value={stats.workingStatus?.NO || 0}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card>
            <Statistic
              title="Pending Tests"
              value={stats.workingStatus?.PENDING || 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="PhoneCheck Data"
              value={
                (stats.phonecheckData?.withDefects || 0) +
                (stats.phonecheckData?.withNotes || 0) +
                (stats.phonecheckData?.withCustom1 || 0)
              }
              prefix={<MobileOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Search and Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Search
            placeholder="Search devices by IMEI, brand, model..."
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            onSearch={(value) => {
              setSearchTerm(value);
              setCurrentPage(1);
            }}
            style={{ maxWidth: 500 }}
          />

          <Collapse ghost>
            <Panel header={<><FilterOutlined /> Filters</>} key="filters">
              <Row gutter={16}>
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Select
                    placeholder="Brand"
                    allowClear
                    style={{ width: '100%' }}
                    value={filterBrand || undefined}
                    onChange={(value) => {
                      setFilterBrand(value || '');
                      setCurrentPage(1);
                    }}
                  >
                    {uniqueBrands.map((brand) => (
                      <Select.Option key={brand} value={brand}>
                        {brand}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Select
                    placeholder="Carrier"
                    allowClear
                    style={{ width: '100%' }}
                    value={filterCarrier || undefined}
                    onChange={(value) => {
                      setFilterCarrier(value || '');
                      setCurrentPage(1);
                    }}
                  >
                    {uniqueCarriers.map((carrier) => (
                      <Select.Option key={carrier} value={carrier}>
                        {carrier}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Select
                    placeholder="Working Status"
                    allowClear
                    style={{ width: '100%' }}
                    value={filterWorkingStatus || undefined}
                    onChange={(value) => {
                      setFilterWorkingStatus(value || '');
                      setCurrentPage(1);
                    }}
                  >
                    <Select.Option value="YES">Passed</Select.Option>
                    <Select.Option value="NO">Failed</Select.Option>
                    <Select.Option value="PENDING">Pending</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Select
                    placeholder="Condition"
                    allowClear
                    style={{ width: '100%' }}
                    value={filterCondition || undefined}
                    onChange={(value) => {
                      setFilterCondition(value || '');
                      setCurrentPage(1);
                    }}
                  >
                    {uniqueConditions.map((condition) => (
                      <Select.Option key={condition} value={condition}>
                        {condition}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                  <DatePicker
                    placeholder="Updated On"
                    style={{ width: '100%' }}
                    value={filterDate}
                    onChange={(date) => {
                      setFilterDate(date);
                      setCurrentPage(1);
                    }}
                    allowClear
                  />
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Button
                    onClick={clearAllFilters}
                    style={{ width: '100%' }}
                  >
                    Clear All Filters
                  </Button>
                </Col>
              </Row>
            </Panel>
          </Collapse>
        </Space>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredInventory}
          rowKey={(record) => record.imei || record.id || ''}
          loading={loading}
          rowSelection={{
            selectedRowKeys: selectedItems,
            onChange: setSelectedItems,
            getCheckboxProps: (record) => ({
              disabled: !record.imei && !record.id,
            }),
          }}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: totalItems,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            pageSizeOptions: ['25', '50', '100', '200'],
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: <Empty description="No items found" />,
          }}
        />
      </Card>

      {/* Edit Modal */}
      <Modal
        title="Edit Item"
        open={showEditModal}
        onOk={updateItem}
        onCancel={() => {
          setShowEditModal(false);
          setEditingItem(null);
          form.resetFields();
        }}
        width={800}
        okText="Update"
        cancelText="Cancel"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Name">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="working_status" label="Working Status">
                <Select>
                  <Select.Option value="YES">Passed</Select.Option>
                  <Select.Option value="NO">Failed</Select.Option>
                  <Select.Option value="PENDING">Pending</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="brand" label="Brand">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model" label="Model">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="Location">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="condition" label="Condition">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

