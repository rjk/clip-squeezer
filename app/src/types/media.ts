export interface VideoStreamInfo {
  codec: string;
  width: number;
  height: number;
  frame_rate: number | null;
  pixel_format: string | null;
  rotation: number;
  duration_seconds: number | null;
}

export interface AudioStreamInfo {
  codec: string;
  channels: number;
  sample_rate: number;
  language: string | null;
  duration_seconds: number | null;
}

export interface MediaInfo {
  path: string;
  filename: string;
  container: string | null;
  duration_seconds: number;
  size_bytes: number;
  video_streams: VideoStreamInfo[];
  audio_streams: AudioStreamInfo[];
  friendly_duration: string;
  friendly_resolution: string;
  friendly_size: string;
  has_video: boolean;
  has_audio: boolean;
}

export interface ErrorDetails {
  title: string;
  message: string;
  technical_details: string | null;
}

export type PrimaryAction = 'compress' | 'convert' | 'trim' | 'extract_audio';

export type CompressQuality = 'BestQuality' | 'Balanced' | 'SmallestFile';
export type CompressResolution = 'KeepOriginal' | 'P1080' | 'P720';
export type CompressCompatibility = 'Wide' | 'SmallerFile';

export interface CompressRequest {
  quality: CompressQuality;
  resolution: CompressResolution;
  compatibility: CompressCompatibility;
}

export type ConvertFormat = 'Mp4' | 'Mov' | 'Mkv' | 'Webm' | 'Gif';

export interface ConvertRequest {
  format: ConvertFormat;
}

export type ExtractAudioMode = 'OriginalQuality' | 'Mp3' | 'M4a';

export interface ExtractAudioRequest {
  mode: ExtractAudioMode;
}

export interface TrimRequest {
  start_seconds: number;
  end_seconds: number;
}

export interface ProgressUpdate {
  percent: number;
  out_time_seconds: number;
  speed: string | null;
}

export interface JobResult {
  output_path: string;
  original_size_bytes: number;
  result_size_bytes: number;
  friendly_original_size: string;
  friendly_result_size: string;
  savings_percent: number | null;
  friendly_duration?: string | null;
  friendly_resolution?: string | null;
}
