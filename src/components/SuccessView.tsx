import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import { JobResult } from '../types/media';
import { Icon } from './Icon';

interface SuccessViewProps {
  result: JobResult;
  onNewFile: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({
  result,
  onNewFile,
}) => {
  const handleShowInFolder = async () => {
    try {
      await invoke('show_in_folder', { path: result.output_path });
    } catch (err) {
      console.error('Failed to show in folder:', err);
    }
  };

  const handleOpenFile = async () => {
    try {
      await openPath(result.output_path);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const filename = result.output_path.split(/[\\/]/).pop() || result.output_path;

  return (
    <div className="success-container">
      <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icon name="success" size={36} />
        <h2 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Done</h2>
      </div>

      {result.savings_percent !== null && result.savings_percent > 0 ? (
        <div className="success-badge">
          {result.friendly_original_size} → {result.friendly_result_size} · {result.savings_percent}% smaller
        </div>
      ) : (
        <div className="success-badge">
          Saved ({result.friendly_result_size})
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          marginTop: '8px',
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>Saved as:</span>
        <button
          onClick={handleOpenFile}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            padding: 0,
          }}
          title="Click to open with default player"
        >
          <Icon name="play" size={16} /> {filename}
        </button>

        <button
          className="btn-secondary"
          onClick={handleShowInFolder}
          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
          title="Show in folder"
        >
          <Icon name="folder" size={14} />
          <span>Show in folder</span>
        </button>
      </div>

      <div className="success-actions" style={{ marginTop: '20px' }}>
        <button className="btn-primary" onClick={onNewFile}>
          <Icon name="restart" size={18} />
          <span>Start over</span>
        </button>
      </div>
    </div>
  );
};
