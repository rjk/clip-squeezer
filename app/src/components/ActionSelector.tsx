import React from 'react';
import { PrimaryAction, MediaInfo } from '../types/media';
import { Icon } from './Icon';

interface ActionSelectorProps {
  mediaInfo: MediaInfo;
  onSelectAction: (action: PrimaryAction) => void;
}

export const ActionSelector: React.FC<ActionSelectorProps> = ({ mediaInfo, onSelectAction }) => {
  return (
    <div className="action-selector-container">
      <h2 className="section-heading">What do you want to do?</h2>

      <div className="action-grid">
        <button
          className="action-card"
          onClick={() => onSelectAction('compress')}
          disabled={!mediaInfo.has_video}
        >
          <div className="action-icon-wrapper compress">
            <Icon name="make-smaller" size={26} />
          </div>
          <div className="action-text">
            <span className="action-title">Make smaller</span>
            <span className="action-desc">Reduce file size</span>
          </div>
        </button>

        <button className="action-card" onClick={() => onSelectAction('convert')}>
          <div className="action-icon-wrapper convert">
            <Icon name="convert" size={26} />
          </div>
          <div className="action-text">
            <span className="action-title">Convert</span>
            <span className="action-desc">Turn into MP4, MOV, MKV, or WebM</span>
          </div>
        </button>

        <button
          className="action-card"
          onClick={() => onSelectAction('trim')}
          disabled={!mediaInfo.has_video}
        >
          <div className="action-icon-wrapper trim">
            <Icon name="trim" size={26} />
          </div>
          <div className="action-text">
            <span className="action-title">Trim</span>
            <span className="action-desc">Cut off the start or end</span>
          </div>
        </button>

        <button
          className={`action-card ${!mediaInfo.has_audio ? 'disabled' : ''}`}
          onClick={() => onSelectAction('extract_audio')}
          disabled={!mediaInfo.has_audio}
          title={!mediaInfo.has_audio ? "This video doesn't contain an audio track" : undefined}
        >
          <div className="action-icon-wrapper audio">
            <Icon name="extract-audio" size={26} />
          </div>
          <div className="action-text">
            <span className="action-title">Extract audio</span>
            <span className="action-desc">
              {!mediaInfo.has_audio ? 'No audio track in this file' : 'Save sound to a new file'}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
