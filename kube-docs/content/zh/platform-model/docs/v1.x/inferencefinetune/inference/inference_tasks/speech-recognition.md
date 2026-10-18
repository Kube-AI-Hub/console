---
title: "语音识别"
keywords: "行业大模型平台, 语音识别, ASR, Speech to Text, Fun-ASR, SenseVoice, 语音转文字, 推理实例"
description: "介绍如何使用 Fun-ASR 语音识别推理引擎，把音频转写成文字，包括 Playground 与 API 调用方式。"
linkTitle: "语音识别"
weight: 6256
---

## 任务说明

语音识别（Automatic Speech Recognition，ASR）把**一段音频**转写成**文字**，并给出音频时长与处理耗时。适合把录音、会议记录、字幕素材转成可检索的文本。

平台通过 [FunAudioLLM](https://github.com/FunAudioLLM/Fun-ASR) 推理引擎提供该能力，支持中文、英语、日语等 **23 种语言**。与文本生成这类通用任务不同，它的输入是音频、输出是转写结果，因此推理实例的概览页提供的是一块**音频选择与转写结果界面**，而不是对话区。

## 创建实例

进入 **模型推理 → 推理实例 → 新建推理实例**：

1. **模型**：选择已上传的 Fun-ASR 权重仓库（如 `admin/Fun-ASR-Nano-2512`）。权重由平台自动下载并挂载，不需要手工准备。
2. **框架**：选择 `asr`。若列表里没有，请管理员在 **管理员后台 → 算力资源管理 → 运行时框架与镜像管理 → 推理引擎** 中确认该框架已启用，或点「导入内置框架」补齐。
3. **算力**：选择带 GPU 的规格。引擎自带一份 VAD（静音检测）模型用于切分长音频，用 GPU 明显快于 CPU。
4. 其余按需填写，提交后等待实例就绪。

{{< notice note >}}
同一个模型也可以用别的框架创建实例，只是概览页的界面不同。要看到下面的识别界面，框架请选 `asr`。
{{< /notice >}}

## 用 Playground 转写

实例就绪后打开概览页，界面会直接嵌在页面里，不需要另外找地址。

![实例概览页内嵌的语音识别 Playground](/images/docs/platform-model/inference/speech-recognition/overview-playground.png)

1. **音频样例**：下拉选择，共 23 种语言，默认选中中文。每种语言都配了一段样例音频，点一下即可试通，**不需要先自备录音**。
2. **音频预览**：播放器可以试听所选的音频——把听到的内容与识别出的文字对照，就能判断差异是识别错误还是记错了音频。

   ![选择音频样例，并在播放器里试听](/images/docs/platform-model/inference/speech-recognition/sample-language.png)

3. **上传或录音**：也可以上传自己的音频（MP3、WAV），或用浏览器麦克风录一段。两种方式都会替换当前选中的样例。
4. **起止时间**：只转写音频的一段时填写，单位是秒；留空为整段。
5. 点 **转写**。结果区显示识别出的文本，以及 `pipeline`（用了哪条管线）、音频时长与处理耗时。

![转写结果：识别文本与处理耗时](/images/docs/platform-model/inference/speech-recognition/recognition-result.png)

没有选音频时，「转写」不会发出请求，而是就地提示「请选择或上传音频」。起止时间填得不合法（结束早于开始）时同样就地报错，已选的文件与参数不会被清空。

**API** 页签内嵌了该引擎的接口文档（RapiDoc，配色与平台一致），可以直接在页面上调一次接口，不用切到别处。文档与界面语言跟随平台当前语言：中文界面显示中文文档，切到 English 显示英文文档。

![API 页签：中文接口文档与三语言代码示例](/images/docs/platform-model/inference/speech-recognition/api-tab.png)

- 每个接口都带 **Python / JavaScript / cURL** 三种可复制的示例，点右上角即可复制；不用自己拼请求。
- 文档里不渲染引擎的整体介绍与 Authentication 折叠区——同一实例的接口鉴权方式一致，逐个接口重复说明反而是干扰。
- 勾选 **使用我的访问令牌** 后，示例里的 `YOUR_TOKEN` 会换成你的令牌，「试一试」发出的请求也带上它；取消勾选则退回占位符，不会留下空的 `Bearer `。
- 无需认证的接口（如健康检查）在文档里标为公开，示例里不带任何凭据。

## API 调用

界面与 API 走同一个实例地址，按路由区分。转写接口是 `POST /api/v1/transcribe`，既接受内置样例，也接受上传的文件或音频 URL：

```bash
# 上传一份音频
curl -X POST "https://<实例地址>/api/v1/transcribe" \
  -H "Authorization: Bearer <访问令牌>" \
  -F "audio_input=@meeting.wav"

# 只转写第 3 秒到第 8 秒
curl -X POST "https://<实例地址>/api/v1/transcribe" \
  -H "Authorization: Bearer <访问令牌>" \
  -F "audio_input=@meeting.wav" \
  -F "start_time=3" \
  -F "end_time=8"

# 用引擎内置的样例
curl -X POST "https://<实例地址>/api/v1/transcribe" \
  -H "Authorization: Bearer <访问令牌>" \
  -H "Content-Type: application/json" \
  -d '{"audio_input": "/audio/zh_f1.flac"}'
```

参数：

| 参数 | 说明 |
|------|------|
| `audio_input` | 上传的音频文件，或引擎内置样例的路径 |
| `audio_url` | 音频的 http/https 地址，与 `audio_input` 二选一 |
| `start_time` | 起始时间（秒），留空为从头开始 |
| `end_time` | 结束时间（秒），留空为到结尾 |

响应给出识别文本与耗时信息：

```json
{
  "text": "这是语音识别测试音频。",
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

完整的接口列表见实例概览页的 **API** 页签。

## Python 示例

```python
import requests

with open("meeting.wav", "rb") as audio:
    response = requests.post(
        "https://<实例地址>/api/v1/transcribe",
        headers={"Authorization": "Bearer <访问令牌>"},
        files={"audio_input": audio},
        timeout=600,
    )

result = response.json()
print(result["text"])
print("音频", result["audio_duration_seconds"], "秒 / 处理", result["processing_time_seconds"], "秒")
```

长音频想先试一小段时，带上起止时间：

```python
import requests

with open("meeting.wav", "rb") as audio:
    response = requests.post(
        "https://<实例地址>/api/v1/transcribe",
        headers={"Authorization": "Bearer <访问令牌>"},
        files={"audio_input": audio},
        data={"start_time": 3, "end_time": 8},
        timeout=600,
    )

print(response.json()["text"])
```

## 常见问题

**首次转写为什么慢**：第一次调用要加载模型，后续会快很多。

**识别结果为空**：先试听一下音频。整段是静音或音量过低时，识别不出内容是正常结果而不是报错；换一段有声内容再试。

**识别内容不对或语言很怪**：确认音频里的语言在支持列表内。引擎按音频内容自动判断，混语种的音频容易出错，可先用**起止时间**截出单一语种的片段再转写。

**长音频超时或很慢**：用**起止时间**先跑一小段验证链路，再放全量。长音频由引擎内置的 VAD 自动切分，耗时随长度增长。

**怎么看用了哪条管线**：结果区的 `pipeline` 字段（或 API 响应里的同名字段）会给出，例如 Fun-ASR-Nano。换模型仓库时该值会跟着变。

**实例就绪但转写报错**：先在概览页的 **API** 页签调一次 `/api/v1/transcribe`，确认是请求问题还是引擎问题；引擎侧的排查见[自定义推理引擎](../custom_engine)里的验证清单。

**API 页签显示「未使用 API 密钥」**：说明这次打开页面时没有带上你的令牌，通常是浏览器缓存了旧页面。强制刷新（Ctrl/Cmd + Shift + R）即可。

## 相关文档

- [创建推理实例](../endpoint_create)
- [推理实例的使用](../endpoint_usage)
- [自定义推理引擎](../custom_engine)
- [语音合成](./speech-synthesis)
