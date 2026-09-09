import React, { useState } from 'react';
import {
  MediaInfo,
  ExtractAudioMode,
  ExtractAudioRequest,
} from '../../types/media';
import { Icon } from '../../components/Icon';

interface ExtractAudioViewProps {
  mediaInfo: MediaInfo;
  onStartExtract: (request: ExtractAudioRequest) => void;
  onBack: () => void;
}

export const ExtractAudioView: React.FC<ExtractAudioViewProps> = ({
  mediaInfo,
  onStartExtract,
  onBack,
}) => {
  const [mode, setMode] = useState<ExtractAudioMode>('OriginalQuality');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartExtract({ mode });
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
  const targetFilename = `${baseName} (audio)${targetExt}`;

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
                onClick={() => setMode(opt.id)}
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
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500' }}>
              Output file: <strong>{targetFilename}</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Your original file is never modified.
            </div>
          </div>

          <button type="submit" className="btn-primary">
            <Icon name="extract-audio" size={16} />
            <span>Extract audio</span>
          </button>
        </div>
      </form>
    </div>
  );
};
