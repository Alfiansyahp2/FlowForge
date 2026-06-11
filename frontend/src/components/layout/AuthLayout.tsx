import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  showLogo?: boolean;
  variant?: 'centered' | 'split' | 'full';
}

export function AuthLayout({
  children,
  title,
  description,
  showLogo = true,
  variant = 'centered'
}: AuthLayoutProps) {
  const containerStyles: Record<string, string> = {
    centered: 'flex min-h-screen items-center justify-center',
    split: 'flex min-h-screen',
    full: 'min-h-screen'
  };

  const backgroundStyles: Record<string, string> = {
    centered: 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4',
    split: 'bg-gradient-to-br from-indigo-600 to-purple-700 dark:from-indigo-900 dark:to-purple-900',
    full: 'bg-gray-50 dark:bg-gray-900'
  };

  return (
    <div className={`${containerStyles[variant]} ${backgroundStyles[variant]}`}>
      <div className="w-full max-w-md">
        {showLogo && (
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-bold text-xl text-gray-900 dark:text-white">FlowForge</span>
            </div>
            {title && (
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
            )}
            {description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{description}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
