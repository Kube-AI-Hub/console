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

![实例概览页内嵌的 Playground](/images/docs/platform-model/inference/document-parsing/overview-playground.png)

1. **选文件**：拖入或选择一份 PDF / Office 文档 / 图片。界面内置了示例文档，点一下即可试通，不必先自备文件。
2. **解析等级**：拖动滑块选择，档位名与说明随滑动实时变化。

   | 档位 | 适用 |
   |------|------|
   | `flash` | 快速预览，走轻量流程，适合先看效果 |
   | `basic` | 基础 OCR |
   | `standard` | 复杂版面（默认），排版复杂或含公式、表格时用 |
   | `advanced` | 更高质量，耗时更长 |

3. **强制 OCR**：勾选后忽略 PDF 自带文本层、整份按扫描件识别。不勾选时引擎自动判断（等价于 `ocr_mode=auto`）；要只用文本层、跳过识别，走 API 传 `ocr_mode=txt`。
4. **页码范围**：起止两个滑块，选好即显示「已选 3-5 页，共 3 页 / 全部 13 页」。页数在选中 PDF 后才知道，所以未选文件时滑块是禁用的；选中的范围会作为 `page_range` 提交，先试前几页更快。
5. 点 **开始解析**。左侧会逐步点亮解析阶段（准备请求 → 提交任务 → 排队 → 解析中 → 下载结果 → 整理输出 → 完成）并计时，卡在哪一步一眼可见；右侧显示解析结果。

中间栏是**源文件预览**，和右侧结果左右对照：鼠标移到任一侧的标题、表格或段落，另一侧会同时高亮对应区块，点击可固定选中。PDF 预览工具条上可以翻页、跳页和缩放。

![源文件与解析结果左右对照，双向高亮](/images/docs/platform-model/inference/document-parsing/parse-compare.png)

结果区右上角可切换 **Markdown**（带格式渲染）与 **JSON**（`middle_json` 结构），并可通过 **下载** 菜单取回多种格式：

![下载菜单里的多种渲染格式](/images/docs/platform-model/inference/document-parsing/download-menu.png)

| 格式 | 说明 |
|------|------|
| Markdown / JSON / Structured JSON | 解析原始产物 |
| HTML / LaTeX / DOCX / EPUB / PDF | 由同一份结果就地转换，**不需要 API 令牌**；LaTeX 是 `_latex.zip`，PDF 是 `_rendered.pdf` |
| ZIP | 完整产物包（含 `images/`） |

首次解析会加载模型，比后续调用慢；界面会提示正在解析。失败时错误信息就地显示在按钮下方，不会丢掉已选的文件与参数。

**API** 页签内嵌了该引擎的接口文档（RapiDoc，配色与平台一致），可以直接在页面上调一次接口，不用切到别处。文档与界面语言跟随平台当前语言：中文界面显示中文文档，切到 English 显示英文文档。

![API 页签：中文接口文档与三语言代码示例](/images/docs/platform-model/inference/document-parsing/api-tab.png)

- 每个接口都带 **Python / JavaScript / cURL** 三种可复制的示例，点右上角即可复制；不用自己拼请求。
- 文档里不渲染引擎的整体介绍与 Authentication 折叠区——同一实例的接口鉴权方式一致，逐个接口重复说明反而是干扰。
- 勾选 **使用我的访问令牌** 后，示例里的 `YOUR_TOKEN` 会换成你的令牌，「试一试」发出的请求也带上它；取消勾选则退回占位符，不会留下空的 `Bearer `。
- 无需认证的接口（如健康检查、列出解析等级）在文档里标为公开，示例里不带任何凭据。
- 想用原生 Swagger 界面时，直接访问实例地址下的 `/docs`。

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

完整的接口列表见实例概览页的 **API** 页签，或直接访问实例地址下的 `/docs`。**API** 页签里的每个接口都带 Python / JavaScript / cURL 示例，可直接复制；勾选「使用我的访问令牌」后示例里就是你的令牌，不必手工替换。

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

**下载菜单里某些格式点不动**：先解析一次——这几种格式是从本次结果就地转换的，没有结果就没有可转的内容。转换期间该菜单项会暂时禁用。

**API 页签显示「未使用 API 密钥」**：说明这次打开页面时没有带上你的令牌，通常是浏览器缓存了旧页面。强制刷新（Ctrl/Cmd + Shift + R）即可；仍然不行时确认实例详情页右上角已登录自己的账号。

**API 页签里的示例还是 `YOUR_TOKEN`**：取消勾选再勾选一次「使用我的访问令牌」，示例会重新加载；若一直不刷新，同样先强刷页面。

## 相关文档

- [创建推理实例](../endpoint_create)
- [推理实例的使用](../endpoint_usage)
- [自定义推理引擎](../custom_engine)
