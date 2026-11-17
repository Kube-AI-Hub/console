# 企业空间角色写能力（2026-11-17）

> 本批交付证据。范围是**企业空间角色页**的写能力：创建（模板组合）、编辑信息、编辑权限、删除。
> 重纳决策 N-21 / DEC-18；详情页保持只读（与项目角色页一致）。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 企业空间管理员在 /kube-frontend/workspaces/<ws>/roles 维护本空间自定义角色，平台预置角色只读 |
| 旧入口、部署 URL | 旧 console /workspaces/:ws/roles 列表与详情（RoleStore('workspaceroles')）；B200 本地全栈验收 |
| 新入口 | 列表页主操作「创建角色」+ 行操作「编辑信息 / 编辑权限 / 删除」 |
| 环境、集群、角色 | B200 本地全栈（静态站 5176 → BFF 8092 → B200）；admin；TC-11 **1 passed（14.02s）** |
| 视口、主题 | 1600×1000 深浅列表 + 创建对话框；删除后截图见 §8 |
| 子页面与状态范围 | 创建/编辑信息/编辑权限/删除；平台预置角色只读；校验失败与写失败保留弹窗 |
| 明确排除及批准 | 详情页写操作不做（入口统一在列表，与项目角色约定一致）；不改平台模板/预置角色 |
| 并行/安全边界 | 只改本页/API/文案；E2E 自建唯一角色并删除，平台角色未动 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/断言 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-WSROLE-01 | 旧列表（名称/描述/创建时间） | 空间成员 | 刷新/分页 | 既有读取（名称/规则数/创建时间） | AC-03；TC-03 | 既有 |
| LEG-WSROLE-02 | 旧创建（模板复制） | 空间管理员 | 名称/别名/描述 + 权限模板 | 创建对话框（19 个模板复选框）；POST IAM 聚合，rules: [] + aggregation-roles | AC-11；TC-11 | 通过 |
| LEG-WSROLE-03 | 旧编辑信息 | 空间管理员 | 别名/描述 | 行操作；merge-patch 只发 annotations，清空键 null | AC-11；TC-11 | 通过 |
| LEG-WSROLE-04 | 旧编辑权限 | 空间管理员 | 模板集合 | 行操作；PATCH 只替换 aggregation-roles | AC-11；TC-11 | 通过 |
| LEG-WSROLE-05 | 旧删除（输入确认） | 空间管理员 | 输入角色名 | 行操作 + DeleteDialog；成功后回读集合 | AC-11；TC-11 | 通过 |
| LEG-WSROLE-06 | 旧预置角色不可写 | — | 隐藏写入口 | creator=system 或 role-template-* 隐藏行操作 | AC-11；TC-11 预置行无「更多操作」 | 通过 |

**计数**：6 项；既有读 1、写 5 全部实现；E2E/截图通过（B200）。

## 3. 数据契约与全链路

| 能力 ID | 请求/方法 | 字段 | 规则 | 映射 | 异常 | 断言 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-WSROLE-02 | POST /kapis/iam…/workspaces/<ws>/workspaceroles | metadata.name、annotations.aggregation-roles（JSON 数组）、rules: [] | 模板来自 labelSelector=iam.kubesphere.io/role-template（实测 19 个）；规则由服务端聚合 | workspaceRolesWriteApi.create | 名称为空/非法、未选模板在对话框拦下；服务端错误显示在弹窗 | api 单测 + E2E 回读 rules 非空 |
| LEG-WSROLE-03 | PATCH 对象（merge-patch） | metadata.annotations | 先读当前，只发改动键，删除键 null | updateInfo | 失败保留弹窗 | api 单测 + E2E 回读 |
| LEG-WSROLE-04 | PATCH 对象（merge-patch） | aggregation-roles | 只替换注解，客户端不写 rules | setTemplates | 失败保留弹窗 | E2E 回读模板变化 |
| LEG-WSROLE-05 | DELETE 对象 | — | 删除需输入对象名；成功后 invalidate 列表 | remove | 404 视为已删除 | E2E 404 + 行消失 |
| LEG-WSROLE-06 | — | creator / name 前缀 | creator=system 或 role-template-* 隐藏写入口 | isReadOnlyWorkspaceRole | 无入口而非点击失败 | 组件单测 + E2E 预置行无菜单按钮 |

## 4. 交互、视觉与复用基线

| 项 | 约定 | 验证 |
| --- | --- | --- |
| 列表 | 右上创建；行操作三项仅自定义角色显示；分页保持 | 截图 + E2E |
| 对话框 | 创建：名称/别名/描述 + 模板复选框（规则数提示）；编辑权限：仅模板复选框并预填当前集合 | 组件测试 + E2E |
| 校验 | 名称正则；至少一个模板；错误就地显示 | 组件测试 |
| 复用 | 复用 ResourceList/Modal/EditInfoDialog/DeleteDialog/actionProps；新增 WorkspaceRoleDialog（项目角色对话框把 namespace 与 RBAC 路径写死，不强行参数化） | 契约 1508 通过 |
| 视觉 | 深浅 1600 列表/创建对话框；删除后状态截图 | 截图见 §8 |

## 5. 编码与回归

- [x] US2/AC-11/DEC-18 覆盖创建、编辑信息、编辑权限、删除、预置只读。
- [x] API 单测 5 条、组件测试 4 条、E2E TC-11（B200）。
- [x] 模板角色不入普通列表的部署事实已记录；只读断言改为预置角色行无入口。
- [x] tsc/contracts/api/build 通过。
- [x] 未提交/未推送；并行文件未回退。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 6 项：既有 1 + 写 5 | — |
| 数据语义 | 通过（B200） | 创建后 rules 非空、模板注解正确；编辑信息/权限回读；删除 404 | — |
| 交互与权限 | 通过（admin） | 创建/编辑/删除全流程；预置角色无写入口 | 非 admin / 无权限 |
| 视觉 | 通过（B200 1600/1280/1024 深浅） | 列表/创建对话框/删除后截图 + 三档深浅 | 旧站对照未生成 |
| 静态/类型/构建/测试 | 通过 | tsc 0；contracts 1508；api 432；组件 4；build 通过 | — |
| 部署/全站 | 未执行 | — | 镜像部署与全站串行 E2E |

## 7. 测试命令与结果

    cd console/kube-frontend
    npx tsc --noEmit -p apps/console-next/tsconfig.json → 0 error
    pnpm --filter @kube-ai-hub/api-client test → 44 files / 432 passed（含 workspace-role-writes 5）
    npx vitest run --config config/vitest.config.ts → 18 files / 1508 passed
    cd apps/console-next && npx vitest run test/workspace-role-writes.test.tsx → 4 passed
    pnpm --filter @kube-ai-hub/console-next build → 通过

    # E2E（B200 本地全栈）
    KA_APP_URL=http://localhost:5176 KA_CLUSTER=host KA_USERNAME=admin KA_PASSWORD=*** \
      pytest tests/.../test_TC_L3_..._WORKSPACE_CONSOLE_11.py -n 0 → 1 passed (14.02s)

## 8. 截图与记录

assets/workspace-roles-write-20261117/new：list-{dark,light}-1600.png、create-{dark,light}-1600.png、list-after-delete-dark-1600.png。

## 9. 剩余项与复查条件

| 项 | 状态 | 复查条件 |
| --- | --- | --- |
| 旧站对照 | 未生成 | 设计走查时补 |
| 非 admin / 无权限 | 未验收 | 普通空间成员账号，核对无创建/写入口与错误提示 |
| 模板角色在列表中的部署差异 | 已记录 | 若某部署把模板角色列入普通集合，同一 creator/前缀规则仍隐藏写入口 |
| 部署/全站 | 未执行 | 镜像与全站串行 E2E |

## 10. 流程反思

| 本批踩到的事 | 已写入 |
| --- | --- |
| 只读行的写入口是**不渲染**而不是空菜单；自动化先找菜单按钮会超时 | 指南 §8 #33：只读断言查入口句柄/按钮数量，不要假定菜单存在 |
| 新增 summary 字段（creator/annotations）会让既有深比较单测失败 | 同批更新期望；summary 变更需同步所有精确断言 |

## 11. 关联文档

- PRD：prd/kube-frontend/access-control/workspace-roles.md（US2/AC-11）
- design：design/kube-frontend/access-control/workspace-roles.md（DEC-18 交付）
- 用例：TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-11
- 既有读取：TC-…-03
