# 租户(企业空间)用户组 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/workspace-user-groups.md)

**技术方案 ID**：`DES-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE`

## 概述

用户组页读 `groups` + `groupbindings`，在客户端拼部门树并统计成员；写路径封装在 `workspaceGroupsApi`：创建 Group 后补 WorkspaceRoleBinding，成员走 GroupBinding 数组 POST，移除先查 binding 再 DELETE。

## 关联需求

- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06`

## 设计目标与非目标

- **目标**：把旧部门页的树、组 CRUD、组成员增删和空间角色绑定收进同一 API 与同一页，页面不再直接拼 IAM URL。
- **非目标**：项目/DevOps 角色数组、未分配用户双栏、watch。

## 关键约束

- 组：`GET/POST /kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/groups`，PATCH/DELETE 对象路径。
- 绑定：同前缀 `groupbindings`；POST 体是 `[{userName, groupName}]`，不是 Kubernetes Binding 对象。
- 空间角色：POST `workspacerolebindings` 的体是 **数组**，与旧 `addWorksapceRoleBinding` 一致。
- 显示名是 `metadata.generateName`；对象名才是 binding 的 `groupRef.name`。
- 中文产品名「租户(企业空间)」，键名不改。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-09 — 成员数在客户端由 groupbindings 合并

**为什么**：成员关系只存在于绑定对象，绑定集合可以一次读完；逐组查用户既没有稳定接口也没有必要。
**被否方案**：`/users?ingroup=` 每组一次。那需要用户列表权限，而且把「人数」和「加人」绑死在同一接口。
**何时重新考虑**：组数量很大、需要服务端分页与成员过滤时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-10 — 树用 parent 标签在客户端拼，不复刻设置部门弹窗

**为什么**：旧页把树和表单拆在 SET_DEPARTMENTS 大弹窗里，主页面只读。新页把树放在主区，创建/编辑用小表单，少一层模态，仍写同一个 `iam.kubesphere.io/group-parent`。
**被否方案**：继续做平铺列表。旧能力的层级会丢。复刻整个 EditGroup 弹窗（含项目/DevOps ArrayInput）会把跨作用域授权混进本组。
**何时重新考虑**：产品要求回到「先设部门、再管成员」两步向导时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-11 — 写路径进 api-client，不再页面直打 request

**为什么**：创建组要连续写 Group、WorkspaceRoleBinding、之后还要写 GroupBinding；这些路径和数组 POST 形状一旦写错，页面和测试会对不上。读也走同一模块，避免列表 join 与写入用两套 URL。
**被否方案**：本页继续 `apiClient.request`（上一轮只读列表的决定）。写路径一出现，页面就会复制 store/group.js。
**何时重新考虑**：IAM 提供聚合「创建组并加人」的单接口。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-12 — 加人按用户名，不拉未分配用户全表

**为什么**：旧未分配页是全量平台用户 + `notingroup`。新控制台的邀请已经统一成「输入已有用户名并先验账号」；组成员沿用同一摩擦，避免在用户组页加载数千平台账号。
**被否方案**：双栏点选。会把用户列表权限和分页重新引入本页。
**何时重新考虑**：产品明确要求从空间成员里勾选加人。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-13 — 有下级的组拒绝删除，不递归删

**为什么**：旧页对父组有单独提示。递归删除会在一次确认里拆掉整棵部门树，DeleteDialog 的确认词也无法覆盖所有子孙名。
**被否方案**：级联删除。误点代价不可逆。
**何时重新考虑**：产品要「删除部门及全部下级」并改成输入组数确认。

## 系统现状

旧 `pages/workspaces/containers/Groups`：GroupTree + GroupUser（ingroup/notingroup）+ EditGroup 弹窗（generateName、别名、空间角色、项目/DevOps ArrayInput）。store `stores/group.js` 创建后补 workspacerolebinding 与 rolebindings。新页此前是平铺只读列表，无主操作。

## 仓库落点

- 页面：`apps/console-next/src/pages/workspace/{WorkspaceUserGroupsPage,WorkspaceUserGroupDialog}.tsx`
- 接口：`packages/api-client/src/access.ts` 的 `workspaceGroupsApi` / `workspaceGroupForest`
- 文案：`packages/locales/src/index.ts`（`workspace.userGroups.*`）
- 后端：不改

## 对外契约

| 用途 | 路径 | 字段 |
| --- | --- | --- |
| 列组 | GET `.../workspaces/<ws>/groups?limit=-1` | `metadata.name`、`generateName`、alias、parent 标签 |
| 列绑定 | GET `.../groupbindings?limit=-1` | `groupRef.name`、`users[]` |
| 创建组 | POST `.../groups` | `metadata.generateName` + workspace / parent 标签 + 角色注解 |
| 空间角色 | POST `.../workspacerolebindings` | **数组**，subject 为 Group 对象名 |
| 改组 | PATCH merge-patch `.../groups/<name>` | 别名、parent、角色注解 |
| 删组 | DELETE `.../groups/<name>`；先清该组 binding 与 rolebinding | |
| 加人 | POST `.../groupbindings` | `[{userName, groupName}]` |
| 移除 | GET binding（`group-ref`+`user-ref`）后 DELETE 对象 | |

## 不变量

1. 树节点集合 = groups 接口 items，脏绑定不产生节点。
2. 成员数 = 指向该组的 bindings 的 `users` 长度之和。
3. 创建提交的是 generateName，绑定与删除用对象名。
4. 删除有 `group-parent` 指向自己的组时，客户端拒绝，不发 DELETE。
5. 加人先 GET `/users/<name>`，账号不存在则不写 binding。

## 已知坑

- `generateName` 不是 K8s「随机后缀前缀」的常规用法，这里是 KubeSphere 显示名。不要把对象名当主显示值。
- workspacerolebinding 与 groupbinding 的 POST 都是数组；发单对象会 4xx。
- 父标签缺对象时当根，避免树把组吞掉。
- 两个读请求必须都成功才算 ready；只成功一个会显示假空树。
- 有下级时 DeleteDialog 仍可输入确认词，`onConfirm` 必须再次拦住。

## 测试与可观测

用例：`WORKSPACE_CONSOLE-04/05/06`。API 单测覆盖 join、forest、POST 数组、账号校验、binding DELETE。句柄：`workspace-user-groups:surface/tree/tree-node/create/edit/delete/add-member/search/dialog/delete-input/delete-confirm`。树节点另有 `data-ai-generate-name`、`data-ai-depth`。

## 后续改进

跨作用域的项目/DevOps 角色数组；未分配用户勾选；websocket watch。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06`
