# TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02 配置字典 · 列头切换排序

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `list`
- **入口**: `{BASE_URL}/c/host/p/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/list.md`

## 产品功能

点击列头在升序与降序之间切换，并把页码重置为第 1 页。

### 关联需求

- `prd/kube-frontend/configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02** — Given 列表已加载，When 点击「名称」列头，Then 请求以 `sortBy=name&order=asc` 重新发起，列头显示升序标记，且当前页回到第 1 页。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/list.md`](../../../../design/kube-frontend/configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，按创建时间看最近的配置


**Independent Test**：进入列表，默认按创建时间倒序，第一条是最新创建的 ConfigMap；点击「名称」列头，顺序切换为按名称升序。

### US2 - 作为项目成员，看清每条配置包含哪些键


**Independent Test**：列表「键」列显示该 ConfigMap 的全部键名，以逗号分隔；无键时显示 `-`。

## 前置与配置

- 已登录
- 列表已加载且总数大于一页

## 测试步骤

1. 打开 {BASE_URL}/c/host/p/default/configmaps
2. 点击「名称」列头
3. 再次点击「名称」列头

## 期望结果

- 第一次点击后请求携带 sortBy=name&order=asc
- 列头 `aria-sort` 为 ascending 且显示升序标记
- 第二次点击后 `aria-sort` 为 descending
- 两次点击后页码均为 1

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
