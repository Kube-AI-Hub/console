# 重新部署（L3）

[子模块需求](./_index.md)

## 概述

详情页的「重新部署」：点击后立即出现加载对话框，完成后关闭并刷新详情。

## 用户故事

### US1 - 重启卡住的部署 (Priority: P1)

作为 **项目运维**，我希望 **一键滚动重启**，以便 **不用去命令行打注解**。

**Independent Test**：点「重新部署」后核对 Pod 模板出现 `restartedAt`。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-01** — 已知在一个部署详情，当点「重新部署」，则出现加载对话框，成功后 Pod 模板带 `restartedAt` 注解。

## 设计目标

落实「点了就有反应」：写操作先给反馈，不等结果。

## 约束与边界

- 用 merge patch 只写 `spec.template.metadata.annotations["kubectl.kubernetes.io/restartedAt"]`。
- 仅部署、有状态副本集、守护进程集提供。

## UI 交互设计

按钮在详情操作区；请求期间加载对话框不可关闭。

## 文案与校验

- 按钮文案「重新部署」；加载对话框标题同名并带对象名。

## 边界情况

- 失败时关闭加载框并显示错误，对象不变。

## 明确不做

- 不做暂停/恢复滚动。

## 假设

- 控制器会因模板变化自己滚动，页面不需要等 Pod 就绪。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-01** — 打注解并触发滚动。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-02** — 请求期间显示加载态。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-01** — 成功后 revision 递增。
