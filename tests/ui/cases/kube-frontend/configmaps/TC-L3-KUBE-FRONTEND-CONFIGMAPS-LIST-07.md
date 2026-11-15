# TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-07 配置字典列表的刷新与空态出口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/list.md`

## 产品功能

列表提供刷新按钮与空态出口（清空搜索与筛选 / 刷新），供读者主动重读。

### 关联需求

- `prd/kube-frontend/configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-07** — 已知配置字典列表已加载，当在别处新建一条 ConfigMap 后点击列表的「刷新」，则请求重新发起并在列表中出现该行，刷新期间按钮显示忙碌状态；当搜索一个不存在的名称使列表进入空态，则空态给出「清空搜索与筛选」与「刷新」两个出口，点击前者清空关键字并回到有数据的列表。集群级配置字典页提供同样的刷新与空态出口。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/list.md`](../../../../design/kube-frontend/configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，按创建时间看最近的配置


**Independent Test**：进入列表，默认按创建时间倒序，第一条是最新创建的 ConfigMap；点击「名称」列头，顺序切换为按名称升序。

## 前置与配置

- 已登录且项目内可创建配置字典

## 测试步骤

1. 打开项目配置字典列表，确认「刷新」按钮存在
2. 在页面之外（API）新建一条 ConfigMap，点击刷新
3. 搜索一个不存在的名称进入空态，点击「清空搜索与筛选」

## 期望结果

- 刷新期间按钮显示忙碌状态；集群级同名页面同样有刷新

## 失败排查

- 刷新后仍看不到：查询键未包含 page/搜索参数，或 refetch 未被调用
- 空态没有出口：schema.labels 未注入 emptyClear/emptyRefresh

## 产品改版后如何更新自动化

- 选择器：configmaps:refresh / configmaps:search
