# 服务账户（L2）

## 概述

项目内的 ServiceAccount 管理页，替代老控制台 `配置 → 服务账户`（`/clusters/:cluster/projects/:namespace/serviceaccounts`）。它比配置字典、保密字典多两件事：

1. **项目角色**：KubeSphere 把项目角色写在注解 `iam.kubesphere.io/role` 上，列表有一列、创建/修改各有一个角色选择器。
2. **kubeconfig**：详情页把服务账户挂载的令牌 Secret 组装成可直接使用的 kubeconfig，支持复制与下载——这是该页面存在的主要理由。

入口：`/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/serviceaccounts`，与配置字典、保密字典并列在侧栏「配置」组。

## 用户故事

### US1 - 作为项目成员，看到每个服务账户的角色与令牌

**Independent Test**：打开列表，确认每条显示名称（别名替换）、描述、角色、保密字典（可点击到对应 Secret 详情）与创建时间。

### US2 - 作为需要命令行访问的用户，拿到某个服务账户的 kubeconfig

**Independent Test**：打开一个有令牌的服务账户详情，数据区出现该令牌 Secret，下方显示 kubeconfig；点「下载」得到 `kubeconfig.yaml`，其中的 `server`、`token`、`ca` 与 Secret 内容一致。

### US3 - 作为项目成员，给服务账户分配项目角色

**Independent Test**：行操作「修改角色」里选 `project-editor` 并确认；列表角色列变为 `project-editor`，`kubectl get sa <name> -o jsonpath='{.metadata.annotations}'` 出现 `iam.kubesphere.io/role: project-editor`。

## 验收场景

- **AC-FULL-KUBE_FRONTEND-SERVICEACCOUNTS-01** — Given 项目内有一个带令牌 Secret 的服务账户，When 打开它的详情，Then 属性区显示集群、项目、角色、创建时间、创建者；数据区按令牌 Secret 展示键值（默认遮挡）并给出 kubeconfig 文本，可下载。

## 页面结构

| 区域 | 内容 | 说明 |
|---|---|---|
| 页头 | 标题「服务账户」、说明 | 只出现一次 |
| 工具条 | 项目筛选、搜索、「批量删除」、「创建」 | 主操作是「创建」 |
| 列表 | 名称（别名替换）、项目、角色、保密字典、创建时间、操作 | 保密字典列可点击跳转 |
| 详情 | 属性区（集群、项目、角色、创建时间、创建者）+ 数据区（每个令牌 Secret 一块：数据 + kubeconfig） |

## 异常态

| 状态 | 触发 | 呈现 |
|---|---|---|
| `loading` | 首次加载、翻页 | 骨架行 |
| `empty` | 无服务账户 | 「暂无服务账户」 |
| `error` | 请求失败 | 一句人话 + 重试（403 不给重试） |
| 无令牌 | 服务账户存在但控制器尚未生成令牌 | 数据区提示「该服务账户没有绑定令牌……」，不报错 |
| 角色列表失败 | `iam` 接口不可用 | 角色选择器为空并提示，仍可创建不带角色的账户 |

## 设计目标

- **kubeconfig 一键可用**：用户不必自己拼 `ca.crt` 与 token。
- **角色可见**：角色决定权限，却藏在注解里；列表与详情都必须展示。
- **与老控制台一致**：列、行操作、属性顺序、kubeconfig 结构逐项对齐。

## 约束与边界

- 读走 kapis `resources.kubesphere.io/v1alpha3/namespaces/{ns}/serviceaccounts`，写走 `/api/v1`。
- 角色列表走 `kapis/iam.kubesphere.io/v1alpha2/namespaces/{ns}/roles`（与老控制台 `RoleStore` 同一端点），`limit=-1`。
- 修改角色是**注解 patch**（`application/merge-patch+json`），不是整对象 PUT：服务账户的 `secrets[]` 由控制器维护，整对象写回会与之竞争。
- kubeconfig 的 `server` 固定为 `https://kubernetes.default.svc:443`（集群内地址，与老控制台一致）；`token` 取 `data.token` 的解码值；`certificate-authority-data` 取 `data['ca.crt']`。
- 详情要自己按名字拉取令牌 Secret（kapis 不把 Secret 内联进 ServiceAccount）。

## UI 交互设计

- 行操作顺序与老控制台一致：编辑 → 编辑 YAML → 修改角色 → 删除。注意第一条文案是「编辑」而不是「编辑信息」——老控制台这一页如此。
- 详情头部四个操作：编辑信息、编辑 YAML、修改角色、删除。
- 每个令牌 Secret 一块：上方键值（默认遮挡，眼睛切换），下方只读 kubeconfig + 复制 / 下载。
- 删除与保密字典共用输入名称确认。

## 功能需求

- **FR-FULL-KUBE_FRONTEND-SERVICEACCOUNTS-01** — 列表必须展示角色与令牌 Secret 名称，角色不在时留空而不显示占位词。
- **FR-FULL-KUBE_FRONTEND-SERVICEACCOUNTS-02** — 详情必须为每个令牌 Secret 生成 kubeconfig，并提供复制与下载。

## 成功标准

- **SC-FULL-KUBE_FRONTEND-SERVICEACCOUNTS-01** — 下载的 kubeconfig 用 `kubectl --kubeconfig` 在集群内可直连（`kubectl get ns` 成功，且权限与角色一致）。

## 明确不做

- 不生成新令牌（由集群控制器完成；旧版 `TokenController` 已不再使用）。
- 不编辑 `secrets[]` 与 `imagePullSecrets`（走 YAML）。
- 不做 workspace 级或集群级服务账户列表。
- 不做角色重新绑定（只改注解，不改 RoleBinding）。

## 假设

- 新版本集群默认不再自动生成令牌 Secret（`LegacyServiceAccountTokenNoAutoGeneration`），此时详情显示「没有绑定令牌」，用户可以自行创建令牌 Secret 并在 YAML 中把它挂到 `secrets`。

## 功能点

- 服务账户列表（`list`）
- 按名称搜索（`search`）
- 服务账户详情与 kubeconfig（`detail`）
- 创建服务账户（`create`）
- 编辑服务账户（`edit`）
- 修改角色（`role`）
- 删除服务账户（`delete`）
- 智能体可操作性（`ai-surface`）
- 移动端适配（`mobile`）

## 验收用例

- `TC-FULL-KUBE_FRONTEND-SERVICEACCOUNTS-01`
