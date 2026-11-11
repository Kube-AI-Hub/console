# TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-01 服务账户 · 创建时写入角色与描述

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `serviceaccounts` `create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts`
- **需求**: `prd/kube-frontend/serviceaccounts/create.md`

## 产品功能

创建的账户在所选项目、带所选角色与描述。

### 关联需求

- `prd/kube-frontend/serviceaccounts/create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/serviceaccounts/create.md`](../../../../prd/kube-frontend/serviceaccounts/create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-CREATE-01** — Given 创建弹窗已打开，When 名称非法或与同项目已有对象重名，Then 提示对应错误且不提交；When 填写合法名称并选择角色，Then 提交后对象创建到所选项目，`metadata.annotations['iam.kubesphere.io/role']` 等于所选角色，描述写入 `kubesphere.io/description`。

### 关联设计

- 技术方案 [`design/kube-frontend/serviceaccounts/create.md`](../../../../design/kube-frontend/serviceaccounts/create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/serviceaccounts/create.md`](../../../../prd/kube-frontend/serviceaccounts/create.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，创建一个带项目角色的服务账户


**Independent Test**：创建 → 名称 `ci-bot` → 角色选 `project-editor` → 提交；列表出现 `ci-bot`，角色列为 `project-editor`。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 项目 default 至少有一个项目角色

## 测试步骤

1. 点击「创建」
2. 填写名称、描述，选择第一个角色后提交
3. 用 kubectl 读取对象

## 期望结果

- 名称非法时提示「名称无效」
- 提交后列表出现该账户
- annotations['iam.kubesphere.io/role'] 等于所选角色
- annotations['kubesphere.io/description'] 等于输入

## 失败排查

- 角色未写入时确认 actionProps 是否覆盖了 onValueChange

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
