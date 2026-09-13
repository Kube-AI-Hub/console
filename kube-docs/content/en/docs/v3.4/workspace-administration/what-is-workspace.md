---
title: "Tenant (Workspace) Overview"
keywords: "Kubernetes, Kube AI Hub, tenant (workspace)"
description: "Understand the concept of tenants (workspaces) in Kube AI Hub and learn how to create and delete a tenant (workspace)."

linkTitle: "Tenant (Workspace) Overview"
weight: 9100
---

A tenant (workspace) is a logical unit to organize your [projects](../../project-administration/) and [DevOps projects](../../devops-user-guide/) and manage [app templates](../upload-helm-based-application/) and app repositories. It is the place for you to control resource access and share resources within your team in a secure way. The Console label is **Tenant (Workspace)**; the API kind remains Workspace and the route remains `/workspaces`.

It is a best practice to create a new tenant (workspace) for business teams (excluding cluster administrators). The same user can work in multiple tenants (workspaces), and a tenant (workspace) can grant access to multiple users.

The Industry AI Model Platform shares this tenant. Signed-in users start in the **public tenant** `public`. Do not invite people into `public`, and do not use `system-workspace` as the Hub default. Create enterprises, invite members, and set quotas in the Console; the Hub only switches the current tenant and writes into it. See [Tenants and Compute Placement](/platform-model/docs/v1.x/tenancy/).

This tutorial demonstrates how to create and delete a tenant (workspace).

## Prerequisites

You have a user granted the role of `workspaces-manager`, such as `ws-manager` in [Create Tenants (Workspaces), Projects, Users and Roles](../../quick-start/create-workspace-and-project/).

## Create a Tenant (Workspace)

1. Log in to the web console of Kube AI Hub as `ws-manager`. Click **Platform** on the upper-left corner, and then select **Access Control**. On the **Tenants (Workspaces)** page, click **Create**.


2. For single-node cluster, on the **Basic Information** page, specify a name for the tenant (workspace) and select an administrator from the drop-down list. Click **Create**.

   - **Name**: Set a name for the tenant (workspace) which serves as a unique identifier.
   - **Alias**: An alias name for the tenant (workspace).
   - **Administrator**: User that administers the tenant (workspace).
   - **Description**: A brief introduction of the tenant (workspace).

   For multi-node cluster, after the basic information about the tenant (workspace) is set, click **Next** to continue. On the **Cluster Settings** page, select clusters to be used in the tenant (workspace), and then click **Create**.

3. The tenant (workspace) is displayed in the tenant (workspace) list after it is created.

4. Click the tenant (workspace) and you can see resource status of the tenant (workspace) on the **Overview** page.

## Delete a Tenant (Workspace)

In Kube AI Hub, you use a tenant (workspace) to group and manage different projects, which means the lifecycle of a project is dependent on the tenant (workspace). More specifically, all the projects and related resources in a tenant (workspace) will be deleted if the tenant (workspace) is deleted.

Before you delete a tenant (workspace), decide whether you want to unbind some key projects.

### Unbind projects before deletion

To delete a tenant (workspace) while preserving some projects in it, run the following command first:

```bash
kubectl label ns <namespace> kubesphere.io/workspace- && kubectl patch ns <namespace>   -p '{"metadata":{"ownerReferences":[]}}' --type=merge
```

{{< notice note >}} 

The command above removes labels associated with the tenant (workspace) and removes ownerReferences. After that, you can [assign an unbound project to a new tenant (workspace)](../../faq/access-control/add-kubernetes-namespace-to-kubesphere-workspace/).

{{</ notice >}} 

### Delete a tenant (workspace) on the console

After you unbind necessary projects from a tenant (workspace), perform the following steps to delete a tenant (workspace).

{{< notice note >}} 

Be extremely cautious about deleting a tenant (workspace) if you use kubectl to delete tenant (workspace) resource objects directly.

{{</ notice >}} 

1. In your tenant (workspace), go to **Basic Information** under **Tenant (Workspace) Settings**. On the **Basic Information** page, you can see the general information of the tenant (workspace), such as the number of projects and members.

   {{< notice note >}}

   On this page, you can click **Edit Information** to change the basic information of the tenant (workspace) (excluding the tenant (workspace) name) and turn on/off [Network Isolation](../../workspace-administration/workspace-network-isolation/).

   {{</ notice >}} 

2. To delete the tenant (workspace), click **Manage > Delete Tenant (Workspace)**. In the displayed dialog box, enter the name of the tenant (workspace), and then click **OK**.

   {{< notice warning >}}

   A tenant (workspace) cannot be restored after it is deleted and resources in the tenant (workspace) will also be removed.

   {{</ notice >}}

