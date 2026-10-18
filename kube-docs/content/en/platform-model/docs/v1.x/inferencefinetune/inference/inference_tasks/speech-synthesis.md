---
title: "Speech Synthesis"
keywords: "Industry AI Model Platform, speech synthesis, TTS, text to speech, Chatterbox, voice cloning, multilingual speech, inference endpoint"
description: "How to use the Chatterbox speech synthesis inference engine to turn text into speech with a chosen voice, through the Playground or the API."
linkTitle: "Speech Synthesis"
weight: 6257
---

## What it does

Speech synthesis (text to speech, TTS) turns **a piece of text** into **a piece of audio**, using a **reference audio clip** to pick the voice: the same text read with a different reference clip sounds like a different speaker. It is the usual way to voice a script, produce audio content in bulk, or check how a particular voice sounds.

The platform provides it through the [Chatterbox Multilingual TTS](https://github.com/resemble-ai/chatterbox) inference engine, which covers **23 languages** including Chinese, English and Japanese. Unlike text generation, the input is text and the output is audio, so the endpoint overview shows a **text editor and an audio player** rather than a chat box.

## Creating an endpoint

Go to **Model Inference → Endpoints → New Endpoint**:

1. **Model**: pick an uploaded Chatterbox weights repository (for example `admin/chatterbox`). The platform downloads and mounts it; nothing has to be prepared by hand.
2. **Framework**: choose `chatterbox-tts`. If it is not listed, ask an administrator to check that it is enabled under **Admin Console → Compute Resource → Runtime Framework & Image Management → Inference Engine**, or use **Import Built-in**.
3. **Compute**: pick a GPU specification. Synthesis loads the acoustic model and the vocoder, so a GPU is noticeably faster than CPU.
4. Fill in the rest as needed and submit. The first run also syncs the weights into the shared cache, so it takes a little longer than a text-only model.

{{< notice note >}}
The same model can be deployed with another framework, but the overview page will then show a different interface. Choose the `chatterbox-tts` framework to get the synthesis page described below.
{{< /notice >}}

## Synthesising in the Playground

Open the overview tab once the endpoint is ready; the page is embedded there, so there is no separate address to find.

![The speech synthesis Playground embedded in the endpoint overview](/images/docs/platform-model/inference/speech-synthesis/overview-playground.png)

1. **Text**: enter what you want spoken, up to 300 characters. Switching language replaces it with that language's default text, so a first run needs no typing.
2. **Language**: pick from 23 entries, shown as "language name - code" (for example "Chinese - zh"). Switching language also changes the default text and the default reference audio.
3. **Reference audio**: this decides the voice. The three sources are **mutually exclusive** — choosing one clears the others.

   | Source | Notes |
   |--------|-------|
   | Bundled example | Every language ships one, and it is used **when you pick no source at all** |
   | Upload | Upload a local audio file |
   | Record | Record a clip with the browser microphone |
   | Reference audio URL (optional) | Filling this in clears the upload and the recording |

   The **reference audio preview** player lets you listen to the current clip first, before deciding whether to swap it.
4. **Parameters**: the defaults are fine to start with.

   | Parameter | Default | Effect |
   |-----------|---------|--------|
   | Exaggeration | 0.5 | Emotional intensity; higher is more expressive |
   | Temperature | 0.8 | Randomness; lower is steadier, higher is more varied |
   | CFG / Pace | — | Speaking rate and rhythm |
   | Seed | 0 (random) | Fix it and the same input gives the same output, which makes comparisons easier |

5. Click **Generate**. An audio player appears in the result area; play it there, or download it to use elsewhere.

![The three reference audio sources and the parameter panel](/images/docs/platform-model/inference/speech-synthesis/reference-audio.png)

![The synthesised audio, ready to play or download](/images/docs/platform-model/inference/speech-synthesis/synthesis-result.png)

If the text is empty or longer than 300 characters, **Generate** sends no request and says so in place, without discarding what you entered. Failures are reported under the button in the same way.

The **API** tab embeds this engine's API reference (RapiDoc, styled to match the platform), so you can call an endpoint from the page instead of switching elsewhere. The reference follows the platform language: a Chinese UI shows the Chinese reference, and switching to English shows the English one.

![The API tab: Chinese reference and three code samples](/images/docs/platform-model/inference/speech-synthesis/api-tab.png)

- Every operation carries **Python / JavaScript / cURL** samples you can copy with one click.
- The reference hides the engine's overall description and the Authentication block: every operation on this endpoint authenticates the same way, so repeating it per operation is noise.
- Ticking **Use my access token** replaces `YOUR_TOKEN` in the samples with your token and sends it with **Try it** requests; unticking restores the placeholder instead of leaving an empty `Bearer `.
- Operations that need no authentication (such as the health check) are marked public and their samples carry no credentials.

## Calling the API

The page and the API share one endpoint address and are told apart by route. Synthesis is `POST /api/v1/tts`:

```bash
curl -X POST "https://<endpoint>/api/v1/tts" \
  -H "Authorization: Bearer <access token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a synthesis test.", "language_id": "en", "exaggeration": 0.5}'
```

Parameters:

| Parameter | Notes |
|-----------|-------|
| `text` | Text to synthesise, up to 300 characters |
| `language_id` | Language code such as `zh`, `en`, `ja`; 23 in total |
| `audio_prompt_url` | Reference clip address, which sets the voice; omit it to use that language's bundled example |
| `exaggeration` | Emotional intensity, default 0.5 |
| `temperature` | Randomness, default 0.8 |
| `cfg_weight` | Speaking rate and rhythm |
| `seed` | Random seed; `0` means random |

To supply your own voice, switch to `multipart/form-data` and send the reference clip as a file:

```bash
curl -X POST "https://<endpoint>/api/v1/tts" \
  -H "Authorization: Bearer <access token>" \
  -F "text=Hello, this is a synthesis test." \
  -F "language_id=en" \
  -F "audio_prompt=@reference.wav"
```

The response is JSON with the audio inlined as base64 in `audio_base64`, alongside `sample_rate`, `format` and `duration_seconds`, plus a `request` object echoing what was actually used:

```json
{
  "sample_rate": 24000,
  "format": "wav",
  "audio_base64": "UklGRi...",
  "duration_seconds": 2.35,
  "request": {
    "text": "Hello, this is a synthesis test.",
    "language_id": "en",
    "audio_prompt": "/audio/en_f1.flac",
    "exaggeration": 0.5,
    "temperature": 0.8,
    "cfg_weight": 0.5,
    "seed": 0
  }
}
```

The full operation list is on the endpoint overview's **API** tab.

## Python example

```python
import base64

import requests

response = requests.post(
    "https://<endpoint>/api/v1/tts",
    headers={"Authorization": "Bearer <access token>"},
    json={
        "text": "Hello, this is a synthesis test.",
        "language_id": "en",
        "exaggeration": 0.5,
    },
    timeout=600,
)
result = response.json()

with open("output.wav", "wb") as f:
    f.write(base64.b64decode(result["audio_base64"]))
print(result["duration_seconds"], "seconds")
```

To use your own voice, upload the reference clip alongside the text:

```python
import base64

import requests

with open("reference.wav", "rb") as ref:
    response = requests.post(
        "https://<endpoint>/api/v1/tts",
        headers={"Authorization": "Bearer <access token>"},
        data={"text": "Hello, this is a synthesis test.", "language_id": "en"},
        files={"audio_prompt": ref},
        timeout=600,
    )

with open("output.wav", "wb") as f:
    f.write(base64.b64decode(response.json()["audio_base64"]))
```

## Troubleshooting

**The first synthesis is slow**: the model is loaded on the first call; later calls are much faster.

**The audio is unintelligible**: check the **language** first. With the wrong language the text is processed by the wrong rules and comes out badly.

**Changing the voice**: swap the reference audio. A 5–10 second clip with clear speech and little background noise works best. With no reference audio, the language's bundled example is used.

**Two runs of the same text differ**: that is expected, sampling is random. Setting a non-zero **seed** makes two runs identical, which is how you compare parameter changes.

**Chinese sounds worse than English**: Chinese text is segmented before it reaches the model; if the segmentation model is missing from the image that step is skipped and Chinese quality drops. There is a warning in the engine log — ask an administrator to confirm the image version.

**The text is over 300 characters**: the page says so in place rather than truncating silently. Split long text into several calls.

**The endpoint is ready but synthesis fails**: call `/api/v1/tts` once from the **API** tab to separate a request problem from an engine problem; engine-side checks are in [Custom inference engines](../custom_engine).

**The API tab says "not using an API key"**: the page was opened without your token, usually because the browser served a cached copy. Force a reload (Ctrl/Cmd + Shift + R).

## See also

- [Creating an endpoint](../endpoint_create)
- [Using an endpoint](../endpoint_usage)
- [Custom inference engines](../custom_engine)
- [Speech recognition](./speech-recognition)
