# 项目基本信息（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/base-info.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-03

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-01
- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-02

## 概述

项目属性块与资源配额块，两处数据都来自项目对象与其 ResourceQuota。

## 设计目标与非目标

目标：归属与配额一眼可见；无配额时如实说明。非目标：编辑与删除。

## 关键约束

- 项目对象走 resources 代理；配额走核心组 `/api/v1`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-01 — 项目对象从 resources 代理读，而不是 IAM

**为什么**：`namespaces` 是核心资源。第一次实现时按「项目属于 IAM」的想法去拼 `iam.kubesphere.io/.../namespaces/<ns>`，那会 404。项目列表本来就从 resources 代理读，详情沿用同一来源，两处不会给出不同答案。

**被否方案**：在 IAM 组下找命名空间端点。该组不服务核心资源。

**何时重新考虑**：平台提供聚合的项目详情接口时。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-02 — 配额缺失是空态，不是错误

**为什么**：共享集群上大多数项目没有 ResourceQuota，这是正常配置；把「没有配额」渲染成错误面板会让管理员以为页面坏了。

**被否方案**：配额请求失败时整体报错。会让一个可选区块拖垮整页。

**何时重新考虑**：平台把配额设为项目必需项时。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-03 — 表单键去掉点号，提交时映射回资源名

**为什么**：`ResourceForm` 用 `setByPath` 存值，把键里的 `.` 当作**嵌套路径**。`requests.cpu` 会被写成 `{ requests: { cpu: … } }`，而提交时按扁平键读取，于是拿到空串——配额对象建出来了，`spec.hard` 却是空的。这个失败不报错，只表现为「点了保存但没生效」。

**被否方案**：改 `setByPath` 支持字面量键。那会改变所有表单的路径语义，风险远大于收益。

**何时重新考虑**：出现大量带点号的字段名时，给 `FormFieldSchema` 增加 `path: false` 选项。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-04 — 空值删除而不是存 0

**为什么**：Kubernetes 用「键不存在」表示不限制，用 `"0"` 表示禁止。把空输入框存成 0 会把「不限制」变成「完全禁止」，方向正好相反。

**被否方案**：空值存 `"0"`。会让清空配额的操作用户以为已解除限制，实际是整个资源被禁用。

**何时重新考虑**：不需要。

## 系统现状

老 console `projects/containers/BaseInfo`：项目信息块 + 资源配额 + 默认容器配额（LimitRange），并支持编辑。本模块先做只读的两块。

## 仓库落点

- `apps/console-next/src/pages/settings/ProjectInfoPage.tsx`
- `packages/api-client/src/iam.ts` 的 `toProjectInfo` / `projectInfoApi`
- `src/routes/.../baseinfo/`

## 对外契约

读 `resources.kubesphere.io/v1alpha3/namespaces/<ns>` 与 `/api/v1/namespaces/<ns>/resourcequotas`。

## 不变量

企业空间列等于 `kubesphere.io/workspace` 标签。

## 已知坑

- 命名空间上 `kubesphere.io/namespace` 标签与工作空间标签同时存在，取错会显示项目名当作企业空间。
- 配额接口在无对象时返回空 `items`，不是 404。

## 测试与可观测

E2E 见 `tests/kube-frontend/project-settings/`。

## 后续改进

编辑项目信息与配额、默认容器配额区块。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-01`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-02`
