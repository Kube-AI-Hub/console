# TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01 服务账户 · 属性顺序与 kubeconfig 内容

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `serviceaccounts` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts`
- **需求**: `prd/kube-frontend/serviceaccounts/detail.md`

## 产品功能

属性区五项顺序；kubeconfig 字段与令牌 Secret 对应。

### 关联需求

- `prd/kube-frontend/serviceaccounts/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/serviceaccounts/detail.md`](../../../../prd/kube-frontend/serviceaccounts/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01** — Given 一个有令牌 Secret 的服务账户，When 打开详情，Then 属性区依次显示集群、项目、角色、创建时间（`YYYY-MM-DD HH:mm:ss`）、创建者；数据区显示该令牌的键值（默认遮挡）以及一段 kubeconfig，其中 `server` 为 `https://kubernetes.default.svc:443`、`current-context` 为 `<sa>@local`。

### 关联设计

- 技术方案 [`design/kube-frontend/serviceaccounts/detail.md`](../../../../design/kube-frontend/serviceaccounts/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/serviceaccounts/detail.md`](../../../../prd/kube-frontend/serviceaccounts/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为平台用户，下载一个服务账户的 kubeconfig


**Independent Test**：打开有令牌的服务账户，点「下载」，得到 `kubeconfig.yaml`；文件里 `users[0].user.token` 等于 `data.token` 解码值，`contexts[0].context.namespace` 等于该 Secret 所在项目。

### US2 - 作为项目成员，确认这个账户挂载了哪些令牌


**Independent Test**：数据区每个令牌 Secret 一块，标题为「保密字典：<name>」，键值列表与 Secret 一致。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 测试账户挂载一个令牌 Secret，Secret 带 token 与 ca.crt

## 测试步骤

1. 打开详情
2. 读取属性区
3. 读取 kubeconfig 文本
4. 点「显示明文」

## 期望结果

- 属性区顺序为 集群、项目、角色、创建时间、创建者
- kubeconfig 的 users[0].user.token 等于 token 解码值
- contexts[0].context.namespace 等于项目名
- 键值默认遮挡，点击后为明文

## 失败排查

- token 不匹配时检查 decodeToken 是否多做/少做了一次解码

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
