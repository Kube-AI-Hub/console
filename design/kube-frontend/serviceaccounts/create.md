# 创建服务账户 · 技术方案（L3）

> 承接 [`prd/kube-frontend/serviceaccounts/create.md`](../../../prd/kube-frontend/serviceaccounts/create.md)。

## 概述

单步弹窗：名称、项目、别名、描述、项目角色，附 YAML 模式。角色选项来自 `useProjectRoles()`，随项目变化重新加载。

## 关联需求

- `AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-CREATE-01`
- `AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-CREATE-02`

## 设计目标与非目标

**目标**：项目与角色在同一步内可改且互相联动；角色列表失败不阻塞创建。

**非目标**：令牌自动创建、`imagePullSecrets` 选择、批量创建。

## 关键约束

- 角色为空时不写 `iam.kubesphere.io/role` 注解（`toKubeServiceAccount` 只在非空时写入）。
- 切换项目清空角色并触发该项目的角色查询（查询键含 namespace）。
- 名称、别名、描述校验与保密字典共用文案（`resource.validate.*`）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-01 — 不写空角色注解

**为什么**：创建一个「还没有角色」的账户，最准确的表示是「没有这个注解」，而不是写入空字符串。后者会让 `kubectl describe` 看起来像设置了一个叫空串的角色。

**被否方案**：总是写注解（与修改角色时清空的方式一致）。修改角色清空时写空串是保留注解以便与 patch 语义一致；创建时没有这个包袱。

**何时重新考虑**：若有下游组件依赖「注解存在」判断角色来源，则补写空串。

### DEC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-02 — 角色选择器可搜索

**为什么**：项目角色可能很多（包括自定义角色）。老控制台 `RoleSelect` 使用可搜索的 `Select`；保持同样行为。

**被否方案**：普通下拉。角色多时需要滚动很久。

## 系统现状

老控制台 `components/Forms/ServiceAccount/BaseInfo` 单步表单；本实现保持字段顺序，并加 YAML 模式。

## 仓库落点

| 层 | 路径 |
|---|---|
| 弹窗 | `apps/console-next/src/pages/serviceaccounts/ServiceAccountCreateDialog.tsx` |
| 角色查询 | `apps/console-next/src/pages/serviceaccounts/queries.ts`（`useProjectRoles`） |
| 提交映射 | `packages/api-client/src/serviceaccounts.ts`（`toKubeServiceAccount`） |

## 对外契约

`POST /api/v1/namespaces/{ns}/serviceaccounts`。

## 不变量

- **INV-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-01** — 角色为空时请求体中不出现 `iam.kubesphere.io/role`。
- **INV-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-02** — 角色选项全部来自所选项目的角色列表。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-01** — ai-kit 可搜索 `Select` 不透传 `data-ai-id`；直接挂在它上面，自动化会超时。
  处置：`AiSurface` 包裹并承载 `serviceaccounts:field-role`（见保密字典技术方案中句柄包裹的决策）。
- **GOT-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-02** — `actionProps` 展开在 `onValueChange` 之后会让角色选择失效（实测中复现）。
  处置：展开顺序固定在回调之前。

## 测试与可观测

- 单元：`test/serviceaccounts-page.test.tsx`（不写空角色、切换项目清空角色）。
- 端到端：`TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-01..02`。

## 后续改进

若集群开启了令牌自动生成，可在创建成功后提示「令牌生成中」。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-01`
- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-02`
