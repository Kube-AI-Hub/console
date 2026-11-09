# TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01 配置字典 · 列表默认视图

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `list`
- **入口**: `{BASE_URL}/c/host/p/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/list.md`

## 产品功能

默认按创建时间倒序，每行显示名称、键、创建时间。

### 关联需求

- `prd/kube-frontend/configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01** — Given 项目内有多条 ConfigMap，When 打开列表，Then 默认按创建时间倒序，每行显示名称、键、创建时间。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/list.md`](../../../../design/kube-frontend/configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，按创建时间看最近的配置


**Independent Test**：进入列表，默认按创建时间倒序，第一条是最新创建的 ConfigMap；点击「名称」列头，顺序切换为按名称升序。

### US2 - 作为项目成员，看清每条配置包含哪些键


**Independent Test**：列表「键」列显示该 ConfigMap 的全部键名，以逗号分隔；无键时显示 `-`。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 该空间下至少有两条 ConfigMap

## 测试步骤

1. 打开 {BASE_URL}/c/host/p/default/configmaps
2. 核对表头与首行内容

## 期望结果

- 表头依次为 名称、键、创建时间、操作
- 首行是最近创建的一条
- 「键」列显示该对象全部键名，逗号分隔
- 无键的对象显示 -

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
