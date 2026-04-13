// F:\...\lib\video-recorder.component.ts
import {
  Component, Input, Output, EventEmitter, ViewChild, ElementRef,
  OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef,
  signal, computed, effect, inject, PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { RecorderConfig, RecordingResult, RecorderError, DevicePermissions } from './interfaces/recorder-config.interface';
import { VideoRecorderService } from './services/video-recorder.service';
import { TimeFormatPipe } from './pipes/time-format.pipe';
import { FilterDevicePipe } from './pipes/filter-device.pipe';
import { ClickOutsideDirective } from './directives/click-outside.directive';
import { BlobUtils } from './utils/blob-utils';

@Component({
  selector: 'ngx-video-recorder',
  standalone: true,
  imports: [CommonModule, FormsModule, TimeFormatPipe, FilterDevicePipe, ClickOutsideDirective],
  templateUrl: './video-recorder.component.html',
  styleUrls: ['./video-recorder.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoRecorderComponent implements OnInit, OnDestroy {
  @Input() config: RecorderConfig = { minDuration: 1000, maxDuration: 300000 };
  @Input() questionText: string = '';
  @Input() questionNumber: number = 1;
  @Input() mode: 'video' | 'audio' | 'both' = 'video';
  @Input() chunkSize: number = 1000;
  
  @Output() recordingComplete = new EventEmitter<RecordingResult>();
  @Output() recordingStart = new EventEmitter<void>();
  @Output() recordingPause = new EventEmitter<void>();
  @Output() recordingResume = new EventEmitter<void>();
  @Output() recordingCancel = new EventEmitter<void>();
  @Output() error = new EventEmitter<RecorderError>();
  @Output() deviceChange = new EventEmitter<MediaDeviceInfo[]>();
  @Output() permissionChange = new EventEmitter<DevicePermissions>();

  @ViewChild('videoPreview') videoPreview!: ElementRef<HTMLVideoElement>;
  @ViewChild('recordedVideo') recordedVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('recordedAudio') recordedAudio!: ElementRef<HTMLAudioElement>;
  @ViewChild('audioVisualization') audioCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('frequencyCanvas') frequencyCanvas!: ElementRef<HTMLCanvasElement>;

  private platformId = inject(PLATFORM_ID);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  private recorderService = inject(VideoRecorderService);
  private destroy$ = new Subject<void>();

  // Signals
  protected isRecording = signal(false);
  protected isPaused = signal(false);
  protected isPlaying = signal(false);
  protected isUploading = signal(false);
  protected hasRecorded = signal(false);
  protected isMicMuted = signal(false);
  protected isCameraOff = signal(false);
  protected hasCameraPermission = signal(false);
  protected hasMicrophonePermission = signal(false);
  protected isInitializing = signal(true);
  protected isProcessing = signal(false);
  protected showDeviceSelector = signal(false);
  protected showSettings = signal(false);
  
  protected elapsedTime = signal(0);
  protected uploadProgress = signal(0);
  protected recordedBlob = signal<Blob | null>(null);
  protected videoUrl = signal<SafeUrl | null>(null);
  protected thumbnail = signal<string | null>(null);
  protected availableDevices = signal<MediaDeviceInfo[]>([]);
  protected selectedCamera = signal<string>('');
  protected selectedMicrophone = signal<string>('');
  protected errorMessage = signal<string>('');
  
  // Playback state
  protected currentPlaybackTime = signal(0);
  protected playbackDuration = signal(0);

  protected mediaStream: MediaStream | null = null;
  protected mediaRecorder: MediaRecorder | null = null;
  protected recordedChunks: Blob[] = [];
  protected audioContext: AudioContext | null = null;
  protected analyser: AnalyserNode | null = null;
  protected animationFrame: number | null = null;
  protected timerInterval: any = null;

  protected isAudioOnly = computed(() => this.mode === 'audio');
  protected maxDuration = computed(() => this.config.maxDuration || 300000);
  protected minDuration = computed(() => this.config.minDuration || 1000);
  protected remainingTime = computed(() => this.maxDuration() - this.elapsedTime());
  protected isMaxDurationReached = computed(() => this.elapsedTime() >= this.maxDuration());
  protected isMinDurationMet = computed(() => this.elapsedTime() >= this.minDuration());
  protected canSave = computed(() => this.hasRecorded() && this.isMinDurationMet() && !this.isProcessing());
  protected canRecord = computed(() => {
    if (this.isAudioOnly()) {
      return this.hasMicrophonePermission() && !this.isMicMuted();
    }
    return this.hasCameraPermission() && this.hasMicrophonePermission() && 
           !this.isCameraOff() && !this.isMicMuted();
  });

  protected themeClass = computed(() => `theme-${this.config.ui?.theme || 'light'}`);
  protected primaryColor = computed(() => this.config.ui?.primaryColor || '#C63C92');
  protected borderRadius = computed(() => this.config.ui?.borderRadius || '16px');

  constructor() {
    effect(() => {
      if (this.isMaxDurationReached() && this.isRecording()) {
        this.stopRecording();
      }
    });
    effect(() => {
      document.documentElement.style.setProperty('--recorder-primary', this.primaryColor());
    });
  }

  async ngOnInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      await this.initializeRecorder();
    }
  }

  ngOnDestroy(): void {
    this.cleanupResources();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeRecorder(): Promise<void> {
    try {
      this.isInitializing.set(true);
      const permissions = await this.recorderService.requestPermissions(this.mode);
      this.hasCameraPermission.set(permissions.camera);
      this.hasMicrophonePermission.set(permissions.microphone);
      this.permissionChange.emit(permissions);
      const devices = await this.recorderService.getAvailableDevices();
      this.availableDevices.set(devices);
      await this.setupMediaStream();
      this.isInitializing.set(false);
      this.cdr.detectChanges();
    } catch (error) {
      this.handleError({ code: 'INIT_ERROR', message: 'Failed to initialize', recoverable: true });
    }
  }

  private async setupMediaStream(): Promise<void> {
    const constraints = this.recorderService.buildMediaConstraints(this.config, this.mode);
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTracks = this.mediaStream.getVideoTracks();
      const audioTracks = this.mediaStream.getAudioTracks();
      this.hasCameraPermission.set(videoTracks.length > 0);
      this.hasMicrophonePermission.set(audioTracks.length > 0);
      this.isCameraOff.set(false);
      this.isMicMuted.set(false);
      if (this.videoPreview?.nativeElement) {
        this.videoPreview.nativeElement.srcObject = this.mediaStream;
        await this.videoPreview.nativeElement.play();
      }
    } catch (error: any) {
      this.handleMediaError(error);
    }
  }

  protected async startRecording(): Promise<void> {
    if (!this.canRecord() || this.isRecording()) return;
    try {
      this.recordedChunks = [];
      this.hasRecorded.set(false);
      const options = await this.recorderService.getRecorderOptions(this.config, this.mode);
      this.mediaRecorder = new MediaRecorder(this.mediaStream!, options);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) this.recordedChunks.push(event.data);
      };
      this.mediaRecorder.onstart = () => {
        this.isRecording.set(true);
        this.isPaused.set(false);
        this.startTimer();
        this.recordingStart.emit();
      };
      this.mediaRecorder.onstop = async () => {
        await this.processRecordedData();
      };
      this.mediaRecorder.start(this.chunkSize);
      this.cdr.detectChanges();
    } catch (error) {
      this.handleError({ code: 'START_ERROR', message: 'Failed to start recording', recoverable: true });
    }
  }

  protected pauseRecording(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused.set(true);
      this.pauseTimer();
      this.recordingPause.emit();
    } else if (this.mediaRecorder?.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused.set(false);
      this.resumeTimer();
      this.recordingResume.emit();
    }
  }

  protected async stopRecording(): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.stopTimer();
    }
  }

  private async processRecordedData(): Promise<void> {
    if (this.recordedChunks.length === 0) return;
    this.isProcessing.set(true);
    try {
      let blob = new Blob(this.recordedChunks, { type: this.mode === 'audio' ? 'audio/webm' : 'video/webm' });
      if (this.config.features?.enableCompression) {
        blob = await BlobUtils.compressVideo(blob, this.config);
      }
      const thumbnail = !this.isAudioOnly() ? await BlobUtils.generateThumbnail(blob) : null;
      this.thumbnail.set(thumbnail);
      const url = URL.createObjectURL(blob);
      this.videoUrl.set(this.sanitizer.bypassSecurityTrustUrl(url));
      this.recordedBlob.set(blob);
      this.hasRecorded.set(true);
      this.isRecording.set(false);
      
      const result: RecordingResult = { 
        blob, url, duration: this.elapsedTime(), size: blob.size, 
        mimeType: blob.type, thumbnail: thumbnail || undefined 
      };
      this.recordingComplete.emit(result);
      this.config.callbacks?.onRecordingComplete?.(result);
    } catch (error) {
      this.handleError({ code: 'PROCESS_ERROR', message: 'Failed to process recording', recoverable: false });
    } finally {
      this.isProcessing.set(false);
      this.cdr.detectChanges();
    }
  }

  // Playback controls
  protected playRecording(): void {
    if (this.isAudioOnly()) {
      const audio = this.recordedAudio?.nativeElement;
      if (audio) {
        audio.play();
        this.isPlaying.set(true);
      }
    } else {
      const video = this.recordedVideo?.nativeElement;
      if (video) {
        video.play();
        this.isPlaying.set(true);
      }
    }
  }

  protected pausePlayback(): void {
    if (this.isAudioOnly()) {
      const audio = this.recordedAudio?.nativeElement;
      if (audio) {
        audio.pause();
        this.isPlaying.set(false);
      }
    } else {
      const video = this.recordedVideo?.nativeElement;
      if (video) {
        video.pause();
        this.isPlaying.set(false);
      }
    }
  }

  protected stopPlayback(): void {
    if (this.isAudioOnly()) {
      const audio = this.recordedAudio?.nativeElement;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        this.isPlaying.set(false);
      }
    } else {
      const video = this.recordedVideo?.nativeElement;
      if (video) {
        video.pause();
        video.currentTime = 0;
        this.isPlaying.set(false);
      }
    }
  }

  protected onPlaybackTimeUpdate(): void {
    if (this.isAudioOnly()) {
      const audio = this.recordedAudio?.nativeElement;
      if (audio) {
        this.currentPlaybackTime.set(audio.currentTime);
        this.playbackDuration.set(audio.duration || 0);
      }
    } else {
      const video = this.recordedVideo?.nativeElement;
      if (video) {
        this.currentPlaybackTime.set(video.currentTime);
        this.playbackDuration.set(video.duration || 0);
      }
    }
  }

  protected onPlaybackEnded(): void {
    this.isPlaying.set(false);
  }

  protected onPlaybackLoaded(): void {
    if (this.isAudioOnly()) {
      const audio = this.recordedAudio?.nativeElement;
      if (audio) {
        this.playbackDuration.set(audio.duration || this.elapsedTime() / 1000);
      }
    } else {
      const video = this.recordedVideo?.nativeElement;
      if (video) {
        this.playbackDuration.set(video.duration || this.elapsedTime() / 1000);
      }
    }
  }

  protected seekPlayback(event: Event): void {
    const input = event.target as HTMLInputElement;
    const seekTime = parseFloat(input.value);
    if (this.isAudioOnly()) {
      const audio = this.recordedAudio?.nativeElement;
      if (audio) audio.currentTime = seekTime;
    } else {
      const video = this.recordedVideo?.nativeElement;
      if (video) video.currentTime = seekTime;
    }
  }

  protected formatTime(seconds: number): string {
    if (!seconds && seconds !== 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  protected toggleMic(): void {
    if (!this.mediaStream) return;
    const audioTracks = this.mediaStream.getAudioTracks();
    const newState = !this.isMicMuted();
    audioTracks.forEach(track => track.enabled = !newState);
    this.isMicMuted.set(newState);
  }

  protected toggleCamera(): void {
    if (this.isAudioOnly() || !this.mediaStream) return;
    const videoTracks = this.mediaStream.getVideoTracks();
    const newState = !this.isCameraOff();
    videoTracks.forEach(track => track.enabled = !newState);
    this.isCameraOff.set(newState);
  }

  protected async switchCamera(deviceId: string): Promise<void> {
    this.selectedCamera.set(deviceId);
    await this.reinitializeStream();
  }

  protected async switchMicrophone(deviceId: string): Promise<void> {
    this.selectedMicrophone.set(deviceId);
    await this.reinitializeStream();
  }

  private async reinitializeStream(): Promise<void> {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    await this.setupMediaStream();
  }

  protected saveRecording(): void {
    const blob = this.recordedBlob();
    if (!blob) return;
    const result: RecordingResult = {
      blob, url: this.videoUrl() as string, duration: this.elapsedTime(),
      size: blob.size, mimeType: blob.type, thumbnail: this.thumbnail() || undefined
    };
    this.recordingComplete.emit(result);
  }

  protected reRecord(): void {
    this.cleanupRecordedData();
    this.setupMediaStream();
  }

  protected deleteRecording(): void {
    this.cleanupRecordedData();
    this.recordingCancel.emit();
  }

  private startTimer(): void {
    const startTime = Date.now() - this.elapsedTime();
    this.timerInterval = setInterval(() => {
      this.elapsedTime.set(Date.now() - startTime);
      this.config.callbacks?.onTimeUpdate?.(this.elapsedTime(), this.remainingTime());
      this.cdr.detectChanges();
    }, 100);
  }

  private pauseTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private resumeTimer(): void {
    this.startTimer();
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private handleMediaError(error: any): void {
    let message = 'Failed to access media devices';
    if (error.name === 'NotAllowedError') message = 'Permission denied';
    else if (error.name === 'NotFoundError') message = 'No camera/microphone found';
    this.handleError({ code: 'MEDIA_ERROR', message, originalError: error, recoverable: true });
  }

  private handleError(error: RecorderError): void {
    this.errorMessage.set(error.message);
    this.error.emit(error);
    this.config.callbacks?.onError?.(error);
    this.cdr.detectChanges();
  }

  private cleanupRecordedData(): void {
    if (this.videoUrl()) URL.revokeObjectURL(this.videoUrl() as string);
    this.recordedBlob.set(null);
    this.videoUrl.set(null);
    this.thumbnail.set(null);
    this.hasRecorded.set(false);
    this.elapsedTime.set(0);
    this.recordedChunks = [];
    this.isPlaying.set(false);
    this.currentPlaybackTime.set(0);
    this.playbackDuration.set(0);
  }

  private cleanupResources(): void {
    this.stopTimer();
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this.mediaRecorder?.state !== 'inactive') this.mediaRecorder?.stop();
    if (this.mediaStream) this.mediaStream.getTracks().forEach(track => track.stop());
    if (this.audioContext) this.audioContext.close();
    this.cleanupRecordedData();
  }

  protected setVirtualBackground(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      console.log('Virtual background set:', input.files[0].name);
    }
  }

  protected openTrimEditor(): void {
    console.log('Trim editor opened');
  }
}