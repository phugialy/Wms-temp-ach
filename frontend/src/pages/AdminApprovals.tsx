import { useState, useEffect } from 'react';
import { Table, Button, Card, Tag, Space, Modal, Form, Input, message, Typography, Descriptions } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { TextArea } = Input;

interface RegistrationRequest {
  id: string;
  email: string;
  full_name: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VERIFIED';
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
}

export const AdminApprovals = () => {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectForm] = Form.useForm();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wms_registration_requests')
        .select('*')
        .eq('app_identifier', 'WMS')
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      message.error('Failed to fetch registration requests: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (request: RegistrationRequest) => {
    try {
      setProcessingId(request.id);
      const response = await fetch('/api/auth/approve-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: request.id }),
      });

      const result = await response.json();
      if (result.success) {
        message.success('Registration approved! Verification email sent.');
        fetchRequests();
      } else {
        message.error(result.error || 'Failed to approve registration');
      }
    } catch (error: any) {
      message.error('Failed to approve: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (values: { reason: string }) => {
    if (!selectedRequest) return;

    try {
      setProcessingId(selectedRequest.id);
      const response = await fetch('/api/auth/reject-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          reason: values.reason,
        }),
      });

      const result = await response.json();
      if (result.success) {
        message.success('Registration rejected.');
        setRejectModalVisible(false);
        rejectForm.resetFields();
        fetchRequests();
      } else {
        message.error(result.error || 'Failed to reject registration');
      }
    } catch (error: any) {
      message.error('Failed to reject: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      PENDING: { color: 'orange', text: 'Pending' },
      APPROVED: { color: 'blue', text: 'Approved' },
      REJECTED: { color: 'red', text: 'Rejected' },
      VERIFIED: { color: 'green', text: 'Verified' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns: ColumnsType<RegistrationRequest> = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Full Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (text) => text || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Requested At',
      dataIndex: 'requested_at',
      key: 'requested_at',
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedRequest(record);
              setDetailModalVisible(true);
            }}
          >
            View
          </Button>
          {record.status === 'PENDING' && (
            <>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record)}
                loading={processingId === record.id}
              >
                Approve
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  setSelectedRequest(record);
                  setRejectModalVisible(true);
                }}
                loading={processingId === record.id}
              >
                Reject
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2} style={{ marginBottom: 24 }}>
          Registration Approvals
        </Title>

        <Table
          columns={columns}
          dataSource={requests}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="Registration Details"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedRequest(null);
        }}
        footer={null}
        width={600}
      >
        {selectedRequest && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Email">{selectedRequest.email}</Descriptions.Item>
            <Descriptions.Item label="Full Name">
              {selectedRequest.full_name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {getStatusTag(selectedRequest.status)}
            </Descriptions.Item>
            <Descriptions.Item label="Requested At">
              {new Date(selectedRequest.requested_at).toLocaleString()}
            </Descriptions.Item>
            {selectedRequest.reviewed_at && (
              <Descriptions.Item label="Reviewed At">
                {new Date(selectedRequest.reviewed_at).toLocaleString()}
              </Descriptions.Item>
            )}
            {selectedRequest.rejection_reason && (
              <Descriptions.Item label="Rejection Reason">
                {selectedRequest.rejection_reason}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      <Modal
        title="Reject Registration"
        open={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false);
          rejectForm.resetFields();
        }}
        onOk={() => rejectForm.submit()}
        confirmLoading={processingId !== null}
      >
        <Form form={rejectForm} onFinish={handleReject} layout="vertical">
          <Form.Item
            name="reason"
            label="Rejection Reason"
            rules={[{ required: true, message: 'Please provide a reason for rejection' }]}
          >
            <TextArea rows={4} placeholder="Enter reason for rejection..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};


