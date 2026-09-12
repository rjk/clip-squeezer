import React, { useState } from 'react';
import {
  MediaInfo,
  ExtractAudioMode,
  ExtractAudioRequest,
} from '../../types/media';
import { Icon } from '../../components/Icon';
import { OutputFileDetails } from '../../components/OutputFileDetails';

interface ExtractAudioViewProps {
  mediaInfo: MediaInfo;
  initialRequest?: ExtractAudioRequest | null;
  onStartExtract: (request: ExtractAudioRequest, suggestedFilename: string) => void;
  onChange?: (request: ExtractAudioRequest) => void;
  selectedOutputPath?: string | null;
  onEditOutput: (suggestedPath: string, suggestedFilename: string) => void;
  onBack: () => void;
}

export const ExtractAudioView: React.FC<ExtractAudioViewProps> = ({
  mediaInfo,
  initialRequest,
  onStartExtract,
  onChange,
  selectedOutputPath,
  onEditOutput,
  onBack,
}) => {
  const [mode, setMode] = useState<ExtractAudioMode>(
    () => initialRequest?.mode || 'OriginalQuality'
  );

  const handleModeSelect = (newMode: ExtractAudioMode) => {
    setMode(newMode);
    onChange?.({ mode: newMode });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange?.({ mode });
    onStartExtract({ mode }, targetFilename);
  };

  if (!mediaInfo.has_audio) {
    return (
      <div className="config-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn-secondary" onClick={onBack} title="Back to actions">
            <Icon name="back" size={16} />
          </button>
          <h2 className="section-heading">Extract audio</h2>
        </div>

        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Icon name="warning" size={24} style={{ color: 'var(--text-muted)' }} />
          <div>
            <div style={{ fontWeight: '600' }}>No audio track</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              This video doesn't contain an audio track to extract.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button className="btn-secondary" onClick={onBack}>
            Back to actions
          </button>
        </div>
      </div>
    );
  }

  const origCodec = mediaInfo.audio_streams[0]?.codec?.toLowerCase() || '';
  const origExt =
    origCodec === 'mp3' ? '.mp3' : origCodec === 'opus' ? '.opus' : origCodec === 'flac' ? '.flac' : '.m4a';

  const baseName = mediaInfo.filename.replace(/\.[^/.]+$/, '');
  const targetExt = mode === 'Mp3' ? '.mp3' : mode === 'M4a' ? '.m4a' : origExt;
  const targetFilename = `${baseName}-audio${targetExt}`;
  const estimatedSizeBytes = Math.max(
    32 * 1024,
    Math.round((mediaInfo.duration_seconds || 1) * (mode === 'M4a' ? 160 : 192) * 1000 / 8)
  );
  const estimatedSize = estimatedSizeBytes < 1024 * 1024
    ? `${Math.round(estimatedSizeBytes / 1024)} KB`
    : `${(estimatedSizeBytes / (1024 * 1024)).toFixed(1)} MB`;

  const options: { id: ExtractAudioMode; title: string; desc: string; info: string }[] = [
    {
      id: 'OriginalQuality',
      title: 'Original quality — Fastest',
      desc: `Direct stream copy (${origCodec ? origCodec.toUpperCase() : 'Audio'}). Zero re-encoding, preserving 100% original quality.`,
      info: `Extracts the original audio stream bit-for-bit into a matching ${origExt} container without transcoding.`,
    },
    {
      id: 'Mp3',
      title: 'MP3 — Works everywhere',
      desc: 'Standard audio file compatible with virtually every player and device.',
      info: 'Universal compatibility. Plays on all computers, smartphones, car stereos, and digital media players.',
    },
    {
      id: 'M4a',
      title: 'M4A — Modern AAC audio',
      desc: 'High clarity at compact size. Standard on modern devices.',
      info: 'Plays natively on Apple devices (iPhone, Mac), Android, Windows 10/11, and web browsers. Legacy players from before ~2012 may prefer MP3.',
    },
  ];

  return (
    <div className="config-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button className="btn-secondary" onClick={onBack} title="Back to actions">
          <Icon name="back" size={16} />
        </button>
        <h2 className="section-heading">Extract audio</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="config-section">
          <label className="config-label">Choose audio format</label>
          <div className="option-cards">
            {options.map((opt) => (
              <div
                key={opt.id}
                className={`option-card ${mode === opt.id ? 'active' : ''}`}
                onClick={() => handleModeSelect(opt.id)}
                tabIndex={0}
                role="button"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="option-title">{opt.title}</div>
                  <span
                    title={opt.info}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      color: 'var(--text-muted)',
                      cursor: 'help',
                    }}
                  >
                    <Icon name="info" size={16} />
                  </span>
                </div>
                <div className="option-desc">{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="config-actions">
          <OutputFileDetails
            sourcePath={mediaInfo.path}
            suggestedFilename={targetFilename}
            selectedOutputPath={selectedOutputPath}
            estimatedSize={estimatedSize}
            onEditOutput={onEditOutput}
          />

          <button type="submit" className="btn-primary">
            <Icon name="extract-audio" size={16} />
            <span>Extract audio</span>
          </button>
        </div>
      </form>
    </div>
  );
};
