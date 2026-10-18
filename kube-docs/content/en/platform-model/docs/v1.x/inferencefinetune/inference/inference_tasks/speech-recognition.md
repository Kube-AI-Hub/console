---
title: "Speech Recognition"
keywords: "Industry AI Model Platform, speech recognition, ASR, speech to text, Fun-ASR, SenseVoice, transcription, inference endpoint"
description: "How to use the Fun-ASR speech recognition inference engine to transcribe audio into text, through the Playground or the API."
linkTitle: "Speech Recognition"
weight: 6256
---

## What it does

Speech recognition (automatic speech recognition, ASR) turns **a piece of audio** into **text**, and reports the audio duration and the processing time. It is the usual way to make recordings, meeting notes or subtitle material searchable.

The platform provides it through the [FunAudioLLM](https://github.com/FunAudioLLM/Fun-ASR) inference engine, which covers **23 languages** including Chinese, English and Japanese. Unlike text generation, the input is audio and the output is a transcript, so the endpoint overview shows an **audio picker and a transcript** rather than a chat box.

## Creating an endpoint

Go to **Model Inference → Endpoints → New Endpoint**:

1. **Model**: pick an uploaded Fun-ASR weights repository (for example `admin/Fun-ASR-Nano-2512`). The platform downloads and mounts it; nothing has to be prepared by hand.
2. **Framework**: choose `asr`. If it is not listed, ask an administrator to check that it is enabled under **Admin Console → Compute Resource → Runtime Framework & Image Management → Inference Engine**, or use **Import Built-in**.
3. **Compute**: pick a GPU specification. The engine ships a VAD (silence detection) model for splitting long audio, and a GPU is noticeably faster than CPU.
4. Fill in the rest as needed and submit, then wait for the endpoint to become ready.

{{< notice note >}}
The same model can be deployed with another framework, but the overview page will then show a different interface. Choose the `asr` framework to get the transcription page described below.
{{< /notice >}}

## Transcribing in the Playground

Open the overview tab once the endpoint is ready; the page is embedded there, so there is no separate address to find.

![The speech recognition Playground embedded in the endpoint overview](/images/docs/platform-model/inference/speech-recognition/overview-playground.png)

1. **Audio sample**: pick from 23 languages; Chinese is selected by default. Every language ships a sample clip, so a first run needs **no recording of your own**.
2. **Audio preview**: play the clip. Comparing what you hear with the transcript is how you tell a recognition mistake from a mis-remembered clip.

   ![Choosing a language's sample clip and playing it](/images/docs/platform-model/inference/speech-recognition/sample-language.png)

3. **Upload or record**: upload your own audio (MP3, WAV) or record a clip with the browser microphone. Either replaces the currently selected sample.
4. **Start / end time**: fill these in to transcribe only part of the clip, in seconds; leave them empty for the whole clip.
5. Click **Transcribe**. The result area shows the transcript plus `pipeline` (which pipeline ran), the audio duration and the processing time.

![The transcript and the processing time](/images/docs/platform-model/inference/speech-recognition/recognition-result.png)

With no audio selected, **Transcribe** sends no request and says "please select or upload audio" in place. An invalid time range (end before start) is reported the same way, without clearing the file or parameters you already chose.

The **API** tab embeds this engine's API reference (RapiDoc, styled to match the platform), so you can call an endpoint from the page instead of switching elsewhere. The reference follows the platform language: a Chinese UI shows the Chinese reference, and switching to English shows the English one.

![The API tab: Chinese reference and three code samples](/images/docs/platform-model/inference/speech-recognition/api-tab.png)

- Every operation carries **Python / JavaScript / cURL** samples you can copy with one click.
- The reference hides the engine's overall description and the Authentication block: every operation on this endpoint authenticates the same way, so repeating it per operation is noise.
- Ticking **Use my access token** replaces `YOUR_TOKEN` in the samples with your token and sends it with **Try it** requests; unticking restores the placeholder instead of leaving an empty `Bearer `.
- Operations that need no authentication (such as the health check) are marked public and their samples carry no credentials.

## Calling the API

The page and the API share one endpoint address and are told apart by route. Transcription is `POST /api/v1/transcribe`, and it accepts an uploaded file, a URL, or a bundled sample:

```bash
# Upload a clip
curl -X POST "https://<endpoint>/api/v1/transcribe" \
  -H "Authorization: Bearer <access token>" \
  -F "audio_input=@meeting.wav"

# Only seconds 3 to 8
curl -X POST "https://<endpoint>/api/v1/transcribe" \
  -H "Authorization: Bearer <access token>" \
  -F "audio_input=@meeting.wav" \
  -F "start_time=3" \
  -F "end_time=8"

# A bundled sample
curl -X POST "https://<endpoint>/api/v1/transcribe" \
  -H "Authorization: Bearer <access token>" \
  -H "Content-Type: application/json" \
  -d '{"audio_input": "/audio/en_f1.flac"}'
```

Parameters:

| Parameter | Notes |
|-----------|-------|
| `audio_input` | An uploaded audio file, or the path of a bundled sample |
| `audio_url` | An http/https audio address; use either this or `audio_input` |
| `start_time` | Start offset in seconds; empty means from the beginning |
| `end_time` | End offset in seconds; empty means to the end |

The response carries the transcript and the timings:

```json
{
  "text": "This is a speech recognition test.",
  "audio_duration_seconds": 4.512,
  "processing_time_seconds": 0.341,
  "pipeline": "Fun-ASR-Nano",
  "request": {
    "audio_source": "upload",
    "start_time": null,
    "end_time": null
  }
}
```

The full operation list is on the endpoint overview's **API** tab.

## Python example

```python
import requests

with open("meeting.wav", "rb") as audio:
    response = requests.post(
        "https://<endpoint>/api/v1/transcribe",
        headers={"Authorization": "Bearer <access token>"},
        files={"audio_input": audio},
        timeout=600,
    )

result = response.json()
print(result["text"])
print("audio", result["audio_duration_seconds"], "s / processing", result["processing_time_seconds"], "s")
```

To try a short excerpt of a long recording first, pass the time range:

```python
import requests

with open("meeting.wav", "rb") as audio:
    response = requests.post(
        "https://<endpoint>/api/v1/transcribe",
        headers={"Authorization": "Bearer <access token>"},
        files={"audio_input": audio},
        data={"start_time": 3, "end_time": 8},
        timeout=600,
    )

print(response.json()["text"])
```

## Troubleshooting

**The first transcription is slow**: the model is loaded on the first call; later calls are much faster.

**The transcript is empty**: play the clip first. An entirely silent or very quiet clip yields no text, which is a normal result rather than an error — try a clip that actually contains speech.

**The transcript looks wrong, or the language is odd**: confirm the clip's language is one of the supported ones. The engine detects it from the audio, and mixed-language clips confuse it; use **start / end time** to cut out a single-language excerpt first.

**Long audio is slow or times out**: use **start / end time** on a short excerpt to validate the path, then run the whole thing. Long audio is split by the engine's built-in VAD, so cost grows with length.

**Which pipeline ran**: the `pipeline` field in the result area (and in the API response) reports it, for example Fun-ASR-Nano. It changes with the model repository.

**The endpoint is ready but transcription fails**: call `/api/v1/transcribe` once from the **API** tab to separate a request problem from an engine problem; engine-side checks are in [Custom inference engines](../custom_engine).

**The API tab says "not using an API key"**: the page was opened without your token, usually because the browser served a cached copy. Force a reload (Ctrl/Cmd + Shift + R).

## See also

- [Creating an endpoint](../endpoint_create)
- [Using an endpoint](../endpoint_usage)
- [Custom inference engines](../custom_engine)
- [Speech synthesis](./speech-synthesis)
