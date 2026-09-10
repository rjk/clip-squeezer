import React, { useState, useRef, useEffect, useCallback } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { MediaInfo, TrimRequest } from '../../types/media';
import { Icon } from '../../components/Icon';

interface TrimViewProps {
  mediaInfo: MediaInfo;
  initialRequest?: TrimRequest | null;
  onStartTrim: (request: TrimRequest) => void;
  onChange?: (request: TrimRequest) => void;
  onBack: () => void;
}

const FRAME_DURATION = 0.04; // ~25 fps step

export const TrimView: React.FC<TrimViewProps> = ({
  mediaInfo,
  initialRequest,
  onStartTrim,
  onChange,
  onBack,
}) => {
  const duration = Math.max(0.1, mediaInfo.duration_seconds);
  const [startSeconds, setStartSeconds] = useState(() => {
    if (initialRequest && initialRequest.start_seconds >= 0 && initialRequest.start_seconds < duration) {
      return initialRequest.start_seconds;
    }
    return 0;
  });
  const [endSeconds, setEndSeconds] = useState(() => {
    if (initialRequest && initialRequest.end_seconds > 0 && initialRequest.end_seconds <= duration + 0.5) {
      return Math.min(duration, initialRequest.end_seconds);
    }
    return duration;
  });
  const [currentTime, setCurrentTime] = useState(() => {
    if (initialRequest && initialRequest.start_seconds >= 0 && initialRequest.start_seconds < duration) {
      return initialRequest.start_seconds;
    }
    return 0;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState(() => convertFileSrc(mediaInfo.path));
  const [isPreparingProxy, setIsPreparingProxy] = useState(false);
  const [proxyError, setProxyError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | 'scrub' | null>(null);
  const [activeControl, setActiveControl] = useState<'start' | 'end' | 'playhead'>('playhead');

  // Throttled seeking via requestAnimationFrame to avoid playback/seeking stalls
  const pendingSeekRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const scheduleSeek = useCallback((time: number) => {
    pendingSeekRef.current = time;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (videoRef.current && pendingSeekRef.current !== null) {
          videoRef.current.currentTime = pendingSeekRef.current;
          pendingSeekRef.current = null;
        }
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

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
      if (currentTime > 0) {
        videoRef.current.currentTime = currentTime;
      }
    }
  }, [videoSrc]);

  const handleVideoError = () => {
    if (!isPreparingProxy) {
      handleLoadProxy();
    }
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      if (videoRef.current.currentTime >= endSeconds - 0.05) {
        videoRef.current.currentTime = startSeconds;
        setCurrentTime(startSeconds);
      }
      videoRef.current.play().catch((err) => {
        console.error('Playback error:', err);
      });
    }
  }, [isPlaying, startSeconds, endSeconds]);

  const pauseVideo = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
  }, []);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    // Loop within kept region if playing
    if (isPlaying && cur >= endSeconds) {
      videoRef.current.currentTime = startSeconds;
      setCurrentTime(startSeconds);
    }
  };

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
  };

  const formatDurationLabel = (secs: number): string => {
    if (secs >= 3600) {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = (secs % 60).toFixed(1);
      return `${h}:${m.toString().padStart(2, '0')}:${s.padStart(4, '0')}`;
    }
    if (secs >= 60) {
      const m = Math.floor(secs / 60);
      const s = (secs % 60).toFixed(1);
      return `${m.toString().padStart(2, '0')}:${s.padStart(4, '0')}`;
    }
    return `${secs.toFixed(1)} sec`;
  };

  const parseTime = (text: string): number | null => {
    const trimmed = text.trim();
    const parts = trimmed.split(':');
    if (parts.length === 3) {
      const h = parseFloat(parts[0]);
      const m = parseFloat(parts[1]);
      const s = parseFloat(parts[2]);
      if (!isNaN(h) && !isNaN(m) && !isNaN(s) && h >= 0 && m >= 0 && s >= 0) {
        return h * 3600 + m * 60 + s;
      }
    } else if (parts.length === 2) {
      const m = parseFloat(parts[0]);
      const s = parseFloat(parts[1]);
      if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0) {
        return m * 60 + s;
      }
    } else if (parts.length === 1) {
      const s = parseFloat(parts[0].replace(/[^\d.]/g, ''));
      if (!isNaN(s) && s >= 0) {
        return s;
      }
    }
    return null;
  };

  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [durationInputVal, setDurationInputVal] = useState('');

  const seekTo = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(duration, val));
    setCurrentTime(clamped);
    scheduleSeek(clamped);
  }, [duration, scheduleSeek]);

  const handleStartChange = useCallback((val: number, seekVideo = false) => {
    const clamped = Math.min(Math.max(0, val), endSeconds - 0.1);
    setStartSeconds(clamped);
    if (seekVideo) {
      seekTo(clamped);
    } else {
      setCurrentTime((prev) => {
        if (prev < clamped) {
          scheduleSeek(clamped);
          return clamped;
        }
        return prev;
      });
    }
  }, [endSeconds, seekTo, scheduleSeek]);

  const handleEndChange = useCallback((val: number, seekVideo = false) => {
    const clamped = Math.max(Math.min(duration, val), startSeconds + 0.1);
    setEndSeconds(clamped);
    if (seekVideo) {
      seekTo(clamped);
    } else {
      setCurrentTime((prev) => {
        if (prev > clamped) {
          scheduleSeek(clamped);
          return clamped;
        }
        return prev;
      });
    }
  }, [duration, startSeconds, seekTo, scheduleSeek]);

  const commitStartInput = useCallback((valStr: string) => {
    const parsed = parseTime(valStr);
    if (parsed !== null && Math.abs(parsed - startSeconds) >= 0.05) {
      handleStartChange(parsed, false);
    }
  }, [handleStartChange, startSeconds]);

  const commitEndInput = useCallback((valStr: string) => {
    const parsed = parseTime(valStr);
    if (parsed !== null && Math.abs(parsed - endSeconds) >= 0.05) {
      handleEndChange(parsed, false);
    }
  }, [handleEndChange, endSeconds]);

  const commitDurationChange = useCallback((text: string) => {
    const parsed = parseTime(text);
    const currentDur = endSeconds - startSeconds;
    if (parsed !== null && parsed > 0 && Math.abs(parsed - currentDur) >= 0.05) {
      const maxPossible = Math.max(0.1, duration - startSeconds);
      const targetDuration = Math.min(parsed, maxPossible);
      handleEndChange(startSeconds + targetDuration, false);
    }
    setIsEditingDuration(false);
  }, [duration, endSeconds, handleEndChange, startSeconds]);

  const setStartToCurrent = useCallback(() => {
    handleStartChange(currentTime, true);
  }, [currentTime, handleStartChange]);

  const setEndToCurrent = useCallback(() => {
    handleEndChange(currentTime, true);
  }, [currentTime, handleEndChange]);

  const nudgePlayhead = useCallback((delta: number) => {
    const nextTime = Math.max(0, Math.min(duration, currentTime + delta));
    seekTo(nextTime);
  }, [currentTime, duration, seekTo]);

  // Timeline drag handling
  const getTimeFromEvent = useCallback((clientX: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    setActiveControl('playhead');
    const time = getTimeFromEvent(e.clientX);
    seekTo(time);
    setDraggingHandle('scrub');
  };

  useEffect(() => {
    if (!draggingHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      const time = getTimeFromEvent(e.clientX);
      if (draggingHandle === 'start') {
        const clamped = Math.min(Math.max(0, time), endSeconds - 0.1);
        setStartSeconds(clamped);
        seekTo(clamped);
      } else if (draggingHandle === 'end') {
        const clamped = Math.max(Math.min(duration, time), startSeconds + 0.1);
        setEndSeconds(clamped);
        seekTo(clamped);
      } else if (draggingHandle === 'scrub') {
        seekTo(time);
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
  }, [draggingHandle, duration, endSeconds, getTimeFromEvent, seekTo, startSeconds]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in text inputs or textareas
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target && target.isContentEditable)
      ) {
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : FRAME_DURATION;
        if (activeControl === 'start') {
          handleStartChange(Math.max(0, startSeconds - step), true);
        } else if (activeControl === 'end') {
          handleEndChange(Math.max(startSeconds + 0.1, endSeconds - step), true);
        } else {
          nudgePlayhead(-step);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : FRAME_DURATION;
        if (activeControl === 'start') {
          handleStartChange(Math.min(endSeconds - 0.1, startSeconds + step), true);
        } else if (activeControl === 'end') {
          handleEndChange(Math.min(duration, endSeconds + step), true);
        } else {
          nudgePlayhead(step);
        }
      } else if (e.key === '[' || e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setStartToCurrent();
      } else if (e.key === ']' || e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setEndToCurrent();
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        nudgePlayhead(-1.0);
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        pauseVideo();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        nudgePlayhead(1.0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    togglePlay,
    nudgePlayhead,
    setStartToCurrent,
    setEndToCurrent,
    pauseVideo,
    activeControl,
    startSeconds,
    endSeconds,
    duration,
    handleStartChange,
    handleEndChange,
  ]);

  useEffect(() => {
    onChange?.({
      start_seconds: startSeconds,
      end_seconds: endSeconds,
    });
  }, [startSeconds, endSeconds, onChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const req: TrimRequest = {
      start_seconds: startSeconds,
      end_seconds: endSeconds,
    };
    onChange?.(req);
    onStartTrim(req);
  };

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
      <div className="trim-preview-container">
        <video
          key={videoSrc}
          ref={videoRef}
          src={videoSrc}
          className="trim-preview-video"
          preload="auto"
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onError={handleVideoError}
          onLoadedData={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = Math.max(0.001, startSeconds);
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = Math.max(0.001, startSeconds);
            }
          }}
          onClick={togglePlay}
        />
        {isPreparingProxy ? (
          <div
            style={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#ffffff',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: '14px 22px',
              borderRadius: '8px',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            <Icon name="loading" className="spinner" size={24} />
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Generating video preview...</span>
          </div>
        ) : (
          <button
            type="button"
            className="trim-play-overlay-btn"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Icon name="pause" size={18} /> : <Icon name="play" size={18} style={{ marginLeft: '2px' }} />}
          </button>
        )}
      </div>

      {/* Timeline Controls */}
      <div className="trim-timeline-wrapper">
        {/* Timeline Bar */}
        <div
          ref={timelineRef}
          className="trim-timeline-track"
          onMouseDown={handleTimelineMouseDown}
        >
          {/* Dimmed cut start region */}
          <div
            className="trim-region-cut start"
            style={{ width: `${startPercent}%` }}
          />

          {/* Active kept region */}
          <div
            className="trim-region-kept"
            style={{
              left: `${startPercent}%`,
              width: `${Math.max(0, endPercent - startPercent)}%`,
            }}
          />

          {/* Dimmed cut end region */}
          <div
            className="trim-region-cut end"
            style={{ width: `${Math.max(0, 100 - endPercent)}%` }}
          />

          {/* Start Handle Bracket */}
          <div
            className={`trim-handle start ${draggingHandle === 'start' ? 'active' : ''} ${activeControl === 'start' ? 'selected' : ''}`}
            style={{ left: `${startPercent}%` }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setActiveControl('start');
              setDraggingHandle('start');
            }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveControl('start');
            }}
            title="Start trim point (selected: Left/Right arrows nudge start)"
          >
            <div className="trim-handle-bracket">
              <div className="trim-handle-grip" />
              <div className="trim-handle-grip" />
            </div>
            {draggingHandle === 'start' && (
              <div className="trim-drag-tooltip">{formatTime(startSeconds)}</div>
            )}
          </div>

          {/* End Handle Bracket */}
          <div
            className={`trim-handle end ${draggingHandle === 'end' ? 'active' : ''} ${activeControl === 'end' ? 'selected' : ''}`}
            style={{ left: `${endPercent}%` }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setActiveControl('end');
              setDraggingHandle('end');
            }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveControl('end');
            }}
            title="End trim point (selected: Left/Right arrows nudge end)"
          >
            <div className="trim-handle-bracket">
              <div className="trim-handle-grip" />
              <div className="trim-handle-grip" />
            </div>
            {draggingHandle === 'end' && (
              <div className="trim-drag-tooltip">{formatTime(endSeconds)}</div>
            )}
          </div>

          {/* Playhead Play Position Line */}
          <div
            className="trim-playhead"
            style={{ left: `${currentPercent}%` }}
          >
            <div className="trim-playhead-cap" />
            {draggingHandle === 'scrub' && (
              <div className="trim-drag-tooltip">{formatTime(currentTime)}</div>
            )}
          </div>
        </div>

        {/* Time Ruler */}
        <div className="trim-ruler">
          <div className="trim-ruler-tick">
            <div className="trim-ruler-tick-mark" />
            <span>0:00</span>
          </div>
          <div className="trim-ruler-tick">
            <div className="trim-ruler-tick-mark" />
            <span>{formatTime(duration * 0.25)}</span>
          </div>
          <div className="trim-ruler-tick">
            <div className="trim-ruler-tick-mark" />
            <span>{formatTime(duration * 0.5)}</span>
          </div>
          <div className="trim-ruler-tick">
            <div className="trim-ruler-tick-mark" />
            <span>{formatTime(duration * 0.75)}</span>
          </div>
          <div className="trim-ruler-tick">
            <div className="trim-ruler-tick-mark" />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Timestamp Inputs and Keep Readout */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary)',
            padding: '10px 14px',
            borderRadius: '8px',
            marginTop: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Start:</span>
            <input
              type="text"
              defaultValue={formatTime(startSeconds)}
              key={`start_${startSeconds}`}
              onFocus={() => setActiveControl('start')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitStartInput((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={(e) => {
                commitStartInput(e.target.value);
              }}
              style={{
                width: '78px',
                padding: '4px 8px',
                fontSize: '0.85rem',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>
              New duration:
            </span>
            {isEditingDuration ? (
              <input
                type="text"
                autoFocus
                value={durationInputVal}
                onChange={(e) => setDurationInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitDurationChange(durationInputVal);
                  } else if (e.key === 'Escape') {
                    setIsEditingDuration(false);
                  }
                }}
                onBlur={() => commitDurationChange(durationInputVal)}
                style={{
                  width: '84px',
                  padding: '3px 6px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  borderRadius: '4px',
                  border: '1px solid var(--primary)',
                  background: 'var(--bg-card)',
                  color: 'var(--primary)',
                  textAlign: 'center',
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  const currentDur = endSeconds - startSeconds;
                  setDurationInputVal(
                    currentDur >= 60
                      ? formatDurationLabel(currentDur)
                      : currentDur.toFixed(1)
                  );
                  setIsEditingDuration(true);
                }}
                title="Click to edit desired duration (e.g. 15 or 01:30)"
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '2px 4px',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                }}
              >
                {formatDurationLabel(endSeconds - startSeconds)}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>End:</span>
            <input
              type="text"
              defaultValue={formatTime(endSeconds)}
              key={`end_${endSeconds}`}
              onFocus={() => setActiveControl('end')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitEndInput((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={(e) => {
                commitEndInput(e.target.value);
              }}
              style={{
                width: '78px',
                padding: '4px 8px',
                fontSize: '0.85rem',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
              }}
            />
          </div>
        </div>

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
              Keep: <strong>{formatTime(startSeconds)}</strong> to <strong>{formatTime(endSeconds)}</strong>
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

