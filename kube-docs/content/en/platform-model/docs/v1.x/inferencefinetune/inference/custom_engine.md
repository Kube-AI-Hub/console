---
title: "Custom Inference Engines"
keywords: "Industry AI Model Platform, custom inference engine, runtime framework, KServe, Playground, OpenAPI, single port"
description: "How to add a custom inference engine to the Industry AI Model Platform: where the code lives, how to build the image, the framework config, the model mount contract, and the requirements for a bundled Playground and OpenAPI."
linkTitle: "Custom Inference Engines"
weight: 6237
---

The platform ships general-purpose runtimes: vLLM, SGLang, TGI, llama.cpp and others. When the task you need to serve is not plain chat or image generation — document parsing, speech synthesis, a domain-specific structured extraction — you can register a **custom inference engine**: you provide the image, and the platform schedules it, mounts the model, exposes the endpoint, and embeds your own page in the overview tab.

This page describes what a new engine has to provide. The document-parsing engine that ships with the platform is described in [Document Parsing](./inference_tasks/document-parsing).

## The shape of it

```text
configs/inference/<engine>.json
        │ seed
        ▼
  runtime framework (runtime_frameworks)
        │ chosen when creating an endpoint
        ▼
  KServe InferenceService
        │
        ├── csghub-storage-initializer ──download & mount──▶ /mnt/models/model (read-only)
        │                                                              │
        │                                                              ▼
        ├── engine container :8000 ◀────────────────────────── reads the weights
        │        │
        │        ├── /v1/*            parse / inference API
        │        ├── / and /docs      Playground and Swagger
        │        └── /health          probe
        │
        └── overview iframe ──rproxy /endpoint/<svc>──▶ the engine's own page
```

Three things matter:

1. **The platform downloads the model**; the engine mounts it read-only and never fetches weights itself.
2. **One container port** serves both the API and the page, separated by route.
3. **The engine decides which UI it needs**, declared through the runtime framework's `custom_playground` flag.

## 1. Where the code lives

Keep the engine's code in the engine's own repository, exposed as a **standalone command**, rather than inside the platform repository:

- the platform repository holds the Dockerfile, `configs/inference/*.json`, and documentation;
- the engine repository provides the serving command (for example `mineru-kit serve`), which runs, debugs, and releases independently of the platform;
- the image is built from that repository's source, so what is deployed is what was tested.

Install from that source tree rather than from a package-index version range: otherwise the image tag and the installed version can drift, and the bundled page may be missing.

## 2. The model mount contract

The platform uses KServe's `csghub-storage-initializer` to download the model to **`/mnt/models/model`** and mounts it read-only into the engine container. Therefore:

| Requirement | Why |
|-------------|-----|
| Do not download weights | The platform has already placed them before the container starts |
| Tolerate a read-only mount | With a shared model cache the mount is `readOnly: true`. Write any completion marker into your own writable directory (for example under `$HOME`), **never into the mount** |
| Fail fast when the mount is missing | A missing mount should abort at startup rather than silently pulling gigabytes inside the pod. The probe then keeps failing, which is much easier to diagnose |
| Keep weights out of the image | Ship only the engine's **fixed assets** (a bundled auxiliary model, for instance); anything a user selects comes from the mount |

If the engine expects a different layout than `/mnt/models/model`, bridge it at startup: link the mount's entries into the expected location (linking avoids copying gigabytes; fall back to a copy only across filesystems) and write the engine's completion marker there. The marker goes in the target directory, not the source, because the source may be read-only.

## 3. The image

Put the Dockerfile in the platform repository under `docker/inference/`, named `Dockerfile.<engine>`, alongside `Dockerfile.chatterbox-tts-cuda` and friends. The image must:

- **listen on 8000**: the platform's container port defaults to `8000`, and both the probe and the proxy use it;
- **answer `GET /health`**: the probe hits exactly that path (see below);
- **carry everything it needs**: page assets, auxiliary models, templates all ship in the image;
- **be amd64**: inference nodes are amd64.

Pick a base image that matches the engine's dependencies. An engine that drives a local VLM can build on `vllm/vllm-openai` so torch and CUDA arrive matched instead of being reinstalled from PyPI.

## 4. Health check

The platform probes **`GET /health`**. The startup probe runs every 15 seconds up to 240 times (about 60 minutes, so loading large weights is not mistaken for a failure), and readiness and liveness probes follow.

Two things to get right:

- **Do not answer 200 before the model is readable**: a replica that reports ready while its weights are unavailable will be sent traffic it cannot serve. Return a non-200 (503, for example) until then.
- **The probe cannot send an Authorization header**: if your service is configured with an API key, `/health` has to stay unauthenticated, or the probe fails forever.

## 5. Framework config

Add `<engine>.json` under `configs/inference/`. The platform seeds runtime frameworks from that directory at startup (it **does not overwrite existing rows**; edit those in the admin console).

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

| Field | Meaning |
|-------|---------|
| `engine_name` | Framework name; used on the create page and stored as `deploy.runtime_framework` |
| `inference_backend` | Custom engines use `kserve-standard` (single replica). `kserve-llmisvc` targets LLM engines with multi-node / PD |
| `custom_playground` | `true` means the engine ships its own page; see below |
| `container_port` | The port the service listens on, matching the image |
| `engine_images` | One entry per compute type, with image and driver version |
| `supported_models` | Optional tags used for model-to-framework matching |
| `launch` | The launch spec. **Required**, or endpoint creation fails with `engine has no launch.decode` |

The key fields of `launch.decode.containers[0]`:

- **`modelCommand: "imageDefault"`** — leaves the image entrypoint alone and appends `args` to it. The simplest arrangement for a custom engine is to put its start command in the Dockerfile's `ENTRYPOINT`.
- **`modelCommand: "custom"`** — overrides the entrypoint with your `command` + `args`; the platform appends `--port` when it is missing.
- **`modelCommand: "vllmServe"`** — renders `vllm serve /mnt/models/model --port <port>`, for serving vLLM directly.

`{{.Name}}` in `args` is replaced with the model repository path. Framework arguments a user enters on the create page (`engine_args`) are appended after these.

Full field reference and examples: [Configure Inference Engines](./runtime_framework_admin).

## 6. Playground and OpenAPI

A custom engine's interaction is unlike the platform Playground (upload a file, read Markdown) rather than a chat, so the engine ships a page and the overview embeds it in an iframe.

### The capability flag

Set `"custom_playground": true` in the framework config, or switch on **Custom Playground** on the admin edit page.

Routing:

```text
custom_playground = true   → embed the engine's own page in an iframe
custom_playground = false  → follow the task tag: the four native tasks get the platform Playground, anything else renders nothing
```

**Why the flag lives on the engine, not the model's task tag**: one model can run under vLLM (which wants the native chat UI) and under a custom engine (which wants its own page). The task tag is a property of the model, so both deploys carry the same value and cannot be told apart.

### Page requirements

- **One port**: the page and the API share a container port, separated only by route. An inference instance exposes a single port, and opening more would bypass the platform's port and auth conventions.

  A workable split:

  | Route | Purpose |
  |-------|---------|
  | `/` | Playground page |
  | `/health` | Probe |
  | `/v1/*` | Engine API |
  | `/docs`, `/openapi.json` | Swagger UI and the API description |
  | static assets | Same origin, referenced relatively |

- **Relative paths are mandatory**: the platform's inference proxy **strips the `/endpoint/<svc>` prefix** before forwarding and sends no `root_path`. Absolute paths such as `/v1/...` or `/docs` resolve against the platform's own host instead of the engine, showing up as a blank page or a 404. Write `./v1/...` and `./docs`, which work both directly and behind the proxy.
- **Revalidate static assets**: send `Cache-Control: no-cache` for the page and its assets. They change with the image, and a heuristically cached copy keeps rendering a previous version's page after an upgrade, which is very hard to diagnose from outside.
- **Bundle example files**: an engine that needs a file from the user should offer examples in the page (one click to fill), so a first run succeeds without preparing anything. The platform does not dictate their form.
- **Read `?token=` and `?lang=`**: the platform appends the current language and, when the user opts in, an access token. Use them for localization and authentication as needed. **Note**: the token must also reach the "Try" calls inside the API tab. Without that the in-page calls go out unauthenticated and report 401 while the parse tab works fine — a "half working" state that reads as an engine fault.

### OpenAPI

Expose `/openapi.json` and `/docs` (Swagger UI), with the interface described by OpenAPI. The platform does not dictate the implementation, only that it is reachable and that its assets use relative paths. Embedding `/docs` as an "API" tab in the page lets a user try and read the API in one place; a documentation component themed to match the platform (RapiDoc, for instance) is also fine — but then point its `server` at the engine itself (a relative path, as above) and inject the token into its auth configuration.

If an operation can only be performed as a form — a file upload, say — **put `multipart/form-data` first in `requestBody.content`**. Most documentation components preselect the first media type; with `application/json` ahead of it, the Try panel offers only a JSON editor and no file picker, so the operation cannot be tried from the page at all.

## 7. Verification checklist

Once the engine is registered, confirm in order:

1. **Standalone**: run the engine with a local weights directory, without the platform; both the page and Swagger open.
2. **Build and push** the image to the registry the platform pulls from.
3. **Deploy an instance** with an uploaded model repository and your engine.
4. **Inspect the pod**: `/mnt/models/model` holds the weights, and the engine log shows **no** attempt to download them.
5. **Probe passes**: `GET /health` returns 200 and the pod becomes ready.
6. **Overview page**: the iframe renders and a bundled example completes one call.
7. **API tab**: Swagger opens and an API call succeeds.
8. **Routing check**: deploy the same model under vLLM and confirm that instance uses the platform Playground, not your page.
9. **Flag off**: turn off **Custom Playground** in the admin console and confirm the instance falls back to task-tag routing.

## See also

- [Configure Inference Engines](./runtime_framework_admin)
- [Inference Frameworks](./inference_framework_intro)
- [Create an Inference Endpoint](./endpoint_create)
- [Document Parsing](./inference_tasks/document-parsing)
