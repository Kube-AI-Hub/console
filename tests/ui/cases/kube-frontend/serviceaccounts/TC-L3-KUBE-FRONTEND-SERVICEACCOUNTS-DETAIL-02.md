# TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-02 服务账户 · 无令牌与下载

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `serviceaccounts` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts`
- **需求**: `prd/kube-frontend/serviceaccounts/detail.md`

## 产品功能

下载得到 kubeconfig.yaml；没有令牌时给出解释而不是报错。

### 关联需求

- `prd/kube-frontend/serviceaccounts/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/serviceaccounts/detail.md`](../../../../prd/kube-frontend/serviceaccounts/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-02** — Given 详情已打开，When 点「显示明文」，Then 该令牌的值以明文显示；When 点「下载」，Then 浏览器下载 `kubeconfig.yaml`；When 打开没有令牌的服务账户，Then 数据区提示当前没有令牌且不报错。

### 关联设计

- 技术方案 [`design/kube-frontend/serviceaccounts/detail.md`](../../../../design/kube-frontend/serviceaccounts/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/serviceaccounts/detail.md`](../../../../prd/kube-frontend/serviceaccounts/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为项目成员，确认这个账户挂载了哪些令牌


**Independent Test**：数据区每个令牌 Secret 一块，标题为「保密字典：<name>」，键值列表与 Secret 一致。

### US3 - 作为项目成员，看到没有令牌时的解释


**Independent Test**：打开没有 `secrets[]` 的服务账户，数据区显示提示，而不是空白或错误。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 一个账户有令牌，另一个没有

## 测试步骤

1. 打开有令牌账户的详情并点下载
2. 打开无令牌账户的详情

## 期望结果

- 下载文件名 kubeconfig.yaml
- 无令牌时数据区显示提示文案且页面状态为 ready

## 失败排查

- 无令牌却报错说明把空 secrets[] 当成了失败

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
