---
title: "Account Settings"
keywords: "Industry AI Model Platform, account settings, access token, API key, SSH key, profile"
description: "Account settings maintain your sign-in identity and access credentials: profile, access tokens, platform API keys, and SSH public keys."
linkTitle: "Account Settings"
weight: 8100
icon: "/images/docs/platform-model/account.svg"
---

## Overview

Account settings maintain your **sign-in identity and access credentials**. Inference API calls, Git clones, and passwordless sign-in to development instances all depend on them.

The four sidebar items are independent: changing one does not affect credentials already issued by another.

| Item | Path | Purpose |
|------|------|---------|
| Profile | `/settings/profile` | Change nickname, email, avatar, and other basics |
| Access tokens | `/settings/access-token` | Call platform APIs, SDKs, and command line tools |
| API keys | `/settings/api-keys` | For automation and third-party systems |
| SSH public keys | `/settings/ssh-keys` | Passwordless Git clones and development instance sign-in |

Entry: click the avatar in the top right and choose **Account settings**.

## Profile

Change your nickname, email, and avatar. Email format and username rules are validated on save, with in-place messages when they fail.

Changing your profile **does not affect** already-issued access tokens, API keys, or SSH public keys.

## Access tokens

An access token is used to:

- Call the platform's inference API (private inference instances require authentication).
- Access repositories with `csghub-cli`, the Python SDK, or the Git command line.
- Act on your behalf in scripts and CI.

The plain text is **shown only once** after creation; after closing the page only the list and revoke actions remain. Copy it immediately and store it safely.

## API keys

A platform API key lets **automation and third-party systems** call platform interfaces on your behalf.

Like access tokens, the plain text is shown only once. The list shows existing keys and lets you revoke ones no longer in use.

## SSH public keys

Register your machine's SSH public key with the platform to:

- Clone model, dataset, and code repositories with `git clone git@...` without a password.
- Sign in to development instances (Notebook) without a password.

Generate a key locally:

```
ssh-keygen -t ed25519 -C "your_email@example.com"
cat ~/.ssh/id_ed25519.pub
```

Paste the public key into the page and save. Never upload the private key.

## Related operations

- [Profile](../profile/)
- [Organizations](../orgs/)
- [Download models](../model/download_models)
- [Development environment](../inferencefinetune/notebook/notebook_intro)
