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
  onStartConvert: (request: ConvertRequest) => void;
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
  onStartConvert,
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
  ];

  // Filter out the source format if it already matches
  const formatOptions = allFormatOptions.filter((opt) => {
    if (opt.id === 'Mp4' && (inputExt === 'mp4' || inputExt === 'm4v')) return false;
    if (opt.id === 'Mov' && inputExt === 'mov') return false;
    if (opt.id === 'Mkv' && inputExt === 'mkv') return false;
    if (opt.id === 'Webm' && inputExt === 'webm') return false;
    return true;
  });

  const [format, setFormat] = useState<ConvertFormat>(() => formatOptions[0]?.id || 'Mp4');
  const [summary, setSummary] = useState<ConversionPlanSummary | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const baseName = mediaInfo.filename.replace(/\.[^/.]+$/, '');
  const destFilename = `${baseName} (converted).${format.toLowerCase()}`;

  useEffect(() => {
    let isCurrent = true;
    setIsChecking(true);

    invoke<ConversionPlanSummary>('check_conversion', {
      path: mediaInfo.path,
      format,
    })
      .then((res) => {
        if (isCurrent) {
          setSummary(res);
        }
      })
      .catch((err) => {
        console.error('Failed to check conversion:', err);
      })
      .finally(() => {
        if (isCurrent) {
          setIsChecking(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [mediaInfo.path, format]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
          <div className="option-cards">
            {formatOptions.map((opt) => (
              <div
                key={opt.id}
                className={`option-card ${format === opt.id ? 'active' : ''}`}
                onClick={() => setFormat(opt.id)}
                tabIndex={0}
                role="button"
              >
                <div className="option-title">{opt.label}</div>
                <div className="option-desc">{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Plain language remux/transcode status indicator */}
        {summary && !isChecking && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '8px',
              backgroundColor: summary.is_remux ? 'var(--success-bg)' : 'var(--bg-secondary)',
              border: `1px solid ${summary.is_remux ? 'var(--success)' : 'var(--border)'}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            {summary.is_remux ? (
              <Icon name="fast" size={20} style={{ color: 'var(--success)', marginTop: '2px', flexShrink: 0 }} />
            ) : (
              <Icon name="clock" size={20} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                {summary.is_remux ? 'No quality change' : 'The video needs converting'}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {summary.is_remux
                  ? 'This conversion can be completed without re-encoding the video.'
                  : 'This will take longer because the video format needs to change.'}
              </div>
            </div>
          </div>
        )}

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
