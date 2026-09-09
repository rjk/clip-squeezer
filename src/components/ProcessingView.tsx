import React, { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Icon } from './Icon';
import { ProgressUpdate } from '../types/media';

interface ProcessingViewProps {
  title: string;
  filename: string;
  onCancel: () => void;
  isCancelling: boolean;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({
  title,
  filename,
  onCancel,
  isCancelling,
}) => {
  const [progress, setProgress] = useState<ProgressUpdate>({
    percent: 0,
    out_time_seconds: 0,
    speed: null,
  });

  useEffect(() => {
    const unlistenPromise = listen<{
      job_id: string;
      percent: number;
      out_time_seconds: number;
      speed: string | null;
    }>('job-progress', (event) => {
      setProgress({
        percent: Math.min(100, Math.max(0, event.payload.percent)),
        out_time_seconds: event.payload.out_time_seconds,
        speed: event.payload.speed,
      });
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="progress-container">
      <div>
        <h2 className="section-heading">{title}</h2>
        <p className="drop-subtitle" style={{ marginTop: '4px' }}>
          {filename}
        </p>
      </div>

      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
      </div>

      <div className="progress-meta">
        <span>{Math.round(progress.percent)}% completed</span>
        <span>
          Time processed: {formatSeconds(progress.out_time_seconds)}
          {progress.speed ? ` (${progress.speed})` : ''}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
        <button
          className="btn-cancel"
          onClick={onCancel}
          disabled={isCancelling}
          aria-label="Cancel processing"
        >
          <Icon name="close" size={16} />
          {isCancelling ? 'Cancelling...' : 'Cancel'}
        </button>
      </div>
    </div>
  );
};
