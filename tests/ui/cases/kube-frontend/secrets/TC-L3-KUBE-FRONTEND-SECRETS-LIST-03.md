# TC-L3-KUBE-FRONTEND-SECRETS-LIST-03 保密字典列表的刷新与空态出口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-LIST-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/list.md`

## 产品功能

列表提供刷新按钮与空态出口（清空搜索与筛选 / 刷新），供读者主动重读。

### 关联需求

- `prd/kube-frontend/secrets/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/list.md`](../../../../prd/kube-frontend/secrets/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-LIST-03** — 已知保密字典列表已加载，当在别处新建一条 Secret 后点击列表的「刷新」，则请求重新发起并在列表中出现该行，刷新期间按钮显示忙碌状态；当搜索一个不存在的名称使列表进入空态，则空态给出「清空搜索与筛选」与「刷新」两个出口，点击后者重新发起请求。集群级保密字典页提供同样的刷新与空态出口。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/list.md`](../../../../design/kube-frontend/secrets/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/list.md`](../../../../prd/kube-frontend/secrets/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，看清每条 Secret 的类型与规模


**Independent Test**：打开列表，读出一条 TLS 类型的 Secret：类型列显示「TLS 信息」，字段数为 2；`Opaque` 类型的显示「默认」。

## 前置与配置

- 已登录且项目内可创建保密字典

## 测试步骤

1. 打开项目保密字典列表，确认「刷新」按钮存在
2. 在页面之外（API）新建一条 Secret，点击刷新
3. 搜索一个不存在的名称进入空态，点击「刷新」

## 期望结果

- 集群级同名页面同样有刷新

## 失败排查

- 刷新后仍看不到：查询键未包含搜索参数，或 refetch 未被调用
- 空态没有出口：schema.labels 未注入 emptyClear/emptyRefresh

## 产品改版后如何更新自动化

- 选择器：secrets:refresh / secrets:search
