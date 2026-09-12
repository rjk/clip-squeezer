import React from 'react';
import { MediaInfo } from '../types/media';
import { Icon } from './Icon';

interface FileSummaryHeaderProps {
  mediaInfo: MediaInfo;
  onReset: () => void;
}

export const FileSummaryHeader: React.FC<FileSummaryHeaderProps> = ({ mediaInfo, onReset }) => {
  return (
    <div className="file-summary-header">
      <div className="file-info-col">
        <div className="file-title-row">
          <Icon name="video" className="file-icon" size={22} />
          <span className="file-name" title={mediaInfo.path}>
            {mediaInfo.filename}
          </span>
        </div>
        <div className="file-meta-row">
          <span className="meta-tag">{mediaInfo.friendly_duration}</span>
          <span className="meta-separator">·</span>
          <span className="meta-tag">{mediaInfo.friendly_resolution}</span>
          <span className="meta-separator">·</span>
          <span className="meta-tag">{mediaInfo.friendly_size}</span>
        </div>
      </div>

      <button className="btn-secondary change-file-btn" onClick={onReset} title="Start over with a different file">
        <Icon name="restart" size={16} />
        <span>Start over</span>
      </button>
    </div>
  );
};
