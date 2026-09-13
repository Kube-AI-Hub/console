---
title: "Tenant (Workspace) Quotas"
keywords: 'Kube AI Hub, Kubernetes, tenant (workspace), quotas'
description: 'Set tenant (workspace) quotas to control the total resource usage of projects and DevOps projects in a tenant (workspace).'
linkTitle: "Tenant (Workspace) Quotas"
weight: 9700
---

Tenant (Workspace) quotas are used to control the total resource usage of all projects and DevOps projects in a tenant (workspace). Similar to [project quotas](../project-quotas/), tenant (workspace) quotas contain requests and limits of CPU and memory. Requests make sure projects in the tenant (workspace) can get the resources they needs as they are specifically guaranteed and reserved. On the contrary, limits ensure that the resource usage of all projects in the tenant (workspace) can never go above a certain value.

In [a multi-cluster architecture](../../multicluster-management/), as you need to [assign one or multiple clusters to a tenant (workspace)](../../cluster-administration/cluster-settings/cluster-visibility-and-authorization/), you can decide the amount of resources that can be used by the tenant (workspace) on different clusters.

This tutorial demonstrates how to manage resource quotas for a tenant (workspace).

## Prerequisites

You have an available tenant (workspace) and a user (`ws-manager`). The user must have the `workspaces-manager` role at the platform level. For more information, see [Create Tenants (Workspaces), Projects, Users and Roles](../../quick-start/create-workspace-and-project/).

## Set Tenant (Workspace) Quotas

1. Log in to the Kube AI Hub web console as `ws-manager` and go to a tenant (workspace).

2. Navigate to **Tenant (Workspace) Quotas** under **Tenant (Workspace) Settings**.

3. The **Tenant (Workspace) Quotas** page lists all the available clusters assigned to the tenant (workspace) and their respective requests and limits of CPU and memory. Click **Edit Quotas** on the right of a cluster.

4. In the displayed dialog box, you can see that Kube AI Hub does not set any requests or limits for the tenant (workspace) by default. To set requests and limits to control CPU and memory resources, move <img src="/images/docs/v3.x/common-icons/slider.png" width="20" alt="icon" /> to a desired value or enter numbers directly. Leaving a field blank means you do not set any requests or limits.

   {{< notice note >}}

   The limit can never be lower than the request.

   {{</ notice >}} 

5. Click **OK** to finish setting quotas.

## See Also

[Project Quotas](../project-quotas/)

[Container Limit Ranges](../../project-administration/container-limit-ranges/)