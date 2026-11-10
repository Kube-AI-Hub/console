# TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-04 配置字典 · 项目筛选切换命名空间

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/list.md`

## 产品功能

选中某个项目时请求该项目的命名空间；选择「全部项目」时去掉命名空间段，并把页码重置为第 1 页。

### 关联需求

- `prd/kube-frontend/configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-04** — Given 列表已加载，When 在项目筛选器中选择某个项目，Then 请求切换到该项目的命名空间并回到第 1 页；When 选择「全部项目」，Then 请求不带命名空间段，返回跨项目结果。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/list.md`](../../../../design/kube-frontend/configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 作为项目成员，只看某个项目的配置


**Independent Test**：在项目筛选器中选择目标项目，列表只剩该项目的对象；切回「全部项目」恢复跨项目结果。

## 前置与配置

- 已登录
- 集群内至少存在两个项目

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps
2. 在「项目」筛选器中选择一个非当前项目
3. 再选择「全部项目」

## 期望结果

- 第一次选择后请求路径包含 namespaces/<该项目>，且 query 带 page=1
- 第二次选择后请求路径不含 namespaces/ 段
- 两次选择后页码均为 1

## 失败排查

- 先看请求路径：筛选必须体现在路径的命名空间段上，只加查询参数说明实现未按 DEC-LIST-03 落地

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
