
import { Injectable } from '@angular/core';
import { RecorderConfig, DevicePermissions } from '../interfaces/recorder-config.interface';
import { MediaUtils } from '../utils/media-utils';

@Injectable({
  providedIn: 'root'
})
export class VideoRecorderService {
  
  async requestPermissions(mode: 'video' | 'audio' | 'both'): Promise<DevicePermissions> {
    return MediaUtils.requestPermissions(true, mode !== 'audio');
  }

  async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    return MediaUtils.getAvailableDevices();
  }

  buildMediaConstraints(config: RecorderConfig, mode: 'video' | 'audio' | 'both'): MediaStreamConstraints {
    const constraints: MediaStreamConstraints = { audio: true };

    if (mode !== 'audio') {
      constraints.video = {
        width: config.video?.width || { ideal: 1280 },
        height: config.video?.height || { ideal: 720 },
        frameRate: config.video?.frameRate || { ideal: 30 },
        facingMode: config.video?.facingMode || 'user'
      };
    } else {
      constraints.video = false;
    }

    if (config.audio) {
      constraints.audio = {
        echoCancellation: config.audio.echoCancellation ?? true,
        noiseSuppression: config.audio.noiseSuppression ?? true,
        autoGainControl: config.audio.autoGainControl ?? true
      };
    }

    return constraints;
  }

  async getRecorderOptions(config: RecorderConfig, mode: string): Promise<MediaRecorderOptions> {
    const mimeType = await MediaUtils.getSupportedMimeType(mode === 'audio' ? 'audio' : 'video');
    return { mimeType };
  }

  async generateMetadata(config: RecorderConfig): Promise<any> {
    return {
      timestamp: Date.now(),
      settings: config
    };
  }
}