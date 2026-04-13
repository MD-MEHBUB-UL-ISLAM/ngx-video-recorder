
export class MediaUtils {
  static async getSupportedMimeType(type: 'audio' | 'video'): Promise<string> {
    const codecs = type === 'video'
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      : ['audio/webm;codecs=opus', 'audio/webm'];

    for (const codec of codecs) {
      if (MediaRecorder.isTypeSupported(codec)) {
        return codec;
      }
    }
    return type === 'video' ? 'video/webm' : 'audio/webm';
  }

  static async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput' || d.kind === 'audioinput');
  }

  static async requestPermissions(audio: boolean, video: boolean): Promise<{ camera: boolean; microphone: boolean }> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      stream.getTracks().forEach(track => track.stop());
      
      return {
        camera: videoTracks.length > 0,
        microphone: audioTracks.length > 0
      };
    } catch {
      return { camera: false, microphone: false };
    }
  }
}