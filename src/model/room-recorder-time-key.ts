import { MAX_RECORDING_DURATION, OVERLAP_DURATION } from '../constants';

export class RoomRecorderTimeKey {
  constructor(
    private start: Date,
  ) {}

  public hms() {
    const [, hmsz] = this.start.toISOString().split('T');
    const hms = hmsz.split('.')[0];
    const [h, min, s] = hms.split(':');
    return `${h}-${min}-${s}`;
  }

  public yymmddhhmmss() {
    let year = this.start.getFullYear();
    let month = ('0' + (this.start.getMonth() + 1)).slice(-2); // Month is zero-based
    let day = ('0' + this.start.getDate()).slice(-2);
    let hour = ('0' + this.start.getHours()).slice(-2);
    let minute = ('0' + this.start.getMinutes()).slice(-2);
    let second = ('0' + this.start.getSeconds()).slice(-2);
    return `${year}-${month}-${day}-${hour}-${minute}-${second}`;
  }

  isOverlap() {
    const now = new Date();
    const diff = now.getTime() - this.start.getTime();
    return diff > MAX_RECORDING_DURATION - OVERLAP_DURATION;
  }

  isOutdated() {
    const now = new Date();
    const diff = now.getTime() - this.start.getTime();
    return diff > MAX_RECORDING_DURATION;
  }
}

// npx ts-node src/model/room-recorder-time-key.ts
