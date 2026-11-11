# TC-FULL-KUBE-FRONTEND-SERVICEACCOUNTS-01 服务账户 · 详情属性与 kubeconfig

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-SERVICEACCOUNTS-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `serviceaccounts` `page`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts`
- **需求**: `prd/kube-frontend/serviceaccounts/_index.md`

## 产品功能

有令牌的账户在详情页给出属性与可下载的 kubeconfig。

### 关联需求

- `prd/kube-frontend/serviceaccounts/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/serviceaccounts/_index.md`](../../../../prd/kube-frontend/serviceaccounts/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-SERVICEACCOUNTS-01** — Given 项目内有一个带令牌 Secret 的服务账户，When 打开它的详情，Then 属性区显示集群、项目、角色、创建时间、创建者；数据区按令牌 Secret 展示键值（默认遮挡）并给出 kubeconfig 文本，可下载。

### 关联设计

- 技术方案 [`design/kube-frontend/serviceaccounts/_index.md`](../../../../design/kube-frontend/serviceaccounts/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/serviceaccounts/_index.md`](../../../../prd/kube-frontend/serviceaccounts/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，看到每个服务账户的角色与令牌


**Independent Test**：打开列表，确认每条显示名称（别名替换）、描述、角色、保密字典（可点击到对应 Secret 详情）与创建时间。

### US2 - 作为需要命令行访问的用户，拿到某个服务账户的 kubeconfig


**Independent Test**：打开一个有令牌的服务账户详情，数据区出现该令牌 Secret，下方显示 kubeconfig；点「下载」得到 `kubeconfig.yaml`，其中的 `server`、`token`、`ca` 与 Secret 内容一致。

### US3 - 作为项目成员，给服务账户分配项目角色


**Independent Test**：行操作「修改角色」里选 `project-editor` 并确认；列表角色列变为 `project-editor`，`kubectl get sa <name> -o jsonpath='{.metadata.annotations}'` 出现 `iam.kubesphere.io/role: project-editor`。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 用例会创建一个手工令牌 Secret 并把它挂到测试账户的 secrets[] 上，结束后两者都删除

## 测试步骤

1. 打开测试账户详情
2. 读取属性区
3. 读取 kubeconfig 文本
4. 点击下载

## 期望结果

- 属性区显示集群、项目、角色、创建时间、创建者
- {'kubeconfig 含 server': 'https://kubernetes.default.svc:443'}
- current-context 为 <sa>@local
- 下载得到 kubeconfig.yaml

## 失败排查

- 没有令牌时先确认集群是否启用了 LegacyServiceAccountTokenNoAutoGeneration

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
