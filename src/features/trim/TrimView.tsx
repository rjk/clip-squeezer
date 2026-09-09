import React, { useState, useRef, useEffect, useCallback } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { MediaInfo, TrimRequest } from '../../types/media';
import { Icon } from '../../components/Icon';

interface TrimViewProps {
  mediaInfo: MediaInfo;
  onStartTrim: (request: TrimRequest) => void;
  onBack: () => void;
}

export const TrimView: React.FC<TrimViewProps> = ({
  mediaInfo,
  onStartTrim,
  onBack,
}) => {
  const duration = Math.max(0.1, mediaInfo.duration_seconds);
  const [startSeconds, setStartSeconds] = useState(0);
  const [endSeconds, setEndSeconds] = useState(duration);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState(() => convertFileSrc(mediaInfo.path));
  const [isPreparingProxy, setIsPreparingProxy] = useState(false);
  const [proxyError, setProxyError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | 'scrub' | null>(null);

  const handleLoadProxy = useCallback(async () => {
    setIsPreparingProxy(true);
    setProxyError(null);
    try {
      const proxyPath = await invoke<string>('ensure_preview_proxy', {
        path: mediaInfo.path,
      });
      const newSrc = convertFileSrc(proxyPath);
      setVideoSrc(newSrc);
    } catch (err) {
      console.error('Proxy preparation failed:', err);
      setProxyError('Could not generate video preview, but you can still trim using timestamps.');
    } finally {
      setIsPreparingProxy(false);
    }
  }, [mediaInfo.path]);

  // Proactively generate preview proxy for reliable playback across formats
  useEffect(() => {
    handleLoadProxy();
  }, [handleLoadProxy]);

  // When videoSrc updates or element mounts, ensure video loads metadata and shows initial frame
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [videoSrc]);

  const handleVideoError = () => {
    if (!isPreparingProxy) {
      handleLoadProxy();
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (videoRef.current.currentTime >= endSeconds - 0.05) {
        videoRef.current.currentTime = startSeconds;
      }
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    // Loop within kept region if playing
    if (isPlaying && cur >= endSeconds) {
      videoRef.current.currentTime = startSeconds;
    }
  };

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
  };

  const parseTime = (text: string): number | null => {
    const parts = text.split(':');
    if (parts.length === 2) {
      const m = parseFloat(parts[0]);
      const s = parseFloat(parts[1]);
      if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0) {
        return m * 60 + s;
      }
    } else if (parts.length === 1) {
      const s = parseFloat(parts[0]);
      if (!isNaN(s) && s >= 0) {
        return s;
      }
    }
    return null;
  };

  const handleStartChange = (val: number) => {
    const clamped = Math.min(Math.max(0, val), endSeconds - 0.1);
    setStartSeconds(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  const handleEndChange = (val: number) => {
    const clamped = Math.max(Math.min(duration, val), startSeconds + 0.1);
    setEndSeconds(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  // Timeline drag handling
  const getTimeFromEvent = useCallback((clientX: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    const time = getTimeFromEvent(e.clientX);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
    setDraggingHandle('scrub');
  };

  useEffect(() => {
    if (!draggingHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      const time = getTimeFromEvent(e.clientX);
      if (draggingHandle === 'start') {
        const clamped = Math.min(Math.max(0, time), endSeconds - 0.1);
        setStartSeconds(clamped);
        if (videoRef.current) videoRef.current.currentTime = clamped;
      } else if (draggingHandle === 'end') {
        const clamped = Math.max(Math.min(duration, time), startSeconds + 0.1);
        setEndSeconds(clamped);
        if (videoRef.current) videoRef.current.currentTime = clamped;
      } else if (draggingHandle === 'scrub') {
        const clamped = Math.max(0, Math.min(duration, time));
        setCurrentTime(clamped);
        if (videoRef.current) videoRef.current.currentTime = clamped;
      }
    };

    const handleMouseUp = () => {
      setDraggingHandle(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingHandle, duration, endSeconds, getTimeFromEvent, startSeconds]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartTrim({
      start_seconds: startSeconds,
      end_seconds: endSeconds,
    });
  };

  const keptDuration = (endSeconds - startSeconds).toFixed(1);
  const startPercent = (startSeconds / duration) * 100;
  const endPercent = (endSeconds / duration) * 100;
  const currentPercent = (Math.max(0, Math.min(duration, currentTime)) / duration) * 100;

  return (
    <div className="config-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button className="btn-secondary" onClick={onBack} title="Back to actions">
          <Icon name="back" size={16} />
        </button>
        <h2 className="section-heading">Trim video</h2>
      </div>

      {/* Video Preview */}
      <div
        style={{
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#000000',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          maxHeight: 'min(320px, 34vh)',
          height: 'min(320px, 34vh)',
          marginTop: '6px',
        }}
      >
        <video
          key={videoSrc}
          ref={videoRef}
          src={videoSrc}
          preload="auto"
          playsInline
          style={{ width: '100%', height: '100%', maxHeight: 'min(320px, 34vh)', objectFit: 'contain' }}
          onTimeUpdate={handleTimeUpdate}
          onError={handleVideoError}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = startSeconds;
            }
          }}
          onClick={togglePlay}
        />
        <button
          type="button"
          onClick={togglePlay}
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            backgroundColor: 'rgba(0,0,0,0.65)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            cursor: 'pointer',
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Icon name="pause" size={18} /> : <Icon name="play" size={18} style={{ marginLeft: '2px' }} />}
        </button>
      </div>

      {/* Timeline Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
        {/* Real Video Editor Timeline Bar */}
        <div
          ref={timelineRef}
          onMouseDown={handleTimelineMouseDown}
          style={{
            position: 'relative',
            height: '48px',
            backgroundColor: '#1e293b',
            borderRadius: '8px',
            cursor: 'pointer',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            userSelect: 'none',
          }}
        >
          {/* Dimmed left region (cut off start) */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${startPercent}%`,
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              borderRight: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          />

          {/* Active kept region */}
          <div
            style={{
              position: 'absolute',
              left: `${startPercent}%`,
              width: `${Math.max(0, endPercent - startPercent)}%`,
              height: '100%',
              backgroundColor: 'rgba(59, 130, 246, 0.25)',
              borderTop: '2px solid #3b82f6',
              borderBottom: '2px solid #3b82f6',
            }}
          />

          {/* Dimmed right region (cut off end) */}
          <div
            style={{
              position: 'absolute',
              left: `${endPercent}%`,
              top: 0,
              width: `${Math.max(0, 100 - endPercent)}%`,
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          />

          {/* Start Handle Line */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              setDraggingHandle('start');
            }}
            style={{
              position: 'absolute',
              left: `${startPercent}%`,
              top: 0,
              width: '18px',
              height: '100%',
              transform: 'translateX(-9px)',
              cursor: 'ew-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
            title="Drag to adjust start trim"
          >
            <div
              style={{
                width: '4px',
                height: '100%',
                backgroundColor: '#3b82f6',
                borderRadius: '2px',
                boxShadow: '0 0 6px rgba(59, 130, 246, 0.6)',
              }}
            />
          </div>

          {/* End Handle Line */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              setDraggingHandle('end');
            }}
            style={{
              position: 'absolute',
              left: `${endPercent}%`,
              top: 0,
              width: '18px',
              height: '100%',
              transform: 'translateX(-9px)',
              cursor: 'ew-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
            title="Drag to adjust end trim"
          >
            <div
              style={{
                width: '4px',
                height: '100%',
                backgroundColor: '#3b82f6',
                borderRadius: '2px',
                boxShadow: '0 0 6px rgba(59, 130, 246, 0.6)',
              }}
            />
          </div>

          {/* Playhead Play Position Line */}
          <div
            style={{
              position: 'absolute',
              left: `${currentPercent}%`,
              top: 0,
              width: '2px',
              height: '100%',
              backgroundColor: '#ffffff',
              boxShadow: '0 0 4px rgba(255, 255, 255, 0.9)',
              pointerEvents: 'none',
              zIndex: 15,
            }}
          >
            {/* Playhead top cap */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '-4px',
                width: '10px',
                height: '8px',
                backgroundColor: '#ffffff',
                clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
              }}
            />
          </div>
        </div>

        {/* Timestamp Inputs and Keep Readout */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary)',
            padding: '12px 16px',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Start:</span>
            <input
              type="text"
              defaultValue={formatTime(startSeconds)}
              key={`start_${startSeconds}`}
              onBlur={(e) => {
                const parsed = parseTime(e.target.value);
                if (parsed !== null) handleStartChange(parsed);
              }}
              style={{
                width: '78px',
                padding: '4px 8px',
                fontSize: '0.85rem',
                borderRadius: '4px',
                border: '1px solid var(--border)',
              }}
            />
          </div>

          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--primary)' }}>
            Keep: {keptDuration} sec
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>End:</span>
            <input
              type="text"
              defaultValue={formatTime(endSeconds)}
              key={`end_${endSeconds}`}
              onBlur={(e) => {
                const parsed = parseTime(e.target.value);
                if (parsed !== null) handleEndChange(parsed);
              }}
              style={{
                width: '78px',
                padding: '4px 8px',
                fontSize: '0.85rem',
                borderRadius: '4px',
                border: '1px solid var(--border)',
              }}
            />
          </div>
        </div>

        {/* Discreet proxy loading status below controls */}
        {isPreparingProxy && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              paddingLeft: '4px',
            }}
          >
            <Icon name="loading" className="spinner" style={{ width: '14px', height: '14px' }} />
            <span>Preparing video preview...</span>
          </div>
        )}

        {proxyError && (
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-secondary)',
              padding: '6px 10px',
              borderRadius: '6px',
            }}
          >
            {proxyError}
          </div>
        )}

        {/* Submit */}
        <div className="config-actions">
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500' }}>
              Cuts: <strong>{formatTime(startSeconds)}</strong> to <strong>{formatTime(endSeconds)}</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Your original file is never modified.
            </div>
          </div>

          <button type="button" className="btn-primary" onClick={handleSubmit}>
            <Icon name="trim" size={16} />
            <span>Save trimmed video</span>
          </button>
        </div>
      </div>
    </div>
  );
};
