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
2. **Parsing level**: drag the slider; the level name and its trade-off update as you move it.

   | Tier | Use |
   |------|-----|
   | `flash` | Quick preview, for a first look |
   | `basic` | Basic OCR |
   | `standard` | Complex layout (default); use it for dense pages, formulas or tables |
   | `advanced` | Highest quality, slower |

3. **Force OCR**: tick it to ignore the PDF text layer and treat the whole document as a scan. Left unticked the engine decides for itself (equivalent to `ocr_mode=auto`); to use the text layer only and skip recognition, pass `ocr_mode=txt` through the API.
4. **Page range**: two sliders for the first and last page, with a summary such as "pages 3-5 selected (3 of 13)". The page count is only known once a PDF is loaded, so the sliders stay disabled until then; the selection is sent as `page_range`. Trying the first few pages is faster.
5. Click **Parse**. The stage list on the left lights up as the job advances (preparing request → submitting job → queued → parsing → downloading result → assembling output → done) with a running timer, so a stall is visible where it happens. The result appears on the right.

The middle column previews the **source document** side by side with the result: hover a heading, table or paragraph on either side and the matching block is highlighted on the other; click to pin the selection. The PDF toolbar offers paging, jumping to a page and zooming.

The result pane switches between **Markdown** (rendered) and **JSON** (`middle_json`), and its **Download** menu offers several formats:

| Format | Notes |
|--------|-------|
| Markdown / JSON / Structured JSON | The parse artifacts themselves |
| HTML / LaTeX / DOCX / EPUB / PDF | Converted from the same result in place, **no API token needed**; LaTeX arrives as `_latex.zip` and PDF as `_rendered.pdf` |
| ZIP | The full artifact bundle, including `images/` |

The first parse loads the model and is slower than later calls; the page says so while it runs. On failure the reason is shown under the button, without losing the selected file and options.

The **API** tab embeds the engine's interface documentation (RapiDoc, themed to match the platform), so an API call can be made from the page itself. When the page is opened with `?token=`, calls made there carry that token automatically.

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

**Some download formats are greyed out**: parse something first — those formats are converted from the current result, so there is nothing to convert without one. The item stays disabled while it converts.

## See also

- [Create an Inference Endpoint](../endpoint_create)
- [Using an Inference Endpoint](../endpoint_usage)
- [Custom Inference Engines](../custom_engine)
