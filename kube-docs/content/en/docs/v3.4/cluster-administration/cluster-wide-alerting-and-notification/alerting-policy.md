---
title: "Alerting Rule Groups (Node Level)"
keywords: 'Kube AI Hub, Kubernetes, Node, Alerting, Rule Group, Policy, Notification'
description: 'Learn how to set alerting rule groups for nodes.'
linkTitle: "Alerting Rule Groups (Node Level)"
weight: 8530
---

Kube AI Hub provides alerting rules for nodes with grouping support, allowing users to organize similar rules into a single rule group. Once the conditions defined in these rules are met, alerts will be triggered. This tutorial demonstrates how to create a rule group and alerting rules for nodes in a cluster.

Kube AI Hub also has built-in rule groups. On the **Built-in Rule Groups** tab, you can click any rule group to see all the rules it contains, and click any rule to view its details. Note that built-in rules cannot be directly deleted from the console, but their parameters can be adjusted by editing.

## Prerequisites

- You have enabled [Kube AI Hub Alerting](../../../pluggable-components/alerting/).
- To receive alert notifications, you must configure a [notification channel](../../../cluster-administration/platform-settings/notification-management/configure-email/) beforehand.
- You need to create a user (`cluster-admin`) and grant it the `clusters-admin` role. For more information, see [Create Workspaces, Projects, Users and Roles](../../../quick-start/create-workspace-and-project/#step-4-create-a-role).

## Create a Rule Group and Alerting Rules

1. Log in to the console as `cluster-admin`. Click **Platform** in the upper-left corner, and then click **Cluster Management**.

2. Go to **Rule Groups** under **Monitoring & Alerting**, and then click **Create**.

3. In the displayed dialog box, provide the basic information as follows, then click **Next** to continue.

   - **Name**: A concise name as its unique identifier, such as `node-rules`.
   - **Alias**: Helps you identify the rule group more easily.
   - **Check Interval (h m s)**: The interval between metric checks. The default is 1 minute.
   - **Description**: A brief introduction to the rule group.

4. On the **Alerting Rules** tab, click **Add Alerting Rule** to add rules to the group.

5. On the **Rule Settings** tab of an alerting rule, you can use the rule template or create a custom rule. To use the template, set the following parameters:

   - **Rule Name**: A concise name as its unique identifier, such as `node1-cpu-rule`.
   - **Monitoring Target**: Select at least one cluster node to monitor.
   - **Trigger Condition**:
     - **Monitoring Metric**: Click the drop-down list to select the desired metric.
     - **Operator**: Click the drop-down list to select an operator (`>`, `>=`, `<`, `<=`).
     - **Threshold**: Once the selected metric reaches this threshold, the alerting rule status becomes **Pending**.
     - **Duration**: If the threshold condition persists for this duration, the alerting rule status becomes **Firing**.
     - **Severity**: Available values are **Warning**, **Important**, and **Critical**, indicating the severity of the alert.

   {{< notice note >}}

   You can also create a custom rule by entering a PromQL expression directly in the **Monitoring Metric** field (autocompletion supported). For more information, see [Querying Prometheus](https://prometheus.io/docs/prometheus/latest/querying/basics/).

   {{</ notice >}}

6. On the **Message Settings** tab of the alerting rule, configure the notification message.

   - **Summary**: The summary shown in alert notifications when this rule fires.
   - **Details**: Custom details describing the alert notification.

7. Click ✔ to finish configuring the rule (you can add multiple alerting rules to one group). After all rules are configured, click **Create** to create the rule group.

## Edit a Rule Group

To edit a rule group after it is created, locate it on the **Rule Groups** page and click the action icon on the right. The available actions are:

1. **Edit Info**: Edit the rule group's basic information following the same steps as creation. Click **OK** to save changes.
2. **Delete**: Delete the rule group.
3. **Disable**: Disable the rule group so it no longer triggers alerts.
4. **Edit Alerting Rules**: Add, remove, modify, or disable individual alerting rules within the group.

## View a Rule Group

On the **Rule Groups** page, click the name of a rule group to view its details, including the list of alerting rules and triggered alert records.

Enter a keyword in the search box to filter alerting rules. Click any alerting rule to view the rule expression generated from the template you selected.

**Alert Messages** displays the custom notification content configured in the message settings.
