---
title: "语音识别"
keywords: "行业大模型平台, 语音识别, ASR, Speech to Text, Fun-ASR, SenseVoice, Paraformer, Whisper, Qwen3-ASR, OpenAI 兼容, 推理实例"
description: "介绍如何使用通用语音识别推理引擎，把音频转写成文字，包括 Playground、OpenAI 兼容接口与多模型家族的用法。"
linkTitle: "语音识别"
weight: 6256
---

## 任务说明

语音识别（Automatic Speech Recognition，ASR）把**一段音频**转写成**文字**，并给出音频时长与处理耗时。适合把录音、会议记录、字幕素材转成可检索的文本。

平台通过通用语音识别引擎提供该能力：**一个引擎覆盖多个模型家族**，后端由引擎按模型自动选择，调用方只看到一套 OpenAI 兼容接口。支持中文、英语、日语等 **23 种语言**（具体语种取决于所选模型）。与文本生成这类通用任务不同，它的输入是音频、输出是转写结果，因此推理实例的概览页提供的是一块**音频选择与转写结果界面**，而不是对话区。

| 模型家族 | 典型仓库 | 引擎后端 |
|------|------|------|
| Fun-ASR-Nano / Fun-ASR-MLT | `admin/Fun-ASR-Nano-2512` | `vllm`（加速） |
| GLM-ASR | `admin/GLM-ASR-Nano-2512` | `vllm`（加速） |
| Whisper | `admin/Whisper-large-v3` | `vllm`（多语版还支持翻译） |
| SenseVoice | `admin/SenseVoiceSmall` | `funasr` |
| Paraformer | `admin/Paraformer-zh` | `funasr` |
| Qwen3-ASR | `admin/Qwen3-ASR-1.7B` | `qwen-asr` |

## 创建实例

进入 **模型推理 → 推理实例 → 新建推理实例**：

1. **模型**：选择已上传的语音识别权重仓库（如 `admin/Fun-ASR-Nano-2512`）。权重由平台自动下载并挂载，不需要手工准备。
2. **框架**：按模型选。
   - Fun-ASR / GLM-ASR / Whisper / SenseVoice / Paraformer 选 `asr`。
   - **Qwen3-ASR 请选 `asr-qwen`**，不要选 `asr`。
   若列表里没有，请管理员在 **管理员后台 → 算力资源管理 → 运行时框架与镜像管理 → 推理引擎** 中确认该框架已启用，或点「导入内置框架」补齐。
3. **算力**：选择带 GPU 的规格。引擎自带一份 VAD（静音检测）模型用于切分长音频，用 GPU 明显快于 CPU。
4. 其余按需填写，提交后等待实例就绪。

{{< notice warning >}}
`asr` 与 `asr-qwen` 是**同一个引擎**，只是 vLLM 依赖的 CUDA 版本不同才拆成两个镜像。选 Qwen3-ASR 时平台可能自动帮你选中 `vllm` 而不是 `asr-qwen`——那是因为 `vllm` 也声明了同一个模型架构。**请手动改选 `asr-qwen`**，否则实例会用错镜像。
{{< /notice >}}

{{< notice note >}}
同一个模型也可以用别的框架创建实例，只是概览页的界面不同。要看到下面的识别界面，框架请选 `asr` 或 `asr-qwen`。
{{< /notice >}}

## 用 Playground 转写

实例就绪后打开概览页，界面会直接嵌在页面里，不需要另外找地址。

![实例概览页内嵌的语音识别 Playground](/images/docs/platform-model/inference/speech-recognition/overview-playground.png)

1. **音频样例**：下拉选择，共 23 种语言，默认选中中文。每种语言都配了一段样例音频，点一下即可试通，**不需要先自备录音**。
2. **音频预览**：播放器可以试听所选的音频——把听到的内容与识别出的文字对照，就能判断差异是识别错误还是记错了音频。

   ![选择音频样例，并在播放器里试听](/images/docs/platform-model/inference/speech-recognition/sample-language.png)

3. **上传或录音**：也可以上传自己的音频（MP3、WAV），或用浏览器麦克风录一段。两种方式都会替换当前选中的样例。
4. **起止时间**：只转写音频的一段时填写，单位是秒；留空为整段。裁切在浏览器里完成，**只上传你选中的那一段**。
5. **语言与热词**（可选）：语言留空则自动识别；热词用逗号分隔，用于提升专有名词的识别。
6. **翻译开关**：只有当所选模型是多语 Whisper 时才出现。其它模型没有翻译能力，界面不会显示这个开关。
7. 点 **转写**。结果区显示识别出的文本，以及音频时长与处理耗时。

![转写结果：识别文本与处理耗时](/images/docs/platform-model/inference/speech-recognition/recognition-result.png)

没有选音频时，「转写」不会发出请求，而是就地提示「请选择或上传音频」。起止时间填得不合法（结束早于开始）时同样就地报错，已选的文件与参数不会被清空。

**API** 页签内嵌了该引擎的接口文档（RapiDoc，配色与平台一致），可以直接在页面上调一次接口，不用切到别处。文档与界面语言跟随平台当前语言：中文界面显示中文文档，切到 English 显示英文文档。

![API 页签：中文接口文档与三语言代码示例](/images/docs/platform-model/inference/speech-recognition/api-tab.png)

- 每个接口都带 **Python / JavaScript / cURL** 三种可复制的示例，点右上角即可复制；不用自己拼请求。
- 文档里不渲染引擎的整体介绍与 Authentication 折叠区——同一实例的接口鉴权方式一致，逐个接口重复说明反而是干扰。
- 勾选 **使用我的访问令牌** 后，示例里的 `YOUR_TOKEN` 会换成你的令牌，「试一试」发出的请求也带上它；取消勾选则退回占位符，不会留下空的 `Bearer `。
- 无需认证的接口（如健康检查、模型列表）在文档里标为公开，示例里不带任何凭据。

## API 调用

界面与 API 走同一个实例地址。接口与 **OpenAI 的音频接口兼容**，所以任何 OpenAI SDK 只改 `base_url` 就能用。

### 转写

`POST /v1/audio/transcriptions`，请求体是 `multipart/form-data`，文件字段名是 `file`：

```bash
curl -X POST "https://<实例地址>/v1/audio/transcriptions" \
  -H "Authorization: Bearer <访问令牌>" \
  -F "file=@meeting.wav" \
  -F "model=local" \
  -F "response_format=json" \
  -F "stream=false"
```

参数：

| 参数 | 说明 |
|------|------|
| `file` | 音频文件，支持 MP3、WAV、FLAC、M4A 等 |
| `model` | 模型别名，默认 `local`；也可填仓库 ID 或仓库名 |
| `language` | 语言代码，留空自动识别 |
| `hotwords` | 热词，逗号分隔 |
| `response_format` | `json`（默认）、`text`、`verbose_json` |
| `stream` | `true` 时按 30 秒分块流式返回，默认 `true` |

`response_format` 的区别：

- `json`：`{"text": "..."}`
- `text`：纯文本
- `verbose_json`：额外返回 `segments`（含起止时间与说话人）、`language`、`duration`、`model`

音频总时长在**响应头** `Audio-Duration-Seconds` 里，不在响应体：

```bash
curl -s -D - -o /dev/null -X POST "https://<实例地址>/v1/audio/transcriptions" \
  -H "Authorization: Bearer <访问令牌>" \
  -F "file=@meeting.wav" | grep -i audio-duration
```

**只转写一段**：接口没有起止参数（要跟 OpenAI 保持一致）。用 `ffmpeg` 先剪出来再上传：

```bash
ffmpeg -ss 3 -to 8 -i meeting.wav -c copy clip.wav
curl -X POST "https://<实例地址>/v1/audio/transcriptions" \
  -H "Authorization: Bearer <访问令牌>" \
  -F "file=@clip.wav"
```

**长音频**：`stream=true` 时引擎按 30 秒切块逐块转写；`stream=false` 时整段一次解码，很长的音频可能被 `max_new_tokens` 截断。

### 翻译

`POST /v1/audio/translations`，把任意语言翻译成英文。参数与转写相同。

**只有多语言 Whisper 模型支持。** Fun-ASR、SenseVoice、Paraformer、Qwen3-ASR 没有翻译任务；Whisper turbo 会忽略 `task=translate`；`.en` 单语模型没有源语言可翻译。这些情况返回 **501**，错误信息会说明原因。

```bash
curl -X POST "https://<实例地址>/v1/audio/translations" \
  -H "Authorization: Bearer <访问令牌>" \
  -F "file=@speech.wav" \
  -F "model=local"
```

### 模型列表

```bash
curl "https://<实例地址>/v1/models" -H "Authorization: Bearer <访问令牌>"
```

返回 `local`、仓库 ID 与仓库名三个别名，并带 `ready` 表示模型是否加载完成。

### 健康检查

```bash
curl "https://<实例地址>/health"
```

返回设备、实际使用的后端与模型信息。`backend` 字段是判断加速是否生效的关键：

- `vllm`：Fun-ASR 等 LLM 类模型，vLLM 加速
- `funasr`：SenseVoice、Paraformer 等非自回归模型，或 CPU 部署
- `qwen-asr`：Qwen3-ASR 系列

## Python 示例

用 OpenAI SDK（推荐，只改 `base_url`）：

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<实例地址>/v1",
    api_key="<访问令牌>",
)

with open("meeting.wav", "rb") as audio:
    result = client.audio.transcriptions.create(
        model="local",
        file=audio,
        response_format="json",
    )

print(result.text)
```

用 `requests`（想读响应头里的时长时）：

```python
import requests

url = "https://<实例地址>/v1/audio/transcriptions"
headers = {"Authorization": "Bearer <访问令牌>"}

with open("meeting.wav", "rb") as audio:
    files = {"file": ("meeting.wav", audio, "audio/wav")}
    data = {"model": "local", "response_format": "json", "stream": "false"}
    response = requests.post(url, files=files, data=data, headers=headers)

result = response.json()
print(result["text"])
print("音频", response.headers.get("Audio-Duration-Seconds"), "秒")
```

## 常见问题

**首次转写为什么慢**：第一次调用要加载模型。Fun-ASR 与 Qwen3-ASR 还要初始化 vLLM 引擎（含 CUDA graph 捕获），首次启动可能需要几十秒，后续会快很多。

**识别结果为空**：先试听一下音频。整段是静音或音量过低时，识别不出内容是正常结果而不是报错；换一段有声内容再试。

**识别内容不对或语言很怪**：确认音频里的语言在所选模型的支持范围内。不同模型的语种覆盖不同（Fun-ASR-Nano 主要是中英日，Fun-ASR-MLT 覆盖 31 种），混语种的音频容易出错，可以先用 `ffmpeg` 截出单一语种的片段再转写。

**长音频超时或很慢**：先用 `ffmpeg` 截一小段验证链路，再放全量。长音频由引擎内置的 VAD 自动切分，耗时随长度增长。

**怎么确认 vLLM 加速生效了**：调 `/health` 看 `backend`。是 `vllm` 说明走的是加速路径；是 `funasr` 说明这个模型没有 vLLM 路径（SenseVoice / Paraformer 本来就不支持），或者实例是 CPU 部署。

**选 Qwen3-ASR 时平台自动选了 `vllm` 框架**：`vllm` 也声明了同一个模型架构，平台按 id 排序先命中了它。请手动改选 `asr-qwen`，否则实例会报 `libcudart.so.12` 之类的错。

**翻译返回 501**：所选模型不支持翻译。换一个多语言 Whisper 模型（如 `Whisper-large-v3`，不是 turbo、不是 `.en`）。

**实例就绪但转写报错**：先在概览页的 **API** 页签调一次 `/v1/audio/transcriptions`，确认是请求问题还是引擎问题；引擎侧的排查见[自定义推理引擎](../custom_engine)里的验证清单。

**API 页签显示「未使用 API 密钥」**：说明这次打开页面时没有带上你的令牌，通常是浏览器缓存了旧页面。强制刷新（Ctrl/Cmd + Shift + R）即可。

## 相关文档

- [创建推理实例](../endpoint_create)
- [推理实例的使用](../endpoint_usage)
- [自定义推理引擎](../custom_engine)
- [语音合成](./speech-synthesis)
