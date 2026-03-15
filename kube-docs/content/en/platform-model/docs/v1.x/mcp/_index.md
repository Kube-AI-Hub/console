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

## Typical Use Cases

- **Database Queries**: Allow large models to directly query internal databases via MCP.
- **File I/O**: Enable large models to read from or write to local/remote file systems.
- **API Calls**: Wrap internal enterprise APIs as MCP tools for large models to use.
- **Code Execution**: Provide sandboxed code execution capabilities to large models.
