---
title: "Document Parsing"
keywords: "Industry AI Model Platform, document parsing, MinerU, PDF to Markdown, Office documents, OCR, inference endpoint"
description: "How to use the MinerU document parsing inference engine to turn PDFs, Office documents and images into formatted Markdown, through the Playground or the API."
linkTitle: "Document Parsing"
weight: 6255
---

## What it does

Document parsing turns **PDFs, Office documents (DOC/DOCX, PPT/PPTX, XLS/XLSX) and images** into formatted Markdown, keeping heading levels, lists, tables and formulas, and placing images where they belong. It is the usual way to make an existing document set searchable, or to feed it to a language model.

The platform provides it through the [MinerU](https://github.com/opendatalab/MinerU) inference engine. Unlike text generation, the input is a file and the output is Markdown, so the endpoint overview shows an **upload and preview page** rather than a chat box.

## Creating an endpoint

Go to **Model Inference → Endpoints → New Endpoint**:

1. **Model**: pick an uploaded MinerU weights repository (for example `admin/MinerU2.5-2509-1.2B`). The platform downloads and mounts it; nothing has to be prepared by hand.
2. **Framework**: choose `mineru`. If it is not listed, ask an administrator to check that it is enabled under **Admin Console → Compute Resource → Runtime Framework & Image Management → Inference Engine**, or use **Import Built-in**.
3. **Compute**: pick a GPU specification. The first parse loads the layout, OCR, formula and table models, so memory and VRAM needs are higher than for a text-only model.
4. Fill in the rest as needed and submit, then wait for the endpoint to become ready.

{{< notice note >}}
The same MinerU model can also be deployed with the `vllm` framework. That gives you image-text chat and the platform Playground; choose `mineru` when you want document parsing.
{{< /notice >}}

## Parsing in the Playground

Open the overview tab once the endpoint is ready; the page is embedded there, so there is no separate address to find.

1. **Choose a file**: drag in or select a PDF, Office document or image. Bundled examples are offered, so a first run needs no file of your own.
2. **Pick a tier**:

   | Tier | Use |
   |------|-----|
   | `flash` | Quick preview, for a first look |
   | `basic` | Basic OCR |
   | `standard` | Complex layout (default); use it for dense pages, formulas or tables |
   | `advanced` | Highest quality, slower |

3. **OCR mode**: `auto` decides, `txt` uses the PDF text layer only, `ocr` forces recognition of scanned pages.
4. **Page range**: leave it empty or `all` for every page, or use a range such as `1-10` to try a few pages first.
5. Click **Parse**. The Markdown appears on the right, ready to copy or download as `.md`.

The first parse loads the model and is slower than later calls; the page says so while it runs. On failure the reason is shown under the button, without losing the selected file and options.

The **API** tab embeds the engine's Swagger UI, so an API call can be made from the page itself.

## Calling the API

The page and the API share the endpoint address and are separated by route. Parsing is `POST /v1/file_parse`:

```bash
curl -X POST "https://<endpoint>/v1/file_parse?tier=standard&ocr_mode=auto" \
  -H "Authorization: Bearer <access-token>" \
  -F "files=@document.pdf"
```

Parameters:

| Parameter | Meaning |
|-----------|---------|
| `tier` | `flash` / `basic` / `standard` / `advanced` |
| `ocr_mode` | `auto` / `txt` / `ocr` |
| `page_range` | Page range; empty means every page |
| `output_formats` | Defaults to `markdown`; add `middle_json`, `structured_content`, `zip` |

The response is a task document; `files[].markdown` holds the Markdown, and a per-file failure explains itself in `files[].error.message`. The body is `multipart/form-data` with the file field named `files`, and several files can be sent at once.

Asynchronous form (submit, then poll):

```bash
# submit
curl -X POST "https://<endpoint>/v1/tasks?tier=standard" \
  -H "Authorization: Bearer <access-token>" \
  -F "files=@document.pdf"

# fetch the result
curl "https://<endpoint>/v1/tasks/<task_id>/result" \
  -H "Authorization: Bearer <access-token>"
```

The full interface list is on the **API** tab of the overview, or at `/docs` under the endpoint address.

## Python example

```python
import requests

response = requests.post(
    "https://<endpoint>/v1/file_parse",
    headers={"Authorization": "Bearer <access-token>"},
    params={"tier": "standard", "ocr_mode": "auto"},
    files={"files": open("document.pdf", "rb")},
    timeout=600,
)
result = response.json()
print(result["files"][0]["markdown"])
```

## Troubleshooting

**Parsing is slow**: the first call loads the model. Use `tier=flash` or a limited `page_range` to check the path quickly.

**Scanned pages come out empty**: use `ocr_mode=ocr` (or `auto`). `txt` reads only the PDF's own text layer, which a scan does not have.

**Tables or formulas are garbled**: move to `tier=standard` or `advanced`; `flash` does not guarantee complex layouts.

**The endpoint is ready but parsing errors out**: call `/v1/file_parse` once from the **API** tab to tell a request problem from an engine problem. Engine-side checks are in [Custom Inference Engines](../custom_engine).

## See also

- [Create an Inference Endpoint](../endpoint_create)
- [Using an Inference Endpoint](../endpoint_usage)
- [Custom Inference Engines](../custom_engine)
