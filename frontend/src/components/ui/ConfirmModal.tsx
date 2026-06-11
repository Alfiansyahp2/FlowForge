import React from 'react';
import { create } from 'zustand';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  type: 'danger' | 'warning' | 'info' | 'success';
}

interface ConfirmModalStore {
  isOpen: boolean;
  config: ConfirmState | null;
  openConfirm: (config: Omit<ConfirmState, 'isOpen'>) => void;
  closeConfirm: () => void;
}

export const useConfirmStore = create<ConfirmModalStore>((set) => ({
  isOpen: false,
  config: null,

  openConfirm: (config) => {
    set({ isOpen: true, config });
  },

  closeConfirm: () => {
    set({ isOpen: false, config: null });
  },
}));

export function ConfirmModal() {
  const { isOpen, config, closeConfirm } = useConfirmStore();

  if (!config || !isOpen) return null;

  const handleConfirm = () => {
    config.onConfirm();
    closeConfirm();
  };

  const handleCancel = () => {
    if (config.onCancel) {
      config.onCancel();
    }
    closeConfirm();
  };

  const typeStyles = {
    danger: {
      bg: '#fee2e2',
      border: '#ef4444',
      text: '#991b1b',
      confirmBg: '#dc2626',
    },
    warning: {
      bg: '#fef3c7',
      border: '#f59e0b',
      text: '#92400e',
      confirmBg: '#d97706',
    },
    info: {
      bg: '#dbeafe',
      border: '#3b82f6',
      text: '#1e40af',
      confirmBg: '#2563eb',
    },
    success: {
      bg: '#d1fae5',
      border: '#10b981',
      text: '#065f46',
      confirmBg: '#059669',
    },
  };

  const styles = typeStyles[config.type] || typeStyles.info;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: '20px',
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          maxWidth: '500px',
          width: '100%',
          padding: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: '20px',
            fontWeight: '600',
            marginBottom: '12px',
            color: styles.text,
          }}
        >
          {config.title}
        </h2>

        <div
          style={{
            marginBottom: '24px',
            fontSize: '14px',
            color: '#6b7280',
            lineHeight: '1.5',
          }}
        >
          {config.message}
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              border: `2px solid ${styles.border}`,
              color: styles.text,
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = styles.bg}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            style={{
              padding: '10px 20px',
              backgroundColor: styles.confirmBg,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              const darkerColor = styles.confirmBg === '#dc2626' ? '#b91c1c' :
                               styles.confirmBg === '#d97706' ? '#b45309' :
                               styles.confirmBg === '#2563eb' ? '#1d4ed8' :
                               styles.confirmBg === '#059669' ? '#047857' : '';
              e.currentTarget.style.backgroundColor = darkerColor;
            }}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = styles.confirmBg}
          >
            {config.type === 'danger' ? '🗑️ Delete' :
             config.type === 'warning' ? '⚠️ Confirm' :
             config.type === 'info' ? 'ℹ️ Continue' :
             '✓ Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
