# 租户(企业空间)用户组迁移记录

> 当前批次证据。台账入口见[能力矩阵](capability-matrix.md) CHECK-05。
> 未提交。不要把本文件追加到其它历史计划。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 租户(企业空间)管理员维护该空间部门树（IAM Group），并把平台用户加进或移出选定组。成员在 `GroupBinding`，组本身不含成员列表。创建/编辑时绑定租户(企业空间)角色。 |
| 旧入口、源码 | `/workspaces/:ws/groups`；`src/pages/workspaces/containers/Groups/**`；SET_DEPARTMENTS 弹窗 + 已分配/未分配双栏。 |
| 新入口 | `/kube-frontend/workspaces/<ws>/user-groups`；`WorkspaceUserGroupsPage.tsx`、`WorkspaceUserGroupDialog.tsx`；写路径 `workspaceGroupsApi`。本地 5178 + BFF 8092。未部署生产前端。 |
| 环境 | 实测 `system-workspace`。截图组 `shot-ug-a`（对象 `shot-ug-a85mb6`）已用 DeleteDialog 确认词 `shot-ug-a` 删掉，接口回读空集。 |
| 视口、主题 | 1024 / 1280 深色中文。英文、浅色未作为本页主验。 |
| 明确排除及批准 | 项目/DevOps 角色 ArrayInput（跨作用域授权）；未分配用户双栏点选；websocket watch；多集群项目角色。 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作 | 归宿 | 新 AC/用例 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-UG-001 | Banner / 侧栏 Groups | 空间管理员 | 侧栏「用户组」 | 保留 | AC-WORKSPACE_CONSOLE-04 | 通过 |
| LEG-UG-002 | GroupTree + parent 标签 | 恒显 | 树；根是空间名 | 改进：主区左树，不再藏进设置部门弹窗 | AC-04；DEC-10 | 通过（改进） |
| LEG-UG-003 | 节点成员数 | 恒显 | groupbindings 合并 | 保留客户端 join | AC-04；DEC-09 | 通过 |
| LEG-UG-004 | 空集 | G=0 | 空态 + 创建 | 保留「还没有用户组」 | AC-04 | 通过 |
| LEG-UG-005 | 创建 generateName + 别名 + 上级 + 空间角色 | 可写 | POST Group，再 POST workspacerolebindings **数组** | 保留小表单 | AC-05 | 通过（E2E） |
| LEG-UG-006 | 编辑别名/上级/角色 | 可写 | merge-patch；角色变则换 binding | 保留 | AC-05 | 通过（E2E） |
| LEG-UG-007 | 删除；有下级拒绝 | 可写 | 先清 binding 与 rolebinding | 保留；确认词是 generateName | AC-05；DEC-13 | 通过（E2E） |
| LEG-UG-008 | 添加成员 | 已选组 | POST `[{userName,groupName}]` | 改进：输入已有用户名 | AC-06；DEC-12 | 通过（E2E） |
| LEG-UG-009 | 移除成员 | 行操作 | 按 label 找 binding 再 DELETE | 保留；不删平台账号 | AC-06 | 通过（E2E） |
| LEG-UG-010 | SET_DEPARTMENTS 项目/DevOps ArrayInput | 旧弹窗 | 写项目 rolebindings | 批准不做：跨作用域授权 | PRD 明确不做 | 批准不做 |
| LEG-UG-011 | 未分配用户双栏 | ingroup/notingroup | 全量平台用户 | 批准不做：与邀请同一摩擦 | DEC-12 | 批准不做 |
| LEG-UG-012 | websocket watch | 旧页 | 实时刷新 | 批准不做 | PRD 明确不做 | 批准不做 |

## 3. 数据契约

| 用途 | 路径 | 对账 |
| --- | --- | --- |
| 列组 | GET `…/workspaces/<ws>/groups?limit=-1` | 树节点数 = items |
| 列绑定 | GET `…/groupbindings?limit=-1` | 节点人数 = 指向该组的 `users` 长度之和 |
| 创建 | POST groups（`metadata.generateName`） | 对象名由服务端生成；显示名是 generateName / 别名 |
| 空间角色 | POST workspacerolebindings **数组** | 409 忽略 |
| 加人 | POST groupbindings 数组；先 GET `/users/<name>` | 账号不存在不写 |
| 删组 | DELETE bindings → rolebindings → group | 有 `group-parent` 指向自己则客户端拒绝 |

## 4. 交互与视觉

| 项 | 验证 |
| --- | --- |
| 空态 | [1024](assets/workspace-user-groups-20261115/user-groups-list-1024-empty.png)、[1280](assets/workspace-user-groups-20261115/user-groups-list-1280-empty.png)：标题「用户组」，描述含「租户(企业空间)」，空文案「还没有用户组」/「先创建一个用户组，再把成员加进去。」；「创建用户组」可见。1024：刷新 x=858 y=88，创建 x=916 y=88。1280：刷新 x=1114 y=88，创建 x=1172 y=88（间距 8px）。 |
| 创建弹窗 | [创建](assets/workspace-user-groups-20261115/user-groups-create-dialog.png)：名称 / 别名 / 上级（根选项「租户(企业空间)」）/ 租户(企业空间)角色，取消 / 确认。 |
| 树 + 成员 | [1024 树](assets/workspace-user-groups-20261115/user-groups-tree-1024.png)：左树根 `system-workspace`，节点「演示部门」人数 0；右侧组头「添加成员 / 编辑用户组 / 删除用户组」同一行 y=144（x=742 / 822 / 916）；无成员时不出现搜索与「清空搜索与筛选」。 |
| 删除确认 | 确认词是 generateName（`shot-ug-a`），不是对象名；删后接口 items 空，页面 `data-ai-state=empty`。 |
| 侧栏 | 配额 / 租户(企业空间)成员 / 租户(企业空间)角色 / 用户组 |

## 5. 测试

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @kube-ai-hub/console-next` typecheck | 0 errors |
| `python3 prd/tools/check_docs.py --strict` workspace-user-groups | errors=0 warnings=0 |
| vitest `workspace-groups.test.ts` | 6 passed |
| `pytest` WORKSPACE_CONSOLE-04/05/06 `KA_APP_URL=http://localhost:5178` | 3 passed / 25.73s；06 在「添加成员」挪到组头后复跑 1 passed / 9.62s |

## 选择依据

CHECK-05 在配额之后是部门/用户组。旧页把树藏在设置部门弹窗、把加人做成全量用户双栏；新页把树放主区、加人按用户名，空间角色仍在创建/编辑里写。项目/DevOps 角色数组留给跨作用域授权。跳过 B200 部署：仅新 UI。
