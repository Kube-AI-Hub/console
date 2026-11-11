# TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-06 配置字典 · 名称列与创建时间格式

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/kube-frontend-demo/configmaps`
- **需求**: `prd/kube-frontend/configmaps/list.md`

## 产品功能

名称列第一行显示别名（无别名时显示名称），第二行显示描述；创建时间固定为 `YYYY-MM-DD HH:mm:ss`。

### 关联需求

- `prd/kube-frontend/configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-06** — Given 某条 ConfigMap 有别名，When 查看列表，Then 名称列第一行显示别名（无别名时显示名称），第二行显示描述或 `-`；创建时间显示为 `YYYY-MM-DD HH:mm:ss`。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/list.md`](../../../../design/kube-frontend/configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，按创建时间看最近的配置


**Independent Test**：进入列表，默认按创建时间倒序，第一条是最新创建的 ConfigMap；点击「名称」列头，顺序切换为按名称升序。

## 前置与配置

- 已登录，且项目内同时存在「有别名」与「无别名」的 ConfigMap

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/kube-frontend-demo/configmaps
2. 读取有别名那条的名称单元格
3. 读取无别名那条的名称单元格
4. 读取任意一行的创建时间单元格

## 期望结果

- 有别名的那行第一行为别名文本，不出现「名称 (别名)」这种拼接
- 无别名的那行第一行为对象名称
- 第二行为描述，无描述时为 `-`
- 创建时间匹配 `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$`

## 失败排查

- 时间显示成 `2026/11/10 04:16` 说明又用了 Intl 的 dateStyle
- 名称出现括号拼接说明把 alias 追加进了名称

## 产品改版后如何更新自动化

- 别名与描述的注解键为 kubesphere.io/alias-name / kubesphere.io/description
