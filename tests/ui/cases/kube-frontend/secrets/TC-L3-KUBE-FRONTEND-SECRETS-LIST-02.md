# TC-L3-KUBE-FRONTEND-SECRETS-LIST-02 保密字典 · 排序与翻页

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-LIST-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/list.md`

## 产品功能

点击列头与翻页都由服务端完成，并重置页码与选择。

### 关联需求

- `prd/kube-frontend/secrets/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/list.md`](../../../../prd/kube-frontend/secrets/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-LIST-02** — Given 列表已加载，When 点击「创建时间」列头，Then 请求带上 `sortBy=createTime` 与取反的 `ascending`，页码回到第 1 页；当点击分页切到第 2 页时，已选项被清空。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/list.md`](../../../../design/kube-frontend/secrets/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/list.md`](../../../../prd/kube-frontend/secrets/list.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为项目成员，按最近创建排序并翻页


**Independent Test**：默认按创建时间倒序，最新一条在最前；点击「名称」列头切换到按名称升序；点「下一页」后回到第 1 页顶部的选择被清空。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 点击「创建时间」列头
2. 勾选第一行后切换到第 2 页（若只有一页则跳过）
3. 点击「名称」列头

## 期望结果

- 请求带 sortBy=createTime 且 ascending 取反
- 翻页后已选项为空
- 名称列头的 aria-sort 为 ascending 或 descending

## 失败排查

- 按网络面板确认请求参数，而不是只看列头箭头

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
