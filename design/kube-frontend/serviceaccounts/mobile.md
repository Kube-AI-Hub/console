# 服务账户 · 移动端适配 · 技术方案（L3）

> 承接 [`prd/kube-frontend/serviceaccounts/mobile.md`](../../../prd/kube-frontend/serviceaccounts/mobile.md)。

## 概述

与保密字典相同的断点策略；详情页的 kubeconfig 预览必须可滚动而不撑破页面。

## 关联需求

- `AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-MOBILE-01`

## 设计目标与非目标

**目标**：375px 下列表无横向滚动，详情可读、可复制。

**非目标**：专用移动布局。

## 关键约束

- 列表：`role`/`secrets` → `lg`，`createTime` → `md`，`project` → `xl`。
- kubeconfig `<pre>`：`overflow-auto`，`max-height` 限制。
- 令牌块内部 `sm:flex-row` 布局，窄屏纵向堆叠。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-MOBILE-01 — kubeconfig 在窄屏允许块内横向滚动

**为什么**：YAML 缩进在窄屏换行后会失去结构；块内横向滚动保留阅读性，且因为容器有 `overflow-auto`，不会传导成页面级横向滚动。

**被否方案**：强制 `whitespace-pre-wrap`。长 base64 会被断行，复制后仍是有效内容，但肉眼无法确认结构。

## 系统现状

沿用 `AppShell` 与 `ResourceList` 的既有断点。

## 仓库落点

| 层 | 路径 |
|---|---|
| 列表列 | `apps/console-next/src/pages/serviceaccounts/ServiceAccountsPage.tsx` |
| 数据区 | `apps/console-next/src/pages/serviceaccounts/ServiceAccountSecretsSection.tsx` |

## 对外契约

不适用。

## 不变量

- **INV-L3-KUBE-FRONTEND-SERVICEACCOUNTS-MOBILE-01** — 375px 下页面级 `scrollWidth` 等于视口宽度。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SERVICEACCOUNTS-MOBILE-01** — 窄屏下复制与下载按钮换行后可能与标题重叠；用 `flex-wrap` 与 `gap` 解决。

## 测试与可观测

- 端到端：`TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-MOBILE-01`。

## 后续改进

无。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-MOBILE-01`
