---
title: "文档解析"
keywords: "行业大模型平台, 文档解析, MinerU, PDF 转 Markdown, Office 文档, OCR, 推理实例"
description: "介绍如何使用 MinerU 文档解析推理引擎，把 PDF、Office 文档与图片转成带格式的 Markdown，包括 Playground 与 API 调用方式。"
linkTitle: "文档解析"
weight: 6255
---

## 任务说明

文档解析把 **PDF、Office 文档（DOC/DOCX、PPT/PPTX、XLS/XLSX）与图片**转成带格式的 Markdown：保留标题层级、列表、表格与公式，图片按引用位置输出。适合把存量文档变成可检索、可喂给大模型的语料。

平台通过 [MinerU](https://github.com/opendatalab/MinerU) 推理引擎提供该能力。与文本生成这类通用任务不同，它的输入是一份文件、输出是一份 Markdown，因此推理实例的概览页提供的是一块**上传与结果预览界面**，而不是对话区。

## 创建实例

进入 **模型推理 → 推理实例 → 新建推理实例**：

1. **模型**：选择已上传的 MinerU 权重仓库（如 `admin/MinerU2.5-2509-1.2B`）。权重由平台自动下载并挂载，不需要手工准备。
2. **框架**：选择 `mineru`。若列表里没有，请管理员在 **管理员后台 → 算力资源管理 → 运行时框架与镜像管理 → 推理引擎** 中确认该框架已启用，或点「导入内置框架」补齐。
3. **算力**：选择带 GPU 的规格。首次解析需要加载版面、OCR、公式与表格模型，显存与内存需求比纯文本模型高。
4. 其余按需填写，提交后等待实例就绪。

{{< notice note >}}
同一个 MinerU 模型也可以选择 `vllm` 框架创建实例。那样得到的是图文对话能力，概览页显示平台原生 Playground；要解析文档请选 `mineru` 框架。
{{< /notice >}}

## 用 Playground 解析

实例就绪后打开概览页，界面会直接嵌在页面里，不需要另外找地址。

1. **选文件**：拖入或选择一份 PDF / Office 文档 / 图片。界面内置了示例文档，点一下即可试通，不必先自备文件。
2. **选档位**：

   | 档位 | 适用 |
   |------|------|
   | `flash` | 快速预览，走轻量流程，适合先看效果 |
   | `basic` | 基础 OCR |
   | `standard` | 复杂版面（默认），排版复杂或含公式、表格时用 |
   | `advanced` | 更高质量，耗时更长 |

3. **OCR 模式**：`auto` 自动判断，`txt` 只用 PDF 文本层，`ocr` 强制识别扫描页。
4. **页码范围**：留空或 `all` 表示全部页面；也可以写 `1-10` 这类区间，先试前几页更快。
5. 点 **开始解析**，右侧显示解析出的 Markdown，可复制或下载为 `.md`。

首次解析会加载模型，比后续调用慢；界面会提示正在解析。失败时错误信息就地显示在按钮下方，不会丢掉已选的文件与参数。

**API** 页签内嵌了该引擎的 Swagger 文档，可以直接在页面上调一次接口，不用切到别处。

## API 调用

界面与 API 走同一个实例地址，按路由区分。解析接口是 `POST /v1/file_parse`：

```bash
curl -X POST "https://<实例地址>/v1/file_parse?tier=standard&ocr_mode=auto" \
  -H "Authorization: Bearer <访问令牌>" \
  -F "files=@document.pdf"
```

参数：

| 参数 | 说明 |
|------|------|
| `tier` | `flash` / `basic` / `standard` / `advanced` |
| `ocr_mode` | `auto` / `txt` / `ocr` |
| `page_range` | 页码范围，留空为全部 |
| `output_formats` | 输出格式，默认 `markdown`；可加 `middle_json`、`structured_content`、`zip` |

响应是一份任务结果文档，`files[].markdown` 是解析出的 Markdown；某个文件失败时原因在 `files[].error.message`。请求体用 `multipart/form-data`，文件字段名是 `files`，可以一次传多个。

异步用法（提交后轮询）：

```bash
# 提交
curl -X POST "https://<实例地址>/v1/tasks?tier=standard" \
  -H "Authorization: Bearer <访问令牌>" \
  -F "files=@document.pdf"

# 查询结果
curl "https://<实例地址>/v1/tasks/<task_id>/result" \
  -H "Authorization: Bearer <访问令牌>"
```

完整的接口列表见实例概览页的 **API** 页签，或直接访问实例地址下的 `/docs`。

## Python 示例

```python
import requests

response = requests.post(
    "https://<实例地址>/v1/file_parse",
    headers={"Authorization": "Bearer <访问令牌>"},
    params={"tier": "standard", "ocr_mode": "auto"},
    files={"files": open("document.pdf", "rb")},
    timeout=600,
)
result = response.json()
print(result["files"][0]["markdown"])
```

## 常见问题

**解析很慢**：首次调用要加载模型。用 `tier=flash` 或限定 `page_range` 可以先验证链路。

**扫描件解析不出文字**：`ocr_mode` 用 `ocr`（或 `auto`），`txt` 只用 PDF 自带文本层，扫描页没有文本层。

**表格或公式错乱**：换 `tier=standard` 或 `advanced`，`flash` 不保证复杂版面的还原质量。

**实例就绪但解析报错**：先在概览页的 **API** 页签调一次 `/v1/file_parse`，确认是请求问题还是引擎问题；引擎侧的排查见[自定义推理引擎](../custom_engine)里的验证清单。

## 相关文档

- [创建推理实例](../endpoint_create)
- [推理实例的使用](../endpoint_usage)
- [自定义推理引擎](../custom_engine)
