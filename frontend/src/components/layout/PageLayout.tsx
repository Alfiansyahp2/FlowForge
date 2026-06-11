import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

interface PageLayoutProps {
  header: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
  footer?: ReactNode;
  className?: string;
  sidebarWidth?: string; // Default: w-64 (16rem = 256px)
  noScrollWrapper?: boolean; // Disable scroll wrapper for main content (for full-height components like ReactFlow)
}

export function PageLayout({
  header,
  sidebar,
  main,
  footer,
  className = '',
  sidebarWidth = 'w-64',
  noScrollWrapper = false
}: PageLayoutProps) {
  return (
    <div className={`flex h-screen overflow-hidden bg-gray-50 ${className}`}>
      {/* Static Sidebar */}
      <div className={`${sidebarWidth} flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto`}>
        {sidebar}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header>{header}</Header>
        {noScrollWrapper ? (
          <div className="flex-1 h-full overflow-hidden">
            {main}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {main}
          </div>
        )}
        {footer ? <Footer>{footer}</Footer> : null}
      </div>
    </div>
  );
}
