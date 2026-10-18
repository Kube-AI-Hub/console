---
title: "语音合成"
keywords: "行业大模型平台, 语音合成, TTS, Text to Speech, Chatterbox, 声音克隆, 多语种语音, 推理实例"
description: "介绍如何使用 Chatterbox 语音合成推理引擎，把文本合成为带指定音色的语音，包括 Playground 与 API 调用方式。"
linkTitle: "语音合成"
weight: 6257
---

## 任务说明

语音合成（Text to Speech，TTS）把**一段文本**合成为**一段语音**，并用一份**参考音频**决定音色——同一段文本换一份参考音频，读出来的声音就不同。适合给文案配音、批量生成有声内容，或验证某个音色的合成效果。

平台通过 [Chatterbox Multilingual TTS](https://github.com/resemble-ai/chatterbox) 推理引擎提供该能力，支持中文、英语、日语等 **23 种语言**。与文本生成这类通用任务不同，它的输入是文本、输出是音频，因此推理实例的概览页提供的是一块**文本编辑与音频播放界面**，而不是对话区。

## 创建实例

进入 **模型推理 → 推理实例 → 新建推理实例**：

1. **模型**：选择已上传的 Chatterbox 权重仓库（如 `admin/chatterbox`）。权重由平台自动下载并挂载，不需要手工准备。
2. **框架**：选择 `chatterbox-tts`。若列表里没有，请管理员在 **管理员后台 → 算力资源管理 → 运行时框架与镜像管理 → 推理引擎** 中确认该框架已启用，或点「导入内置框架」补齐。
3. **算力**：选择带 GPU 的规格。合成需要加载声学模型与声码器，用 GPU 明显快于 CPU。
4. 其余按需填写，提交后等待实例就绪。首次创建需要把权重同步到共享缓存，比纯文本模型慢一些。

{{< notice note >}}
同一个模型也可以用别的框架创建实例，只是概览页的界面不同。要看到下面的合成界面，框架请选 `chatterbox-tts`。
{{< /notice >}}

## 用 Playground 合成

实例就绪后打开概览页，界面会直接嵌在页面里，不需要另外找地址。

![实例概览页内嵌的语音合成 Playground](/images/docs/platform-model/inference/speech-synthesis/overview-playground.png)

1. **输入文本**：填要合成的文字，最多 300 个字符。切换语言时会替换成该语言的默认文本，点一下即可试通。
2. **语言**：下拉选择，共 23 种，显示为「本地语言名 - 语言代码」（如「中文 - zh」）。切换语言会同时换掉默认文本与默认参考音频。
3. **参考音频**：决定音色，三种来源**互斥**，选一种会清掉另外两种。

   | 来源 | 说明 |
   |------|------|
   | 内置样例 | 每种语言都有一份默认参考音频，**不选任何来源时就用它** |
   | 上传 | 上传本地音频文件 |
   | 录音 | 用浏览器麦克风录一段 |
   | 参考音频 URL（可选） | 填 URL 会清除上传与录音 |

   上面的**参考音频预览**播放器可以试听当前选中的参考音频——先把音色听一遍，再决定要不要换。
4. **参数**：一般用默认值即可，需要调听感时再动。

   | 参数 | 默认 | 作用 |
   |------|------|------|
   | 夸张度（Exaggeration） | 0.5 | 情绪强度，调高更夸张 |
   | 温度（Temperature） | 0.8 | 随机性，调低更稳定、调高更多变 |
   | CFG / 节奏 | — | 语速与节奏 |
   | 随机种子（Seed） | 0（随机） | 固定后同样的输入会得到同样的结果，便于对比 |

5. 点 **生成**。结果区出现音频播放器，可以直接播放，也可以下载下来给别处使用。

![参考音频的三种来源与参数区](/images/docs/platform-model/inference/speech-synthesis/reference-audio.png)

![合成结果：可播放、可下载的音频](/images/docs/platform-model/inference/speech-synthesis/synthesis-result.png)

文本为空或超过 300 个字符时，「生成」不会发出请求，而是就地提示，已填的内容不会被清掉。合成失败时错误原因同样就地显示在按钮下方。

**API** 页签内嵌了该引擎的接口文档（RapiDoc，配色与平台一致），可以直接在页面上调一次接口，不用切到别处。文档与界面语言跟随平台当前语言：中文界面显示中文文档，切到 English 显示英文文档。

![API 页签：中文接口文档与三语言代码示例](/images/docs/platform-model/inference/speech-synthesis/api-tab.png)

- 每个接口都带 **Python / JavaScript / cURL** 三种可复制的示例，点右上角即可复制；不用自己拼请求。
- 文档里不渲染引擎的整体介绍与 Authentication 折叠区——同一实例的接口鉴权方式一致，逐个接口重复说明反而是干扰。
- 勾选 **使用我的访问令牌** 后，示例里的 `YOUR_TOKEN` 会换成你的令牌，「试一试」发出的请求也带上它；取消勾选则退回占位符，不会留下空的 `Bearer `。
- 无需认证的接口（如健康检查）在文档里标为公开，示例里不带任何凭据。

## API 调用

界面与 API 走同一个实例地址，按路由区分。合成接口是 `POST /api/v1/tts`：

```bash
curl -X POST "https://<实例地址>/api/v1/tts" \
  -H "Authorization: Bearer <访问令牌>" \
  -H "Content-Type: application/json" \
  -d '{"text": "你好，这是语音合成测试。", "language_id": "zh", "exaggeration": 0.5}'
```

参数：

| 参数 | 说明 |
|------|------|
| `text` | 要合成的文本，最多 300 个字符 |
| `language_id` | 语言代码，如 `zh`、`en`、`ja`，共 23 种 |
| `audio_prompt_url` | 参考音频地址，决定音色；不传时用该语言的内置样例 |
| `exaggeration` | 情绪强度，默认 0.5 |
| `temperature` | 随机性，默认 0.8 |
| `cfg_weight` | 语速与节奏 |
| `seed` | 随机种子，`0` 表示随机 |

要自带音色时，改用 `multipart/form-data` 把参考音频文件一起传上去：

```bash
curl -X POST "https://<实例地址>/api/v1/tts" \
  -H "Authorization: Bearer <访问令牌>" \
  -F "text=你好，这是语音合成测试。" \
  -F "language_id=zh" \
  -F "audio_prompt=@reference.wav"
```

响应是 JSON，音频以 base64 内联在 `audio_base64` 里，另外带 `sample_rate`、`format`、`duration_seconds`，以及 `request` 字段回显这次实际用的文本与参数：

```json
{
  "sample_rate": 24000,
  "format": "wav",
  "audio_base64": "UklGRi...",
  "duration_seconds": 2.35,
  "request": {
    "text": "你好，这是语音合成测试。",
    "language_id": "zh",
    "audio_prompt": "/audio/zh_f1.flac",
    "exaggeration": 0.5,
    "temperature": 0.8,
    "cfg_weight": 0.5,
    "seed": 0
  }
}
```

完整的接口列表见实例概览页的 **API** 页签。

## Python 示例

```python
import base64

import requests

response = requests.post(
    "https://<实例地址>/api/v1/tts",
    headers={"Authorization": "Bearer <访问令牌>"},
    json={
        "text": "你好，这是语音合成测试。",
        "language_id": "zh",
        "exaggeration": 0.5,
    },
    timeout=600,
)
result = response.json()

with open("output.wav", "wb") as f:
    f.write(base64.b64decode(result["audio_base64"]))
print(result["duration_seconds"], "seconds")
```

要用自己的音色，把参考音频以文件形式一起上传：

```python
import base64

import requests

with open("reference.wav", "rb") as ref:
    response = requests.post(
        "https://<实例地址>/api/v1/tts",
        headers={"Authorization": "Bearer <访问令牌>"},
        data={"text": "你好，这是语音合成测试。", "language_id": "zh"},
        files={"audio_prompt": ref},
        timeout=600,
    )

with open("output.wav", "wb") as f:
    f.write(base64.b64decode(response.json()["audio_base64"]))
```

## 常见问题

**首次合成为什么慢**：第一次调用要加载模型，后续会快很多。

**结果听不懂或发音奇怪**：先确认**语言**选对了。语言选错时文本会用错误的规则处理，发音会很怪。

**想换音色**：换一份参考音频即可——上传一段 5～10 秒、人声清晰、背景安静的音频效果最好。不选参考音频时会用该语言的内置样例。

**同一段文本两次结果不一样**：这是正常的，采样带随机性。把**随机种子**填成同一个非零值，两次结果就一致了，便于对比参数。

**中文合成效果不如英文**：中文文本会先经过分词再送入模型；若镜像里缺少分词模型，会跳过这一步，中文质量会下降。引擎日志里会有对应告警，请联系管理员确认镜像版本。

**文本超过 300 个字符**：界面会就地提示，不会静默截断。把长文本拆成几段分别合成即可。

**实例就绪但合成报错**：先在概览页的 **API** 页签调一次 `/api/v1/tts`，确认是请求问题还是引擎问题；引擎侧的排查见[自定义推理引擎](../custom_engine)里的验证清单。

**API 页签显示「未使用 API 密钥」**：说明这次打开页面时没有带上你的令牌，通常是浏览器缓存了旧页面。强制刷新（Ctrl/Cmd + Shift + R）即可。

## 相关文档

- [创建推理实例](../endpoint_create)
- [推理实例的使用](../endpoint_usage)
- [自定义推理引擎](../custom_engine)
- [语音识别](./speech-recognition)
