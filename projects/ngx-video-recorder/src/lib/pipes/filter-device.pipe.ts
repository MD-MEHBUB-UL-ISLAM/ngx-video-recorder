
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterDevice',
  standalone: true
})
export class FilterDevicePipe implements PipeTransform {
  transform(devices: MediaDeviceInfo[] | null, kind: string): MediaDeviceInfo[] {
    if (!devices) return [];
    return devices.filter(device => device.kind === kind);
  }
}