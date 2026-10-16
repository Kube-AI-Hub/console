---
title: "Knowledge Base"
keywords: "Industry AI Model Platform, Agent Workshop, knowledge base, RAG, retrieval, chunking"
description: "A knowledge base is the material an agent may consult; once bound, answers retrieve within the namespace, and only bound knowledge bases with the tool enabled are searched."
linkTitle: "Knowledge Base"
weight: 4640
---

## The role of knowledge bases

A knowledge base is material an agent may consult. It joins as a **special tool**, and retrieval reuses the model platform's existing knowledge bases: the workshop does not build a second retrieval engine and does not generate answers here.

The builder page does two things only: bind which knowledge bases, and whether this tool is on.

## Binding knowledge bases

In the builder, open the **Knowledge base** section and click **Add**; the right drawer opens the candidate list, where you search and check rows.

- Candidates are never laid out on the page; the section lists **only what is selected**, each row removable.
- Candidates include both document knowledge bases and knowledge spaces; the selected row marks the type.
- If the list fails to load, the selection is kept with the reason shown, and saving is not blocked.

## Retrieval behavior

- Only knowledge bases that are **bound and have the tool enabled** are searched; with the tool off or nothing bound, no request is sent.
- Answers retrieve within the namespace, and the results are handed to the model as context.
- In observe mode knowledge retrieval is on by default, the same as web retrieval.

## Documents and chunking

Uploading documents, chunking strategy, and vectorization all happen on the model platform's knowledge base page; the workshop only references the result. Chunk quality directly decides retrieval hit rate, so confirm the chunking works on the model platform side before binding an agent to it.

## Tenant isolation

Knowledge bases are isolated by the current tenant: switching tenants swaps both the candidate list and the bound items.

## Related operations

- [Digital twin](./digital-twin)
- [Service expert](./service-expert)
- [Tenant and permissions](./tenancy)
