# 日志收集 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/logging.md)

## 概述

一个标签的读写：`logging.kubesphere.io/logsidecar-injection` 在项目命名空间上。

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-01
- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-02

## 设计目标与非目标

目标：开关只动一个标签；关闭有确认；三态可区分。

非目标：日志查询、日志后端配置、按工作负载筛选。

## 关键约束

- 读：`/kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>`（与其它项目页同源）。
- 写：`/api/v1/namespaces/<ns>`，`application/merge-patch+json`，只含 `metadata.labels`。
- 集群能力：`/kapis/cluster.kubesphere.io/v1alpha1/clusters/<id>` 的 `status.configz.logging`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-LOGGING-01 — 开关就是命名空间上的一个标签

**为什么**：老 console 的实现就是这样：`isOpen = labels['logging.kubesphere.io/logsidecar-injection'] === 'enabled'`，切换时 patch 该标签。注入器读的也是它。任何「另建一份状态」的做法都会与注入器不一致，而这种不一致只在日志缺失时才被发现。

**被否方案**：写一个项目级 CR 记录意图。多一份事实源，且注入器不读它。

**何时重新考虑**：平台改为用 CR 表达日志收集策略时。

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-LOGGING-02 — merge patch，不 PUT

**为什么**：命名空间上还有企业空间归属等标签（`kubesphere.io/workspace`）。PUT 整对象会把它们一起替换，**可能把项目从企业空间里移除**——网络隔离开关踩过同一类风险。

**被否方案**：PUT 整对象。见上。

**何时重新考虑**：需要原子地改多个字段时。

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-LOGGING-03 — 关闭前确认，且写在面板内

**为什么**：关闭会移除边车、重启容器组。一个开关看起来无害，代价却不小。确认用面板内展开而不是弹窗：信息与开关在同一屏，取消后不丢失上下文。

**被否方案**：直接切换 + 事后提示。破坏性操作不应有「事后」。

**何时重新考虑**：平台提供不重启的摘除方式时。

## 系统现状

老 console 的项目设置 → 日志收集是一个开关（`Switch`）+ 说明 + 关闭确认弹窗，并在集群未启用日志模块或该命名空间被列入 `disabledLoggingSidecarNamespace` 时整块不渲染。本次迁移保留开关与确认；把「模块缺失」从「不渲染」改为「禁用并说明」——不渲染会让读者以为功能不存在。

## 仓库落点

- 页面：`apps/console-next/src/pages/settings/LogCollectionPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/logging/`
- 区域注册：`areas/registry.ts`（settings 增加 logging）
- 接口：`packages/api-client/src/iam.ts` 的 `logCollectionApi` / `LOG_COLLECTION_LABEL`
- 文案：`packages/locales/src/index.ts`（`logCollection.*`）

## 对外契约

| 用途 | 路径 | 方法 |
| --- | --- | --- |
| 读状态 | /kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns> | GET |
| 写开关 | /api/v1/namespaces/<ns> | PATCH（merge-patch+json） |
| 集群能力 | /kapis/cluster.kubesphere.io/v1alpha1/clusters/<id> | GET |

## 不变量

1. 开关只写 `logging.kubesphere.io/logsidecar-injection` 一个标签。
2. 标签缺失 = 未配置；`disabled` = 已关闭；两者分开显示。
3. 关闭必须先确认。
4. 写入失败不做乐观更新，开关保持实际状态。

## 已知坑

- **是标签不是注解**：写错位置页面上看起来一样，但注入器不读，表现为「开了却没日志」。
- **PUT 会丢企业空间归属**：命名空间上的 `kubesphere.io/workspace` 标签是项目归属的唯一来源。
- **`disabled` 与缺失不同**：缺失是默认（从未配置），`disabled` 是有人主动关的。
- **模块未启用时开关无效**：从 `status.configz.logging` 判断，禁用而不是隐藏。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/project-settings/TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-01.yaml`
可观测点：`log-collection:surface`、`log-collection:panel`、`log-collection:toggle`、`log-collection:confirm`、`log-collection:confirm-disable`、`log-collection:cancel-disable`。

## 后续改进

- 收集范围的按工作负载筛选（老 console 也没有，需平台支持）。
- 与集群日志查询页联动。

## 验收用例

- TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-01
