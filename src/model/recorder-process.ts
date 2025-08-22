import { MAX_RECORDING_DURATION } from '../constants';
import { disposify } from '../util/disposify';
import { CustomBusWatcher } from './custom-bus-watcher';
import GLib from '@girs/node-glib-2.0';
import Gst from '@girs/node-gst-1.0';
import { Logger } from '@nestjs/common';
import { RoomServiceClient } from 'livekit-server-sdk';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let livekitService: RoomServiceClient;
let logger: Logger;

process.on(
  'message',
  (data: {
    wsUrl: string;
    apiKey: string;
    secretKey: string;
    roomName: string;
    identity: string;
    location: string;
  }) => {
    logger = new Logger(data.identity);
    livekitService = new RoomServiceClient(
      data.wsUrl,
      data.apiKey,
      data.secretKey,
    );

    Gst.init(null);

    void (async () => {
      try {
        logger.log('Starting recorder');
        await main(data);
      } catch (error) {
        logger.error(error instanceof Error ? error.stack : error);
      }
    })();
  },
);

async function main(data: {
  wsUrl: string;
  apiKey: string;
  secretKey: string;
  roomName: string;
  identity: string;
  location: string;
}) {
  const videoCodec = '<H264>';

  using pipeline = disposify(
    Gst.parseLaunch(`
        livekitwebrtcsrc name=src
          signaller::ws-url=${data.wsUrl}
          signaller::api-key=${data.apiKey}
          signaller::secret-key=${data.secretKey}
          signaller::room-name=${data.roomName}
          signaller::identity=${data.identity}
          signaller::participant-name=${data.identity}
          video-codecs=${videoCodec}
        queue name=video_queue
        ! identity sync=true
        ! rtph264depay
        ! h264parse name=h264parse config-interval=-1
        ! queue
        ! mux.video_0
        audiotestsrc wave=0 volume=0
        ! audioconvert
        ! audioresample
        ! audio_mixer.
        audiomixer name=audio_mixer
        ! avenc_aac
        ! aacparse
        ! queue
        ! mux.audio_0
        mp4mux name=mux
          reserved-max-duration=${MAX_RECORDING_DURATION * Gst.MSECOND * 1.5}
          reserved-moov-update-period=${Gst.SECOND}
        ! filesink
          location=${data.location}
      `) as Gst.Pipeline,
  );

  using webrtcSrc = disposify(pipeline.getByName('src'));
  webrtcSrc.connect('pad-added', (pad) => {
    try {
      const padName = pad.getName();
      const info = pad.getProperty<Gst.Structure>('participant-info');
      const identity = info?.getString('identity') || 'undefined';
      if (!info && padName.startsWith('video_')) {
        logger.error(`Pad added: ${padName} without participant-info`);
        kickRecorder();
        return;
      } else if (info && padName.startsWith('audio_')) {
        logger.log(`Pad added: ${padName} ${identity}`);
      }

      pad.addProbe(Gst.PadProbeType.BUFFER, (pad, info) =>
        fixInvalidPts(pad, info),
      );

      if (padName.startsWith('video_')) {
        if (identity !== data.roomName) {
          return;
        }
        using videoQueue = disposify(pipeline.getByName('video_queue'));
        using videoQueueSink = disposify(videoQueue.getStaticPad('sink'));
        pad.link(videoQueueSink);
      }
      if (padName.startsWith('audio_')) {
        const template =
          'queue ! identity sync=true ! rtpopusdepay ! opusdec ! audioconvert ! audioresample';
        using dynamicBin = disposify(
          Gst.parseBinFromDescription(template, true),
        );
        dynamicBin.setName(`audio_${pad.getName()}`);
        pipeline.add(dynamicBin);
        dynamicBin.syncStateWithParent();
        using audioMixer = disposify(pipeline.getByName('audio_mixer'));
        dynamicBin.link(audioMixer);
        using sink = disposify(dynamicBin.getStaticPad('sink'));
        pad.link(sink);
      }
    } finally {
      pad.unref();
    }
  });

  using h264parse = disposify(pipeline.getByName('h264parse'));
  using h264Pad = disposify(h264parse.getStaticPad('src'));

  h264Pad.addProbe(Gst.PadProbeType.BUFFER, (pad, info) =>
    fixInvalidPts(pad, info),
  );

  process.send({ status: 'starting' });
  pipeline.setState(Gst.State.PLAYING);
  process.send({ status: 'started' });

  using bus = disposify(pipeline.getBus());
  const watcher = new CustomBusWatcher(bus);
  await new Promise<void>((resolve) => {
    watcher.on(Gst.MessageType.ERROR, (msg) => {
      const [err, debugInfo] = msg.parseError();

      if (
        err.message === 'GStreamer encountered a general stream error.' ||
        err.message === 'Could not write to resource.'
      ) {
        logger.log(`Recorder Participant Disconnected`);
      } else if (err.message === 'Internal data stream error.') {
        logger.error(
          `Error: Internal data stream error. Maybe DasLoop exit room unexpected`,
        );
        void (async () => {
          try {
            await livekitService.updateRoomMetadata(
              data.roomName,
              JSON.stringify({
                recorderConnected: true,
                isRecordingStop: true,
                errorMsg: {
                  message:
                    'Device issue, please check network connection or restart the device',
                  timestamp: new Date().toISOString(),
                },
              }),
            );
          } catch (error) {
            logger.error(error instanceof Error ? error.stack : error);
          }
        })();
      } else {
        logger.error(`Error: ${err.message}`);
        logger.error(`Debug information: ${debugInfo}`);
      }

      resolve();
    });

    watcher.on(Gst.MessageType.WARNING, (msg) => {
      const [warn, debugInfo] = msg.parseWarning();
      logger.warn(`Warning: ${warn.message}`);
      logger.warn(`Debug information: ${debugInfo}`);
    });
  });

  process.send({ status: 'stopping' });
  logger.log('Stopping recorder pipeline');
  // First dispose of the watcher to prevent new messages from being processed
  watcher?.dispose();

  // await performStateChangeWithRetry(Gst.State.PAUSED);
  // await sleep(1000);
  logger.log('Watcher disposed');
  // const flushStart = webrtcSrc?.sendEvent(Gst.Event.newFlushStart());
  // logger.log(`Flush start returned: ${flushStart}`);
  // const flushStop = webrtcSrc?.sendEvent(Gst.Event.newFlushStop(true));
  // logger.log(`Flush start returned: ${flushStop}`);

  const newEos = webrtcSrc?.sendEvent(Gst.Event.newEos());
  logger.log(`EOS sent to WebRTC source: ${newEos}`);

  await sleep(1000);
  logger.log('Flush sent to WebRTC source');
  await performStateChangeWithRetry(Gst.State.NULL);
  logger.log('Recorder pipeline stopped');
  process.send({ status: 'stopped' });
  process.exit(0);

  function fixInvalidPts(pad: Gst.Pad, info: Gst.PadProbeInfo) {
    const buffer = info.getBuffer();

    if (buffer.pts === GLib.MAXUINT64) {
      using parentElement = disposify(pad.getParentElement());
      const ts = parentElement.getCurrentRunningTime();
      logger.warn(`Fixing invalid pts: ${ts}`);
      buffer.pts = ts;
      return Gst.PadProbeReturn.OK;
    }

    return Gst.PadProbeReturn.OK;
  }

  function kickRecorder() {
    void (async () => {
      try {
        await livekitService.removeParticipant(data.roomName, data.identity);
      } catch (error) {
        logger.error(error instanceof Error ? error.stack : error);
      }
    })();
  }

  async function performStateChangeWithRetry(
    state: Gst.State,
    retryCount = 0,
  ): Promise<void> {
    const stateChangeResult = pipeline?.setState(state);
    logger.log(
      `Pipeline state change to NULL returned: ${Gst.StateChangeReturn[stateChangeResult]}`,
    );
    if (
      stateChangeResult !== Gst.StateChangeReturn.SUCCESS &&
      stateChangeResult !== Gst.StateChangeReturn.ASYNC
    ) {
      // Additional error handling
      if (stateChangeResult === Gst.StateChangeReturn.FAILURE) {
        logger.error(
          'Failed to change pipeline state to NULL - attempting retry',
        );

        if (retryCount < 3) {
          logger.warn(`Retry attempt ${retryCount + 1} of ${3}`);
          // Adjusted backoff to ensure total time < 10 seconds
          // 1s, 2s, 3s backoff (total = 1+2+3+1 = 7 seconds max including initial EOS wait)
          const backoffMs = (retryCount + 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          return await performStateChangeWithRetry(state, retryCount + 1);
        } else {
          logger.error('Max retries reached - forcing resource cleanup');
          // Continue with cleanup despite failures
        }
      } else if (stateChangeResult === Gst.StateChangeReturn.NO_PREROLL) {
        logger.warn(
          'Pipeline is live and cannot preroll - proceeding with cleanup anyway',
        );
      }
    }
  }
}
