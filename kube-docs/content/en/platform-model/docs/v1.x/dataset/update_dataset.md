---
title: "Update Datasets"
keywords: "Industry AI Model Platform, update dataset, edit dataset, dataset settings, delete dataset"
description: "How to edit dataset files, modify repository settings, and delete datasets."
linkTitle: "Update Datasets"
weight: 2040
---

## Edit Dataset Files

### Local Editing (Git / SDK)

Clone the dataset repository locally via Git or Python SDK, make changes to files, then push the updates to the remote.

Using Git:

```bash
# Clone the repository
git lfs install
git clone https://<username>:<access-token>@<platform-host>/<namespace>/<dataset-name>
cd <dataset-name>

# Edit files, then commit and push
git add .
git commit -m "update dataset files"
git push
```

Using Python SDK:

```python
from pycsghub.repository import Repository

repo = Repository(
    repo_id="<namespace>/<dataset-name>",
    repo_type="dataset",
    endpoint="https://<platform-host>",
    token="<access-token>"
)

repo.clone()

# Edit files in the local repository, then push
repo.push()
```

### Web Online Editing

1. Navigate to the dataset detail page and switch to the **Files** tab
2. Click the file name you want to edit to open the file viewer
3. Click the **Edit** button to enter online editing mode
4. Modify the file content, enter a commit message, and click **Commit** to save

{{< notice tip >}}
Web online editing is suitable for modifying text files such as README.md or configuration files. For large data file updates, use Git or CLI instead.
{{</ notice >}}

## Repository Settings

Navigate to the dataset detail page and click the **Settings** tab to modify repository configuration.

### Non-modifiable Fields

The following fields cannot be changed after creation:

| Field | Description |
|-------|-------------|
| **Dataset Name** | The English identifier of the dataset; fixed once created |
| **Visibility** | Defaults to private; the platform does not currently support self-service visibility changes via the UI |

### Modifiable Fields

| Field | Description |
|-------|-------------|
| **Nickname** | Update the friendly display name for the dataset |
| **Description** | Update the text description of the dataset |
| **Task Tags** | Add or modify task type tags (e.g., `text-classification`, `question-answering`) |
| **Industry Tags** | Add or modify industry domain tags (e.g., finance, healthcare, education) |

## Delete a Dataset

{{< notice warning >}}
Deleting a dataset is irreversible. All data files and version history will be permanently removed and cannot be recovered.
{{</ notice >}}

To delete a dataset:

1. Navigate to the dataset detail page and click the **Settings** tab
2. Scroll to the **Delete Dataset** section at the bottom of the page
3. Type the full name of the dataset in the confirmation input field
4. Click the **Delete** button to confirm

## Related Documentation

- [Dataset Card](./dataset_card)
- [Upload Datasets](./upload_dataset)
