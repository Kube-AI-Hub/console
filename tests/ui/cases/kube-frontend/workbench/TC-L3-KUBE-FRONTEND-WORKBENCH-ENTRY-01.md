# TC-L3-KUBE-FRONTEND-WORKBENCH-ENTRY-01 工作台 · 企业空间与项目入口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-WORKBENCH-ENTRY-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `workbench` `entry`
- **入口**: `{BASE_URL}/kube-frontend/`
- **需求**: `prd/kube-frontend/workbench/entry.md`

## 产品功能

顶部「工作台」到达 /kube-frontend/；页面按企业空间列出项目；点项目进入该项目控制台。

### 关联需求

- `prd/kube-frontend/workbench/entry.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/workbench/entry.md`](../../../../prd/kube-frontend/workbench/entry.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-WORKBENCH-ENTRY-01** — 已登录，当点击顶部「工作台」，则地址为 `/kube-frontend/` 且页面显示企业空间与项目；点击一个项目后进入该项目控制台。
- **AC-L3-KUBE-FRONTEND-WORKBENCH-ENTRY-02** — 当平台没有任何可进入的项目，则显示空态与「前往平台管理」链接，而不是空白。

### 关联设计

- 技术方案 [`design/kube-frontend/workbench/entry.md`](../../../../design/kube-frontend/workbench/entry.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/workbench/entry.md`](../../../../prd/kube-frontend/workbench/entry.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 从工作台进入一个项目 (Priority: P1)

作为 **平台用户**，我希望 **在工作台看到我所在企业空间的项目并点进去**，以便 **不用手拼 URL 也能开始工作**。

**Independent Test**：从集群列表点击顶部「工作台」，页面显示企业空间与其项目；点击任一项目进入该项目控制台，地址包含该项目的集群与命名空间。

## 前置与配置

- 已登录

## 测试步骤

1. 从集群列表点击顶部「工作台」
2. 核对地址与页面内容（企业空间、项目）
3. 点击第一个项目

## 期望结果

- 地址为 /kube-frontend/
- 至少一个企业空间分组与一个项目胶囊
- 点击后进入该项目控制台（地址含集群与命名空间）

## 失败排查

- 点击后 Not Found：/kube-frontend/ 缺路由（历史上顶部入口就指向这里）
- 分组为空但项目存在：项目按集群异步加载，需等待分组出现

## 产品改版后如何更新自动化

- 选择器变化时改 pages/workbench.py
