---
title: "Configure Inference Engines"
keywords: "Industry AI Model Platform, inference engine, runtime framework, launch spec, KServe, llm-d, engine_args"
description: "How platform administrators configure inference engines in the admin console, including engine args and KServe / llm-d launch settings."
linkTitle: "Configure Inference Engines"
weight: 6236
---

## Admin entry

Sign in as a platform administrator and open **Admin Console → Compute Resource → Runtime Framework & Image Management** (same group as resource specifications and public inference). Tabs map to deploy types:

| Tab | Use |
|-----|-----|
| **Inference Engine** | Images and launch settings for dedicated endpoints and public inference |
| **Finetune** | Fine-tuning images and engine args |
| **Evaluation** | Evaluation images and engine args |
| **Notebook** | Development environment images |
| **Job** | Generic job images |

This page covers the **Inference Engine** tab. KServe (including llm-d / LLMISVC) builds the process command from **Launch (KServe / llm-d)**, not from a hardcoded image entrypoint.

## List and import

- Search by name, image, version, or model format, and filter by compute type and status. Search, filters, Import Built-in, and Create sit on one row.
- **Create** registers a new framework version.
- **Import Built-in** adds missing rows from the bundled JSON for the current tab. It **does not overwrite** existing rows (including engine args and launch spec).
- Names ending in `-multi-node` / `-pd` show **Multi-node** / **PD** badges.

{{< notice note >}}
Updating the bundled JSON does not change rows that already exist (seed and import skip them). To switch `tensor-parallel-size` to `${GPU_NUM}` or to add `launch`, edit the record.
{{</ notice >}}

## Create or edit

On the **Inference Engine** tab, click **New** or **Edit**. Main fields:

| Field | Description |
|-------|-------------|
| **Framework name** | For example `ascend-vllm` or `sglang`. The topology selector appends a suffix on save |
| **Topology** | **Single** (no suffix), **Multi-node** (`-multi-node`), **PD** (`-pd`). The create-endpoint page infers topology from this |
| **Version / Image** | Framework version and container image |
| **Compute type** | `cpu` / `gpu` / `npu`, and so on. Must match the SKU type to appear on the create page |
| **Driver version** | Optional, shown when matching node drivers |
| **Model format** | For example safetensors or gguf |
| **Container port** | Listen port, default `8000`. Keep it aligned with `containerPort` in launch |
| **Engine args** | JSON array of CLI flags users can override |
| **Launch (KServe / llm-d)** | JSON object that tells KServe how to start the process |
| **Architectures / models** | Optional tags for framework matching |
| **Enabled** | Disabled versions are hidden on the create page |

Fine-tuning and evaluation forms also accept engine args and launch JSON. KServe / llm-d reads launch only for inference and public inference.

## Engine args

The admin form edits this JSON in a code editor with syntax highlighting, line numbers, and find (Ctrl/⌘F). Value is a JSON array. Each item:

```json
{
  "name": "tensor-parallel-size",
  "value": "${GPU_NUM}",
  "format": "--tensor-parallel-size %s"
}
```

| Field | Description |
|-------|-------------|
| `name` | Form field on the create page |
| `value` | Default. `${GPU_NUM}` or `$GPU_NUM` expands to the SKU **per-replica** card count (`processors[].resourceNum`; invalid or ≤0 becomes `1`) |
| `format` | String written into `ENGINE_ARGS`. With no `%s` it is a switch (emitted only when enabled) |

Emit rules:

1. Write the flag only if the user overrode the field, **or** the template value contains a `GPU_NUM` placeholder.
2. Other defaults (`dtype`, `max-model-len`, and so on) stay omitted unless the user changes them.
3. A literal `"2"` is passed through; `"${GPU_NUM}"` is expanded.

KServe appends the already-expanded `ENGINE_ARGS` after the launch-generated args. When KServe is off, inference stays on Knative: launch is not rendered, and image scripts read `ENGINE_ARGS`. Those scripts skip adding `--tensor-parallel-size` if it is already present.

## Launch (KServe / llm-d)

The same code editor is used for this JSON. Launch is stored as `launch_spec`. Field names match the `decode` / `prefill` / `routing` subset of [llm-d-modelservice](https://github.com/llm-d/llm-d-modelservice) Helm values. Both KServe Standard (`InferenceService`) and LLMISVC (`LLMInferenceService`) render `command` / `args` from this object.

{{< notice warning >}}
When KServe is enabled, inference **must** define `decode` (or the `template` alias). An empty launch fails with `engine has no launch.decode; configure launch on the runtime framework`.
{{</ notice >}}

### Top-level fields

| Field | Alias | Role |
|-------|-------|------|
| `decode` | `template` | Decode / single-node main process. Standard ISVC and the default LLMISVC workload read this |
| `prefill` | — | Prefill process for PD |
| `routing` | `router` | Routing. Presence of the object (even `{}`) means routing is configured |

`decode` / `prefill` shape:

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

The platform uses the **first** container of each workload. `{{.Name}}` in `args` becomes the repository path (for example `CSG_Qwen/Qwen3-0.6B`). The model is mounted at `/mnt/models/model`.

### modelCommand

| Value | Command |
|-------|---------|
| `vllmServe` | `vllm serve /mnt/models/model --port <port>`, then `args` and `ENGINE_ARGS` |
| `custom` | Your `command` + `args`. `--port` is added if missing. `command` is required |
| `imageDefault` | Keep the image entrypoint; use `args` (plus `ENGINE_ARGS`) |
| Empty with `command` set | Treated as `custom` |

Use `custom` for SGLang, for example `python3 -m sglang.launch_server`. If `command` / `args` look like SGLang and `--enable-metrics` is absent, the platform adds it for prefix-cache metrics.

### routing and backends

| Scenario | Backend | Launch requirement |
|----------|---------|-------------------|
| Single node, min replicas = 1 | KServe Standard | `decode` at minimum |
| Single node, min replicas ≥ 2 | KServe LLMISVC | `decode`; add `routing` (may be `{}`) for prefix-sticky scheduling |
| Multi-node (`-multi-node` or SKU node count > 1) | KServe LLMISVC | `decode`; put multi-host flags in `args` (for example LWS env vars) |
| PD (`-pd`) | KServe LLMISVC | `decode`, `prefill`, and `routing` |

PD routing when decode and the gateway use different ports:

```json
"routing": {
  "servicePort": 8000,
  "proxy": { "targetPort": 8001 }
}
```

- With `routing` and LLMISVC, InferencePool / EPP pin the same prompt prefix to the same replica when possible.
- Built-in single-node SGLang includes `"routing": {}` so multi-replica prefix routing can attach; without `routing`, only on-pod cache applies.
- PD / multi-node require LLMISVC on the cluster. Creation fails instead of falling back to Knative if it is off.

### Example: single-node vLLM

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

The process looks like:

```text
vllm serve /mnt/models/model --port 8000 --served-model-name <model-id> --host 0.0.0.0 --trust-remote-code --tensor-parallel-size 2
```

(`--tensor-parallel-size` comes from `${GPU_NUM}` in engine args, not from launch.)

### Example: single-node SGLang

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

### Example: PD vLLM

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

## Related Documentation

- [Create Dedicated Inference Instance](./endpoint_create)
- [Manage Public Inference](./serverless_admin)
- [Resource Specifications](/docs/v3.4/access-control-and-account-management/resource-specifications)
