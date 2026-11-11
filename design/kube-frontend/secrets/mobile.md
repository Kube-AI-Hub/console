# 保密字典 · 移动端适配 · 技术方案（L3）

> 承接 [`prd/kube-frontend/secrets/mobile.md`](../../../prd/kube-frontend/secrets/mobile.md)。

## 概述

移动端沿用配置字典的断点决策：列表按 `hideBelow` 折叠列，侧栏改抽屉，触控目标不小于 44px。保密字典特有的注意事项是长值（证书、令牌）在窄屏的换行。

## 关联需求

- `AC-L3-KUBE-FRONTEND-SECRETS-MOBILE-01`

## 设计目标与非目标

**目标**：375px 下无页面级横向滚动；主要操作可点。

**非目标**：移动端专用布局。

## 关键约束

- 断点：`data`（字段数）`md`、`type`/`createTime` `lg`、`project` `xl`。
- 容器 `max-w-[1800px]`，`main` 有 `min-w-0`，表格自身横向滚动而不撑破页面。
- 侧栏宽度切换用 `transition-[width]`，抽屉关闭后不保留布局占位。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SECRETS-MOBILE-01 — 名称列不折叠

**为什么**：主要任务是「找到并打开」，名称是唯一必要信息；类型与字段数可以在详情看。

**被否方案**：在移动端把类型并进名称副标题。与桌面端的信息层级不一致，且副标题已用于描述。

## 系统现状

配置字典已实现同一套断点与抽屉；保密字典复用 `AppShell` 与 `ResourceList`。

## 仓库落点

| 层 | 路径 |
|---|---|
| 列可见性 | `apps/console-next/src/pages/secrets/SecretsPage.tsx`（`hideBelow`） |
| 壳 | `apps/console-next/src/shell/AppShell.tsx` |
| 明细行 | `apps/console-next/src/pages/secrets/SecretDataSection.tsx` |

## 对外契约

不适用：纯前端布局，无接口变化。

## 不变量

- **INV-L3-KUBE-FRONTEND-SECRETS-MOBILE-01** — 375px 宽下 `document.scrollingElement.scrollWidth <= window.innerWidth`。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SECRETS-MOBILE-01** — `100vh` 在移动端地址栏收起时跳变。
  处置：页面根容器使用 `min-h-dvh`。
- **GOT-L3-KUBE-FRONTEND-SECRETS-MOBILE-02** — 长 `*` 串或长 base64 没有可断点，撑宽容器。
  处置：值容器 `break-all` 或 `whitespace-pre-wrap`。

## 测试与可观测

- 端到端：`TC-L3-KUBE-FRONTEND-SECRETS-MOBILE-01`（375×667 视口截图与 `scrollWidth` 断言）。

## 后续改进

无。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-MOBILE-01`
