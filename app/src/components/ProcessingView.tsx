import React, { useEffect, useState, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Icon } from './Icon';
import { ProgressUpdate } from '../types/media';

interface ProcessingViewProps {
  title: string;
  sourceFilename: string;
  targetFilename?: string | null;
  jobId?: string | null;
  onCancel: () => void;
  isCancelling: boolean;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({
  title,
  sourceFilename,
  targetFilename,
  jobId,
  onCancel,
  isCancelling,
}) => {
  const [progress, setProgress] = useState<ProgressUpdate>({
    percent: 0,
    out_time_seconds: 0,
    speed: null,
  });

  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    setProgress({
      percent: 0,
      out_time_seconds: 0,
      speed: null,
    });

    const unlistenPromise = listen<{
      job_id: string;
      percent: number;
      out_time_seconds: number;
      speed: string | null;
    }>('job-progress', (event) => {
      if (jobId && event.payload.job_id !== jobId) {
        return;
      }
      setProgress({
        percent: Math.min(100, Math.max(0, event.payload.percent)),
        out_time_seconds: event.payload.out_time_seconds,
        speed: event.payload.speed,
      });
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [jobId]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Calculate estimated time remaining after sufficient elapsed progress
  const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
  let remainingTimeText: string | null = null;

  if (progress.percent >= 3 && elapsedSec >= 3) {
    const totalEstimatedSec = elapsedSec / (progress.percent / 100);
    const remainingSec = Math.max(0, Math.round(totalEstimatedSec - elapsedSec));
    remainingTimeText = `Time remaining: ${formatSeconds(remainingSec)}`;
  }

  return (
    <div className="progress-container">
      <div>
        <h2 className="section-heading">{title}</h2>
        <div className="progress-files-flow">
          <span className="progress-file-name" title={sourceFilename}>
            {sourceFilename}
          </span>
          {targetFilename && (
            <>
              <span className="progress-flow-arrow" aria-hidden="true">
                →
              </span>
              <span className="progress-file-name target" title={targetFilename}>
                {targetFilename}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
      </div>

      <div className="progress-meta">
        <span>{Math.round(progress.percent)}% completed</span>
        <span>{remainingTimeText || ''}</span>
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
