import { Router, Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { emailService } from '../services/email.service';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

/**
 * POST /api/auth/approve-registration
 * Approve a registration request and send verification email
 */
router.post('/approve-registration', async (req: Request, res: Response): Promise<void> => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      res.status(400).json({
        success: false,
        error: 'Request ID is required',
      });
      return;
    }

    // Get the registration request
    const { data: request, error: requestError } = await supabase
      .from('wms_registration_requests')
      .select('*')
      .eq('id', requestId)
      .eq('app_identifier', 'WMS')
      .single();

    if (requestError || !request) {
      res.status(404).json({
        success: false,
        error: 'Registration request not found',
      });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        error: 'Request is not pending',
      });
      return;
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24); // 24 hours expiry

    // Update request status
    const { error: updateError } = await supabase
      .from('wms_registration_requests')
      .update({
        status: 'APPROVED',
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.body.reviewerId || null, // TODO: Get from auth session
        verification_token: verificationToken,
        verification_token_expires_at: tokenExpiresAt.toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      logger.error('[AuthRoute] Error updating request:', updateError);
      res.status(500).json({
        success: false,
        error: 'Failed to update request',
      });
      return;
    }

    // Get all admin emails for notification
    const { data: admins } = await supabase
      .from('wms_admins')
      .select('email')
      .eq('app_identifier', 'WMS')
      .eq('is_active', true);

    const adminEmails = admins?.map((a) => a.email) || [];

    // Create verification link
    const baseUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';
    const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(request.email)}`;

    // Send verification email to user
    logger.info('[AuthRoute] Attempting to send verification email', {
      to: request.email,
      emailServiceReady: emailService.isReady(),
      provider: emailService.getProvider(),
    });

    const emailSent = await emailService.sendEmail({
      to: request.email,
      subject: 'WMS Account Approved - Verify Your Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1890ff;">Account Approved!</h2>
          <p>Hello ${request.full_name || request.email},</p>
          <p>Your registration request for the Warehouse Management System has been approved.</p>
          <p>Please click the link below to verify your email address and complete your registration:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #1890ff; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              Verify Email Address
            </a>
          </p>
          <p>This link will expire in 24 hours.</p>
          <p>If you did not request this account, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #888; font-size: 12px;">
            Warehouse Management System<br />
            DNCL Techzone
          </p>
        </div>
      `,
    });

    if (!emailSent) {
      logger.warn('[AuthRoute] Failed to send verification email, but request was approved', {
        email: request.email,
        emailServiceReady: emailService.isReady(),
        provider: emailService.getProvider(),
      });
    } else {
      logger.info('[AuthRoute] Verification email sent successfully', {
        email: request.email,
      });
    }

    res.json({
      success: true,
      message: 'Registration approved and verification email sent',
      emailSent,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[AuthRoute] Error approving registration:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to approve registration',
      details: errorMessage,
    });
  }
});

/**
 * POST /api/auth/reject-registration
 * Reject a registration request
 */
router.post('/reject-registration', async (req: Request, res: Response): Promise<void> => {
  try {
    const { requestId, reason } = req.body;

    if (!requestId) {
      res.status(400).json({
        success: false,
        error: 'Request ID is required',
      });
      return;
    }

    if (!reason) {
      res.status(400).json({
        success: false,
        error: 'Rejection reason is required',
      });
      return;
    }

    // Get the registration request
    const { data: request, error: requestError } = await supabase
      .from('wms_registration_requests')
      .select('*')
      .eq('id', requestId)
      .eq('app_identifier', 'WMS')
      .single();

    if (requestError || !request) {
      res.status(404).json({
        success: false,
        error: 'Registration request not found',
      });
      return;
    }

    // Update request status
    const { error: updateError } = await supabase
      .from('wms_registration_requests')
      .update({
        status: 'REJECTED',
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.body.reviewerId || null, // TODO: Get from auth session
        rejection_reason: reason,
      })
      .eq('id', requestId);

    if (updateError) {
      logger.error('[AuthRoute] Error updating request:', updateError);
      res.status(500).json({
        success: false,
        error: 'Failed to update request',
      });
      return;
    }

    // Send rejection email
    await emailService.sendEmail({
      to: request.email,
      subject: 'WMS Registration Request Rejected',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff4d4f;">Registration Request Rejected</h2>
          <p>Hello ${request.full_name || request.email},</p>
          <p>We regret to inform you that your registration request for the Warehouse Management System has been rejected.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>If you believe this is an error, please contact the system administrator.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #888; font-size: 12px;">
            Warehouse Management System<br />
            DNCL Techzone
          </p>
        </div>
      `,
    });

    res.json({
      success: true,
      message: 'Registration rejected',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[AuthRoute] Error rejecting registration:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to reject registration',
      details: errorMessage,
    });
  }
});

/**
 * POST /api/auth/notify-admins
 * Notify all admins about a new registration request
 */
router.post('/notify-admins', async (req: Request, res: Response): Promise<void> => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      res.status(400).json({
        success: false,
        error: 'Request ID is required',
      });
      return;
    }

    // Get the registration request
    const { data: request } = await supabase
      .from('wms_registration_requests')
      .select('*')
      .eq('id', requestId)
      .eq('app_identifier', 'WMS')
      .single();

    if (!request) {
      res.status(404).json({
        success: false,
        error: 'Registration request not found',
      });
      return;
    }

    // Get all admin emails
    const { data: admins } = await supabase
      .from('wms_admins')
      .select('email')
      .eq('app_identifier', 'WMS')
      .eq('is_active', true);

    const adminEmails = admins?.map((a) => a.email) || [];

    if (adminEmails.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No active admins found',
      });
      return;
    }

    const baseUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';
    const approvalUrl = `${baseUrl}/admin-approvals`;

    // Send notification to all admins
    logger.info('[AuthRoute] Attempting to notify admins', {
      adminCount: adminEmails.length,
      emails: adminEmails,
      emailServiceReady: emailService.isReady(),
      provider: emailService.getProvider(),
    });

    const emailSent = await emailService.sendEmail({
      to: adminEmails,
      subject: 'New WMS Registration Request - Action Required',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1890ff;">New Registration Request</h2>
          <p>A new user has requested access to the Warehouse Management System.</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p><strong>Email:</strong> ${request.email}</p>
            <p><strong>Full Name:</strong> ${request.full_name || 'Not provided'}</p>
            <p><strong>Requested At:</strong> ${new Date(request.requested_at).toLocaleString()}</p>
          </div>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${approvalUrl}" 
               style="background-color: #1890ff; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              Review Request
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #888; font-size: 12px;">
            Warehouse Management System<br />
            DNCL Techzone
          </p>
        </div>
      `,
    });

    if (!emailSent) {
      logger.warn('[AuthRoute] Failed to send admin notification email', {
        adminCount: adminEmails.length,
        emailServiceReady: emailService.isReady(),
        provider: emailService.getProvider(),
      });
    } else {
      logger.info('[AuthRoute] Admin notification email sent successfully', {
        adminCount: adminEmails.length,
      });
    }

    res.json({
      success: true,
      message: 'Admin notification sent',
      emailSent,
      recipients: adminEmails.length,
      emailServiceReady: emailService.isReady(),
      provider: emailService.getProvider(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[AuthRoute] Error notifying admins:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to notify admins',
      details: errorMessage,
    });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email address using token
 */
router.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, email } = req.body;

    if (!token || !email) {
      res.status(400).json({
        success: false,
        error: 'Token and email are required',
      });
      return;
    }

    // Find the registration request
    const { data: request, error: requestError } = await supabase
      .from('wms_registration_requests')
      .select('*')
      .eq('email', email)
      .eq('verification_token', token)
      .eq('app_identifier', 'WMS')
      .single();

    if (requestError || !request) {
      res.status(404).json({
        success: false,
        error: 'Invalid or expired verification link',
      });
      return;
    }

    // Check if token is expired
    if (request.verification_token_expires_at) {
      const expiresAt = new Date(request.verification_token_expires_at);
      if (expiresAt < new Date()) {
        res.status(400).json({
          success: false,
          error: 'Verification link has expired. Please contact an administrator.',
        });
        return;
      }
    }

    // Check if already verified
    if (request.status === 'VERIFIED') {
      res.json({
        success: true,
        message: 'Email already verified',
      });
      return;
    }

    // Get the user from Supabase Auth (using admin client)
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User account not found. Please contact an administrator.',
      });
      return;
    }

    // Update wms_users table
    const { error: updateError } = await supabase
      .from('wms_users')
      .upsert({
        id: user.id,
        email: email.toLowerCase(),
        full_name: request.full_name,
        role: 'OPERATOR', // Default role
        is_verified: true,
        is_active: true,
        app_identifier: 'WMS',
        verified_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (updateError) {
      logger.error('[AuthRoute] Error updating user:', updateError);
      // Try to insert if update fails
      const { error: insertError } = await supabase
        .from('wms_users')
        .insert({
          id: user.id,
          email: email.toLowerCase(),
          full_name: request.full_name,
          role: 'OPERATOR',
          is_verified: true,
          is_active: true,
          app_identifier: 'WMS',
          verified_at: new Date().toISOString(),
        });

      if (insertError) {
        throw insertError;
      }
    }

    // Update registration request status
    await supabase
      .from('wms_registration_requests')
      .update({
        status: 'VERIFIED',
        verified_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[AuthRoute] Error verifying email:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to verify email',
      details: errorMessage,
    });
  }
});

/**
 * POST /api/auth/send-welcome-email
 * Send welcome email to pre-approved admin
 */
router.post('/send-welcome-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, fullName } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required',
      });
      return;
    }

    const baseUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';
    const loginUrl = `${baseUrl}/login`;

    // Send welcome email
    const emailSent = await emailService.sendEmail({
      to: email,
      subject: 'Welcome to WMS - Your Account is Ready!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #52c41a;">Welcome to WMS!</h2>
          <p>Hello ${fullName || email},</p>
          <p>Your account has been created and approved. You can now access the Warehouse Management System.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="background-color: #1890ff; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              Log In Now
            </a>
          </p>
          <p>Use your registered email and password to log in.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #888; font-size: 12px;">
            Warehouse Management System<br />
            DNCL Techzone
          </p>
        </div>
      `,
    });

    if (!emailSent) {
      logger.warn('[AuthRoute] Failed to send welcome email, but account is created');
    }

    res.json({
      success: true,
      message: 'Welcome email sent',
      emailSent,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[AuthRoute] Error sending welcome email:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to send welcome email',
      details: errorMessage,
    });
  }
});

/**
 * POST /api/auth/fix-user-account
 * Fix user account - create wms_users record if missing
 * This is a helper endpoint to fix accounts that exist in Supabase Auth but not in wms_users
 */
router.post('/fix-user-account', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required',
      });
      return;
    }

    // Get the user from Supabase Auth
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found in Supabase Auth',
      });
      return;
    }

    // Check if user is pre-approved admin
    const { data: adminCheck } = await supabase
      .from('wms_admins')
      .select('email, full_name')
      .eq('email', email.toLowerCase())
      .eq('app_identifier', 'WMS')
      .eq('is_active', true)
      .single();

    const isAdmin = !!adminCheck;
    const role = isAdmin ? 'ADMIN' : 'OPERATOR';
    const fullName = adminCheck?.['full_name'] || user.user_metadata?.['full_name'] || email.split('@')[0];

    // Create or update wms_users record
    const { error: upsertError } = await supabase
      .from('wms_users')
      .upsert({
        id: user.id,
        email: email.toLowerCase(),
        full_name: fullName,
        role: role,
        is_verified: true,
        is_active: true,
        app_identifier: 'WMS',
        verified_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (upsertError) {
      logger.error('[AuthRoute] Error fixing user account:', upsertError);
      res.status(500).json({
        success: false,
        error: 'Failed to create user record',
        details: upsertError.message,
      });
      return;
    }

    logger.info('[AuthRoute] User account fixed successfully', {
      email: email.toLowerCase(),
      userId: user.id,
      role,
    });

    res.json({
      success: true,
      message: 'User account fixed successfully',
      user: {
        id: user.id,
        email: email.toLowerCase(),
        full_name: fullName,
        role,
        is_verified: true,
        is_active: true,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[AuthRoute] Error fixing user account:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fix user account',
      details: errorMessage,
    });
  }
});

export default router;

