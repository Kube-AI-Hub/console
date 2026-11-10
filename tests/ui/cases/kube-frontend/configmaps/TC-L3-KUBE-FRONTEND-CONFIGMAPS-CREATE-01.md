# TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01 配置字典 · 创建时的名称校验

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/create.md`

## 产品功能

名称在进入下一步前校验格式与是否已存在。

### 关联需求

- `prd/kube-frontend/configmaps/create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/create.md`](../../../../prd/kube-frontend/configmaps/create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01** — Given 创建弹窗打开，When 名称留空、含大写、以连字符开头或超过 63 字符，Then 提示对应错误且不进入下一步；When 名称已存在，Then 提示「名称已存在，请输入其他名称。」

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

1. 点击「创建」
2. 输入含大写的名称并点「下一步」
3. 输入一个已存在的名称并点「下一步」

## 期望结果

- 提示「名称无效」且停留在基本信息步
- 提示「名称已存在，请输入其他名称。」

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
