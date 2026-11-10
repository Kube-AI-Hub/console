# TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-03 配置字典 · YAML 模式创建

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/create.md`

## 产品功能

切换到 YAML 模式粘贴合法对象后可直接提交，非法 YAML 时禁止提交。

### 关联需求

- `prd/kube-frontend/configmaps/create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/create.md`](../../../../prd/kube-frontend/configmaps/create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-03** — Given 弹窗打开，When 切到 YAML 模式并粘贴合法对象，Then 可直接提交；When YAML 无法解析，Then 提示「YAML 格式有误，请修正后再提交。」且提交按钮禁用。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/create.md`](../../../../design/kube-frontend/configmaps/create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/create.md`](../../../../prd/kube-frontend/configmaps/create.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为项目成员，把一份现成的 YAML 粘贴进来直接创建


**Independent Test**：打开创建弹窗，切到 YAML 模式，粘贴一段合法 YAML 并提交，对象按 YAML 内容创建。

## 前置与配置

- 已登录
- 项目 default 中至少存在一个配置字典

## 测试步骤

1. 点击「创建」
2. 点击「编辑 YAML」
3. 粘贴一段非法 YAML
4. 改为合法 YAML 后提交

## 期望结果

- 非法 YAML 时提示「YAML 格式有误，请修正后再提交。」且提交按钮禁用
- 合法后提交成功，对象按 YAML 内容创建

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
