// F:\...\lib\interfaces\recorder-config.interface.ts
export interface RecorderConfig {
  maxDuration?: number;
  minDuration?: number;
  video?: VideoConfig;
  audio?: AudioConfig;
  ui?: UIConfig;
  features?: FeatureFlags;
  callbacks?: RecorderCallbacks;
  localization?: LocalizationConfig;
}

export interface VideoConfig {
  width?: number | { ideal: number; min?: number; max?: number };
  height?: number | { ideal: number; min?: number; max?: number };
  frameRate?: number | { ideal: number; min?: number; max?: number };
  facingMode?: 'user' | 'environment';
  aspectRatio?: number;
  quality?: 'low' | 'medium' | 'high';
  codec?: 'vp8' | 'vp9' | 'h264';
  bitrate?: number;
}

export interface AudioConfig {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  sampleRate?: number;
  channelCount?: 1 | 2;
  bitrate?: number;
}

export interface UIConfig {
  theme?: 'light' | 'dark' | 'auto';
  primaryColor?: string;
  secondaryColor?: string;
  borderRadius?: string;
  showTimer?: boolean;
  showDeviceSelector?: boolean;
  showAudioVisualization?: boolean;
  compact?: boolean;
}

export interface FeatureFlags {
  enablePause?: boolean;
  enableCountdown?: boolean;
  enableRetake?: boolean;
  enableTrim?: boolean;
  enableCompression?: boolean;
  enableBackgroundBlur?: boolean;
  enableVirtualBackground?: boolean;
  enableWatermark?: boolean;
}

export interface RecorderCallbacks {
  onRecordingStart?: () => void;
  onRecordingPause?: () => void;
  onRecordingResume?: () => void;
  onRecordingStop?: (blob: Blob, duration: number) => void;
  onRecordingComplete?: (result: RecordingResult) => void;
  onError?: (error: RecorderError) => void;
  onTimeUpdate?: (currentTime: number, remainingTime: number) => void;
}

export interface LocalizationConfig {
  locale?: string;
  rtl?: boolean;
}

export interface RecordingResult {
  blob: Blob;
  url: string;
  duration: number;
  size: number;
  mimeType: string;
  thumbnail?: string;
}

export interface RecorderError {
  code: string;
  message: string;
  originalError?: any;
  recoverable: boolean;
}

export interface DevicePermissions {
  camera: boolean;
  microphone: boolean;
}