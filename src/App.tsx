import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  MediaInfo,
  ErrorDetails,
  PrimaryAction,
  CompressRequest,
  ConvertRequest,
  ExtractAudioRequest,
  TrimRequest,
  JobResult,
} from './types/media';
import { DropZone } from './components/DropZone';
import { FileSummaryHeader } from './components/FileSummaryHeader';
import { ActionSelector } from './components/ActionSelector';
import { CompressView } from './features/compress/CompressView';
import { ConvertView } from './features/convert/ConvertView';
import { ExtractAudioView } from './features/extract-audio/ExtractAudioView';
import { TrimView } from './features/trim/TrimView';
import { ProcessingView } from './components/ProcessingView';
import { SuccessView } from './components/SuccessView';
import { HistoryModal, HistoryItem } from './components/HistoryModal';
import { Icon } from './components/Icon';
import './App.css';

export function App() {
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [error, setError] = useState<ErrorDetails | null>(null);
  const [selectedAction, setSelectedAction] = useState<PrimaryAction | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('video_utility_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addToHistory = (
    action: HistoryItem['action'],
    actionLabel: string,
    res: JobResult
  ) => {
    if (!mediaInfo) return;
    const now = new Date();
    const friendlyTime = now.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const outputFilename = res.output_path.split(/[\\/]/).pop() || res.output_path;
    const resultSize =
      res.savings_percent !== null && res.savings_percent > 0
        ? `${res.friendly_result_size} (${res.savings_percent}% smaller)`
        : res.friendly_result_size;

    const newItem: HistoryItem = {
      id: `hist_${Date.now()}`,
      action,
      action_label: actionLabel,
      source_filename: mediaInfo.filename,
      source_path: mediaInfo.path,
      output_filename: outputFilename,
      output_path: res.output_path,
      timestamp: Date.now(),
      friendly_time: friendlyTime,
      result_size: resultSize,
    };

    setHistory((prev) => {
      const updated = [newItem, ...prev].slice(0, 50);
      try {
        localStorage.setItem('video_utility_history', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save history:', err);
      }
      return updated;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('video_utility_history');
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  // Active Job State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [processingTitle, setProcessingTitle] = useState('Processing video...');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<JobResult | null>(null);

  const handleFileSelected = async (path: string) => {
    setIsProbing(true);
    setError(null);
    setSelectedAction(null);
    setJobResult(null);

    try {
      const info = await invoke<MediaInfo>('probe_media', { path });
      setMediaInfo(info);
    } catch (err: unknown) {
      console.error('Probe failed:', err);
      const errDetails = err as ErrorDetails;
      setError(
        errDetails && errDetails.title
          ? errDetails
          : {
              title: 'Could not read file',
              message: 'This file could not be inspected. Please choose a valid video.',
              technical_details: String(err),
            }
      );
    } finally {
      setIsProbing(false);
    }
  };

  const handleStartCompress = async (request: CompressRequest) => {
    if (!mediaInfo) return;

    setIsProcessing(true);
    setIsCancelling(false);
    setProcessingTitle('Making video smaller...');
    setError(null);
    const jobId = `job_${Date.now()}`;
    setCurrentJobId(jobId);

    try {
      const result = await invoke<JobResult>('start_compression', {
        path: mediaInfo.path,
        request,
      });
      setJobResult(result);
      addToHistory('compress', 'Make smaller', result);
    } catch (err: unknown) {
      console.error('Compression failed:', err);
      const errDetails = err as ErrorDetails;
      if (errDetails && errDetails.title === 'Cancelled') {
        // User cancelled
      } else {
        setError(
          errDetails && errDetails.title
            ? errDetails
            : {
                title: 'Compression failed',
                message: 'The video could not be made smaller.',
                technical_details: String(err),
              }
        );
      }
    } finally {
      setIsProcessing(false);
      setCurrentJobId(null);
    }
  };

  const handleStartConvert = async (request: ConvertRequest) => {
    if (!mediaInfo) return;

    setIsProcessing(true);
    setIsCancelling(false);
    setProcessingTitle(`Converting to ${request.format}...`);
    setError(null);
    const jobId = `job_${Date.now()}`;
    setCurrentJobId(jobId);

    try {
      const result = await invoke<JobResult>('start_conversion', {
        path: mediaInfo.path,
        request,
      });
      setJobResult(result);
      addToHistory('convert', `Convert to ${request.format}`, result);
    } catch (err: unknown) {
      console.error('Conversion failed:', err);
      const errDetails = err as ErrorDetails;
      if (errDetails && errDetails.title === 'Cancelled') {
        // User cancelled
      } else {
        setError(
          errDetails && errDetails.title
            ? errDetails
            : {
                title: 'Conversion failed',
                message: 'The video could not be converted.',
                technical_details: String(err),
              }
        );
      }
    } finally {
      setIsProcessing(false);
      setCurrentJobId(null);
    }
  };

  const handleStartExtractAudio = async (request: ExtractAudioRequest) => {
    if (!mediaInfo) return;

    setIsProcessing(true);
    setIsCancelling(false);
    setProcessingTitle('Extracting audio track...');
    setError(null);
    const jobId = `job_${Date.now()}`;
    setCurrentJobId(jobId);

    try {
      const result = await invoke<JobResult>('start_audio_extraction', {
        path: mediaInfo.path,
        request,
      });
      setJobResult(result);
      addToHistory('extract_audio', 'Extract audio', result);
    } catch (err: unknown) {
      console.error('Audio extraction failed:', err);
      const errDetails = err as ErrorDetails;
      if (errDetails && errDetails.title === 'Cancelled') {
        // User cancelled
      } else {
        setError(
          errDetails && errDetails.title
            ? errDetails
            : {
                title: 'Audio extraction failed',
                message: 'The audio could not be extracted.',
                technical_details: String(err),
              }
        );
      }
    } finally {
      setIsProcessing(false);
      setCurrentJobId(null);
    }
  };

  const handleStartTrim = async (request: TrimRequest) => {
    if (!mediaInfo) return;

    setIsProcessing(true);
    setIsCancelling(false);
    setProcessingTitle('Trimming video...');
    setError(null);
    const jobId = `job_${Date.now()}`;
    setCurrentJobId(jobId);

    try {
      const result = await invoke<JobResult>('start_trim', {
        path: mediaInfo.path,
        request,
      });
      setJobResult(result);
      addToHistory('trim', 'Trim video', result);
    } catch (err: unknown) {
      console.error('Trim failed:', err);
      const errDetails = err as ErrorDetails;
      if (errDetails && errDetails.title === 'Cancelled') {
        // User cancelled
      } else {
        setError(
          errDetails && errDetails.title
            ? errDetails
            : {
                title: 'Trim failed',
                message: 'The video could not be trimmed.',
                technical_details: String(err),
              }
        );
      }
    } finally {
      setIsProcessing(false);
      setCurrentJobId(null);
    }
  };

  const handleCancelJob = async () => {
    if (!currentJobId) return;
    setIsCancelling(true);
    try {
      await invoke('cancel_job', {
        jobId: currentJobId,
        outputPath: jobResult ? jobResult.output_path : null,
      });
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setIsCancelling(false);
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setMediaInfo(null);
    setSelectedAction(null);
    setJobResult(null);
    setError(null);
  };

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <button className="app-brand" onClick={handleReset} title="Return to home screen" aria-label="Clip Squeezer home">
          <img className="brand-mark" src="/brand/app-icon.svg" width="40" height="40" alt="" />
          <span className="app-title">Clip Squeezer</span>
        </button>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-container">
            <h3 className="error-title">{error.title}</h3>
            <p className="error-message">{error.message}</p>
            {error.technical_details && (
              <pre className="tech-details">{error.technical_details}</pre>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" onClick={() => setError(null)}>
                <Icon name="close" size={16} /> Dismiss
              </button>
              {error.technical_details && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${error.title}\n${error.message}\n${error.technical_details}`
                    );
                    setHasCopied(true);
                    setTimeout(() => setHasCopied(false), 2000);
                  }}
                >
                  <Icon name={hasCopied ? 'check' : 'copy'} size={16} />
                  {hasCopied ? 'Copied to clipboard!' : 'Copy technical details'}
                </button>
              )}
            </div>
          </div>
        )}

        {!mediaInfo ? (
          <DropZone onFileSelected={handleFileSelected} isLoading={isProbing} />
        ) : isProcessing ? (
          <ProcessingView
            title={processingTitle}
            filename={mediaInfo.filename}
            onCancel={handleCancelJob}
            isCancelling={isCancelling}
          />
        ) : jobResult ? (
          <SuccessView
            result={jobResult}
            onNewFile={handleReset}
          />
        ) : (
          <div className="media-workspace">
            <FileSummaryHeader mediaInfo={mediaInfo} onReset={handleReset} />

            {!selectedAction ? (
              <ActionSelector
                mediaInfo={mediaInfo}
                onSelectAction={(action) => setSelectedAction(action)}
              />
            ) : selectedAction === 'compress' ? (
              <CompressView
                mediaInfo={mediaInfo}
                onStartCompress={handleStartCompress}
                onBack={() => setSelectedAction(null)}
              />
            ) : selectedAction === 'convert' ? (
              <ConvertView
                mediaInfo={mediaInfo}
                onStartConvert={handleStartConvert}
                onBack={() => setSelectedAction(null)}
              />
            ) : selectedAction === 'extract_audio' ? (
              <ExtractAudioView
                mediaInfo={mediaInfo}
                onStartExtract={handleStartExtractAudio}
                onBack={() => setSelectedAction(null)}
              />
            ) : selectedAction === 'trim' ? (
              <TrimView
                mediaInfo={mediaInfo}
                onStartTrim={handleStartTrim}
                onBack={() => setSelectedAction(null)}
              />
            ) : (
              <div className="config-card">
                <h2 className="section-heading">Feature coming right up: {selectedAction}</h2>
                <button className="btn-secondary" onClick={() => setSelectedAction(null)}>
                  Back
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="app-footer" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <button className="about-link" onClick={() => setShowHistory(true)}>
          <Icon name="history" size={16} /> Activity History {history.length > 0 ? `(${history.length})` : ''}
        </button>
        <button className="about-link" onClick={() => setShowAbout(true)}>
          <Icon name="info" size={16} /> About & Privacy
        </button>
      </footer>

      {showHistory && (
        <HistoryModal
          history={history}
          onClose={() => setShowHistory(false)}
          onClearHistory={handleClearHistory}
        />
      )}

      {showAbout && (
        <div className="modal-backdrop" onClick={() => setShowAbout(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)' }}>
                About Clip Squeezer
              </h3>
              <button className="btn-close" onClick={() => setShowAbout(false)} aria-label="Close modal">
                <Icon name="close" size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5', marginTop: '12px' }}>
              A fast, simple, and private desktop utility for the common things you need to do to video files: reducing file size, converting formats, trimming cuts, and saving sound.
            </p>
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: '12px',
                borderRadius: '8px',
                marginTop: '12px',
                fontSize: '0.85rem',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>
                <Icon name="lock" size={16} /> 100% Local & Private
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                Your files never leave this computer. Clip Squeezer has no servers, collects no analytics, tracks no telemetry, and requires zero internet connection.
              </div>
            </div>
            <div
              style={{
                marginTop: '18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <button
                onClick={() =>
                  openUrl('https://github.com/rjk/clip-squeezer/blob/main/PRIVACY.md')
                }
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  padding: 0,
                }}
              >
                <Icon name="lock" size={16} /> Privacy Policy & Info
              </button>
              <button className="btn-secondary" onClick={() => setShowAbout(false)}>
                <Icon name="close" size={16} /> Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
