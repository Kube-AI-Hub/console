---
title: "配置推理引擎"
keywords: "行业大模型平台, 推理引擎, 运行时框架, 启动配置, KServe, llm-d, engine_args"
description: "平台管理员如何在管理后台配置推理引擎，包括引擎参数与启动配置（KServe / llm-d）。"
linkTitle: "配置推理引擎"
weight: 6236
---

## 管理入口

以平台管理员身份登录，进入 **平台管理 → 运行时框架与镜像管理**（与规格管理、公共推理服务同一套后台）。页面按部署类型分成多个页签：

| 页签 | 用途 |
|------|------|
| **推理引擎** | 用户创建推理实例、管理员部署公共推理时可选的镜像与启动方式 |
| **大模型微调** | 微调框架镜像与引擎参数 |
| **模型评测** | 评测框架镜像与引擎参数 |
| **Notebook** | 开发环境镜像 |
| **任务** | 通用任务镜像 |

本文说明 **推理引擎** 页签。KServe 推理（含 llm-d / LLMISVC）的启动命令来自这里的 **启动配置**，而不是镜像内写死的入口脚本。

## 列表与导入

- 可按框架名称、镜像、版本、模型格式搜索。
- **新建**：手工登记一条框架版本。
- **导入内置框架**：按当前页签补齐仓库内置 JSON 中缺失的记录，**不会覆盖已有行**（包括已写入的引擎参数和启动配置）。
- 名称带 `-multi-node` / `-pd` 后缀的记录会显示 **多节点** / **PD 分离** 标记。

{{< notice note >}}
内置配置更新后，seed 和「导入内置框架」都不会改已经存在的行。要把 `tensor-parallel-size` 改成 `${GPU_NUM}`，或补上 `launch`，请直接编辑对应记录。
{{</ notice >}}

## 新建或编辑

在 **推理引擎** 页签点击**新建**，或打开某条记录的**编辑**。主要字段：

| 参数 | 说明 |
|------|------|
| **框架名称** | 如 `ascend-vllm`、`sglang`。保存时会按「多节点支持」自动加后缀 |
| **多节点支持** | **单节点**（无后缀）、**多节点**（`-multi-node`）、**PD 分离**（`-pd`）。用户创建实例时，平台据此推断拓扑 |
| **版本 / 镜像地址** | 框架版本号与容器镜像 |
| **计算类型** | `cpu` / `gpu` / `npu` 等，须与规格类型一致才会出现在创建页 |
| **驱动版本** | 可选，用于和节点驱动匹配展示 |
| **模型格式** | 如 safetensors、gguf |
| **容器端口** | 服务监听端口，默认 `8000`，应与启动配置里的 `containerPort` 一致 |
| **引擎参数** | JSON 数组，用户在创建页可覆盖的 CLI 参数模板 |
| **启动配置（KServe / llm-d）** | JSON 对象，决定 KServe 如何拉起进程 |
| **支持的架构 / 模型** | 可选标签，用于模型与框架匹配 |
| **启用** | 关闭后用户创建页不再展示该版本 |

微调、评测页签同样有引擎参数和启动配置输入框；KServe / llm-d 只在推理（及公共推理）部署时读取启动配置。

## 引擎参数

后台用代码编辑器编辑 JSON，支持语法高亮、行号和查找（Ctrl/⌘F）。值为 JSON 数组。每一项：

```json
{
  "name": "tensor-parallel-size",
  "value": "${GPU_NUM}",
  "format": "--tensor-parallel-size %s"
}
```

| 字段 | 说明 |
|------|------|
| `name` | 创建页表单字段名 |
| `value` | 默认值。可写 `${GPU_NUM}` 或 `$GPU_NUM`，部署时替换为规格里**每副本**的卡数（`processors[].resourceNum`，非法或 ≤0 时按 `1`） |
| `format` | 写入 `ENGINE_ARGS` 的格式串；无 `%s` 时视为开关（`enable` 才写出该 flag） |

写入启动命令的规则：

1. 用户在创建 / 设置页改过该字段，**或** 模板 `value` 含 `GPU_NUM` 占位符时，才会写入 `ENGINE_ARGS`。
2. 其它默认项（如 `dtype`、`max-model-len`）用户没改就不写，避免覆盖引擎自身默认值。
3. 用户手写 `"2"` 原样发出；手写 `"${GPU_NUM}"` 也会按卡数展开。

KServe 把已展开的 `ENGINE_ARGS` 追加到启动配置生成的参数后面。未开启 KServe 时走 Knative，启动配置不参与渲染，由镜像脚本读取 `ENGINE_ARGS`；脚本若已看到 `--tensor-parallel-size` 则不会再补一份。

## 启动配置（KServe / llm-d）

后台同样用代码编辑器维护这段 JSON。启动配置对应运行时框架上的 `launch_spec`，字段与 [llm-d-modelservice](https://github.com/llm-d/llm-d-modelservice) Helm values 的 `decode` / `prefill` / `routing` 子集对齐。KServe Standard（`InferenceService`）和 LLMISVC（`LLMInferenceService`）都从这里渲染容器 `command` / `args`。

{{< notice warning >}}
集群已开启 KServe 时，推理部署**必须**配置 `decode`（或别名 `template`）。留空会导致创建失败，错误类似 `engine has no launch.decode; configure launch on the runtime framework`。
{{</ notice >}}

### 顶层字段

| 字段 | 别名 | 作用 |
|------|------|------|
| `decode` | `template` | Decode / 单节点主进程。Standard ISVC 和 LLMISVC 的默认工作负载都读这里 |
| `prefill` | — | PD 分离时的 Prefill 进程 |
| `routing` | `router` | 路由。写了该对象（即使是 `{}`）即视为启用路由 |

`decode` / `prefill` 的结构：

```json
{
  "containers": [
    {
      "name": "kserve-container",
      "modelCommand": "vllmServe",
      "command": [],
      "args": [],
      "ports": [{ "containerPort": 8000, "protocol": "TCP" }],
      "env": [{ "name": "EXAMPLE", "value": "1" }]
    }
  ]
}
```

平台使用每个工作负载的**第一个** container。`args` 中的 `{{.Name}}` 会替换为模型仓库路径（如 `CSG_Qwen/Qwen3-0.6B`）。模型文件挂载在 `/mnt/models/model`。

### modelCommand

| 取值 | 生成的启动命令 |
|------|----------------|
| `vllmServe` | `vllm serve /mnt/models/model --port <端口>`，再追加 `args` 和 `ENGINE_ARGS` |
| `custom` | 使用你填写的 `command` + `args`。缺少 `--port` 时自动补上。`command` 不能为空 |
| `imageDefault` | 不改镜像入口，只使用 `args`（再追加 `ENGINE_ARGS`） |
| 空且写了 `command` | 按 `custom` 处理 |

SGLang 应使用 `custom`，例如 `python3 -m sglang.launch_server`。若 `command` / `args` 里能识别到 sglang，且未写 `--enable-metrics`，平台会自动加上，便于前缀缓存等指标采集。

### routing 与编排后端

| 场景 | 后端 | 启动配置要求 |
|------|------|----------------|
| 单节点、最小副本 = 1 | KServe Standard | 至少有 `decode` |
| 单节点、最小副本 ≥ 2 | KServe LLMISVC | `decode`；需要前缀粘滞调度时写 `routing`（可为 `{}`） |
| 多节点（`-multi-node` 或规格节点数 > 1） | KServe LLMISVC | `decode`；多机参数可写在 `args` 里（如 LWS 环境变量） |
| PD 分离（`-pd`） | KServe LLMISVC | 同时配置 `decode`、`prefill`、`routing` |

`routing` 示例（PD 时 decode 与网关端口不同）：

```json
"routing": {
  "servicePort": 8000,
  "proxy": { "targetPort": 8001 }
}
```

- 写了 `routing` 且走 LLMISVC 时，会挂 InferencePool / EPP，把相同 prompt 前缀尽量打到同一副本。
- 单节点 SGLang 内置配置带 `"routing": {}`，多副本才能走前缀粘滞；未写 `routing` 时只靠引擎本机缓存。
- PD / 多节点要求集群打开 LLMISVC；未打开时创建会失败，而不是回退到 Knative。

### 示例：单节点 vLLM

```json
{
  "decode": {
    "containers": [
      {
        "name": "kserve-container",
        "modelCommand": "vllmServe",
        "args": [
          "--served-model-name",
          "{{.Name}}",
          "--host",
          "0.0.0.0",
          "--trust-remote-code"
        ],
        "ports": [{ "containerPort": 8000, "protocol": "TCP" }]
      }
    ]
  },
  "routing": {}
}
```

实际进程类似：

```text
vllm serve /mnt/models/model --port 8000 --served-model-name <模型ID> --host 0.0.0.0 --trust-remote-code --tensor-parallel-size 2
```

（最后的 `--tensor-parallel-size` 来自引擎参数里的 `${GPU_NUM}`，不写在启动配置里。）

### 示例：单节点 SGLang

```json
{
  "decode": {
    "containers": [
      {
        "name": "kserve-container",
        "modelCommand": "custom",
        "command": ["python3", "-m", "sglang.launch_server"],
        "args": [
          "--model-path", "/mnt/models/model",
          "--host", "0.0.0.0",
          "--port", "8000",
          "--enable-metrics",
          "--trust-remote-code"
        ],
        "ports": [{ "containerPort": 8000, "protocol": "TCP" }]
      }
    ]
  },
  "routing": {}
}
```

### 示例：PD 分离 vLLM

```json
{
  "decode": {
    "containers": [
      {
        "name": "main",
        "modelCommand": "vllmServe",
        "args": ["--served-model-name", "{{.Name}}", "--trust-remote-code"],
        "ports": [{ "containerPort": 8001, "protocol": "TCP" }]
      }
    ]
  },
  "prefill": {
    "containers": [
      {
        "name": "main",
        "modelCommand": "vllmServe",
        "args": ["--served-model-name", "{{.Name}}", "--trust-remote-code"],
        "ports": [{ "containerPort": 8000, "protocol": "TCP" }]
      }
    ]
  },
  "routing": {
    "servicePort": 8000,
    "proxy": { "targetPort": 8001 }
  }
}
```

## 相关文档

- [创建推理实例](./endpoint_create)
- [管理公共推理服务](./serverless_admin)
- [规格管理](/docs/v3.4/access-control-and-account-management/resource-specifications)
