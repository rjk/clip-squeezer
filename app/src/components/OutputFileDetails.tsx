import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Pencil } from 'lucide-react';
import { filenameFromPath, withOutputExtension } from '../utils/outputPath';

interface OutputFileDetailsProps {
  sourcePath: string;
  suggestedFilename: string;
  selectedOutputPath?: string | null;
  estimatedSize: string;
  isEstimating?: boolean;
  warning?: string | null;
  onEditOutput: (suggestedPath: string, suggestedFilename: string) => void;
}

export const OutputFileDetails: React.FC<OutputFileDetailsProps> = ({
  sourcePath,
  suggestedFilename,
  selectedOutputPath,
  estimatedSize,
  isEstimating = false,
  warning,
  onEditOutput,
}) => {
  const [defaultOutputPath, setDefaultOutputPath] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setDefaultOutputPath(null);
    invoke<string>('suggest_output_path', { path: sourcePath, filename: suggestedFilename })
      .then((path) => {
        if (isCurrent) setDefaultOutputPath(path);
      })
      .catch((error) => {
        console.error('Could not suggest output path:', error);
      });

    return () => {
      isCurrent = false;
    };
  }, [sourcePath, suggestedFilename]);

  const selectedPathForAction = selectedOutputPath
    ? withOutputExtension(selectedOutputPath, suggestedFilename)
    : null;
  const outputPath = selectedPathForAction || defaultOutputPath || suggestedFilename;
  const outputFilename = filenameFromPath(outputPath);

  return (
    <div className="output-file-details">
      <div className="output-file-line">
        <span>Output File:</span>
        <strong title={outputPath}>{outputFilename}</strong>
        <button
          type="button"
          className="output-file-edit"
          onClick={() => onEditOutput(selectedPathForAction || defaultOutputPath || suggestedFilename, suggestedFilename)}
          title="Choose output file and location"
          aria-label="Choose output file and location"
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="output-file-line output-file-size">
        Estimated file size: {isEstimating ? 'estimating…' : <>around <strong>{estimatedSize}</strong></>}
      </div>
      {warning && <div className="output-file-warning">{warning}</div>}
    </div>
  );
};
