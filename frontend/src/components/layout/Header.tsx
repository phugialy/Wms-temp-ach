import { useAuthStore } from '../../stores/authStore';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bell, Menu, ChevronDown } from 'lucide-react';

export const Header = () => {
  const user = useAuthStore((state) => state.user);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userName = user?.name || 'User';
  const userRole = user?.role || 'OPERATOR';
  const userInitial = userName.charAt(0).toUpperCase();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
    const sidebar = document.querySelector('aside');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) {
      sidebar.classList.toggle('sidebar-open');
      if (overlay) {
        overlay.style.display = sidebar.classList.contains('sidebar-open') ? 'block' : 'none';
      }
    }
  };

  return (
    <>
      <header 
        className="fixed top-0 right-0 h-16 flex items-center justify-between z-40 transition-all duration-300 bg-background border-b"
        style={{
          left: 'var(--sidebar-width)',
          padding: '0 var(--spacing-lg)',
        }}
      >
        {/* Left Section - Mobile Menu & Page Title */}
        <div className="flex items-center gap-4 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden md:block">
            <h2 className="text-lg font-semibold" id="pageTitle">
              Dashboard
            </h2>
          </div>
        </div>

        {/* Right Section - Actions & User Menu */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <Button 
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border-2 border-background" />
          </Button>
          
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 h-auto py-1.5 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-semibold leading-tight">{userName}</div>
                  <div className="text-xs text-muted-foreground leading-tight">{userRole}</div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{userRole}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  useAuthStore.getState().logout();
                }}
                className="text-destructive focus:text-destructive"
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 1024px) {
          header {
            left: 0 !important;
          }
        }
      `}</style>
    </>
  );
};

export default Header;

