import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const DashboardLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div 
        className="lg:ml-[var(--sidebar-width)] transition-all duration-300"
        style={{ 
          marginLeft: '0',
        }}
      >
        <Header />
        <main 
          className="pt-16 min-h-[calc(100vh-64px)]"
          style={{ 
            padding: 'var(--spacing-lg)',
          }}
        >
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

