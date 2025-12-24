// PREVIEW: Inventory Manager - Ant Design Conversion
// This is a preview showing key sections of the converted version
// Full implementation will replace the existing Inventory.tsx file

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
  Divider,
  Popconfirm,
} from 'antd';
import {
  ReloadOutlined,
  ExportOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  SearchOutlined,
  BoxOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  MobileOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../services/api';
import { edgeFunctions } from '../services/edgeFunctions';
import { App } from 'antd';

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

export const Inventory = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  
  // ... existing state variables ...
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterCarrier, setFilterCarrier] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterWorkingStatus, setFilterWorkingStatus] = useState('');
  const [filterDate, setFilterDate] = useState(null);
  const [selectedItems, setSelectedItems] = useState<React.Key[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  
  // ... existing functions (loadStats, loadInventoryPage, etc.) ...

  // ============================================
  // PREVIEW: Statistics Cards (Ant Design)
  // ============================================
  const renderStatistics = () => (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={5}>
        <Card>
          <Statistic
            title="Total Items"
            value={stats.total}
            prefix={<BoxOutlined />}
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
  );

  // ============================================
  // PREVIEW: Table Columns (Ant Design)
  // ============================================
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

  // ============================================
  // PREVIEW: Main Component Render
  // ============================================
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
      {renderStatistics()}

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
                    value={filterBrand}
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
                    value={filterCarrier}
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
                    value={filterWorkingStatus}
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
                    value={filterCondition}
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
        onOk={() => {
          form.validateFields().then((values) => {
            updateItem({ ...editingItem, ...values });
          });
        }}
        onCancel={() => {
          setShowEditModal(false);
          setEditingItem(null);
          form.resetFields();
        }}
        width={800}
      >
        {editingItem && (
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              name: editingItem.name,
              brand: editingItem.brand,
              model: editingItem.model,
              working_status: editingItem.working || editingItem.working_status || editingItem.workingStatus,
              location: editingItem.location,
              condition: editingItem.condition,
            }}
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
        )}
      </Modal>
    </div>
  );
};

