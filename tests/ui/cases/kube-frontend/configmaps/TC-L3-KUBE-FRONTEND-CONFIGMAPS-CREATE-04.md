# TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-04 配置字典 · 创建时选择项目

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/create.md`

## 产品功能

创建配置字典时可以在弹窗内选择项目，对象创建到所选项目。

### 关联需求

- `prd/kube-frontend/configmaps/create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/create.md`](../../../../prd/kube-frontend/configmaps/create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-04** — Given 创建弹窗打开，When 选择另一个项目再提交，Then 对象创建到所选项目而非打开弹窗时的项目；未选择项目时下一步被阻止并提示「请选择项目」；名称查重针对所选项目进行。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/create.md`](../../../../design/kube-frontend/configmaps/create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/create.md`](../../../../prd/kube-frontend/configmaps/create.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，从表单创建一个只含少量键值的配置字典


**Independent Test**：打开创建弹窗，填写名称后进入数据设置，添加两个键值对，提交后列表出现该对象。

## 前置与配置

- 已登录
- 集群内至少存在两个项目

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps
2. 点击「创建」
3. 在「项目」下拉中选择另一个项目
4. 填写名称，进入数据设置，添加一条键值并保存
5. 提交创建

## 期望结果

- 「项目」是必填字段，打开时预填当前页面的项目
- 选择另一个项目后，下拉显示该项目名
- 提交后对象出现在所选项目的列表中，而不是原项目
- 在原项目的列表中看不到该对象

## 失败排查

- 对象落错项目时检查提交是否用了弹窗内的 namespace，而不是 props
- 无法进入下一步且提示「请选择项目」时，是「全部项目」视图下未选择项目

## 产品改版后如何更新自动化

- 项目的选项来自 useProjectOptions，断言时不要依赖固定项目名
