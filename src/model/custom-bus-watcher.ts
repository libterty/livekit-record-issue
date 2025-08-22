import Gst from '@girs/node-gst-1.0';
import EventEmitter from 'events';

export class CustomBusWatcher {
  private emitter: EventEmitter;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private bus: Gst.Bus) {
    this.bus = bus;
    this.emitter = new EventEmitter();
    this.run();
  }

  run() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(() => {
      const msg = this.bus.pop();
      if (msg) {
        for (const key of Object.values(Gst.MessageType).reverse()) {
          if (typeof key !== 'number' || key === Gst.MessageType.UNKNOWN) {
            continue;
          }
          if ((msg.type & key) === key) {
            setImmediate(() => this.emitter.emit(Gst.MessageType[key], msg));
          }
        }
      }
    }, 4);
  }

  on(event: Gst.MessageType, listener: (message: Gst.Message) => void): this {
    for (const key of Object.values(Gst.MessageType).reverse()) {
      if (typeof key !== 'number' || key === Gst.MessageType.UNKNOWN) {
        continue;
      }
      if ((event & key) === key) {
        this.emitter.on(Gst.MessageType[key], listener);
      }
    }

    return this;
  }

  dispose() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.emitter.removeAllListeners();
  }
}
