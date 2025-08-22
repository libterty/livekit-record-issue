import { RoomRecorderTimeKey } from './room-recorder-time-key';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChildProcess, fork } from 'child_process';
import { dirname } from 'path';


@Injectable()
export class RecorderMonitor implements OnModuleInit {
  private process: ChildProcess;
  private killed: boolean = false;
  private timeKey = new RoomRecorderTimeKey(new Date());
  private readonly logger = new Logger(RecorderMonitor.name);
  private readonly endpointName = 'LMVMTPE007337'
  private readonly name = `RC_${this.endpointName}_${this.timeKey.yymmddhhmmss()}`;
  private readonly tempPath = `tmp/${this.name}.mp4`;

  public onModuleInit() {
    this.startProcess();
  }

  private startProcess() {
    this.process = fork(dirname(__filename) + '/recorder-process');

    this.process.send({
      wsUrl: 'your-domain',
      apiKey: 'your-api-key',
      secretKey: 'your-secret-key',
      roomName: this.endpointName,
      identity: `RC_${this.endpointName}_${this.timeKey.yymmddhhmmss()}`,
      location: this.tempPath,
    });

    this.process.on('message', (msg: { status: string }) => {
      if (msg.status === 'stopping') {
        void (async () => {
          await new Promise((resolve) => setTimeout(resolve, 60000));
          if (!this.isExited()) {
            this.logger.error(`Pipeline is stop timed out, force kill`);
            this.process.kill('SIGKILL');
            this.killed = true;
          }
        })();
      }
    });

    this.process.on('exit', () => {
      this.process.kill('SIGKILL');
      this.killed = true;
    });
  }

  isExited() {
    return this.killed;
  }
}
