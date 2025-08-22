lea# DasIoT - LiveKit Recorder

## Overview

This is a program that uses GStreamer to record LiveKit streams.

It uses two different LiveKit SDKs:

* Server SDK

`livekit-server-sdk` - Uses Key and Secret to access the LiveKit API, can create tokens

* Client SDK

`@livekit/rtc-node` - Uses tokens to join rooms, can get more detailed information, and can receive room events

### MonitorService
Uses the LiveKit Server SDK to check for new rooms every five seconds, and if there are any, it calls RecorderService to connect to the room
Manages the connections of all room RoomMonitors, each room has a RoomMonitor to monitor the room's status

### RoomMonitor
Checks the room's status every second, activates when participants change or RoomRecorder stop
A RoomMonitor can only monitor one room, but a RoomMonitor can have multiple Recorders
Every ten minutes, there will be an independent RoomRecorder to record the room's audio and video, with a 10-second overlap, during which two RoomRecorders will record simultaneously

The RoomMonitor is also responsible for updating the room's metadata
DasLoop Video relies on `metadata.isRecordingStop` to decide whether to turn on the camera

### RecorderMonitor
Launch process to recording the room and uploading the mp4 to S3
When receiving the `stopping` event, it will start counting down and kill the process if not stopped
It prevents any deadlocks caused by the GStreamer Pipeline

### RecorderProcess
Note that `livekitwebrtcsrc` cannot be stopped directly, as it will cause Node.js to deadlock
You need to stop the BOT participant first
After the BOT participants is removed, the GStreamer Pipeline will throw an error, and then closing the Pipeline will not cause a deadlock

Possible future changes include adjusting the Pipeline to support more encoding formats
When adjusting the Pipeline, it is recommended not to look at the GStreamer Element documentation, as the documentation on the website is incomplete
It is recommended to use `gst-inspect-1.0` to view the properties and other specs of the elements
However, you can still refer to the GStreamer tutorial documents to understand the concepts of GStreamer

## Error Log

### Internal data stream error & not-negotiated (-4)
```log
[Nest] 1  - 03/14/2025, 3:43:03 AM   ERROR [RC_LLVJTYO006456_03-40-36] Error: Internal data stream error.
[Nest] 1  - 03/14/2025, 3:43:03 AM   ERROR [RC_LLVJTYO006456_03-40-36] Debug information: ../libs/gst/base/gstbasesrc.c(3177): gst_base_src_loop (): /GstPipeline:pipeline1/GstLiveKitWebRTCSrc:src/GstBin:bin5/GstWebRTCBin:webrtcbin1/TransportReceiveBin:transportreceivebin1/GstNiceSrc:nicesrc1:
streaming stopped, reason not-negotiated (-4)
```

This usually happens when the helmet does not exit the room properly, such as due to a crash or power loss.
GStreamer will stop because it does not receive data.

You can reproduce this error by long pressing the power button on the helmet.

## Useful Links
* [GStreamer](https://gstreamer.freedesktop.org)
* [GStreamer Examples](https://gitlab.freedesktop.org/gstreamer/gst-examples)
* [GStreamer Discourse](https://discourse.gstreamer.org)
* [node-gtk](https://github.com/romgrk/node-gtk)
* [LiveKit](https://livekit.io/)
* [Tintin's Node.js GStreamer Cookbook](https://babyducktw.github.io/node-gstreamer-cookbook)


docker run -d --platform=linux/amd64 --name issue-livekit-record -p 3000:3000 --env-file .env issue-livekit-record