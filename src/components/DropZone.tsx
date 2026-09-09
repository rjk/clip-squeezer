import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { Icon } from './Icon';

interface DropZoneProps {
  onFileSelected: (path: string) => void;
  isLoading: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFileSelected, isLoading }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    // Listen for Tauri's native window drag-drop event
    const unlistenPromise = listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
      setIsDragOver(false);
      if (event.payload.paths && event.payload.paths.length > 0) {
        const filePath = event.payload.paths[0];
        const parentDir = filePath.replace(/[\\/][^\\/]+$/, '');
        if (parentDir) {
          localStorage.setItem('last_used_dir', parentDir);
        }
        onFileSelected(filePath);
      }
    });

    const unlistenOver = listen('tauri://drag-over', () => {
      setIsDragOver(true);
    });

    const unlistenLeave = listen('tauri://drag-leave', () => {
      setIsDragOver(false);
    });

    return () => {
      unlistenPromise.then((fn) => fn());
      unlistenOver.then((fn) => fn());
      unlistenLeave.then((fn) => fn());
    };
  }, [onFileSelected]);

  const handleChooseFile = async () => {
    try {
      const defaultPath = localStorage.getItem('last_used_dir') || undefined;
      const selected = await open({
        multiple: false,
        defaultPath,
        filters: [
          {
            name: 'Video Files',
            extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'ts', 'mts', 'flv', 'wmv'],
          },
        ],
      });

      if (typeof selected === 'string') {
        const parentDir = selected.replace(/[\\/][^\\/]+$/, '');
        if (parentDir) {
          localStorage.setItem('last_used_dir', parentDir);
        }
        onFileSelected(selected);
      }
    } catch (err) {
      console.error('File picker error:', err);
    }
  };

  return (
    <div
      className={`drop-zone ${isDragOver ? 'drag-over' : ''} ${isLoading ? 'loading' : ''}`}
      onClick={handleChooseFile}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleChooseFile();
        }
      }}
      aria-label="Drop a video here or choose a file"
    >
      <div className="drop-zone-content">
        <div className="icon-container">
          {isLoading ? (
            <div className="spinner" />
          ) : isDragOver ? (
            <Icon name="add-file" className="drop-icon active" size={56} />
          ) : (
            <img src="/brand/drop-video.svg" className="drop-illustration" width="144" height="112" alt="" />
          )}
        </div>

        <h2 className="drop-title">
          {isLoading ? 'Reading media...' : isDragOver ? 'Drop file now' : 'Drop a video here'}
        </h2>

        {!isLoading && (
          <>
            <p className="drop-subtitle">
              or <span className="browse-link">choose a file</span> from your computer
            </p>
            <p className="drop-reassurance"><Icon name="lock" size={14} /> Stays on your computer. Always.</p>
          </>
        )}
      </div>
    </div>
  );
};
