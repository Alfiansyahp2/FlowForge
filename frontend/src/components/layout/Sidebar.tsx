import type { ReactNode } from 'react';

interface SidebarProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'compact' | 'wide';
  collapsible?: boolean;
  isCollapsed?: boolean;
  sticky?: boolean; // New: make sidebar sticky/fixed
}

export function Sidebar({
  children,
  className = '',
  variant = 'default',
  collapsible = false,
  isCollapsed = false,
  sticky = false
}: SidebarProps) {
  const baseStyles = 'bg-white border-r border-gray-200 flex flex-col';

  const variantStyles: Record<string, string> = {
    default: 'w-64',
    compact: 'w-20',
    wide: 'w-80'
  };

  const collapsedStyles = isCollapsed ? 'w-16' : '';

  const widthStyle = collapsible
    ? collapsedStyles || variantStyles[variant]
    : variantStyles[variant];

  // Sticky styles - makes sidebar fixed in position
  const stickyStyles = sticky
    ? 'position-sticky top-0 h-screen overflow-y-auto'
    : '';

  return (
    <aside className={`${baseStyles} ${widthStyle} ${stickyStyles} ${className} transition-all duration-300`}>
      {children}
    </aside>
  );
}
