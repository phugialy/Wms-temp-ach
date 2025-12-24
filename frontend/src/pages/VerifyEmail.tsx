import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Result, Button, Spin, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export const VerifyEmail = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const checkSession = useAuthStore((state) => state.checkSession);

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      const email = searchParams.get('email');

      if (!token || !email) {
        setStatus('error');
        setErrorMessage('Invalid verification link. Missing token or email.');
        return;
      }

      try {
        // Find the registration request
        const { data: request, error: requestError } = await supabase
          .from('wms_registration_requests')
          .select('*')
          .eq('email', email)
          .eq('verification_token', token)
          .eq('app_identifier', 'WMS')
          .single();

        if (requestError || !request) {
          setStatus('error');
          setErrorMessage('Invalid or expired verification link.');
          return;
        }

        // Check if token is expired
        if (request.verification_token_expires_at) {
          const expiresAt = new Date(request.verification_token_expires_at);
          if (expiresAt < new Date()) {
            setStatus('error');
            setErrorMessage('Verification link has expired. Please contact an administrator.');
            return;
          }
        }

        // Check if already verified
        if (request.status === 'VERIFIED') {
          setStatus('success');
          message.success('Email already verified!');
          return;
        }

        // Call backend API to verify email
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            email,
          }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Verification failed');
        }

        setStatus('success');
        message.success('Email verified successfully! You can now log in.');
      } catch (error: any) {
        console.error('Verification error:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Failed to verify email. Please try again or contact support.');
      }
    };

    verifyEmail();
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Card>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>Verifying your email...</p>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <Card style={{ maxWidth: 500, width: '100%' }}>
        {status === 'success' ? (
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="Email Verified Successfully!"
            subTitle="Your email has been verified. You can now log in to access the system."
            extra={[
              <Button type="primary" key="login" onClick={() => navigate('/login')}>
                Go to Login
              </Button>,
            ]}
          />
        ) : (
          <Result
            icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            title="Verification Failed"
            subTitle={errorMessage || 'Unable to verify your email. Please contact support.'}
            extra={[
              <Button key="retry" onClick={() => window.location.reload()}>
                Retry
              </Button>,
              <Button type="primary" key="login" onClick={() => navigate('/login')}>
                Go to Login
              </Button>,
            ]}
          />
        )}
      </Card>
    </div>
  );
};

