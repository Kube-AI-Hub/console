# TC-FULL-KUBE-FRONTEND-WORKBENCH-01 工作台到项目的完整路径

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-WORKBENCH-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `workbench` `entry`
- **入口**: `{BASE_URL}/kube-frontend/`
- **需求**: `prd/kube-frontend/workbench/_index.md`

## 产品功能

从工作台入口进入项目控制台，页头、侧栏与上下文栏同时在位。

### 关联需求

- `prd/kube-frontend/workbench/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/workbench/_index.md`](../../../../prd/kube-frontend/workbench/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-WORKBENCH-01** — 已登录，当打开工作台并进入一个项目，则工作台列出企业空间与项目，且项目控制台的侧栏与上下文栏都在位。

### 关联设计

- 技术方案 [`design/kube-frontend/workbench/_index.md`](../../../../design/kube-frontend/workbench/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/workbench/_index.md`](../../../../prd/kube-frontend/workbench/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 从工作台进入一个项目 (Priority: P1)

作为 **平台用户**，我希望 **在工作台看到我所在企业空间的项目并点进去**，以便 **不用手拼 URL 也能开始工作**。
页头、侧栏与三级上下文栏同时在位。

**Independent Test**：点击顶部「工作台」，页面列出企业空间与项目；点任一项目进入该项目控制台，

## 前置与配置

- 已登录

## 测试步骤

1. 打开工作台并等待就绪
2. 若有项目则进入第一个
3. 核对项目控制台的三处结构

## 期望结果

- 工作台就绪且列出企业空间
- 进入项目后出现项目区侧栏与上下文栏

## 失败排查

- 上下文栏缺失：项目路由未匹配

## 产品改版后如何更新自动化

- 与 ENTRY-01 共用页面对象
