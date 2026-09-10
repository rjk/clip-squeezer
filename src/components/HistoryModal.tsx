import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Icon } from './Icon';

export interface HistoryItem {
  id: string;
  action: 'compress' | 'convert' | 'trim' | 'extract_audio';
  action_label: string;
  source_filename: string;
  source_path: string;
  output_filename: string;
  output_path: string;
  timestamp: number;
  friendly_time: string;
  result_size: string;
  details?: string;
}

interface HistoryModalProps {
  history: HistoryItem[];
  onClose: () => void;
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  history,
  onClose,
  onClearHistory,
}) => {
  const handleOpenFile = async (path: string) => {
    try {
      await invoke('open_file_path', { path });
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const handleShowInFolder = async (path: string) => {
    try {
      await invoke('show_in_folder', { path });
    } catch (err) {
      console.error('Failed to show in folder:', err);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="history" size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
              Recent Activity
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {history.length > 0 && (
              <button
                className="btn-secondary"
                onClick={onClearHistory}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                title="Clear all history"
              >
                <Icon name="trash" size={13} />
                <span>Clear</span>
              </button>
            )}
            <button className="btn-close" onClick={onClose} aria-label="Close modal">
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)' }}>
            <p style={{ margin: 0, fontSize: '0.95rem' }}>No recent activity yet.</p>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>
              Completed video operations will be logged here for quick access.
            </p>
          </div>
        ) : (
          <div
            style={{
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              paddingRight: '4px',
            }}
          >
            {history.map((item) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--primary)',
                    }}
                  >
                    {item.action_label}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {item.friendly_time}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => handleOpenFile(item.output_path)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-main)',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        padding: 0,
                        textAlign: 'left',
                        textDecoration: 'underline',
                      }}
                      title="Click to open with default player"
                    >
                      {item.output_filename}
                    </button>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      From: {item.source_filename} · {item.result_size}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      className="btn-secondary"
                      onClick={() => handleOpenFile(item.output_path)}
                      style={{ padding: '5px 8px' }}
                      title="Play file"
                      aria-label={`Play ${item.output_filename}`}
                    >
                      <Icon name="play" size={14} />
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleShowInFolder(item.output_path)}
                      style={{ padding: '5px 8px' }}
                      title="Show in folder"
                      aria-label={`Show ${item.output_filename} in folder`}
                    >
                      <Icon name="folder" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>
            <Icon name="close" size={16} /> Close
          </button>
        </div>
      </div>
    </div>
  );
};
