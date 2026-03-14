---
title: "Manage Alerts with Alertmanager in Kube AI Hub"
keywords: 'Kubernetes, Prometheus, Alertmanager, alerting'
description: 'Learn how to manage alerts with Alertmanager in Kube AI Hub.'
linkTitle: "Alertmanager in Kube AI Hub"
weight: 8510
---

Alertmanager handles alerts sent by client applications such as the Prometheus server. It takes care of deduplicating, grouping, and routing them to the correct receiver integration such as email, PagerDuty, or OpsGenie. It also takes care of silencing and inhibition of alerts. For more details, refer to the [Alertmanager guide](https://prometheus.io/docs/alerting/latest/alertmanager/).

Kube AI Hub has been using Prometheus as its monitoring service's backend from the first release. Starting from v3.0, Kube AI Hub adds Alertmanager to its monitoring stack to manage alerts sent from Prometheus as well as other components such as [kube-events](https://github.com/kubesphere/kube-events) and kube-auditing.

![alertmanager-kubesphere](/images/docs/v3.x/cluster-administration/cluster-wide-alerting-and-notification/alertmanager-in-kubesphere/alertmanager-in-kubesphere.svg)

## Use Alertmanager to Manage Prometheus Alerts

Alerting with Prometheus is separated into two parts. Alerting rules in Prometheus servers send alerts to an Alertmanager. The Alertmanager then manages those alerts, including silencing, inhibition, aggregation and sending out notifications via methods such as emails, on-call notification systems, and chat platforms.

Starting from v3.0, Kube AI Hub adds popular alert rules in the open source community to its Prometheus offering as built-in alert rules. And by default Prometheus in Kube AI Hub v3.4 evaluates these built-in alert rules continuously and then sends alerts to Alertmanager.

## Use Alertmanager to Manage Kubernetes Event Alerts

Alertmanager can be used to manage alerts sent from sources other than Prometheus. In Kube AI Hub v3.0 and above, users can use it to manage alerts triggered by Kubernetes events. For more details, refer to [kube-events](https://github.com/kubesphere/kube-events).

## Use Alertmanager to Manage Kube AI Hub Auditing Alerts

In Kube AI Hub v3.0 and above, users can also use Alertmanager to manage alerts triggered by Kubernetes/Kube AI Hub auditing events.

## Receive Notifications for Alertmanager Alerts

Generally, to receive notifications for Alertmanager alerts, users have to edit Alertmanager's configuration files manually to configure receiver settings such as Email and Slack.

This is not convenient for Kubernetes users and it breaks the multi-tenant principle/architecture of Kube AI Hub. More specifically, alerts triggered by workloads in different namespaces, which should have been sent to different tenants, might be sent to the same tenant.

To use Alertmanager to manage alerts on the platform, Kube AI Hub offers [Notification Manager](https://github.com/kubesphere/notification-manager), a Kubernetes native notification management tool, which is completely open source. It complies with the multi-tenancy principle, providing user-friendly experiences of Kubernetes notifications. It's installed by default in Kube AI Hub v3.0 and above.

For more details about using Notification Manager to receive Alertmanager notifications, refer to [Notification Manager](https://github.com/kubesphere/notification-manager).