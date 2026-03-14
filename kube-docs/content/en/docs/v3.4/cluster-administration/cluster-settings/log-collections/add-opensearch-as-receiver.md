---
title: "Add OpenSearch as a Log Receiver"
keywords: "Kubernetes, Logs, OpenSearch, Pod, Container, Fluentbit, Output"
description: "Learn how to add OpenSearch to receive container logs, resource events, or audit logs."
linkTitle: "Add OpenSearch as a Log Receiver"
weight: 8625
---

[OpenSearch](https://opensearch.org/) is a distributed, community-driven, and 100% open-source search and analytics suite licensed under Apache 2.0. It can be used for real-time application monitoring, log analysis, website search, and more.

OpenSearch is backed by the Apache Lucene search library and supports a range of search and analysis features such as k-Nearest Neighbors (KNN) search, SQL, anomaly detection, Machine Learning Commons, Trace Analytics, full-text search, and more.

OpenSearch provides a highly scalable system, allowing users to explore their data easily through integrated visualization tools.

Starting from Kube AI Hub v3.4.0, OpenSearch v1 and v2 are integrated into it and set as the default backend storage for the `logging`, `events`, and `auditing` components.

## Prerequisites

- You need a user with cluster management permissions. For example, you can log in to the console directly with the `admin` user or create a role with cluster management permissions and assign it to a user.

- Before adding a log receiver, you need to enable the `logging`, `events`, or `auditing` components. For more information, see [Enable Pluggable Components](../../../../pluggable-components/). This tutorial enables `logging` as an example.

## Use OpenSearch as a Log Receiver

In Kube AI Hub v3.4.0 and later, OpenSearch is the default backend storage for `logging`, `events`, or `auditing` components. Configure as follows:

```shell
$ kubectl edit cc -n kubesphere-system ks-installer

apiVersion: installer.kubesphere.io/v1alpha1
kind: ClusterConfiguration
metadata:
  name: ks-installer
  namespace: kubesphere-system
spec:
  common:
    opensearch:   # Storage backend for logging, events, and auditing.
      enabled: true
      logMaxAge: 7             # Log retention time in built-in Opensearch. It is 7 days by default.
      opensearchPrefix: whizard      # The string making up index names. The index name will be formatted as ks-<opensearchPrefix>-logging.
```

For Kube AI Hub versions below `v3.4.0`, please [upgrade](https://github.com/kubesphere/ks-installer/tree/release-3.4#upgrade) first.

### Enable Logging via the Console and Use OpenSearch as the Backend Storage

1. Log in to the console as the `admin` user, click **Platform** in the upper left corner, and select **Cluster Management**.

2. Click **CRDs**, enter `clusterconfiguration` in the search bar, and click the search result to view its detailed page.

3. Under **Custom Resources**, click the action icon on the right side of `ks-installer` and select **Edit YAML**.

4. In the YAML file, search for `logging`, change the `enabled` from `false` to `true`. After that, click **OK** in the lower-right corner to save the configuration.

```yaml
common:
  opensearch:
    enabled: true

logging:
  enabled: true
```

## Change Log Storage to External OpenSearch and Disable Internal OpenSearch

If you are using Kube AI Hub's internal OpenSearch and want to change it to your external OpenSearch, follow these steps:

1. Run the following command to update the cluster configuration:

```shell
kubectl edit cc -n kubesphere-system ks-installer
```

2. Set `opensearch:externalOpensearchHost` to the address of your external OpenSearch and set `opensearch:externalOpensearchPort` to its port. Comment or delete the `status:logging` field. Here is an example:

```yaml
apiVersion: installer.kubesphere.io/v1alpha1
kind: ClusterConfiguration
metadata:
  name: ks-installer
  namespace: kubesphere-system
spec:
  common:
    opensearch:
      enabled: true
      externalOpensearchHost: ""
      externalOpensearchPort: ""
      dashboard:
        enabled: false
status:
  # logging:
  #  enabledTime: 2023-08-21T21:05:13UTC
  #  status: enabled
```

If you want to use the visualization tools of `OpenSearch`, set `opensearch.dashboard.enabled` to `true`.

3. Run the following command to restart `ks-installer`.

```shell
kubectl rollout restart deploy -n kubesphere-system ks-installer
```

4. Run the following command to delete the internal OpenSearch. Make sure you have backed up the data in it.

```shell
helm uninstall opensearch-master -n kubesphere-logging-system && helm uninstall opensearch-data -n kubesphere-logging-system && helm uninstall opensearch-logging-curator -n kubesphere-logging-system
```

## Query Logs in Kube AI Hub

1. All users can use the log query feature. Log in with any account, click the toolbox icon in the lower-right corner, and select **Log Query** from the pop-up menu.

2. In the pop-up window, you can see the time histogram of log counts, the cluster dropdown list, and the log search bar.

3. Click the search bar and enter search conditions. You can search logs by message, workspace, project, resource type, resource name, reason, category, or time range (for example, enter the time range: last 10 minutes to search for logs in the last 10 minutes). Alternatively, click a bar in the time histogram and Kube AI Hub will display logs within that bar's time range.
