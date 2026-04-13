import { Component, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoRecorderComponent, RecorderConfig, RecordingResult, RecorderError } from 'ngx-video-recorder';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, VideoRecorderComponent],
  template: `
    <div class="test-container">
      <header class="test-header">
        <h1>🎥 NGX Video Recorder - Test Application</h1>
        <p>Test all features of the video/audio recording library</p>
      </header>

      <!-- Mode Selector -->
      <div class="mode-selector">
        <button [class.active]="mode() === 'video'" (click)="mode.set('video')">🎬 Video Mode</button>
        <button [class.active]="mode() === 'audio'" (click)="mode.set('audio')">🎤 Audio Only</button>
        <button [class.active]="mode() === 'both'" (click)="mode.set('both')">📷 Both</button>
      </div>

      <!-- Video Recorder Component -->
      <div class="recorder-wrapper">
        <ngx-video-recorder
          [config]="config"
          [questionText]="questionText"
          [questionNumber]="1"
          [mode]="mode()"
          (recordingComplete)="onRecordingComplete($event)"
          (recordingStart)="onRecordingStart()"
          (recordingPause)="onRecordingPause()"
          (recordingResume)="onRecordingResume()"
          (recordingCancel)="onRecordingCancel()"
          (error)="onError($event)">
        </ngx-video-recorder>
      </div>

      <!-- Recording Result with Playback -->
      @if (lastRecording()) {
        <div class="result-panel">
          <h3>📼 Last Recording</h3>
          
          <!-- Playback Section -->
          <div class="playback-section">
            @if (mode() !== 'audio') {
              <video #playbackVideo
                     [src]="lastRecording()!.url"
                     (timeupdate)="onPlaybackTimeUpdate()"
                     (loadedmetadata)="onPlaybackLoaded()"
                     (ended)="onPlaybackEnded()"
                     class="playback-video">
              </video>
            } @else {
              <audio #playbackAudio
                     [src]="lastRecording()!.url"
                     (timeupdate)="onPlaybackTimeUpdate()"
                     (loadedmetadata)="onPlaybackLoaded()"
                     (ended)="onPlaybackEnded()">
              </audio>
              <div class="audio-playback-placeholder">
                <div class="audio-waveform">
                  @for (bar of [1,2,3,4,5,6,7,8,9,10,11,12]; track bar) {
                    <div class="wave-bar" [class.active]="isPlaying()" [style.animation-delay.ms]="bar * 50"></div>
                  }
                </div>
              </div>
            }
            
            <!-- Playback Controls -->
            <div class="playback-controls">
              <div class="control-buttons">
                @if (!isPlaying()) {
                  <button class="play-pause-btn" (click)="playRecording()" title="Play">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="currentColor" d="M8 5v14l11-7z"/>
                    </svg>
                    Play
                  </button>
                } @else {
                  <button class="play-pause-btn" (click)="pausePlayback()" title="Pause">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                    Pause
                  </button>
                }
                <button class="stop-btn" (click)="stopPlayback()" title="Stop">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M6 6h12v12H6z"/>
                  </svg>
                  Stop
                </button>
              </div>
              
              <!-- Progress Bar -->
              <div class="progress-container">
                <span class="time">{{ formatPlaybackTime(currentTime()) }}</span>
                <input type="range"
                       min="0"
                       [max]="duration()"
                       [value]="currentTime()"
                       (input)="seekPlayback($event)"
                       class="progress-slider" />
                <span class="time">{{ formatPlaybackTime(duration()) }}</span>
              </div>
            </div>
          </div>
          
          <div class="result-info">
            <p><strong>Duration:</strong> {{ formatDuration(lastRecording()!.duration) }}</p>
            <p><strong>Size:</strong> {{ formatSize(lastRecording()!.size) }}</p>
            <p><strong>Type:</strong> {{ lastRecording()!.mimeType }}</p>
          </div>
          @if (lastRecording()!.thumbnail) {
            <img [src]="lastRecording()!.thumbnail" alt="Thumbnail" class="thumbnail">
          }
          <div class="result-actions">
            <button (click)="downloadRecording()">⬇️ Download</button>
            <button (click)="clearRecording()">🗑️ Clear</button>
          </div>
        </div>
      }

      <!-- Event Log -->
      <div class="event-log">
        <h3>📋 Event Log</h3>
        <div class="log-container">
          @for (log of eventLogs(); track $index) {
            <div class="log-entry" [class]="log.type">
              <span class="log-time">{{ log.time }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          }
        </div>
        <button (click)="clearLogs()">Clear Logs</button>
      </div>
    </div>
  `,
  styles: [`
    .test-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .test-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .test-header h1 {
      color: #1a1a2e;
      margin-bottom: 8px;
    }

    .test-header p {
      color: #666;
    }

    .mode-selector {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 20px;
    }

    .mode-selector button {
      padding: 12px 24px;
      border: 2px solid #ddd;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.2s;
    }

    .mode-selector button.active {
      background: #C63C92;
      border-color: #C63C92;
      color: white;
    }

    .recorder-wrapper {
      margin-bottom: 20px;
    }

    .result-panel {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .result-panel h3 {
      margin-top: 0;
      color: #166534;
    }

    .playback-section {
      margin-bottom: 20px;
    }

    .playback-video {
      width: 100%;
      max-height: 400px;
      border-radius: 8px;
      background: #000;
    }

    .audio-playback-placeholder {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      padding: 30px;
      margin-bottom: 15px;
    }

    .audio-waveform {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      height: 80px;
    }

    .wave-bar {
      width: 6px;
      height: 30px;
      background: rgba(255, 255, 255, 0.6);
      border-radius: 3px;
      transition: height 0.1s;
    }

    .wave-bar.active {
      animation: wave 1s ease-in-out infinite;
    }

    @keyframes wave {
      0%, 100% { height: 20px; }
      50% { height: 60px; }
    }

    .playback-controls {
      margin-top: 15px;
    }

    .control-buttons {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 15px;
    }

    .play-pause-btn, .stop-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 20px;
      border: none;
      border-radius: 20px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }

    .play-pause-btn {
      background: #C63C92;
      color: white;
    }

    .play-pause-btn:hover {
      background: #a82d7a;
    }

    .stop-btn {
      background: #6b7280;
      color: white;
    }

    .stop-btn:hover {
      background: #4b5563;
    }

    .progress-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .time {
      font-size: 12px;
      color: #666;
      min-width: 40px;
    }

    .progress-slider {
      flex: 1;
      height: 4px;
      -webkit-appearance: none;
      appearance: none;
      background: #ddd;
      border-radius: 2px;
      outline: none;
    }

    .progress-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      background: #C63C92;
      border-radius: 50%;
      cursor: pointer;
    }

    .result-info {
      display: flex;
      gap: 20px;
      margin-bottom: 15px;
    }

    .thumbnail {
      max-width: 200px;
      border-radius: 8px;
      margin-bottom: 15px;
    }

    .result-actions {
      display: flex;
      gap: 10px;
    }

    .result-actions button {
      padding: 8px 16px;
      border: none;
      background: #166534;
      color: white;
      border-radius: 6px;
      cursor: pointer;
    }

    .event-log {
      background: #1e1e1e;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .event-log h3 {
      color: #fff;
      margin-top: 0;
      margin-bottom: 15px;
    }

    .log-container {
      max-height: 200px;
      overflow-y: auto;
      background: #2d2d2d;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 10px;
    }

    .log-entry {
      padding: 4px 8px;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 13px;
      border-bottom: 1px solid #444;
    }

    .log-entry.info { color: #4fc3f7; }
    .log-entry.success { color: #66bb6a; }
    .log-entry.warning { color: #ffa726; }
    .log-entry.error { color: #ef5350; }

    .log-time {
      color: #888;
      margin-right: 10px;
    }

    .event-log button {
      padding: 6px 12px;
      background: #444;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  `]
})
export class App {
  @ViewChild('playbackVideo') playbackVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('playbackAudio') playbackAudio!: ElementRef<HTMLAudioElement>;
  
  mode = signal<'video' | 'audio' | 'both'>('video');
  maxDurationSec = 60;
  
  config: RecorderConfig = {
    maxDuration: 60000,
    minDuration: 1000,
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
      facingMode: 'user'
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    ui: {
      theme: 'light',
      primaryColor: '#C63C92',
      showTimer: true,
      showDeviceSelector: true,
      showAudioVisualization: true
    },
    features: {
      enablePause: true,
      enableCountdown: false,
      enableRetake: true,
      enableCompression: false
    }
  };

  questionText = 'Please introduce yourself and explain your experience with Angular development.';
  
  lastRecording = signal<RecordingResult | null>(null);
  eventLogs = signal<Array<{ time: string; message: string; type: string }>>([]);
  
  // Playback state
  isPlaying = signal(false);
  currentTime = signal(0);
  duration = signal(0);

  addLog(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const time = new Date().toLocaleTimeString();
    this.eventLogs.update(logs => [{ time, message, type }, ...logs.slice(0, 49)]);
  }

  clearLogs(): void {
    this.eventLogs.set([]);
  }

  onRecordingStart(): void {
    this.addLog('🎬 Recording started', 'success');
  }

  onRecordingPause(): void {
    this.addLog('⏸️ Recording paused', 'warning');
  }

  onRecordingResume(): void {
    this.addLog('▶️ Recording resumed', 'success');
  }

  onRecordingCancel(): void {
    this.addLog('❌ Recording cancelled', 'warning');
  }

  onRecordingComplete(result: RecordingResult): void {
    this.lastRecording.set(result);
    this.isPlaying.set(false);
    this.currentTime.set(0);
    this.duration.set(0);
    this.addLog(`✅ Recording complete! Duration: ${this.formatDuration(result.duration)}, Size: ${this.formatSize(result.size)}`, 'success');
  }

  onError(error: RecorderError): void {
    this.addLog(`⚠️ Error: ${error.message}`, 'error');
  }

  // Playback methods
  playRecording(): void {
    if (this.mode() !== 'audio') {
      const video = this.playbackVideo?.nativeElement;
      if (video) {
        video.play();
        this.isPlaying.set(true);
      }
    } else {
      const audio = this.playbackAudio?.nativeElement;
      if (audio) {
        audio.play();
        this.isPlaying.set(true);
      }
    }
  }

  pausePlayback(): void {
    if (this.mode() !== 'audio') {
      const video = this.playbackVideo?.nativeElement;
      if (video) {
        video.pause();
        this.isPlaying.set(false);
      }
    } else {
      const audio = this.playbackAudio?.nativeElement;
      if (audio) {
        audio.pause();
        this.isPlaying.set(false);
      }
    }
  }

  stopPlayback(): void {
    if (this.mode() !== 'audio') {
      const video = this.playbackVideo?.nativeElement;
      if (video) {
        video.pause();
        video.currentTime = 0;
        this.isPlaying.set(false);
        this.currentTime.set(0);
      }
    } else {
      const audio = this.playbackAudio?.nativeElement;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        this.isPlaying.set(false);
        this.currentTime.set(0);
      }
    }
  }

  onPlaybackTimeUpdate(): void {
    if (this.mode() !== 'audio') {
      const video = this.playbackVideo?.nativeElement;
      if (video) {
        this.currentTime.set(video.currentTime);
      }
    } else {
      const audio = this.playbackAudio?.nativeElement;
      if (audio) {
        this.currentTime.set(audio.currentTime);
      }
    }
  }

  onPlaybackLoaded(): void {
    if (this.mode() !== 'audio') {
      const video = this.playbackVideo?.nativeElement;
      if (video) {
        this.duration.set(video.duration || 0);
      }
    } else {
      const audio = this.playbackAudio?.nativeElement;
      if (audio) {
        this.duration.set(audio.duration || 0);
      }
    }
  }

  onPlaybackEnded(): void {
    this.isPlaying.set(false);
    this.currentTime.set(0);
  }

  seekPlayback(event: Event): void {
    const input = event.target as HTMLInputElement;
    const seekTime = parseFloat(input.value);
    if (this.mode() !== 'audio') {
      const video = this.playbackVideo?.nativeElement;
      if (video) {
        video.currentTime = seekTime;
        this.currentTime.set(seekTime);
      }
    } else {
      const audio = this.playbackAudio?.nativeElement;
      if (audio) {
        audio.currentTime = seekTime;
        this.currentTime.set(seekTime);
      }
    }
  }

  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  formatPlaybackTime(seconds: number): string {
    if (!seconds && seconds !== 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`;
  }

  downloadRecording(): void {
    const recording = this.lastRecording();
    if (!recording) return;
    
    const a = document.createElement('a');
    a.href = recording.url;
    a.download = `recording-${Date.now()}.${recording.mimeType.includes('video') ? 'webm' : 'webm'}`;
    a.click();
    this.addLog('⬇️ Recording downloaded', 'success');
  }

  clearRecording(): void {
    this.stopPlayback();
    this.lastRecording.set(null);
    this.addLog('🗑️ Recording cleared', 'info');
  }
}