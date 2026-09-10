import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  MediaInfo,
  ConvertFormat,
  ConvertRequest,
} from '../../types/media';
import { Icon } from '../../components/Icon';

interface ConvertViewProps {
  mediaInfo: MediaInfo;
  initialRequest?: ConvertRequest | null;
  onStartConvert: (request: ConvertRequest) => void;
  onChange?: (request: ConvertRequest) => void;
  onBack: () => void;
}

interface ConversionPlanSummary {
  is_remux: boolean;
  video_action: string;
  audio_action: string;
  target_ext: string;
  message: string;
}

export const ConvertView: React.FC<ConvertViewProps> = ({
  mediaInfo,
  initialRequest,
  onStartConvert,
  onChange,
  onBack,
}) => {
  const inputExt = mediaInfo.filename.split('.').pop()?.toLowerCase() || '';

  const allFormatOptions: { id: ConvertFormat; label: string; desc: string }[] = [
    {
      id: 'Mp4',
      label: 'MP4 — Recommended',
      desc: 'Works almost everywhere.',
    },
    {
      id: 'Mov',
      label: 'MOV',
      desc: 'Common in Mac and editing workflows.',
    },
    {
      id: 'Mkv',
      label: 'MKV',
      desc: 'Flexible format that can keep many kinds of video and audio.',
    },
    {
      id: 'Webm',
      label: 'WebM',
      desc: 'Mainly useful for web workflows.',
    },
    {
      id: 'Gif',
      label: 'GIF',
      desc: 'Best for short looping animations and easy sharing.',
    },
  ];

  // Filter out the source format if it already matches
  const formatOptions = allFormatOptions.filter((opt) => {
    if (opt.id === 'Mp4' && (inputExt === 'mp4' || inputExt === 'm4v')) return false;
    if (opt.id === 'Mov' && inputExt === 'mov') return false;
    if (opt.id === 'Mkv' && inputExt === 'mkv') return false;
    if (opt.id === 'Webm' && inputExt === 'webm') return false;
    if (opt.id === 'Gif' && inputExt === 'gif') return false;
    return true;
  });

  const [format, setFormat] = useState<ConvertFormat>(() => {
    if (initialRequest && formatOptions.some((opt) => opt.id === initialRequest.format)) {
      return initialRequest.format;
    }
    return formatOptions[0]?.id || 'Mp4';
  });
  const [summaries, setSummaries] = useState<Partial<Record<ConvertFormat, ConversionPlanSummary>>>({});

  const baseName = mediaInfo.filename.replace(/\.[^/.]+$/, '');
  const destFilename = `${baseName}-converted.${format.toLowerCase()}`;

  const handleFormatSelect = (newFormat: ConvertFormat) => {
    setFormat(newFormat);
    onChange?.({ format: newFormat });
  };

  useEffect(() => {
    let isCurrent = true;

    // Check all format options upfront so switching is instantaneous and never flickers
    formatOptions.forEach((opt) => {
      invoke<ConversionPlanSummary>('check_conversion', {
        path: mediaInfo.path,
        format: opt.id,
      })
        .then((res) => {
          if (isCurrent) {
            setSummaries((prev) => ({ ...prev, [opt.id]: res }));
          }
        })
        .catch((err) => {
          console.error('Failed to check conversion:', err);
        });
    });

    return () => {
      isCurrent = false;
    };
  }, [mediaInfo.path]);

  const currentSummary = summaries[format];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange?.({ format });
    onStartConvert({ format });
  };

  return (
    <div className="config-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button className="btn-secondary" onClick={onBack} title="Back to actions">
          <Icon name="back" size={16} />
        </button>
        <h2 className="section-heading">Convert</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="config-section">
          <label className="config-label">Choose destination format</label>
          <div className="convert-format-grid">
            {formatOptions.map((opt) => (
              <div
                key={opt.id}
                className={`option-card ${format === opt.id ? 'active' : ''}`}
                onClick={() => handleFormatSelect(opt.id)}
                tabIndex={0}
                role="button"
              >
                <div className="option-title">{opt.label}</div>
                <div className="option-desc">{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Plain language remux/transcode status indicator - always mounted with stable height to prevent layout shift */}
        <div
          className={`convert-info-box ${currentSummary?.is_remux && format !== 'Gif' ? 'fast-remux' : ''}`}
        >
          {format === 'Gif' ? (
            <Icon name="info" size={20} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
          ) : currentSummary?.is_remux ? (
            <Icon name="fast" size={20} style={{ color: 'var(--success)', marginTop: '2px', flexShrink: 0 }} />
          ) : (
            <Icon name="clock" size={20} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-main)' }}>
              {format === 'Gif'
                ? 'Made for short clips'
                : currentSummary?.is_remux
                ? 'No quality change'
                : 'The video needs converting'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {format === 'Gif'
                ? 'GIFs loop automatically and are easy to share, but can be much larger than MP4 or WebM.'
                : currentSummary?.is_remux
                ? "It'll be quick with no quality loss as we don't need to re-encode the video."
                : 'This will take a bit longer as it needs re-encoding. Quality should remain the same.'}
            </div>
          </div>
        </div>

        <div className="config-actions">
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500' }}>
              Destination: <strong>{destFilename}</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Your original file is never modified.
            </div>
          </div>

          <button type="submit" className="btn-primary">
            <Icon name="convert" size={16} />
            <span>Convert</span>
          </button>
        </div>
      </form>
    </div>
  );
};
