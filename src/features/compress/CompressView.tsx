import React, { useState } from 'react';
import {
  MediaInfo,
  CompressQuality,
  CompressResolution,
  CompressCompatibility,
  CompressRequest,
} from '../../types/media';
import { Icon } from '../../components/Icon';

interface CompressViewProps {
  mediaInfo: MediaInfo;
  onStartCompress: (request: CompressRequest) => void;
  onBack: () => void;
}

export const CompressView: React.FC<CompressViewProps> = ({
  mediaInfo,
  onStartCompress,
  onBack,
}) => {
  const [quality, setQuality] = useState<CompressQuality>('Balanced');
  const [resolution, setResolution] = useState<CompressResolution>('KeepOriginal');
  const [compatibility, setCompatibility] = useState<CompressCompatibility>('Wide');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartCompress({
      quality,
      resolution,
      compatibility,
    });
  };

  const vStream = mediaInfo.video_streams[0];
  const minDim = vStream ? Math.min(vStream.width, vStream.height) : 1080;

  // Only show downscale target buttons if original resolution is strictly larger than that target
  const show1080p = minDim > 1080;
  const show720p = minDim > 720;

  // File size estimation heuristic based on CRF targets and resolution
  const getEstimatedSize = (): string => {
    const duration = Math.max(1, mediaInfo.duration_seconds);
    const targetHeight =
      resolution === 'P720'
        ? 720
        : resolution === 'P1080'
        ? 1080
        : minDim;

    let resFactor = 1.0;
    if (targetHeight <= 480) resFactor = 0.35;
    else if (targetHeight <= 720) resFactor = 0.55;
    else if (targetHeight <= 1080) resFactor = 1.0;
    else if (targetHeight <= 1440) resFactor = 1.7;
    else resFactor = 2.8;

    let baseVideoKbps = 2200;
    if (compatibility === 'Wide') {
      if (quality === 'BestQuality') baseVideoKbps = 4500;
      else if (quality === 'Balanced') baseVideoKbps = 2200;
      else baseVideoKbps = 1100;
    } else {
      // H.265 (HEVC)
      if (quality === 'BestQuality') baseVideoKbps = 2800;
      else if (quality === 'Balanced') baseVideoKbps = 1400;
      else baseVideoKbps = 750;
    }

    const totalKbps = baseVideoKbps * resFactor + 128;
    const estBytes = (totalKbps * 1000 * duration) / 8;
    const finalBytes = Math.min(estBytes, mediaInfo.size_bytes * 0.95);

    if (finalBytes < 1024 * 1024) {
      return `${Math.round(finalBytes / 1024)} KB`;
    } else if (finalBytes < 1024 * 1024 * 1024) {
      const mb = finalBytes / (1024 * 1024);
      return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
    } else {
      return `${(finalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  };

  const estimatedSizeLabel = getEstimatedSize();

  return (
    <div className="config-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button className="btn-secondary" onClick={onBack} title="Back to actions">
          <Icon name="back" size={16} />
        </button>
        <h2 className="section-heading">Make smaller</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Quality Section */}
        <div className="config-section">
          <label className="config-label">Quality</label>
          <div className="segmented-group">
            <button
              type="button"
              className={`segmented-btn ${quality === 'BestQuality' ? 'active' : ''}`}
              onClick={() => setQuality('BestQuality')}
            >
              Best quality
            </button>
            <button
              type="button"
              className={`segmented-btn ${quality === 'Balanced' ? 'active' : ''}`}
              onClick={() => setQuality('Balanced')}
            >
              Balanced — Recommended
            </button>
            <button
              type="button"
              className={`segmented-btn ${quality === 'SmallestFile' ? 'active' : ''}`}
              onClick={() => setQuality('SmallestFile')}
            >
              Smallest file
            </button>
          </div>
        </div>

        {/* Resolution Section */}
        <div className="config-section">
          <label className="config-label">Resolution</label>
          <div className="segmented-group">
            <button
              type="button"
              className={`segmented-btn ${resolution === 'KeepOriginal' ? 'active' : ''}`}
              onClick={() => setResolution('KeepOriginal')}
            >
              Keep original ({mediaInfo.friendly_resolution})
            </button>
            {show1080p && (
              <button
                type="button"
                className={`segmented-btn ${resolution === 'P1080' ? 'active' : ''}`}
                onClick={() => setResolution('P1080')}
              >
                1080p
              </button>
            )}
            {show720p && (
              <button
                type="button"
                className={`segmented-btn ${resolution === 'P720' ? 'active' : ''}`}
                onClick={() => setResolution('P720')}
              >
                720p
              </button>
            )}
          </div>
        </div>

        {/* Compatibility Section */}
        <div className="config-section">
          <label className="config-label">Compatibility</label>
          <div className="option-cards">
            <div
              className={`option-card ${compatibility === 'Wide' ? 'active' : ''}`}
              onClick={() => setCompatibility('Wide')}
              tabIndex={0}
              role="button"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="option-title">Works almost everywhere — Recommended</div>
                <span
                  title="Uses the H.264 (AVC) encoder. Universally supported on virtually all computers, smartphones, TVs, and web browsers made since 2010."
                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}
                >
                  <Icon name="info" size={16} />
                </span>
              </div>
              <div className="option-desc">
                Uses H.264 video encoding. Best choice if you will share the file with other people, older devices, or chat apps.
              </div>
            </div>

            <div
              className={`option-card ${compatibility === 'SmallerFile' ? 'active' : ''}`}
              onClick={() => setCompatibility('SmallerFile')}
              tabIndex={0}
              role="button"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="option-title">Smaller file</div>
                <span
                  title="Uses the H.265 (HEVC) encoder. Compresses up to 40% smaller at identical visual quality. Supported on modern devices (iPhone iOS 11+, Android 5+, Windows 10/11, macOS, modern smart TVs)."
                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}
                >
                  <Icon name="info" size={16} />
                </span>
              </div>
              <div className="option-desc">
                Uses H.265 (HEVC) encoding for extra space savings. Plays on modern smartphones and computers (generally 2016 onwards).
              </div>
            </div>
          </div>
        </div>

        {/* Reassurance Notice & Submit */}
        <div className="config-actions">
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '600' }}>
              New file size: around {estimatedSizeLabel}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Your original file is never modified.
            </div>
          </div>

          <button type="submit" className="btn-primary">
            <Icon name="make-smaller" size={16} />
            <span>Make smaller</span>
          </button>
        </div>
      </form>
    </div>
  );
};
