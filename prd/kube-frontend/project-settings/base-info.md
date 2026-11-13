# 项目基本信息（L3）

[子模块需求](./_index.md)

## 概述

项目的属性块与资源配额块：名称、别名、企业空间、描述、创建者、创建时间；配额按资源列出上限与已用量。

## 用户故事

### US1 - 确认项目的归属与配额 (Priority: P1)

作为 **项目管理员**，我希望 **看到项目属于哪个企业空间、有没有配额**，以便 **判断资源上限从哪来**。

**Independent Test**：打开 `…/projects/spaces/baseinfo`，核对企业空间与项目列表页一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-01** — 已知项目存在，当打开基本信息页，则显示名称、别名、企业空间、描述、创建者、创建时间六项属性，且企业空间与企业空间标签一致。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-03** — 已知项目配额可编辑，当点「编辑配额」填写 requests.cpu=2 与 requests.memory=4Gi 后确认，则存在一个 ResourceQuota，其 `spec.hard` 含这两项，且未填写的项不出现在 `spec.hard` 中。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-02** — 已知项目没有 ResourceQuota，当打开基本信息页，则配额区显示「该项目没有设置资源配额」，而不是空白或错误。

## 设计目标

1. 基本信息与配额都来自项目对象本身，不额外拉取列表。
2. 没有配额是正常状态，必须显式说明。

## 约束与边界

- 项目即命名空间：读 `resources.kubesphere.io/v1alpha3/namespaces/<ns>`。
- 配额读核心组 `resourcequotas`；不存在时配额区显示空态。
- 企业空间取 `kubesphere.io/workspace` 标签。

## UI 交互设计

两个卡片：项目信息（定义列表）与资源配额（三列表：资源、上限、已使用）；底部一行说明编辑能力未提供。

## 文案与校验

- 属性名：名称、别名、企业空间、描述、创建者、创建时间。
- 配额表头：资源、上限、已使用。
- 空配额：该项目没有设置资源配额。

## 边界情况

- 名称是唯一必填项；其余字段缺失显示 `-`。
- 配额对象存在但 `spec.hard` 为空时，按无配额处理。

## 明确不做

- 编辑项目信息（需要平台侧表单）。
- 默认容器配额（LimitRange）区块。
- 删除项目。

## 假设

- KubeSphere 用命名空间承载项目，配额用 ResourceQuota。

## 验收用例

- `AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-01`
- `AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-02`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-03** — 配额区提供「编辑配额」，写入 ResourceQuota 的 `spec.hard`；留空表示不限制。

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-01** — 显示六项属性，企业空间来自标签。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-02** — 没有配额时显示明确的空态文案。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-01** — 企业空间与项目列表页同一项目的企业空间一致。
