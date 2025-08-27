# LiveKit GStreamer DTLS Issue Reproduction

## Problem Description

This repository contains code that reproduces a **DTLS (Datagram Transport Layer Security) connection issue** when using LiveKit with GStreamer for WebRTC recording. The error occurs during the SSL/TLS handshake process, preventing proper media stream recording.

## What You'll Need

Before running this reproduction case, you need access to:

- A LiveKit server instance
- LiveKit API credentials (API key and secret)
- Docker installed on your system

## Setup Instructions

### 1. Configure Your LiveKit Credentials

Open the code file and replace these placeholder values with your actual LiveKit configuration:

```javascript
this.process.send({
  wsUrl: 'wss://your-livekit-domain.com',           // Your LiveKit server URL
  apiKey: 'your-livekit-api-key',                   // Your LiveKit API key
  secretKey: 'your-livekit-secret-key',             // Your LiveKit secret key
  roomName: 'test-room-name',                       // Room name to record
  identity: `RC_${your-room-name}_${timestamp}`,    // Unique participant identity
  location: this.tempPath,                          // Output file location
});
```

### 2. Build and Run

```bash
# Build the Docker image
docker build --no-cache -t issue-livekit-record .

# Run the container
docker run -d --name issue-livekit-record issue-livekit-record
```

### 3. Check the Logs

```bash
# View container logs to see the error
docker logs issue-livekit-record
```

## Expected Error Output

When the DTLS issue occurs, you'll see logs similar to this:

```log
[Nest] 14  - 08/22/2025, 2:00:42 PM     LOG [RC_LMVMTPE007337_2025-08-22-14-00-37] Starting recorder
[Nest] 14  - 08/22/2025, 2:00:45 PM   ERROR [RC_LMVMTPE007337_2025-08-22-14-00-37] Error: Could not read from resource.
[Nest] 14  - 08/22/2025, 2:00:45 PM   ERROR [RC_LMVMTPE007337_2025-08-22-14-00-37] Debug information: ../ext/dtls/gstdtlsdec.c(504): process_buffer (): /GstPipeline:pipeline0/GstLiveKitWebRTCSrc:src/GstBin:bin0/GstWebRTCBin:webrtcbin0/TransportReceiveBin:transportreceivebin0/GstDtlsSrtpDec:dtlssrtpdec0/GstDtlsDec:dtlsdec0:
Fatal SSL error
```
