---
title: "Create Model Repository"
keywords: "Industry AI Model Platform, create model, model repository, new model"
description: "How to create a model repository on the platform, including form field descriptions and post-creation steps."
linkTitle: "Create Model Repository"
weight: 1020
---

## Access the Creation Page

After logging in, click your profile avatar in the top-right corner and select **New Model** from the dropdown menu to navigate to the model creation page. You can also access it directly at:

```text
https://<platform-host>/models/new
```

## Fill in Model Information

On the model creation page, fill in the following form fields:

| Parameter | Required | Description |
|-----------|----------|-------------|
| Owner | Yes | Defaults to the current user. If the user belongs to an organization, the organization can be selected from the dropdown |
| Model English Name | Yes | Unique identifier for the model repository. Must be 2-64 characters, start with a letter, end with a letter or number, and may only contain letters, numbers, hyphens (`-`), underscores (`_`), and dots (`.`). Special characters cannot appear consecutively |
| Nickname | No | Optional display name for a friendlier presentation of the model name |
| License | Yes | Select the open-source license type for the model, e.g., Apache-2.0, MIT, GPL-3.0, etc. |
| Description | No | A brief text description of the model to help other users understand its purpose |
| Visibility | Yes | **Public**: anyone can access the model repository; **Private**: only authorized users can access it |

After filling in the form, click the **Create Model** button to submit.

{{< notice note >}}
The Model English Name (repository name) cannot be changed after creation. Choose it carefully.
{{</ notice >}}

## Post-Creation Steps

After the model repository is successfully created, the system automatically generates a `README.md` file. It is recommended to edit this file following the [Model Card](./model_card) conventions, adding detailed descriptions, usage examples, and metadata tags.

After creation, you can proceed with the following operations:

- [Upload model files](./upload_model)
- [Update model information](./update_model)
- [Download models](./download_models)

## View Model List

The platform provides several ways to browse and find models:

- **Model Hub**: Visit `https://<platform-host>/models` to view all public models. Supports filtering by task type, framework, license, and other criteria.
- **Personal Models**: Click your profile avatar to access your personal page and view all model repositories you created under the **Models** tab.
- **Organization Models**: Navigate to the organization page and view all model repositories under the **Models** tab.
