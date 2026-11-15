# TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-08 列表每页条数选择器（10/20/50/100）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-08`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `list`
- **入口**: `{BASE_URL}/kube-frontend/{WORKSPACE}/clusters/{CLUSTER}/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/list.md`

## 产品功能

列表分页处的每页条数选择器可改 10/20/50/100，切换后请求以新的 limit 与 page=1 重发，表格行数与服务端返回一致；保密字典、服务账号、项目工作负载同一套状态。

### 关联需求

- `prd/kube-frontend/configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-08** — 已知列表已加载（默认每页 10 条），当点分页处的每页条数选择器并选择 50，则请求以 `page=1&limit=50` 重新发起、表格回到第 1 页且行数等于服务端返回条数（不超过 50），选择器显示 50；每页条数可选 10/20/50/100（与旧 console 的 `PAGESIZE_OPTION` 一致）；该能力同样适用于保密字典、服务账号与项目工作负载列表（同一套 `useResourceListState` 状态）。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/list.md`](../../../../design/kube-frontend/configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，按创建时间看最近的配置


**Independent Test**：进入列表，默认按创建时间倒序，第一条是最新创建的 ConfigMap；点击「名称」列头，顺序切换为按名称升序。

## 前置与配置

- 已登录；项目 default 有若干 ConfigMap

## 测试步骤

1. 打开配置字典列表，核对每页条数选择器显示 10
2. 选择 50，记录请求与行数
3. 切到保密字典与服务账号列表，核对选择器存在且可选 50

## 期望结果

- 选择器句柄 configmaps:page-size 存在且显示 10
- 选择 50 后出现 limit=50 且 page=1 的请求，行数等于该次响应条数（≤50）
- 保密字典（secrets:page-size）与服务账号（serviceaccounts:page-size）同样存在并可切换

## 失败排查

- 选择器不存在：只给了 pageSizeOptions，没给 onPageSizeChange
- 请求仍是 limit=10：toListParams 被传了常量而不是 state.pageSize

## 产品改版后如何更新自动化

- 句柄：configmaps:page-size / secrets:page-size / serviceaccounts:page-size / deployments:page-size
