import { Module } from '@nestjs/common';
import { RecorderMonitor } from './model/recorder-monitor';

@Module({
  controllers: [],
  providers: [
    {
      provide: 'MONITOR',
      useClass: RecorderMonitor,
    }
  ],
})
export class AppModule {
  
}
