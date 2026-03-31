---
title: "Create Dataset"
keywords: "Industry AI Model Platform, create dataset, new dataset, dataset repository"
description: "How to create a dataset repository on the platform, including entry point, form parameters, and next steps."
linkTitle: "Create Dataset"
weight: 2020
---

## Entry Point

Click your profile avatar in the top-right corner of the page, then select **New Dataset** from the dropdown menu to open the dataset creation page.

## Fill in Dataset Information

Complete the following fields on the creation page, then click the **Create Dataset** button:

| Parameter | Required | Description |
|-----------|----------|-------------|
| **Owner** | Yes | Defaults to the current logged-in user. If you belong to an organization, you can select it as the owner from the dropdown list |
| **Dataset English Name** | Yes | 2–64 characters. Must start with a letter, end with a letter or number, and may only contain letters, numbers, hyphens (`-`), underscores (`_`), and dots (`.`). Special characters cannot appear consecutively |
| **Nickname** | No | Optional friendly display name; supports Chinese and other characters |
| **License** | Yes | Select the open-source license type for the dataset |
| **Description** | No | A brief text description of the dataset |
| **Visibility** | Yes | Defaults to **Private**. Public datasets require administrator approval before taking effect |

{{< notice note >}}
The dataset English name cannot be changed after creation. Please choose it carefully.
{{</ notice >}}

## Complete the Dataset Card

After the dataset is created, you will be redirected to the dataset detail page. It is recommended to edit the `README.md` file in the repository root following the [Dataset Card](./dataset_card) conventions, adding detailed descriptions, data structure, usage instructions, and more.

## View Dataset List

Once created, you can view datasets in the following ways:

- **Personal datasets**: Click your avatar, select **Profile**, and switch to the **Datasets** tab to see your datasets
- **Organization datasets**: Navigate to the organization page and switch to the **Datasets** tab
- **All datasets**: Use the **Datasets** entry in the top navigation bar to browse all public datasets on the platform

## Related Documentation

- [Dataset Card](./dataset_card)
- [Upload Datasets](./upload_dataset)
