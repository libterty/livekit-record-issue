# Livekit Gstreamer Issue Template

## Overview

This is a program that reproduces dtls issue in LiveKit/Gstreamer. 

## Env Replacement

- You need to replace the following env variables in code
```
this.process.send({
  wsUrl: 'your-domain',
  apiKey: 'your-api-key',
  secretKey: 'your-secret-key',
  roomName: this.endpointName,
  identity: `RC_${this.endpointName}_${this.timeKey.yymmddhhmmss()}`,
  location: this.tempPath,
});
```

## Error Log

### DTLS Issue
```log
[Nest] 14  - 08/22/2025, 2:00:42 PM     LOG [RC_LMVMTPE007337_2025-08-22-14-00-37] Starting recorder
[Nest] 14  - 08/22/2025, 2:00:45 PM   ERROR [RC_LMVMTPE007337_2025-08-22-14-00-37] Error: Could not read from resource.
[Nest] 14  - 08/22/2025, 2:00:45 PM   ERROR [RC_LMVMTPE007337_2025-08-22-14-00-37] Debug information: ../ext/dtls/gstdtlsdec.c(504): process_buffer (): /GstPipeline:pipeline0/GstLiveKitWebRTCSrc:src/GstBin:bin0/GstWebRTCBin:webrtcbin0/TransportReceiveBin:transportreceivebin0/GstDtlsSrtpDec:dtlssrtpdec0/GstDtlsDec:dtlsdec0:
Fatal SSL error
```