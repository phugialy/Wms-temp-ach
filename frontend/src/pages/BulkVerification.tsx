import { useState } from 'react';
import {
  Card,
  Input,
  Button,
  Table,
  Statistic,
  Row,
  Col,
  Typography,
  Space,
  message,
  Upload,
  Divider,
  Tag,
  Alert,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface VerificationResult {
  imei: string;
  found: boolean;
  deviceData?: {
    imei: string;
    sku?: string;
    brand?: string;
    model?: string;
    capacity?: string;
    color?: string;
    carrier?: string;
    location?: string;
    working?: string;
    battery_health?: string;
    created_at?: string;
  };
}

interface VerificationResponse {
  success: boolean;
  data?: {
    total: number;
    matched: number;
    notMatched: number;
    results: VerificationResult[];
    matchedDevices: any[];
    notMatchedImeis: string[];
  };
  error?: string;
}

export const BulkVerification = () => {
  const [loading, setLoading] = useState(false);
  const [imeiList, setImeiList] = useState<string>('');
  const [verificationData, setVerificationData] = useState<VerificationResponse['data'] | null>(null);

  const handleVerify = async () => {
    if (!imeiList.trim()) {
      message.error('Please enter at least one IMEI/Serial number');
      return;
    }

    setLoading(true);
    try {
      // Parse IMEI list (split by newline, comma, or space)
      const imeis = imeiList
        .split(/[\n,\s]+/)
        .map((imei) => imei.trim())
        .filter((imei) => imei.length > 0);

      if (imeis.length === 0) {
        message.error('No valid IMEIs found in input');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/verification/bulk-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imeis }),
      });

      const result: VerificationResponse = await response.json();

      if (result.success && result.data) {
        setVerificationData(result.data);
        message.success(`Verification complete! ${result.data.matched} matched, ${result.data.notMatched} not found`);
      } else {
        message.error(result.error || 'Verification failed');
      }
    } catch (error: any) {
      message.error(error.message || 'Network error during verification');
      console.error('Verification error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        // Extract IMEIs from first column or find IMEI column
        const imeis: string[] = [];
        jsonData.forEach((row: any) => {
          if (Array.isArray(row)) {
            row.forEach((cell) => {
              const value = String(cell || '').trim();
              if (value.length >= 10) {
                // IMEI is typically 15 digits, but accept 10+ for flexibility
                imeis.push(value);
              }
            });
          } else {
            // Object format - try common column names
            const imei = row.imei || row.IMEI || row.Serial || row.serial || row['Serial Number'] || Object.values(row)[0];
            if (imei) {
              imeis.push(String(imei).trim());
            }
          }
        });

        if (imeis.length > 0) {
          setImeiList(imeis.join('\n'));
          message.success(`Loaded ${imeis.length} IMEIs from file`);
        } else {
          message.warning('No IMEIs found in file. Please check the format.');
        }
      } catch (error) {
        message.error('Failed to parse file. Please ensure it is a valid Excel/CSV file.');
      }
    };
    reader.readAsBinaryString(file);
    return false; // Prevent auto upload
  };

  const exportToCSV = () => {
    if (!verificationData) return;

    // Create CSV content
    const headers = ['IMEI', 'Status', 'SKU', 'Brand', 'Model', 'Capacity', 'Color', 'Carrier', 'Location', 'Working', 'Battery Health', 'Created At'];
    const rows = verificationData.results.map((result) => [
      result.imei,
      result.found ? 'FOUND' : 'NOT FOUND',
      result.deviceData?.sku || '',
      result.deviceData?.brand || '',
      result.deviceData?.model || '',
      result.deviceData?.capacity || '',
      result.deviceData?.color || '',
      result.deviceData?.carrier || '',
      result.deviceData?.location || '',
      result.deviceData?.working || '',
      result.deviceData?.battery_health || '',
      result.deviceData?.created_at || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `imei-verification-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportToExcel = () => {
    if (!verificationData) return;

    // Prepare data
    const wsData = [
      ['IMEI', 'Status', 'SKU', 'Brand', 'Model', 'Capacity', 'Color', 'Carrier', 'Location', 'Working', 'Battery Health', 'Created At'],
      ...verificationData.results.map((result) => [
        result.imei,
        result.found ? 'FOUND' : 'NOT FOUND',
        result.deviceData?.sku || '',
        result.deviceData?.brand || '',
        result.deviceData?.model || '',
        result.deviceData?.capacity || '',
        result.deviceData?.color || '',
        result.deviceData?.carrier || '',
        result.deviceData?.location || '',
        result.deviceData?.working || '',
        result.deviceData?.battery_health || '',
        result.deviceData?.created_at || '',
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Verification Results');
    XLSX.writeFile(wb, `imei-verification-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportNotMatched = () => {
    if (!verificationData || verificationData.notMatchedImeis.length === 0) {
      message.warning('No unmatched IMEIs to export');
      return;
    }

    const csvContent = ['IMEI', ...verificationData.notMatchedImeis].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `not-matched-imeis-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const columns: ColumnsType<VerificationResult> = [
    {
      title: 'IMEI',
      dataIndex: 'imei',
      key: 'imei',
      fixed: 'left',
      width: 150,
    },
    {
      title: 'Status',
      dataIndex: 'found',
      key: 'status',
      width: 100,
      render: (found: boolean) => (
        <Tag color={found ? 'green' : 'red'} icon={found ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {found ? 'FOUND' : 'NOT FOUND'}
        </Tag>
      ),
    },
    {
      title: 'SKU',
      dataIndex: ['deviceData', 'sku'],
      key: 'sku',
      width: 120,
    },
    {
      title: 'Brand',
      dataIndex: ['deviceData', 'brand'],
      key: 'brand',
      width: 100,
    },
    {
      title: 'Model',
      dataIndex: ['deviceData', 'model'],
      key: 'model',
      width: 120,
    },
    {
      title: 'Capacity',
      dataIndex: ['deviceData', 'capacity'],
      key: 'capacity',
      width: 100,
    },
    {
      title: 'Color',
      dataIndex: ['deviceData', 'color'],
      key: 'color',
      width: 100,
    },
    {
      title: 'Carrier',
      dataIndex: ['deviceData', 'carrier'],
      key: 'carrier',
      width: 100,
    },
    {
      title: 'Location',
      dataIndex: ['deviceData', 'location'],
      key: 'location',
      width: 120,
    },
    {
      title: 'Working',
      dataIndex: ['deviceData', 'working'],
      key: 'working',
      width: 100,
    },
    {
      title: 'Battery Health',
      dataIndex: ['deviceData', 'battery_health'],
      key: 'battery_health',
      width: 120,
    },
    {
      title: 'Created At',
      dataIndex: ['deviceData', 'created_at'],
      key: 'created_at',
      width: 150,
      render: (date: string) => (date ? new Date(date).toLocaleString() : '-'),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Bulk IMEI/Serial Verification</Title>
      <Text type="secondary">Verify a list of IMEI or Serial numbers against your database</Text>

      <Card style={{ marginTop: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong>Input IMEI/Serial Numbers</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              (One per line, or comma/space separated)
            </Text>
          </div>

          <TextArea
            rows={10}
            placeholder="Enter IMEI or Serial numbers here...&#10;Example:&#10;123456789012345&#10;987654321098765&#10;Or paste a comma-separated list"
            value={imeiList}
            onChange={(e) => setImeiList(e.target.value)}
            style={{ fontFamily: 'monospace' }}
          />

          <Space>
            <Upload
              accept=".xlsx,.xls,.csv"
              beforeUpload={handleFileUpload}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>Upload Excel/CSV File</Button>
            </Upload>
            <Button type="primary" onClick={handleVerify} loading={loading} icon={<CheckCircleOutlined />}>
              Verify IMEIs
            </Button>
            <Button onClick={() => setImeiList('')}>Clear</Button>
          </Space>
        </Space>
      </Card>

      {verificationData && (
        <>
          <Row gutter={16} style={{ marginTop: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Total Verified"
                  value={verificationData.total}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Matched"
                  value={verificationData.matched}
                  valueStyle={{ color: '#3f8600' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Not Matched"
                  value={verificationData.notMatched}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Card style={{ marginTop: 24 }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={4} style={{ margin: 0 }}>Verification Results</Title>
                <Space>
                  <Button icon={<DownloadOutlined />} onClick={exportToCSV}>
                    Export CSV
                  </Button>
                  <Button icon={<FileExcelOutlined />} onClick={exportToExcel}>
                    Export Excel
                  </Button>
                  {verificationData.notMatchedImeis.length > 0 && (
                    <Button danger icon={<DownloadOutlined />} onClick={exportNotMatched}>
                      Export Not Matched
                    </Button>
                  )}
                </Space>
              </div>

              {verificationData.notMatchedImeis.length > 0 && (
                <Alert
                  message={`${verificationData.notMatchedImeis.length} IMEI(s) not found in database`}
                  description={
                    <div>
                      <Text strong>Not Matched IMEIs:</Text>
                      <div style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
                        {verificationData.notMatchedImeis.map((imei, idx) => (
                          <Tag key={idx} style={{ marginBottom: 4 }}>
                            {imei}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  }
                  type="warning"
                  showIcon
                />
              )}

              <Divider />

              <Table
                columns={columns}
                dataSource={verificationData.results}
                rowKey="imei"
                pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total) => `Total ${total} items` }}
                scroll={{ x: 1500 }}
                size="small"
              />
            </Space>
          </Card>
        </>
      )}
    </div>
  );
};

