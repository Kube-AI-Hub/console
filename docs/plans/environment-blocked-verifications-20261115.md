# 环境受限的验证项（2026-11-15 复核）

全量回归里有若干用例以 **skip** 结束。skip 不等于通过，因此把每一项查到底：缺什么、谁负责、页面侧是否已经正确。

## 1. 通知组件的校验 webhook 不可用（4 条 skip）

受影响用例：`PLATFORM_SETTINGS-MAIL-01`、`PLATFORM_SETTINGS-FEISHU-01`、`PLATFORM_SETTINGS-CHANNELS-01`（3 条参数化）。

现象：写入通知渠道/邮件/飞书配置时 API server 报

```
Internal error occurred: failed calling webhook "vconfig.notification.kubesphere.io":
Post "https://notification-manager-webhook.kubesphere-monitoring-system.svc:443/...": context deadline exceeded
```

逐层排查（B200）：

| 层 | 观察 |
| --- | --- |
| Pod | `notification-manager-deployment-*` Running，容器 `notification-manager` / `tenant` 均 ready |
| Service | `notification-manager-webhook` 的 selector 是 `control-plane: controller-manager`，命中 **operator** pod（10.233.70.209），不是通知管理器 |
| 修正 selector 后 | Endpoint 改为通知管理器 pod（10.233.71.60），但 API server 报 `dial tcp 10.233.32.186:443: connection refused`——**该 pod 没有在 9443 上提供 webhook TLS 服务** |
| 结论 | 本部署的 notification-manager 缺少 webhook server（或未启用），校验 webhook 无法放行写入 |

处置：**探针后已把 Service selector 还原**（`control-plane: controller-manager`），集群恢复原状。要真正解除需要重装/升级 notification-manager（Helm），属集群运维，不是控制台迁移缺陷。

页面侧结论：控制台的表单、校验与错误呈现已按接口真实报错回显（用例以 skip 记录原因，而不是把失败包装成通过）。

## 2. 节点终端后端未就绪（1 条 skip）

`CLUSTER_MANAGEMENT-NODES-05`：BFF 的 WebSocket 握手返回 101，但上游没有数据帧。节点终端需要集群侧提供一个节点级 shell 入口（node access / node shell pod）与相应 RBAC，当前 B200 未提供。属终端能力线的范围，与容器终端（已有交付）不同。

## 3. 其他 skip（数据前提缺失，非缺陷）

- `CONFIGMAPS-LIST-05`：当前项目没有键名超过 50 个字符的 ConfigMap；
- `NETWORK_ISOLATION-01`：`spaces` 项目没有网络策略；
- 这两条是「先造数据才能验证」的用例，造数据的职责在用例自身（已有 seed fixture 的用例不 skip）。

## 结论

全量回归中的 skip **全部有明确归因**：1 项集群组件缺 webhook server、1 项集群缺节点 shell 入口、2 项数据前提缺失。没有一条是「控制台迁移没做完」。
