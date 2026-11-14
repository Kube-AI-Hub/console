# 应用商店（L2）

## 概述

顶栏两个入口：**应用商店**（`/kube-frontend/apps`，浏览）与 **平台管理 › 应用商店管理**（`/kube-frontend/apps-manage`，应用/分类/审核）。数据来自 openpitrix。

## 用户故事

### US1 - 打开应用商店，在浏览与管理之间切换并看到各自的数据 (Priority: P1)

作为 **平台用户/管理员**，我希望 **能进入应用商店与管理页**，以便 **找到可安装的应用，或查看商店里发布了什么**。

**Independent Test**：从顶栏进入 `/kube-frontend/apps` 看到分类与应用区；进入 `/kube-frontend/apps-manage` 默认落在「应用」页签，三个页签可切换。

## 验收场景

- **AC-FULL-KUBE-FRONTEND-APP-STORE-01** — 当从顶栏进入应用商店与商店管理，两者各自渲染且页签可切换。

## 设计目标

补齐顶栏两个曾经是死链的入口。

## 约束与边界

- 依赖 openpitrix 模块；本集群该模块开启且接口可用。
- 安装应用（deploy）与商店写操作不在本轮范围。

## UI 交互设计

浏览页：左分类栏 + 右卡片网格；管理页：区域页签（应用/分类/审核）+ 刷新。

## 页面结构

`/kube-frontend/apps`（单页）；`/kube-frontend/apps-manage/{store,categories,reviews}`（三页签，默认 store）。

## 异常态

接口失败显示错误面板与重试；空商店显示说明（应用来自应用仓库）。

## 功能需求

- **FR-FULL-KUBE-FRONTEND-APP-STORE-01** — 两个顶栏入口都可达并渲染。

## 成功标准

- **SC-FULL-KUBE-FRONTEND-APP-STORE-01** — 一个 L2 用例覆盖两个入口的导航与页签切换。

## 明确不做

- 应用安装、商店写操作（建分类、审核）、应用仓库管理。

## 假设

- `/kapis/openpitrix.io/v1/{apps,categories,reviews}` 可读。

## 功能点

见同目录 `browse.md`、`manage.md`。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-APP-STORE-01`
