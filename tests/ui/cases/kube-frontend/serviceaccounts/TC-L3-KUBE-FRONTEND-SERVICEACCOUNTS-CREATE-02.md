# TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-02 服务账户 · 不设置角色与切换项目

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `serviceaccounts` `create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts`
- **需求**: `prd/kube-frontend/serviceaccounts/create.md`

## 产品功能

不选角色时不写注解；切换项目清空角色。

### 关联需求

- `prd/kube-frontend/serviceaccounts/create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/serviceaccounts/create.md`](../../../../prd/kube-frontend/serviceaccounts/create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-CREATE-02** — Given 角色保持「不设置」，When 提交，Then 对象被创建且不带角色注解；When 切换项目，Then 角色选择被清空并重新加载该项目的角色列表。

### 关联设计

- 技术方案 [`design/kube-frontend/serviceaccounts/create.md`](../../../../design/kube-frontend/serviceaccounts/create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/serviceaccounts/create.md`](../../../../prd/kube-frontend/serviceaccounts/create.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为项目成员，不指定角色创建一个账户


**Independent Test**：创建时角色保持「不设置」，提交后对象上没有 `iam.kubesphere.io/role` 注解。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 项目 default 与另一个项目中都有角色

## 测试步骤

1. 创建 → 选择角色 → 切换项目
2. 不改角色直接提交

## 期望结果

- 切换后角色选择被清空
- 提交后对象没有 iam.kubesphere.io/role 注解

## 失败排查

- 注解为空串说明 toKubeServiceAccount 条件写错

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
