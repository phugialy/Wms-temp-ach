import { create } from 'zustand';
import type { User } from '../types';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string; requiresApproval?: boolean }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  
  login: async (email: string, password: string) => {
    try {
      // Handle default admin login (case-insensitive)
      const emailLower = email.toLowerCase().trim();
      if ((emailLower === 'admin' || emailLower === 'admin@wms.local') && password === 'Ustvmos817') {
        // Create a mock admin user
        const adminUser: User = {
          id: 'admin-default',
          email: 'admin@wms.local',
          name: 'Administrator',
          full_name: 'System Administrator',
          role: 'ADMIN',
          is_verified: true,
          is_active: true,
        };
        set({ user: adminUser, isAuthenticated: true, isLoading: false });
        // Store in localStorage for persistence
        localStorage.setItem('wms_user', JSON.stringify(adminUser));
        return { success: true };
      }

      // Regular Supabase login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Fetch user details from wms_users table
        const { data: wmsUser, error: userError } = await supabase
          .from('wms_users')
          .select('*')
          .eq('id', data.user.id)
          .eq('app_identifier', 'WMS')
          .single();

        if (userError) {
          console.error('Error fetching WMS user:', userError);
          await supabase.auth.signOut();
          return { success: false, error: `Database error: ${userError.message}` };
        }

        if (!wmsUser) {
          // Try to auto-fix: create user record if they're a pre-approved admin
          console.log('User not found in wms_users, attempting to fix...');
          try {
            const fixResponse = await fetch('/api/auth/fix-user-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: data.user.email }),
            });

            const fixResult = await fixResponse.json();
            if (fixResult.success) {
              // Retry fetching user
              const { data: fixedUser } = await supabase
                .from('wms_users')
                .select('*')
                .eq('id', data.user.id)
                .eq('app_identifier', 'WMS')
                .single();

              if (fixedUser && fixedUser.is_active && fixedUser.is_verified) {
                const user: User = {
                  id: fixedUser.id,
                  email: fixedUser.email,
                  name: fixedUser.full_name || fixedUser.email.split('@')[0],
                  full_name: fixedUser.full_name,
                  role: fixedUser.role as 'OPERATOR' | 'ADMIN' | 'MANAGER',
                  is_verified: fixedUser.is_verified,
                  is_active: fixedUser.is_active,
                };
                set({ user, isAuthenticated: true });
                return { success: true };
              }
            }
          } catch (fixError) {
            console.error('Error fixing user account:', fixError);
          }

          await supabase.auth.signOut();
          return { success: false, error: 'User account not found in WMS system. Please contact administrator.' };
        }

        if (!wmsUser.is_active) {
          await supabase.auth.signOut();
          return { success: false, error: 'Your account has been deactivated. Please contact administrator.' };
        }

        if (!wmsUser.is_verified) {
          await supabase.auth.signOut();
          return { success: false, error: 'Your email is not verified. Please check your email for verification link.' };
        }

        const user: User = {
          id: wmsUser.id,
          email: wmsUser.email,
          name: wmsUser.full_name || wmsUser.email.split('@')[0],
          full_name: wmsUser.full_name,
          role: wmsUser.role as 'OPERATOR' | 'ADMIN' | 'MANAGER',
          is_verified: wmsUser.is_verified,
          is_active: wmsUser.is_active,
        };

        set({ user, isAuthenticated: true });
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Login failed' };
    }
  },

  register: async (email: string, password: string, fullName: string) => {
    try {
      // Check if email is in pre-approved admin list
      const { data: adminCheck } = await supabase
        .from('wms_admins')
        .select('email')
        .eq('email', email.toLowerCase())
        .eq('app_identifier', 'WMS')
        .eq('is_active', true)
        .single();

      const isPreApproved = !!adminCheck;

      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        if (isPreApproved) {
          // Auto-approve pre-approved admins - create user record immediately
          const { error: insertError } = await supabase
            .from('wms_users')
            .insert({
              id: data.user.id,
              email: email.toLowerCase(),
              full_name: fullName,
              role: 'ADMIN',
              is_verified: true, // Pre-approved admins are auto-verified
              is_active: true,
              app_identifier: 'WMS',
              verified_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('Error creating user:', insertError);
            // If insert fails due to duplicate, try to update instead
            const { error: updateError } = await supabase
              .from('wms_users')
              .update({
                full_name: fullName,
                role: 'ADMIN',
                is_verified: true,
                is_active: true,
                verified_at: new Date().toISOString(),
              })
              .eq('id', data.user.id)
              .eq('app_identifier', 'WMS');

            if (updateError) {
              console.error('Error updating user:', updateError);
              // If both fail, try using upsert
              await supabase
                .from('wms_users')
                .upsert({
                  id: data.user.id,
                  email: email.toLowerCase(),
                  full_name: fullName,
                  role: 'ADMIN',
                  is_verified: true,
                  is_active: true,
                  app_identifier: 'WMS',
                  verified_at: new Date().toISOString(),
                }, {
                  onConflict: 'id',
                });
            }
          }

          // Send welcome email (optional, but helpful)
          try {
            await fetch('/api/auth/send-welcome-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: email.toLowerCase(), fullName }),
            });
          } catch (error) {
            console.error('Error sending welcome email:', error);
          }

          // Don't sign out - allow immediate login for pre-approved admins
          return { success: true, requiresApproval: false };
        } else {
          // Create registration request
          const { data: requestData, error: requestError } = await supabase
            .from('wms_registration_requests')
            .insert({
              email: email.toLowerCase(),
              full_name: fullName,
              status: 'PENDING',
              app_identifier: 'WMS',
            })
            .select()
            .single();

          if (requestError) {
            console.error('Error creating registration request:', requestError);
          } else if (requestData) {
            // Notify admins about new registration request
            try {
              await fetch('/api/auth/notify-admins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: requestData.id }),
              });
            } catch (error) {
              console.error('Error notifying admins:', error);
            }
          }

          // Sign out the user until approved
          await supabase.auth.signOut();

          return { success: true, requiresApproval: true };
        }
      }

      return { success: false, error: 'Registration failed' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Registration failed' };
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('authToken');
    localStorage.removeItem('wms_user');
    set({ user: null, isAuthenticated: false });
  },

  checkSession: async () => {
    try {
      set({ isLoading: true });
      
      // Check for default admin in localStorage first
      const storedUser = localStorage.getItem('wms_user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          if (user.id === 'admin-default') {
            set({ user, isAuthenticated: true, isLoading: false });
            return;
          }
        } catch (e) {
          // Invalid stored user, continue to Supabase check
        }
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Fetch user details from wms_users table
        const { data: wmsUser } = await supabase
          .from('wms_users')
          .select('*')
          .eq('id', session.user.id)
          .eq('app_identifier', 'WMS')
          .single();

        if (wmsUser && wmsUser.is_active) {
          const user: User = {
            id: wmsUser.id,
            email: wmsUser.email,
            name: wmsUser.full_name || wmsUser.email.split('@')[0],
            full_name: wmsUser.full_name,
            role: wmsUser.role as 'OPERATOR' | 'ADMIN' | 'MANAGER',
            is_verified: wmsUser.is_verified,
            is_active: wmsUser.is_active,
          };
          set({ user, isAuthenticated: true, isLoading: false });
          localStorage.setItem('wms_user', JSON.stringify(user));
          return;
        }
      }

      set({ user: null, isAuthenticated: false, isLoading: false });
      localStorage.removeItem('wms_user');
    } catch (error) {
      console.error('Error checking session:', error);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

