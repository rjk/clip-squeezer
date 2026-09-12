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

interface GifSizeEstimate {
  estimated_size_bytes: number;
  friendly_estimated_size: string;
  exceeds_size_limit: boolean;
  size_limit_bytes: number;
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
  const [allowLargeGif, setAllowLargeGif] = useState(
    () => initialRequest?.allow_large_gif || false
  );
  const [summaries, setSummaries] = useState<Partial<Record<ConvertFormat, ConversionPlanSummary>>>({});
  const [gifEstimate, setGifEstimate] = useState<GifSizeEstimate | null>(null);
  const [isEstimatingGif, setIsEstimatingGif] = useState(false);
  const [convertAfterEstimate, setConvertAfterEstimate] = useState(false);

  const handleFormatSelect = (newFormat: ConvertFormat) => {
    setFormat(newFormat);
    if (newFormat !== 'Gif') setConvertAfterEstimate(false);
    const nextAllowLargeGif = newFormat === 'Gif' ? allowLargeGif : false;
    setAllowLargeGif(nextAllowLargeGif);
    onChange?.({ format: newFormat, allow_large_gif: nextAllowLargeGif });
  };

  useEffect(() => {
    let isCurrent = true;

    // Check all format options upfront so switching is instantaneous and never flickers
    formatOptions.filter((opt) => opt.id !== 'Gif').forEach((opt) => {
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

  useEffect(() => {
    if (format !== 'Gif') {
      setIsEstimatingGif(false);
      setGifEstimate(null);
      return;
    }

    let isCurrent = true;
    setGifEstimate(null);
    setIsEstimatingGif(true);
    invoke<GifSizeEstimate>('estimate_gif', { path: mediaInfo.path })
      .then((estimate) => {
        if (isCurrent) setGifEstimate(estimate);
      })
      .catch((err) => {
        console.error('Failed to estimate GIF size:', err);
      })
      .finally(() => {
        if (isCurrent) setIsEstimatingGif(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [format, mediaInfo.path]);

  const currentSummary = summaries[format];
  const gifNeedsConfirmation = Boolean(
    format === 'Gif' && gifEstimate?.exceeds_size_limit && !allowLargeGif
  );

  useEffect(() => {
    if (!convertAfterEstimate || isEstimatingGif) return;

    setConvertAfterEstimate(false);
    if (gifNeedsConfirmation) return;

    const request = { format, allow_large_gif: allowLargeGif };
    onChange?.(request);
    onStartConvert(request);
  }, [allowLargeGif, convertAfterEstimate, format, gifNeedsConfirmation, isEstimatingGif, onChange, onStartConvert]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Keep the button available while the estimate runs. The summary below explains why
    // conversion waits briefly instead of changing the cursor to a disabled state.
    if (format === 'Gif' && isEstimatingGif) {
      setConvertAfterEstimate(true);
      return;
    }

    const request = {
      format,
      // Clicking the explicitly labelled large-GIF action is the confirmation.
      allow_large_gif: allowLargeGif || gifNeedsConfirmation,
    };
    onChange?.(request);
    onStartConvert(request);
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
                ? 'Optimised for web sharing'
                : currentSummary?.is_remux
                ? 'No quality change'
                : 'The video needs converting'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {format === 'Gif'
                ? 'GIFs loop automatically at 640px and 12 frames per second, with no sound.'
                : currentSummary?.is_remux
                ? "It'll be quick with no quality loss as we don't need to re-encode the video."
                : 'This will take a bit longer as it needs re-encoding. Quality should remain the same.'}
            </div>
          </div>
        </div>

        <div className="config-actions">
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500' }}>
              New file size:{' '}
              <strong>
                {format === 'Gif'
                  ? isEstimatingGif
                    ? 'estimating…'
                    : gifEstimate
                    ? `around ${gifEstimate.friendly_estimated_size}`
                    : 'will be checked while converting'
                  : 'shown when conversion finishes'}
              </strong>
            </div>
            {gifNeedsConfirmation ? (
              <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '2px' }}>
                Above the 25 MB sharing limit. A shorter clip or MP4 will be more practical.
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Your original file is never modified.
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary">
            <Icon name="convert" size={16} />
            <span>{gifNeedsConfirmation ? 'Create GIF anyway' : isEstimatingGif ? 'Checking GIF size…' : 'Convert'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
