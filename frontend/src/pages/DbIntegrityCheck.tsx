import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Statistic,
  Row,
  Col,
  Space,
  Input,
  Checkbox,
  Alert,
  Tag,
  Divider,
  Descriptions,
  App,
  Spin,
  Empty,
  Progress,
} from 'antd';
import {
  DatabaseOutlined,
  ReloadOutlined,
  SearchOutlined,
  PlayCircleOutlined,
  ClearOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { api } from '../services/api';

interface MissingDataRecord {
  imei: string;
  missingFields: string[];
  model?: string | null;
  capacity?: string | null;
  color?: string | null;
  carrier?: string | null;
}

interface IntegrityCheckResult {
  success: boolean;
  totalScanned: number;
  recordsWithMissingData: number;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors: Array<{ imei: string; error: string }>;
  processingTime: number;
  details: {
    found: MissingDataRecord[];
    processed: Array<{ imei: string; status: 'updated' | 'failed' | 'no_data' }>;
  };
}

interface MissingDataStats {
  totalRecords: number;
  missingModel: number;
  missingCapacity: number;
  missingColor: number;
  missingCarrier: number;
  missingAnyField: number;
}

export const DbIntegrityCheck = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<MissingDataStats | null>(null);
  const [result, setResult] = useState<IntegrityCheckResult | null>(null);
  const [records, setRecords] = useState<MissingDataRecord[]>([]);

  // Configuration
  const [selectedFields, setSelectedFields] = useState<string[]>(['model', 'capacity', 'color', 'carrier']);
  const [maxItems, setMaxItems] = useState<number>(100);
  const [batchSize, setBatchSize] = useState<number>(5);
  const [delayBetweenBatches, setDelayBetweenBatches] = useState<number>(1000);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await api.get('/db-integrity-check/stats');
      if (response.data?.success && response.data?.data?.stats) {
        setStats(response.data.data.stats);
      }
    } catch (error: any) {
      console.error('Error loading stats:', error);
      message.error(error.response?.data?.error || 'Failed to load statistics');
    }
  };

  const scanMissingData = async () => {
    setScanning(true);
    try {
      const response = await api.post('/db-integrity-check/scan', {
        missingFields: selectedFields,
        maxItems,
      });

      if (response.data?.success) {
        setRecords(response.data.data.records);
        setResult({
          ...response.data.data,
          recordsProcessed: 0,
          recordsUpdated: 0,
          recordsFailed: 0,
          processingTime: 0,
          details: {
            found: response.data.data.records,
            processed: [],
          },
        });
        message.success(`Found ${response.data.data.records.length} records with missing data`);
      }
    } catch (error: any) {
      console.error('Error scanning:', error);
      message.error(error.response?.data?.error || 'Failed to scan database');
    } finally {
      setScanning(false);
    }
  };

  const runIntegrityCheck = async () => {
    if (!window.confirm('This will update records in the database. Continue?')) {
      return;
    }

    setProcessing(true);
    try {
      const response = await api.post('/db-integrity-check/run', {
        missingFields: selectedFields,
        maxItems,
        batchSize,
        delayBetweenBatches,
      });

      if (response.data?.success) {
        setResult(response.data.data);
        setRecords(response.data.data.details.found);
        message.success(
          response.data.message || 
          `Integrity check completed. Updated ${response.data.data.recordsUpdated} records, ${response.data.data.recordsFailed} failed.`
        );
      }
    } catch (error: any) {
      console.error('Error running integrity check:', error);
      message.error(error.response?.data?.error || 'Failed to run integrity check');
    } finally {
      setProcessing(false);
    }
  };

  const clearResults = () => {
    setResult(null);
    setRecords([]);
  };

  const handleFieldToggle = (field: string) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter((f) => f !== field));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const columns = [
    {
      title: 'IMEI',
      dataIndex: 'imei',
      key: 'imei',
      render: (text: string) => <code className="text-xs">{text}</code>,
    },
    {
      title: 'Missing Fields',
      key: 'missingFields',
      render: (_: any, record: MissingDataRecord) => (
        <Space wrap>
          {record.missingFields.map((field) => (
            <Tag color="orange" key={field}>
              {field}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Model',
      dataIndex: 'model',
      key: 'model',
      render: (text: string | null) => text || <span className="text-gray-400">N/A</span>,
    },
    {
      title: 'Capacity',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (text: string | null) => text || <span className="text-gray-400">N/A</span>,
    },
    {
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
      render: (text: string | null) => text || <span className="text-gray-400">N/A</span>,
    },
    {
      title: 'Carrier',
      dataIndex: 'carrier',
      key: 'carrier',
      render: (text: string | null) => text || <span className="text-gray-400">N/A</span>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Database Integrity Check</h1>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
            Scan and update records with missing identification fields
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadStats}>
          Refresh Stats
        </Button>
      </div>

      {/* Statistics */}
      <Card title="Missing Data Statistics" style={{ marginBottom: 24 }}>
        {stats ? (
          <Row gutter={16}>
            <Col span={4}>
              <Statistic title="Total Records" value={stats.totalRecords} />
            </Col>
            <Col span={4}>
              <Statistic title="Missing Any Field" value={stats.missingAnyField} valueStyle={{ color: '#faad14' }} />
            </Col>
            <Col span={4}>
              <Statistic title="Missing Model" value={stats.missingModel} valueStyle={{ color: '#ff4d4f' }} />
            </Col>
            <Col span={4}>
              <Statistic title="Missing Capacity" value={stats.missingCapacity} valueStyle={{ color: '#722ed1' }} />
            </Col>
            <Col span={4}>
              <Statistic title="Missing Color" value={stats.missingColor} valueStyle={{ color: '#eb2f96' }} />
            </Col>
            <Col span={4}>
              <Statistic title="Missing Carrier" value={stats.missingCarrier} valueStyle={{ color: '#ff4d4f' }} />
            </Col>
          </Row>
        ) : (
          <Spin />
        )}
      </Card>

      {/* Configuration */}
      <Card title="Configuration" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Missing Fields to Check</div>
            <Checkbox.Group
              value={selectedFields}
              onChange={(values) => setSelectedFields(values as string[])}
            >
              <Space direction="vertical">
                <Checkbox value="model">Model</Checkbox>
                <Checkbox value="capacity">Capacity / Storage</Checkbox>
                <Checkbox value="color">Color</Checkbox>
                <Checkbox value="carrier">Carrier</Checkbox>
              </Space>
            </Checkbox.Group>
          </div>

          <Row gutter={16}>
            <Col span={8}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>Max Items to Process</div>
              <Input
                type="number"
                value={maxItems}
                onChange={(e) => setMaxItems(parseInt(e.target.value) || 100)}
                min={1}
                max={1000}
              />
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>Limit: 1-1000</div>
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>Batch Size</div>
              <Input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value) || 5)}
                min={1}
                max={20}
              />
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>Parallel: 1-20</div>
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>Delay Between Batches (ms)</div>
              <Input
                type="number"
                value={delayBetweenBatches}
                onChange={(e) => setDelayBetweenBatches(parseInt(e.target.value) || 1000)}
                min={0}
                max={10000}
              />
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>Range: 0-10000ms</div>
            </Col>
          </Row>

          <Space>
            <Button
              icon={<SearchOutlined />}
              onClick={scanMissingData}
              loading={scanning}
              disabled={selectedFields.length === 0}
            >
              Scan Only (Read-Only)
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={runIntegrityCheck}
              loading={processing}
              disabled={selectedFields.length === 0}
            >
              Run Full Integrity Check
            </Button>
            <Button icon={<ClearOutlined />} onClick={clearResults} disabled={!result}>
              Clear Results
            </Button>
          </Space>
        </Space>
      </Card>

      {/* Progress Indicator */}
      {(scanning || processing) && (
        <Card style={{ marginBottom: 24 }}>
          <Spin tip={processing ? 'Running integrity check...' : 'Scanning database...'} size="large" />
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <Card title="Results Summary" style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="Total Scanned" value={result.totalScanned} />
              </Col>
              <Col span={6}>
                <Statistic title="With Missing Data" value={result.recordsWithMissingData} valueStyle={{ color: '#1890ff' }} />
              </Col>
              <Col span={6}>
                <Statistic title="Processed" value={result.recordsProcessed} valueStyle={{ color: '#faad14' }} />
              </Col>
              <Col span={3}>
                <Statistic
                  title="Updated"
                  value={result.recordsUpdated}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Col>
              <Col span={3}>
                <Statistic
                  title="Failed"
                  value={result.recordsFailed}
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<CloseCircleOutlined />}
                />
              </Col>
            </Row>
            {result.processingTime > 0 && (
              <div style={{ marginTop: 16, fontSize: 12, color: '#8c8c8c' }}>
                Processing time: {(result.processingTime / 1000).toFixed(2)} seconds
              </div>
            )}
          </Card>

          {/* Errors */}
          {result.errors && result.errors.length > 0 && (
            <Card
              title={
                <Space>
                  <WarningOutlined style={{ color: '#ff4d4f' }} />
                  Errors
                </Space>
              }
              style={{ marginBottom: 24 }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {result.errors.map((error, index) => (
                  <Alert
                    key={index}
                    message={`IMEI ${error.imei}`}
                    description={error.error}
                    type="error"
                    showIcon
                  />
                ))}
              </Space>
            </Card>
          )}

          {/* Records Table */}
          <Card title="Records with Missing Data">
            {records.length > 0 ? (
              <Table
                columns={columns}
                dataSource={records}
                rowKey="imei"
                pagination={{ pageSize: 20 }}
                scroll={{ x: 'max-content' }}
              />
            ) : (
              <Empty description="No records found" />
            )}
          </Card>
        </>
      )}
    </div>
  );
};

