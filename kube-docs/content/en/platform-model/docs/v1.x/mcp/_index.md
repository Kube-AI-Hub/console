---
title: "MCP"
keywords: "Industry AI Model Platform, MCP, Model Context Protocol, tool calling"
description: "MCP (Model Context Protocol) is an open protocol that standardizes how large language models interact with external data sources and tools."
linkTitle: "MCP"
weight: 5000
icon: "/images/docs/platform-model/mcp.svg"
---

## What is MCP

Model Context Protocol (MCP) is an open protocol designed to standardize how large language models (LLMs) interact with external data sources and tools. It is described as the "USB-C port for AI applications" — by providing a unified interface, it simplifies the connection between AI models and various tools, databases, and services, solving the traditional M×N integration problem.

## Key Advantages

- **Lower Barrier**: Significantly reduces the complexity of connecting large models to external tools, software, and interfaces.
- **Ecosystem Expansion**: A growing number of software and tool vendors are joining the MCP ecosystem, enriching the resources available to AI models.
- **Standardized Integration**: Provides a unified interface so large language models can easily connect to and use different data sources and tools.

## MCP Repositories on the Platform

The platform provides an MCP Hub for hosting and sharing MCP-compliant tool services. Developers can:

- Create MCP service repositories to publish their own MCP tools.
- Browse and use community-shared MCP tool services.
- Deploy MCP tools as runnable Space services.

## MCP Application Deployment

The platform supports deploying MCP services as standalone Spaces, providing standardized API endpoints that MCP-compatible agent frameworks can call directly.

## Viewing the MCP Protocol

Open any MCP repository and switch to the **Schema** tab to see the **tools**, **prompts** and **resources** that service actually exposes, along with the environment variables needed to run it.

The protocol is obtained by **probing the service itself**, not by parsing its source code: the platform performs an MCP handshake against the running service and reads its `tools/list`, `prompts/list` and `resources/list`. What you see is therefore what the service really promises, including anything that varies with its environment.

Discovery is automatic, with nothing to trigger by hand:

- **On successful deployment**: the platform probes once when the Space enters the running state.
- **Periodic reconciliation**: the platform also looks for services that are running while their protocol is still empty, and fills them in. This covers the rare case where the deploy-time probe did not succeed. The interval defaults to 10 minutes and can be changed with the `STARHUB_SERVER_MCP_SCAN_SCHEMA_REFRESH_INTERVAL` environment variable (a non-positive value disables it).

Because the protocol comes from a running service, an MCP service that has **not been deployed yet** shows an empty Schema tab, with a note that the protocol is fetched automatically once it is deployed. The **MCP Tools** page (`/mcp/servers/tools`) shows the same data as a second view: one row per tool, each opening a detail view with its input parameters.

When the protocol is long, a table of contents stays pinned on the left of the page (Server Config / Prompts / Resources / Tools). Clicking an entry scrolls to that section **in place**, which makes it easy to jump straight to a section when a service exposes many tools.

## Typical Use Cases

- **Database Queries**: Allow large models to directly query internal databases via MCP.
- **File I/O**: Enable large models to read from or write to local/remote file systems.
- **API Calls**: Wrap internal enterprise APIs as MCP tools for large models to use.
- **Code Execution**: Provide sandboxed code execution capabilities to large models.
