---
title: "Speech Recognition"
keywords: "Industry AI Model Platform, speech recognition, ASR, speech to text, Fun-ASR, SenseVoice, Paraformer, Whisper, Qwen3-ASR, OpenAI compatible, inference endpoint"
description: "How to use the general speech recognition inference engine to transcribe audio into text, through the Playground, the OpenAI-compatible API, and the supported model families."
linkTitle: "Speech Recognition"
weight: 6256
---

## What it does

Speech recognition (automatic speech recognition, ASR) turns **a piece of audio** into **text**, and reports the audio duration and the processing time. It is the usual way to make recordings, meeting notes or subtitle material searchable.

The platform provides it through a general speech recognition engine: **one engine covers several model families**, and it picks the backend from the model, so callers only ever see one OpenAI-compatible API. It supports **23 languages** (the exact set depends on the model you deploy). Unlike text generation, the input is audio and the output is a transcript, so the endpoint overview shows an **audio picker and a transcript** rather than a chat box.

| Family | Typical repository | Engine backend |
|--------|--------------------|----------------|
| Fun-ASR-Nano / Fun-ASR-MLT | `admin/Fun-ASR-Nano-2512` | `vllm` (accelerated) |
| GLM-ASR | `admin/GLM-ASR-Nano-2512` | `vllm` (accelerated) |
| Whisper | `admin/Whisper-large-v3` | `vllm` (multilingual ones also translate) |
| SenseVoice | `admin/SenseVoiceSmall` | `funasr` |
| Paraformer | `admin/Paraformer-zh` | `funasr` |
| Qwen3-ASR | `admin/Qwen3-ASR-1.7B` | `qwen-asr` |

## Creating an endpoint

Go to **Model Inference → Endpoints → New Endpoint**:

1. **Model**: pick an uploaded speech recognition weights repository (for example `admin/Fun-ASR-Nano-2512`). The platform downloads and mounts it; nothing has to be prepared by hand.
2. **Framework**: choose according to the model.
   - Fun-ASR / GLM-ASR / Whisper / SenseVoice / Paraformer: choose `asr`.
   - **Qwen3-ASR: choose `asr-qwen`**, not `asr`.
   If it is not listed, ask an administrator to check that it is enabled under **Admin Console → Compute Resource → Runtime Framework & Image Management → Inference Engine**, or use **Import Built-in**.
3. **Compute**: pick a GPU specification. The engine ships a VAD (silence detection) model for splitting long audio, and a GPU is noticeably faster than CPU.
4. Fill in the rest as needed and submit, then wait for the endpoint to become ready.

{{< notice warning >}}
`asr` and `asr-qwen` are **the same engine**; they are two images only because their vLLM builds need different CUDA versions. When you pick a Qwen3-ASR model, the platform may auto-select `vllm` instead of `asr-qwen`, because `vllm` declares the same model architecture. **Change it to `asr-qwen` manually**, otherwise the endpoint runs the wrong image.
{{< /notice >}}

{{< notice note >}}
The same model can be deployed with another framework, but the overview page will then show a different interface. Choose the `asr` or `asr-qwen` framework to get the transcription page described below.
{{< /notice >}}

## Transcribing in the Playground

Open the overview tab once the endpoint is ready; the page is embedded there, so there is no separate address to find.

![The speech recognition Playground embedded in the endpoint overview](/images/docs/platform-model/inference/speech-recognition/overview-playground.png)

1. **Audio sample**: pick from 23 languages; Chinese is selected by default. Every language ships a sample clip, so a first run needs **no recording of your own**.
2. **Audio preview**: play the clip. Comparing what you hear with the transcript is how you tell a recognition mistake from a mis-remembered clip.

   ![Choosing a language's sample clip and playing it](/images/docs/platform-model/inference/speech-recognition/sample-language.png)

3. **Upload or record**: upload your own audio (MP3, WAV) or record a clip with the browser microphone. Either replaces the currently selected sample.
4. **Start / end time**: fill these in to transcribe only part of the clip, in seconds; leave them empty for the whole clip. The trimming happens **in the browser**, and only the selected excerpt is uploaded.
5. **Language and hotwords** (optional): leave the language empty to auto-detect; hotwords are comma-separated and bias recognition toward those terms.
6. **Translate**: this toggle only appears when the deployed model is a multilingual Whisper. Other models have no translation task, so the control is hidden rather than shown and then rejected.
7. Click **Transcribe**. The result area shows the transcript plus the audio duration and the processing time.

![The transcript and the processing time](/images/docs/platform-model/inference/speech-recognition/recognition-result.png)

With no audio selected, **Transcribe** sends no request and says "please select or upload audio" in place. An invalid time range (end before start) is reported the same way, without clearing the file or parameters you already chose.

The **API** tab embeds this engine's API reference (RapiDoc, styled to match the platform), so you can call an endpoint from the page instead of switching elsewhere. The reference follows the platform language: a Chinese UI shows the Chinese reference, and switching to English shows the English one.

![The API tab: Chinese reference and three code samples](/images/docs/platform-model/inference/speech-recognition/api-tab.png)

- Every operation carries **Python / JavaScript / cURL** samples you can copy with one click.
- The reference hides the engine's overall description and the Authentication block: every operation on this endpoint authenticates the same way, so repeating it per operation is noise.
- Ticking **Use my access token** replaces `YOUR_TOKEN` in the samples with your token and sends it with **Try it** requests; unticking restores the placeholder instead of leaving an empty `Bearer `.
- Operations that need no authentication (the health check, the model list) are marked public and their samples carry no credentials.

## Calling the API

The page and the API share one endpoint address. The routes are **compatible with OpenAI's audio API**, so any OpenAI SDK works by changing only `base_url`.

### Transcription

`POST /v1/audio/transcriptions`, with a `multipart/form-data` body whose file field is `file`:

```bash
curl -X POST "https://<endpoint>/v1/audio/transcriptions" \
  -H "Authorization: Bearer <access token>" \
  -F "file=@meeting.wav" \
  -F "model=local" \
  -F "response_format=json" \
  -F "stream=false"
```

Parameters:

| Parameter | Notes |
|-----------|-------|
| `file` | Audio file; MP3, WAV, FLAC, M4A and others |
| `model` | Model alias, defaults to `local`; the repository id or name also works |
| `language` | Language code; empty means auto-detect |
| `hotwords` | Comma-separated terms to bias recognition |
| `response_format` | `json` (default), `text`, `verbose_json` |
| `stream` | Splits into 30-second chunks when `true`; defaults to `true` |

What `response_format` changes:

- `json`: `{"text": "..."}`
- `text`: plain text
- `verbose_json`: adds `segments` (start/end plus speaker), `language`, `duration` and `model`

The total audio duration is in the **`Audio-Duration-Seconds` response header**, not in the body:

```bash
curl -s -D - -o /dev/null -X POST "https://<endpoint>/v1/audio/transcriptions" \
  -H "Authorization: Bearer <access token>" \
  -F "file=@meeting.wav" | grep -i audio-duration
```

**Transcribing only an excerpt**: the API has no start/end parameters (it stays OpenAI-compatible). Cut the clip first:

```bash
ffmpeg -ss 3 -to 8 -i meeting.wav -c copy clip.wav
curl -X POST "https://<endpoint>/v1/audio/transcriptions" \
  -H "Authorization: Bearer <access token>" \
  -F "file=@clip.wav"
```

**Long audio**: with `stream=true` the engine splits the file into 30-second chunks and transcribes them one by one. With `stream=false` the whole clip is decoded in one pass, which can hit `max_new_tokens` and truncate the transcript.

### Translation

`POST /v1/audio/translations` translates speech in any supported language into English. The parameters are the same as transcription.

**Only multilingual Whisper models can translate.** Fun-ASR, SenseVoice, Paraformer and Qwen3-ASR have no translation task; Whisper turbo ignores `task=translate`; `.en` checkpoints have no source language to translate from. Those cases return **501** with an explanation.

```bash
curl -X POST "https://<endpoint>/v1/audio/translations" \
  -H "Authorization: Bearer <access token>" \
  -F "file=@speech.wav" \
  -F "model=local"
```

### Model list

```bash
curl "https://<endpoint>/v1/models" -H "Authorization: Bearer <access token>"
```

Returns the aliases `local`, the repository id and the repository name, each with `ready` indicating whether the weights finished loading.

### Health check

```bash
curl "https://<endpoint>/health"
```

Reports the device, the backend actually in use, and model details. `backend` is the field to check for acceleration:

- `vllm`: LLM-based models such as Fun-ASR, accelerated by vLLM
- `funasr`: non-autoregressive models (SenseVoice, Paraformer), or a CPU deployment
- `qwen-asr`: the Qwen3-ASR family

## Python example

With the OpenAI SDK (recommended; only `base_url` changes):

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<endpoint>/v1",
    api_key="<access token>",
)

with open("meeting.wav", "rb") as audio:
    result = client.audio.transcriptions.create(
        model="local",
        file=audio,
        response_format="json",
    )

print(result.text)
```

With `requests` (when you need the duration header):

```python
import requests

url = "https://<endpoint>/v1/audio/transcriptions"
headers = {"Authorization": "Bearer <access token>"}

with open("meeting.wav", "rb") as audio:
    files = {"file": ("meeting.wav", audio, "audio/wav")}
    data = {"model": "local", "response_format": "json", "stream": "false"}
    response = requests.post(url, files=files, data=data, headers=headers)

result = response.json()
print(result["text"])
print("duration:", response.headers.get("Audio-Duration-Seconds"), "s")
```

## Troubleshooting

**The first transcription is slow**: the model is loaded on the first call. Fun-ASR and Qwen3-ASR also initialise the vLLM engine (including CUDA graph capture), so the first start can take tens of seconds; later calls are much faster.

**The transcript is empty**: play the clip first. An entirely silent or very quiet clip yields no text, which is a normal result rather than an error — try a clip that actually contains speech.

**The transcript looks wrong, or the language is odd**: confirm the clip's language is supported by the deployed model. Coverage differs per model (Fun-ASR-Nano focuses on Chinese/English/Japanese, Fun-ASR-MLT covers 31 languages), and mixed-language clips confuse it; cut a single-language excerpt with `ffmpeg` first.

**Long audio is slow or times out**: validate the path on a short excerpt first, then run the whole thing. Long audio is split by the engine's built-in VAD, so cost grows with length.

**How to confirm vLLM is active**: check `backend` in `/health`. `vllm` means the accelerated path; `funasr` means this model has no vLLM path (SenseVoice and Paraformer never do) or the endpoint is on CPU.

**Picking a Qwen3-ASR model auto-selects the `vllm` framework**: `vllm` declares the same model architecture and wins the id ordering. Change it to `asr-qwen` manually, otherwise the endpoint fails with errors like `libcudart.so.12`.

**Translation returns 501**: the deployed model cannot translate. Use a multilingual Whisper model (for example `Whisper-large-v3`, not turbo and not `.en`).

**The endpoint is ready but transcription fails**: call `/v1/audio/transcriptions` once from the **API** tab to separate a request problem from an engine problem; engine-side checks are in [Custom inference engines](../custom_engine).

**The API tab says "not using an API key"**: the page was opened without your token, usually because the browser served a cached copy. Force a reload (Ctrl/Cmd + Shift + R).

## See also

- [Creating an endpoint](../endpoint_create)
- [Using an endpoint](../endpoint_usage)
- [Custom inference engines](../custom_engine)
- [Speech synthesis](./speech-synthesis)
