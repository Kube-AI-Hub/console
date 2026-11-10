# TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02 配置字典 · 详情页四个操作入口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/detail.md`

## 产品功能

详情页头部提供编辑信息、编辑设置、编辑 YAML、删除四个入口，删除后回到列表。

### 关联需求

- `prd/kube-frontend/configmaps/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/detail.md`](../../../../prd/kube-frontend/configmaps/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02** — Given 详情已打开，When 点击「编辑信息」「编辑设置」「编辑 YAML」「删除」，Then 分别打开对应弹窗并预填当前对象；在详情页完成删除后跳回列表。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/detail.md`](../../../../design/kube-frontend/configmaps/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/detail.md`](../../../../prd/kube-frontend/configmaps/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为项目成员，从详情直接发起编辑或删除


**Independent Test**：在详情页依次点击四个操作，每个都打开对应弹窗，且弹窗预填的正是当前对象。

## 前置与配置

- 已登录
- 项目 default 中至少存在一个配置字典

## 测试步骤

1. 打开某个对象的详情
2. 依次点击四个操作
3. 在详情页确认删除

## 期望结果

- 四个按钮分别打开对应弹窗且预填当前对象
- 删除成功后跳转回列表路由

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
