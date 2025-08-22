import { AppModule } from './app.module';
import { LogLevel, ShutdownSignal } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import fs from 'fs';
import * as process from 'node:process';

void (async () => {
  if (!fs.existsSync('tmp')) {
    fs.mkdirSync('tmp');
  }

  const app = await NestFactory.create(AppModule);

  const loglevel = process.env.LOG_LEVEL;
  if (loglevel) {
    app.useLogger(loglevel.split(',') as LogLevel[]);
  }

  app.enableShutdownHooks([ShutdownSignal.SIGINT, ShutdownSignal.SIGTERM]);
  await app.init();
})();
