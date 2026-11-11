# TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-01 服务账户 · 编辑信息不改角色

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `serviceaccounts` `edit`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts`
- **需求**: `prd/kube-frontend/serviceaccounts/edit.md`

## 产品功能

编辑信息只改别名与描述；YAML 不接受改名。

### 关联需求

- `prd/kube-frontend/serviceaccounts/edit.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/serviceaccounts/edit.md`](../../../../prd/kube-frontend/serviceaccounts/edit.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-01** — Given 一条服务账户，When 打开「编辑」，Then 名称只读、别名与描述可改；保存后 `iam.kubesphere.io/role` 与 `secrets[]` 保持不变；When 打开「编辑 YAML」并修改名称，Then 提示名称锁定且提交禁用。

### 关联设计

- 技术方案 [`design/kube-frontend/serviceaccounts/edit.md`](../../../../design/kube-frontend/serviceaccounts/edit.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/serviceaccounts/edit.md`](../../../../prd/kube-frontend/serviceaccounts/edit.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，改别名与描述


**Independent Test**：行操作「编辑」→ 名称只读，改别名与描述 → 确认；列表中名称显示为新别名，描述更新。

### US2 - 作为项目成员，用 YAML 修改 autmount 设置


**Independent Test**：行操作「编辑 YAML」→ 加一行 `automountServiceAccountToken: false` → 确认；对象更新。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 测试账户带角色

## 测试步骤

1. 行操作「编辑」修改别名并确认
2. 行操作「编辑 YAML」修改 metadata.name

## 期望结果

- 别名更新，角色注解不变
- 提示名称锁定且提交禁用

## 失败排查

- 角色丢了说明 EditInfoDialog 传入了不完整的注解

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
