# TC-L3-KUBE-FRONTEND-STORAGE-LIST-05 存储卷与快照列表的刷新与空态出口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-LIST-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/list.md`

## 产品功能

存储卷与存储卷快照列表提供刷新按钮与空态出口。

### 关联需求

- `prd/kube-frontend/storage/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/list.md`](../../../../prd/kube-frontend/storage/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-LIST-05** — 已知存储卷列表已加载，当在别处新建一条存储卷后点击列表的「刷新」，则请求重新发起并出现该行；当搜索一个不存在的名称使列表进入空态，则空态给出「清空搜索与筛选」与「刷新」两个出口，点击前者清空关键字并回到有数据的列表；存储卷快照列表（同一页面的另一种 kind）提供同样的刷新与空态出口。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/list.md`](../../../../design/kube-frontend/storage/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/list.md`](../../../../prd/kube-frontend/storage/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清项目里有哪些存储卷、是否绑定 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到绑定状态、容量与访问模式**，以便 **判断有没有卷没绑上**。

**Independent Test**：打开 `…/projects/<ns>/persistentvolumeclaims`，核对五列与状态徽章。

## 前置与配置

- 已登录且项目内可创建存储卷

## 测试步骤

1. 打开存储卷列表，确认「刷新」按钮
2. 在页面之外（API）新建一条存储卷，点击刷新
3. 搜索不存在的名称进入空态，点击「清空搜索与筛选」
4. 切到存储卷快照列表，确认同样的刷新与空态出口

## 期望结果

- 刷新期间按钮显示忙碌状态

## 失败排查

- 快照列表没有刷新：aiId 前缀未随 kind 变化
- 空态没有出口：schema.labels 未注入 emptyLabels

## 产品改版后如何更新自动化

- 选择器：persistentvolumeclaims:refresh / volumesnapshots:refresh / :search
