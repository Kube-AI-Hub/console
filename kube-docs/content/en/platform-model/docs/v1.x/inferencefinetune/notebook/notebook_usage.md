---
title: "Using Notebook Instances"
keywords: "Industry AI Model Platform, Notebook usage, JupyterLab, VS Code, Eclipse Theia, logs, billing"
description: "How to use development instances on the Industry AI Model Platform, including launching the Notebook, viewing logs, billing details, and stopping or deleting instances."
linkTitle: "Using Notebook Instances"
weight: 6120
---

## Launch the Notebook

After the instance status changes to **Running**, click the **Launch Notebook** button in the instance action bar. The system will open the corresponding online development environment in your browser.

The development environment depends on the runtime framework selected during instance creation:

| Runtime Framework | Description |
|-------------------|-------------|
| **JupyterLab** | Full-featured interactive development environment with Notebook, terminal, and file management support |
| **VS Code** | Web-based VS Code editor with comprehensive code editing and debugging capabilities |
| **Eclipse Theia** | Open-source cloud IDE with a VS Code-like interface and extension plugin support |

{{< notice note >}}
Once the Notebook is launched, the instance continues to consume compute resources and incur charges. Stop the instance promptly when you are done.
{{</ notice >}}

## Detail tabs

Opening an instance detail page (`/notebooks/:id`) reveals:

| Tab | Contents |
|-----|----------|
| Analysis | Resource usage curves for the instance. Development environments hide HTTP traffic metrics |
| Logs | Startup and runtime logs of the instance |
| Billing | Resource usage and cost breakdown |
| Settings | Alias, description, visibility, and more |

A development environment has no Overview tab; the primary action on the detail page is opening the IDE directly.

### Analysis

Shows resource usage curves for the running instance, to tell whether it is starved of CPU, memory, or VRAM. Development environments hide HTTP traffic metrics, since interactive work has no steady request volume.

### Logs

Shows startup and runtime logs of the instance, with:

- **Auto-refresh**: Automatically scrolls to show the latest log entries
- **Keyword search**: Quickly locate specific log messages
- **Log level filtering**: Filter output by level (INFO, WARNING, ERROR, etc.)

Log content includes environment startup information, dependency installation records, and code execution output, which helps troubleshoot runtime issues.

### Billing

Shows resource usage details:

| Field | Description |
|-------|-------------|
| **Billing Start Time** | When the instance started consuming compute resources |
| **Billing End Time** | When the instance was stopped or resources were released |
| **Resource Spec** | The GPU/CPU/memory configuration used by the instance |
| **Accumulated Cost** | Total resource usage cost to date |

{{< notice tip >}}
Check the billing page regularly to stay informed about resource consumption and avoid unnecessary charges.
{{</ notice >}}

### Settings

Change the alias, description, and visibility. The instance's English name and runtime framework cannot be changed after creation.

## Stop the Instance

When development work is paused or complete, click the **Stop** button in the instance action bar to pause the instance.

- After stopping, the instance no longer consumes compute resources and **billing is paused**.
- Data and configurations in the instance are preserved and remain available when restarted.
- Stopping does not delete the instance; it can be restarted at any time.

## Delete the Instance

If a development instance is no longer needed, click the **Delete** button in the instance action bar to permanently remove the instance.

{{< notice warning >}}
Deletion is irreversible. All code, data, and configurations saved in the instance will be permanently removed. Make sure you have backed up important files before deleting.
{{</ notice >}}
