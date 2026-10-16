---
title: "Organizations"
keywords: "Industry AI Model Platform, organizations, Organization, member collaboration, organization API key"
description: "An organization is a container for shared assets and member permissions: a repository owner can be an organization, members get read/write by role, and the organization has its own API key."
linkTitle: "Organizations"
weight: 8200
---

## What is an organization

An organization is a **container for shared assets and member permissions**. When creating a repository the owner can be an individual or an organization you belong to; members of the organization get read/write access by role.

It suits teams sharing models, datasets, and code: assets belong to the organization rather than to an individual, and permissions follow roles as membership changes.

## Creating an organization

Go to `/organizations/new`.

| Field | Description |
|-------|-------------|
| Namespace | **Globally unique, cannot be changed after creation** |
| Alias | A Chinese or friendly name |
| Type | Organization type |
| Homepage | Organization homepage address |
| Avatar | Uploaded first; the create request carries only the image URL |
| Tenant | Read-only, showing the current tenant |

The creator becomes the organization's initial administrator. A duplicate name is rejected by the API with an in-place message.

The **tenant** comes from the current tenant; it is not a selectable Workspace picker. Once an organization belongs to a tenant it cannot be re-bound across tenants.

## Organization home

Opening `/organizations/:id` shows the organization's details and the models, datasets, and code repositories it owns.

From the organization home you can reach **Members** and **Organization API keys**.

## Members and roles

The members page (`/organizations/:id/members`) invites members and assigns roles. Roles decide write access:

| Role | Description |
|------|-------------|
| Administrator | Change organization details, manage members, manage all assets |
| Member | Read and write assets according to the granted role |

A non-administrator sees the members page read-only.

## Organization API keys

An organization has its own API key for automation that acts **on behalf of the organization** rather than a person. The plain text is likewise shown once and can only be revoked afterwards.

## Visibility

An organization belongs to the current tenant. Its repositories are open to members of the same tenant according to each repository's own visibility; other tenants cannot see them.

## Related operations

- [Account settings](../account/)
- [Profile](../profile/)
- [Tenant and compute ownership](../tenancy/)
