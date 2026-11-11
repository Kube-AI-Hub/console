# TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03 配置字典 · 翻页清空已选

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/list.md`

## 产品功能

翻到下一页时清空已选项，避免对看不见的行做批量操作。

### 关联需求

- `prd/kube-frontend/configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03** — Given 列表已加载，When 点击分页切换到第 2 页，Then 请求带 `page=2`，已选项被清空，列表显示第 2 页数据。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/list.md`](../../../../design/kube-frontend/configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，按创建时间看最近的配置


**Independent Test**：进入列表，默认按创建时间倒序，第一条是最新创建的 ConfigMap；点击「名称」列头，顺序切换为按名称升序。

### US2 - 作为项目成员，看清每条配置包含哪些键


**Independent Test**：列表「键」列以逗号（无空格）分隔显示键名，最多 50 个字符，超出部分以 `...` 结尾；完整键名在悬停提示与详情页可见；无键时显示 `-`。

## 前置与配置

- 已登录
- 该空间下对象数超过 10 条

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps
2. 勾选第一行
3. 点击分页第 2 页

## 期望结果

- 勾选后「批量删除」可用并显示 (1)
- 切页后「批量删除」回到禁用
- 列表显示第 2 页数据

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
