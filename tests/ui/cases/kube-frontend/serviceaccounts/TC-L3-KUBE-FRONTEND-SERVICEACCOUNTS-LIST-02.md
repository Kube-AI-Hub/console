# TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-02 服务账户 · 令牌链接到保密字典详情

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `serviceaccounts` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts`
- **需求**: `prd/kube-frontend/serviceaccounts/list.md`

## 产品功能

保密字典列中的名称可点，跳转到该 Secret 的详情。

### 关联需求

- `prd/kube-frontend/serviceaccounts/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/serviceaccounts/list.md`](../../../../prd/kube-frontend/serviceaccounts/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-LIST-02** — Given 列表已加载，When 点击「保密字典」列中的某个名称，Then 进入该 Secret 的详情页（`/projects/<ns>/secrets/<name>`）；When 点击「名称」列头，Then 请求按 `sortBy=name` 重新发起。

### 关联设计

- 技术方案 [`design/kube-frontend/serviceaccounts/list.md`](../../../../design/kube-frontend/serviceaccounts/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/serviceaccounts/list.md`](../../../../prd/kube-frontend/serviceaccounts/list.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为项目成员，从列表跳到某个令牌 Secret 的详情


**Independent Test**：点击保密字典列中的名称，跳到保密字典详情页，且显示的正是该 Secret。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 测试账户的 secrets[] 指向一个已存在的令牌 Secret

## 测试步骤

1. 在列表中找到测试账户
2. 点击保密字典列中的令牌名称

## 期望结果

- URL 变为 /projects/<ns>/secrets/<token>
- 详情页展示的正是该 Secret

## 失败排查

- 链接 404 时确认是否用了当前筛选项目而不是行对象自己的项目

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
