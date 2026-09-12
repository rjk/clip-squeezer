import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { JobResult } from '../types/media';
import { Icon } from './Icon';

interface SuccessViewProps {
  result: JobResult;
}

export const SuccessView: React.FC<SuccessViewProps> = ({
  result,
}) => {
  const [copied, setCopied] = useState(false);

  const handleShowInFolder = async () => {
    try {
      await invoke('show_in_folder', { path: result.output_path });
    } catch (err) {
      console.error('Failed to show in folder:', err);
    }
  };

  const handleOpenFile = async () => {
    try {
      await invoke('open_file_path', { path: result.output_path });
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const filename = result.output_path.split(/[\\/]/).pop() || result.output_path;

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(result.output_path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy file path:', err);
    }
  };

  const sizeText =
    result.savings_percent !== null && result.savings_percent > 0
      ? `${result.friendly_result_size} (${result.savings_percent}% smaller)`
      : result.friendly_result_size;

  return (
    <div className="file-summary-header" style={{ alignItems: 'center' }}>
      <div className="file-info-col" style={{ flex: 1, minWidth: 0 }}>
        <div className="file-title-row" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <button
            type="button"
            className={`filename-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopyPath}
            title="Click to copy full file path"
            aria-label="Copy full file path"
          >
            <span className="file-name" style={{ maxWidth: '460px' }}>
              {filename}
            </span>
            <span className="copy-icon-wrapper" aria-hidden="true">
              <Icon
                name={copied ? 'check' : 'copy'}
                size={15}
                style={{
                  color: copied ? 'var(--success)' : 'var(--text-muted)',
                  flexShrink: 0,
                }}
              />
            </span>
            {copied && <span className="copy-tooltip">Copied full path!</span>}
          </button>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              className="btn-secondary"
              onClick={handleOpenFile}
              style={{ padding: '5px 8px' }}
              title="Play file"
              aria-label={`Play ${filename}`}
            >
              <Icon name="play" size={14} />
            </button>
            <button
              className="btn-secondary"
              onClick={handleShowInFolder}
              style={{ padding: '5px 8px' }}
              title="Show in folder"
              aria-label={`Show ${filename} in folder`}
            >
              <Icon name="folder" size={14} />
            </button>
          </div>
        </div>

        <div className="file-meta-row" style={{ paddingLeft: 0 }}>
          {result.friendly_duration && (
            <>
              <span className="meta-tag">{result.friendly_duration}</span>
              <span className="meta-separator">·</span>
            </>
          )}
          {result.friendly_resolution && (
            <>
              <span className="meta-tag">{result.friendly_resolution}</span>
              <span className="meta-separator">·</span>
            </>
          )}
          <span className="meta-tag">{sizeText}</span>
        </div>
      </div>
    </div>
  );
};
