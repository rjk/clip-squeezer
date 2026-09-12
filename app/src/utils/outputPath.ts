export const filenameFromPath = (path: string): string => path.split(/[\\/]/).pop() || path;

export const fileExtension = (filename: string): string | null => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 && lastDot < filename.length - 1
    ? filename.slice(lastDot + 1)
    : null;
};

export const withOutputExtension = (path: string, suggestedFilename: string): string => {
  const expectedExtension = fileExtension(suggestedFilename);
  if (!expectedExtension) return path;

  const lastSeparator = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const directory = lastSeparator === -1 ? '' : path.slice(0, lastSeparator + 1);
  const filename = lastSeparator === -1 ? path : path.slice(lastSeparator + 1);
  const lastDot = filename.lastIndexOf('.');
  const stem = lastDot > 0 ? filename.slice(0, lastDot) : filename;

  return `${directory}${stem}.${expectedExtension}`;
};

export const hasOutputExtension = (path: string, suggestedFilename: string): boolean => {
  const expectedExtension = fileExtension(suggestedFilename);
  return expectedExtension !== null
    && fileExtension(filenameFromPath(path))?.toLowerCase() === expectedExtension.toLowerCase();
};
