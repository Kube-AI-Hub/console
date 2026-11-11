# 服务账户列表（L3）

## 概述

服务账户页的主表格。老控制台同一页面是 `pages/projects/containers/ServiceAccounts/index.jsx`：名称（`Avatar`，别名替换）、角色（`record.role`，来自注解 `iam.kubesphere.io/role`）、保密字典（`secrets[]` 每个一行链接到 Secret 详情）、创建时间（`YYYY-MM-DD HH:mm:ss`）。本页逐项照搬，另加「项目」列以支持跨项目视图。

## 用户故事

### US1 - 作为项目成员，看到每个服务账户的角色与它挂载的令牌

**Independent Test**：打开列表，读出一条服务账户：角色列显示注解里的角色名，保密字典列显示令牌 Secret 名称。

### US2 - 作为项目成员，从列表跳到某个令牌 Secret 的详情

**Independent Test**：点击保密字典列中的名称，跳到保密字典详情页，且显示的正是该 Secret。

## 验收场景

- **AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-LIST-01** — Given 项目内有多条 ServiceAccount，When 打开列表，Then 每行显示名称（别名替换名称，第二行为描述或 `-`）、角色、保密字典链接、创建时间；没有角色的行角色列为空。
- **AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-LIST-02** — Given 列表已加载，When 点击「保密字典」列中的某个名称，Then 进入该 Secret 的详情页（`/projects/<ns>/secrets/<name>`）；When 点击「名称」列头，Then 请求按 `sortBy=name` 重新发起。

## 设计目标

- 角色与令牌是这一页的信息主体：二者都决定「这个账户能做什么、以谁的身份做」。
- 令牌列直接可点，省掉「复制名称再搜索」的一步。

## 约束与边界

- 角色缺失时不显示「无」：空单元格表示未设置，填写占位词会被误读为某个角色叫「无」。
- 令牌只显示 `secrets[]`（控制器绑定的令牌），不显示 `imagePullSecrets`（老控制台也不显示）。
- 列可见性：`role`、`secrets` 在 `lg` 以下隐藏，`createTime` 在 `md` 以下隐藏，`project` 只在 `xl` 以上显示。
- 分页固定 10 条，服务端切片。

## UI 交互设计

- 保密字典列每条一行链接；多条令牌时纵向排列。
- 无令牌显示 `-`。
- 联邦对象追加「联邦」徽标。

## 文案与校验

- 表头：名称、项目、角色、保密字典、创建时间、操作。

## 边界情况

- 令牌 Secret 已被删除但仍在 `secrets[]` 中（控制器未及时更新）：链接仍生成，目标页显示「资源不存在」——与老控制台一致，不做额外隐藏。
- 名称很长：截断并保留 `title`。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-01** — 列表必须展示角色与令牌 Secret 名称。
- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-02** — 令牌名称必须链接到保密字典详情，路径带上该对象自己的项目。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-01** — 名称集合与 `kubectl get sa -n <ns>` 一致，角色与 `-o jsonpath='{.metadata.annotations}'` 一致。

## 明确不做

- 不在列表展示 kubeconfig 或令牌内容。
- 不做列显隐设置。

## 假设

- `secrets[]` 中的每项都有 `name`。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-01`
- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-02`
