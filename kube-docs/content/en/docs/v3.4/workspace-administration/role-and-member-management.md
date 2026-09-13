---
title: "Tenant (Workspace) Role and Member Management"
keywords: "Kubernetes, tenant (workspace), Kube AI Hub, multitenancy"
description: "Customize a tenant (workspace) role and grant it to tenants."
linkTitle: "Tenant (Workspace) Role and Member Management"
weight: 9400
---

This tutorial demonstrates how to manage roles and members in a tenant (workspace).

## Prerequisites

At least one tenant (workspace) has been created, such as `demo-workspace`. Besides, you need a user of the `workspace-admin` role (for example, `ws-admin`) at the tenant (workspace) level. For more information, see [Create Tenants (Workspaces), Projects, Users and Roles](../../quick-start/create-workspace-and-project/).

{{< notice note >}} 

The actual role name follows a naming convention: `workspace name-role name`. For example, for a tenant (workspace) named `demo-workspace`, the actual role name of the role `admin` is `demo-workspace-admin`.

{{</ notice >}} 

## Built-in Roles

In **Tenant (Workspace) Roles**, there are four available built-in roles. Built-in roles are created automatically by Kube AI Hub when a tenant (workspace) is created and they cannot be edited or deleted. You can only view permissions included in a built-in role or assign it to a user.

| Built-in Roles     | Description                                                  |
| ------------------ | ------------------------------------------------------------ |
| `workspace-viewer` | Tenant (Workspace) viewer who can view all resources in the tenant (workspace). |
| `workspace-self-provisioner`   | Tenant (Workspace) regular member who can view tenant (workspace) settings, manage app templates, and create projects and DevOps projects. |
| `workspace-regular` | Tenant (Workspace) regular member who can view tenant (workspace) settings. |
| `workspace-admin`   | Tenant (Workspace) administrator who has full control over all resources in the tenant (workspace). |

To view the permissions that a role contains:

1. Log in to the console as `ws-admin`. In **Tenant (Workspace) Roles**, click a role (for example, `workspace-admin`) and you can see role details.

2. Click the **Authorized Users** tab to see all the users that are granted the role.

## Create a Tenant (Workspace) Role

1. Navigate to **Tenant (Workspace) Roles** under **Tenant (Workspace) Settings**.

2. In **Tenant (Workspace) Roles**, click **Create** and set a role **Name** (for example, `demo-project-admin`). Click **Edit Permissions** to continue.

3. In the pop-up window, permissions are categorized into different **Modules**. In this example, click **Project Management** and select **Project Creation**, **Project Management**, and **Project Viewing** for this role. Click **OK** to finish creating the role.

   {{< notice note >}} 

   **Depends on** means the major permission (the one listed after **Depends on**) needs to be selected first so that the affiliated permission can be assigned.

   {{</ notice >}} 

4. Newly-created roles will be listed in **Tenant (Workspace) Roles**. To edit the information or permissions, or delete an existing role, click <img src="/images/docs/v3.x/workspace-administration/role-and-member-management/three-dots.png" height="20px" alt="icon"> on the right.

## Invite a New Member

1. Navigate to **Tenant (Workspace) Members** under **Tenant (Workspace) Settings**, and click **Invite**.
2. Invite a user to the tenant (workspace) by clicking <img src="/images/docs/v3.x/workspace-administration/role-and-member-management/add.png" height="20px" alt="icon"> on the right of it and assign a role to it.

3. After you add the user to the tenant (workspace), click **OK**. In **Tenant (Workspace) Members**, you can see the user in the list.

4. To edit the role of an existing user or remove the user from the tenant (workspace), click <img src="/images/docs/v3.x/workspace-administration/role-and-member-management/three-dots.png" height="20px" alt="icon"> on the right and select the corresponding operation.