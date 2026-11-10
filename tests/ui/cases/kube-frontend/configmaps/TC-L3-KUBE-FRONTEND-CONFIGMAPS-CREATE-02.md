# TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02 配置字典 · 表单创建两步流程

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/create.md`

## 产品功能

基本信息通过后进入数据设置，添加键值对并提交。

### 关联需求

- `prd/kube-frontend/configmaps/create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/create.md`](../../../../prd/kube-frontend/configmaps/create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02** — Given 基本信息已填，When 进入数据设置并添加键值对，Then 在子表单未保存时「创建」保持禁用；保存后提交，列表刷新并出现该对象。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/create.md`](../../../../design/kube-frontend/configmaps/create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/create.md`](../../../../prd/kube-frontend/configmaps/create.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，从表单创建一个只含少量键值的配置字典


**Independent Test**：打开创建弹窗，填写名称后进入数据设置，添加两个键值对，提交后列表出现该对象。

## 前置与配置

- 已登录
- 项目 default 中至少存在一个配置字典

## 测试步骤

1. 输入合法名称并点「下一步」
2. 点「添加数据」，填写键与值并保存
3. 点「创建」

## 期望结果

- 子表单打开期间「创建」按钮禁用
- 保存后键值出现在列表中
- 提交后弹窗关闭，列表出现该对象

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
