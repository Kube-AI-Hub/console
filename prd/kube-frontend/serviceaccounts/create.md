# 创建服务账户（L3）

## 概述

创建入口在列表工具栏。老控制台的创建是一步表单（`configs/steps/serviceaccounts.js` 只有一个「基本信息」步骤），字段为名称、别名、项目、描述、项目角色；本页保持同样的一步，并加上与其它资源一致的 YAML 模式。

## 用户故事

### US1 - 作为项目成员，创建一个带项目角色的服务账户

**Independent Test**：创建 → 名称 `ci-bot` → 角色选 `project-editor` → 提交；列表出现 `ci-bot`，角色列为 `project-editor`。

### US2 - 作为项目成员，不指定角色创建一个账户

**Independent Test**：创建时角色保持「不设置」，提交后对象上没有 `iam.kubesphere.io/role` 注解。

## 验收场景

- **AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-CREATE-01** — Given 创建弹窗已打开，When 名称非法或与同项目已有对象重名，Then 提示对应错误且不提交；When 填写合法名称并选择角色，Then 提交后对象创建到所选项目，`metadata.annotations['iam.kubesphere.io/role']` 等于所选角色，描述写入 `kubesphere.io/description`。
- **AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-CREATE-02** — Given 角色保持「不设置」，When 提交，Then 对象被创建且不带角色注解；When 切换项目，Then 角色选择被清空并重新加载该项目的角色列表。

## 设计目标

- 角色是账户的核心属性，创建时就该能设定，而不是先建再改。
- 切换项目时清空角色：角色属于项目，跨项目沿用的名字可能不存在。

## 约束与边界

- 名称规则与其它资源相同（小写字母、数字、连字符，最长 63）；别名、描述规则相同。
- 角色选项来自 `kapis/iam.kubesphere.io/v1alpha2/namespaces/{ns}/roles?limit=-1`，与老控制台 `RoleSelect` 一致；加上「不设置」作为默认空选项。
- 角色列表加载失败时不阻塞创建：仍可创建不带角色的账户。
- YAML 模式中 `metadata.annotations` 上的角色会被保留。

## UI 交互设计

- 弹窗宽 `xl`，字段顺序：名称、项目、别名、描述、项目角色。
- 角色选择可搜索（老控制台 `RoleSelect` 同样可搜索）。
- 底部三个按钮：取消、编辑 YAML、创建。

## 文案与校验

- 标题：创建服务账户。按钮：取消、编辑 YAML、创建。
- 提示：角色决定该服务账户在项目内的权限，可在创建后修改。
- 校验：与保密字典共用（请设置一个名称。／名称无效…／名称已存在…／请选择项目。／别名无效…／描述最长 256 个字符。）。

## 边界情况

- 项目没有可选角色：选择器显示「该项目没有可选的角色」，仍可提交。
- 角色列表正在加载：选项区显示「加载中」。
- 名称为保留字（如 `default`）且已存在：按重名处理。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-01** — 创建必须把所选角色写入 `iam.kubesphere.io/role` 注解。
- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-02** — 切换项目必须清空角色并重新拉取角色列表。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-01** — 创建后 `kubectl get sa <name> -o json` 的注解与表单一致。

## 明确不做

- 不做令牌自动创建（集群决定）。
- 不做 `imagePullSecrets` 选择（走 YAML）。
- 不做批量创建。

## 假设

- 不选角色时上游不要求该注解；KubeSphere 视其为「无项目角色」。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-01`
- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-02`
