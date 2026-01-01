---
title: "Uninstall Kube AI Hub and Kubernetes"
keywords: 'Kubernetes, Kube AI Hub, uninstalling, remove-cluster'
description: 'Remove Kube AI Hub and Kubernetes from your machines.'
linkTitle: "Uninstall Kube AI Hub and Kubernetes"
weight: 3700
---


Uninstalling Kube AI Hub and Kubernetes means they will be removed from your machine. This operation is irreversible and does not have any backup. Please be cautious with the operation.

To delete your cluster, execute the following command.

- If you installed Kube AI Hub with the quickstart ([all-in-one](../../quick-start/all-in-one-on-linux/)):

    ```bash
    ./kk delete cluster
    ```

- If you installed Kube AI Hub with the advanced mode ([created with a configuration file](../introduction/multioverview/#step-3-create-a-cluster)):

    ```bash
    ./kk delete cluster [-f config-sample.yaml]
    ```

