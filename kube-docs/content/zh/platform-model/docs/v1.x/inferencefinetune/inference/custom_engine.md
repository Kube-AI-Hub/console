---
title: "自定义推理引擎"
keywords: "行业大模型平台, 自定义推理引擎, 推理框架, KServe, Playground, OpenAPI, 单端口"
description: "介绍如何为行业大模型平台接入一个自定义推理引擎：代码落点、镜像构建、框架配置、模型挂载约定，以及自带 Playground 与 OpenAPI 的要求。"
linkTitle: "自定义推理引擎"
weight: 6237
---

平台内置了 vLLM、SGLang、TGI、llama.cpp 等通用推理框架。当你要服务的任务不是通用对话或图像生成——例如文档解析、语音合成、特定领域的结构化抽取——可以在平台上登记一个**自定义推理引擎**：自己提供镜像，平台负责调度、挂载模型、暴露端点，并在概览页嵌入你自带的界面。

本文说明接入一个新引擎需要做什么。已内置的文档解析引擎见 [MinerU 文档解析](./inference_tasks/document-parsing)。

## 整体形状

```text
configs/inference/<engine>.json
        │ 播种
        ▼
  运行时框架 runtime_frameworks
        │ 创建实例时选择
        ▼
  KServe InferenceService
        │
        ├── csghub-storage-initializer ──下载并挂载──▶ /mnt/models/model（只读）
        │                                                     │
        │                                                     ▼
        ├── 引擎容器 :8000 ◀──────────────────────────── 读取权重
        │        │
        │        ├── /v1/*            解析 / 推理 API
        │        ├── / 与 /docs       Playground 与 Swagger
        │        └── /health          探针
        │
        └── 概览页 iframe ──rproxy /endpoint/<svc>──▶ 引擎自带界面
```

要点：

1. **模型由平台统一下载**，引擎只读挂载，不自己拉权重。
2. **一个容器端口**同时提供 API 与界面，按路由区分。
3. **界面形态由引擎决定**，通过运行时框架的能力位 `custom_playground` 告诉平台。

## 一、代码放哪

引擎代码建议放在引擎自己的仓库里，以**独立命令**的形式提供，而不是塞进平台仓库：

- 平台仓库只放 Dockerfile、`configs/inference/*.json` 与文档；
- 引擎仓库提供启动命令（如 `mineru-kit serve`），能脱离平台独立运行、独立调试、独立发版；
- 镜像从引擎仓库的源码构建，保证部署的就是被验证过的那份代码。

镜像以「从本仓库源码安装」的方式构建，而不是从包索引装一个区间版本——否则镜像 tag 与实际安装的版本可能不一致，自带的界面也可能缺失。

## 二、模型挂载约定

平台通过 KServe 的 `csghub-storage-initializer` 把模型下载到 **`/mnt/models/model`**，并以只读方式挂载给引擎容器。因此：

| 要求 | 说明 |
|------|------|
| 不自己下载权重 | 引擎启动时**不要**发起下载；平台已经在容器启动前把权重放好了 |
| 只读兼容 | 挂载点可能是只读的（启用共享模型缓存时 `readOnly: true`）。需要写标记文件时，写到自己的可写目录（如 `$HOME` 下的模型目录），**不要写进挂载点** |
| 缺权重时快速失败 | 挂载缺失应在启动阶段报错退出，而不是在 Pod 里静默下载几 GB。平台探针会一直不通过，问题也更容易定位 |
| 权重不烧进镜像 | 镜像里只放**引擎的固定资产**（例如固定的辅助模型包），用户可选的权重一律走挂载 |

如果引擎期望的目录结构与 `/mnt/models/model` 不同，在启动时做一次桥接：把挂载目录按条目软链到引擎期望的位置（软链不复制数据，跨文件系统时才退回复制），并在那里写入引擎所需的完成标记。标记写在目标目录而不是源目录，源目录可能只读。

## 三、镜像

在平台仓库的 `docker/inference/` 下放 Dockerfile，命名 `Dockerfile.<engine>`，与 `Dockerfile.chatterbox-tts-cuda` 等并列。镜像需要满足：

- **监听 8000**：平台的容器端口默认 `8000`，探针与代理都按它工作；
- **`GET /health` 可用**：探针固定访问该路径（见下节）；
- **不依赖镜像外的文件**：界面资源、辅助模型、模板都随镜像分发；
- **amd64**：推理节点为 amd64。

基础镜像按引擎的依赖选。如果引擎需要 vLLM 跑本地 VLM，可以直接基于 `vllm/vllm-openai`，这样 torch 与 CUDA 是匹配好的，不用再从 PyPI 装一份。

## 四、健康检查

平台探针固定请求 **`GET /health`**，启动探针 15 秒一次、最多 240 次（约 60 分钟，避免大权重加载被误判为失败），另有就绪与存活探针。

实现时注意：

- **就绪前不要返回 200**：权重还没可读时返回非 200（或 503），否则副本会在模型不可用时被判定为就绪并接流量；
- **探针带不了鉴权头**：如果你的服务配置了 API key，`/health` 必须免鉴权，否则探针永远失败。

## 五、框架配置

在 `configs/inference/` 下新增 `<engine>.json`。平台启动时按该目录播种运行时框架记录（**不会覆盖已存在的行**，已存在记录的改动请在管理后台编辑）。

```json
{
  "engine_name": "mineru",
  "inference_backend": "kserve-standard",
  "custom_playground": true,
  "enabled": 1,
  "container_port": 8000,
  "model_format": "safetensors",
  "description": "MinerU document parsing runtime",
  "engine_images": [
    {
      "compute_type": "gpu",
      "image": "opencsghq/mineru:4.0.12-cu129",
      "driver_version": "12.9",
      "engine_version": "4.0.12-cu129"
    }
  ],
  "supported_models": ["MinerU2.5-2509-1.2B"],
  "launch": {
    "decode": {
      "containers": [
        {
          "name": "kserve-container",
          "modelCommand": "imageDefault",
          "args": [],
          "ports": [{ "containerPort": 8000, "protocol": "TCP" }]
        }
      ]
    }
  }
}
```

| 字段 | 说明 |
|------|------|
| `engine_name` | 框架名。实例创建页与 `deploy.runtime_framework` 都用它 |
| `inference_backend` | 自定义引擎用 `kserve-standard`（单副本）。`kserve-llmisvc` 面向 LLM 引擎的多机 / PD |
| `custom_playground` | `true` 表示引擎自带 Playground，概览页嵌入它；见下节 |
| `container_port` | 服务监听端口，与镜像一致 |
| `engine_images` | 每个计算类型一条，含镜像与驱动版本 |
| `supported_models` | 可选标签，用于模型与框架匹配 |
| `launch` | 启动配置。**必填**，否则创建实例时报 `engine has no launch.decode` |

`launch.decode.containers[0]` 的关键字段：

- **`modelCommand: "imageDefault"`** —— 不改镜像入口，`args` 直接追加给镜像的 entrypoint。自定义引擎的启动命令写在 Dockerfile 的 `ENTRYPOINT` 里最省事。
- **`modelCommand: "custom"`** —— 用你填的 `command` + `args` 覆盖镜像入口；缺 `--port` 时平台自动补。
- **`modelCommand: "vllmServe"`** —— 生成 `vllm serve /mnt/models/model --port <端口>`，用于直接跑 vLLM 的场景。

`args` 里的 `{{.Name}}` 会替换成模型仓库路径。用户在创建页填的框架参数（`engine_args`）会追加到这些参数之后。

完整的字段说明与示例见[配置推理引擎](./runtime_framework_admin)。

## 六、Playground 与 OpenAPI

自定义引擎的交互形态与平台原生 Playground 不同（上传文件、看 Markdown 结果，而不是对话），因此引擎自带一个页面，概览页把它嵌进 iframe。

### 能力位

在框架配置里写 `"custom_playground": true`，或在管理后台的推理引擎编辑页打开 **自带 Playground**。

分流规则：

```text
custom_playground = true   → iframe 嵌入引擎自带界面
custom_playground = false  → 按模型任务类型：原生四类任务走平台原生 Playground，其余不渲染
```

**为什么挂在引擎而不是模型任务类型上**：同一个模型既能用 vLLM 跑（该走原生对话），也能用自定义引擎跑（该走引擎自带界面），任务类型挂在模型上，两种部署拿到同一个值，区分不了。

### 界面要求

- **单端口**：界面与 API 共用一个容器端口，只用路由区分。推理实例只暴露一个端口，多开端口会绕过平台的端口与鉴权约定。

  参考划分：

  | 路由 | 用途 |
  |------|------|
  | `/` | Playground 页面 |
  | `/health` | 探针 |
  | `/v1/*` | 引擎 API |
  | `/docs`、`/openapi.json` | Swagger UI 与接口描述 |
  | 静态资源 | 与页面同源，按相对路径引用 |

- **必须用相对地址**：平台对推理实例的代理会**剥掉 `/endpoint/<svc>` 前缀**再转发，且不下发 `root_path`。页面里出现 `/v1/...`、`/docs` 这类绝对地址会打到平台自身域而不是引擎，表现为白屏或 404。写 `./v1/...`、`./docs` 即可，直连与代理两种情形都能用。
- **静态资源回源校验**：给页面与静态资源加 `Cache-Control: no-cache`。资源随镜像变化，被浏览器启发式缓存后，升级完仍会渲染旧页面，现象难以从外部定位。
- **内置示例文件**：需要用户输入文件的引擎应在界面内提供示例（一键填充），让用户不必先自备文件就能试通一次调用。平台不规定示例的形态。
- **读 `?token=` 与 `?lang=`**：平台打开 iframe 时会带上当前语言与（勾选后）访问令牌，引擎界面按需读取，用于语言切换与鉴权。**注意**：令牌同时要能传给「API」页签里的试调用，否则页面内调接口会缺凭据而报 401，而解析页签却正常——这种「一半能跑」的状态很容易被当成引擎故障。

### OpenAPI

引擎提供 `/openapi.json` 与 `/docs`（Swagger UI），接口按 OpenAPI 描述。平台不规定内部实现，只要求它可访问、且资源用相对地址。界面内可以把 `/docs` 嵌成「API」页签，让用户在一个页面里既能试又能查；也可以换成主题与平台一致的文档组件（例如 RapiDoc），此时注意两点：**声明 `server` 指向引擎自身**（相对路径，见上），以及把令牌注入到它的鉴权配置里。

若接口有「上传文件」这类只能由表单完成的调用，**把 `multipart/form-data` 排在 `requestBody.content` 的第一位**。多数文档组件默认选中第一个媒体类型，若 `application/json` 在前，Try 面板只会给出 JSON 编辑器、没有文件选择框，用户无法在页面上试通。

## 七、验证清单

接入后按顺序确认：

1. **独立运行**：不依赖平台，用本地权重目录把引擎跑起来，界面与 Swagger 都能打开；
2. **构建镜像**并推送到平台使用的镜像仓库；
3. **部署实例**：模型选一个已上传的仓库，框架选你的引擎；
4. **Pod 内检查**：`/mnt/models/model` 有权重，且引擎日志里**没有**任何权重下载请求；
5. **探针通过**：`GET /health` 返回 200，Pod 变为就绪；
6. **概览页**：出现 iframe 界面，用内置示例完成一次调用；
7. **API 页签**：打开 Swagger 并成功调一次接口；
8. **分流验证**：同一个模型用 vLLM 再建一个实例，确认它走的是平台原生 Playground（而不是你的界面）；
9. **关闭能力位**：在管理后台关掉「自带 Playground」，确认该实例改回按任务类型分流。

## 相关文档

- [配置推理引擎](./runtime_framework_admin)
- [推理框架介绍](./inference_framework_intro)
- [创建推理实例](./endpoint_create)
- [MinerU 文档解析](./inference_tasks/document-parsing)
