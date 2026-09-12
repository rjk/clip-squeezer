import React, { useState } from 'react';
import {
  MediaInfo,
  CompressQuality,
  CompressResolution,
  CompressCompatibility,
  CompressRequest,
} from '../../types/media';
import { Icon } from '../../components/Icon';
import { OutputFileDetails } from '../../components/OutputFileDetails';

interface CompressViewProps {
  mediaInfo: MediaInfo;
  initialRequest?: CompressRequest | null;
  onStartCompress: (request: CompressRequest, suggestedFilename: string) => void;
  onChange?: (request: CompressRequest) => void;
  selectedOutputPath?: string | null;
  onEditOutput: (suggestedPath: string, suggestedFilename: string) => void;
  onBack: () => void;
}

export const CompressView: React.FC<CompressViewProps> = ({
  mediaInfo,
  initialRequest,
  onStartCompress,
  onChange,
  selectedOutputPath,
  onEditOutput,
  onBack,
}) => {
  const [quality, setQuality] = useState<CompressQuality>(
    () => initialRequest?.quality || 'Balanced'
  );
  const [resolution, setResolution] = useState<CompressResolution>(
    () => initialRequest?.resolution || 'KeepOriginal'
  );
  const [compatibility, setCompatibility] = useState<CompressCompatibility>(
    () => initialRequest?.compatibility || 'Wide'
  );

  const handleQualityChange = (newQuality: CompressQuality) => {
    setQuality(newQuality);
    onChange?.({ quality: newQuality, resolution, compatibility });
  };

  const handleResolutionChange = (newResolution: CompressResolution) => {
    setResolution(newResolution);
    onChange?.({ quality, resolution: newResolution, compatibility });
  };

  const handleCompatibilityChange = (newCompatibility: CompressCompatibility) => {
    setCompatibility(newCompatibility);
    onChange?.({ quality, resolution, compatibility: newCompatibility });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const req: CompressRequest = {
      quality,
      resolution,
      compatibility,
    };
    onChange?.(req);
    onStartCompress(req, `${mediaInfo.filename.replace(/\.[^/.]+$/, '')}-smaller.mp4`);
  };

  const vStream = mediaInfo.video_streams?.[0];
  const origW = vStream?.width || 1920;
  const origH = vStream?.height || 1080;
  const minDim = Math.min(origW, origH);

  // Only show downscale target buttons if original resolution is strictly larger than that target
  const show1080p = minDim > 1080;
  const show720p = minDim > 720;

  // File size estimation heuristic based on CRF targets, resolution scaling, and original bitrate
  const calculateEstimateBytes = (
    q: CompressQuality,
    r: CompressResolution,
    c: CompressCompatibility
  ): number => {
    const duration = Math.max(1, mediaInfo.duration_seconds || 1);
    const inputBytes = Math.max(1024, mediaInfo.size_bytes || 1024);

    let targetH = minDim;
    if (r === 'P1080' && minDim > 1080) targetH = 1080;
    if (r === 'P720' && minDim > 720) targetH = 720;

    // Scale factor based on resolution downscaling relative to original
    const resReductionFactor = Math.pow(targetH / minDim, 1.3);

    // Target video bitrates at 1080p (kbps) and maximum ratio of original size
    let crfTarget1080Kbps = 2200;
    let maxRatioOfOriginal = 0.60;

    if (c === 'Wide') {
      if (q === 'BestQuality') {
        crfTarget1080Kbps = 4200;
        maxRatioOfOriginal = 0.85;
      } else if (q === 'Balanced') {
        crfTarget1080Kbps = 2200;
        maxRatioOfOriginal = 0.60;
      } else {
        crfTarget1080Kbps = 1100;
        maxRatioOfOriginal = 0.35;
      }
    } else {
      // H.265 (HEVC) produces ~35-40% smaller files than H.264
      if (q === 'BestQuality') {
        crfTarget1080Kbps = 2700;
        maxRatioOfOriginal = 0.60;
      } else if (q === 'Balanced') {
        crfTarget1080Kbps = 1400;
        maxRatioOfOriginal = 0.40;
      } else {
        crfTarget1080Kbps = 750;
        maxRatioOfOriginal = 0.22;
      }
    }

    // Scale bitrate target according to target resolution relative to 1080p
    const resRatioTo1080 = Math.pow(targetH / 1080, 1.3);
    const targetVideoBitrateKbps = crfTarget1080Kbps * resRatioTo1080;
    const targetAudioBitrateKbps = mediaInfo.has_audio ? 128 : 0;
    const targetTotalBitrateKbps = targetVideoBitrateKbps + targetAudioBitrateKbps;

    const bitrateEstBytes = (targetTotalBitrateKbps * 1000 * duration) / 8;
    const ratioEstBytes = inputBytes * maxRatioOfOriginal * resReductionFactor;

    // Use the lower of bitrate estimate and ratio estimate so low-bitrate input doesn't inflate
    let est = Math.min(bitrateEstBytes, ratioEstBytes);

    // Strict ceiling so quality levels never collapse into identical numbers
    const qualityCapFactor = q === 'BestQuality' ? 0.90 : q === 'Balanced' ? 0.72 : 0.48;
    const maxCap = inputBytes * qualityCapFactor * resReductionFactor;
    est = Math.min(est, maxCap);

    // Floor to prevent tiny or zero values
    const minFloor = Math.max(30 * 1024, inputBytes * 0.03);
    return Math.max(est, minFloor);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      const mb = bytes / (1024 * 1024);
      return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  };

  const currentEstimateBytes = calculateEstimateBytes(quality, resolution, compatibility);
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
              onClick={() => handleQualityChange('BestQuality')}
            >
              Best quality
            </button>
            <button
              type="button"
              className={`segmented-btn ${quality === 'Balanced' ? 'active' : ''}`}
              onClick={() => handleQualityChange('Balanced')}
            >
              Balanced — Recommended
            </button>
            <button
              type="button"
              className={`segmented-btn ${quality === 'SmallestFile' ? 'active' : ''}`}
              onClick={() => handleQualityChange('SmallestFile')}
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
              onClick={() => handleResolutionChange('KeepOriginal')}
            >
              Keep original ({mediaInfo.friendly_resolution})
            </button>
            {show1080p && (
              <button
                type="button"
                className={`segmented-btn ${resolution === 'P1080' ? 'active' : ''}`}
                onClick={() => handleResolutionChange('P1080')}
              >
                1080p
              </button>
            )}
            {show720p && (
              <button
                type="button"
                className={`segmented-btn ${resolution === 'P720' ? 'active' : ''}`}
                onClick={() => handleResolutionChange('P720')}
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
              onClick={() => handleCompatibilityChange('Wide')}
              tabIndex={0}
              role="button"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="option-title">Works everywhere — Recommended</div>
                <span
                  title="Uses the H.264 (AVC) encoder. Universally supported on virtually all computers, smartphones, TVs, and web browsers made since 2010."
                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}
                >
                  <Icon name="info" size={16} />
                </span>
              </div>
              <div className="option-desc">
                Uses H.264 encoding. Best choice to work on all devices and apps.
              </div>
            </div>

            <div
              className={`option-card ${compatibility === 'SmallerFile' ? 'active' : ''}`}
              onClick={() => handleCompatibilityChange('SmallerFile')}
              tabIndex={0}
              role="button"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="option-title">Smaller file</div>
                <span
                  title="Uses H.265 (HEVC) encoding. Compresses up to 40% smaller at identical visual quality. Supported on modern devices (iPhone iOS 11+, Android 5+, Windows 10/11, macOS, modern smart TVs)."
                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}
                >
                  <Icon name="info" size={16} />
                </span>
              </div>
              <div className="option-desc">
                Uses H.265 (HEVC) encoding. Plays on modern devices, generally from 2016 onwards.
              </div>
            </div>
          </div>
        </div>

        <div className="config-actions">
          <OutputFileDetails
            sourcePath={mediaInfo.path}
            suggestedFilename={`${mediaInfo.filename.replace(/\.[^/.]+$/, '')}-smaller.mp4`}
            selectedOutputPath={selectedOutputPath}
            estimatedSize={formatBytes(currentEstimateBytes)}
            onEditOutput={onEditOutput}
          />

          <button type="submit" className="btn-primary">
            <Icon name="make-smaller" size={16} />
            <span>Make smaller</span>
          </button>
        </div>
      </form>
    </div>
  );
};
