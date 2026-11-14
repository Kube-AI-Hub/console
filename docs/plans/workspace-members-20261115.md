# 租户(企业空间)成员迁移记录

> 当前批次证据。台账入口见[能力矩阵](capability-matrix.md) CHECK-05。
> 未提交。不要把本文件追加到其它历史计划。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 租户(企业空间)管理员管理空间成员：名单/搜索/邀请/改角色/移除/批量移除，点用户名看详情（身份属性、项目、DevOps）。作用域是 IAM `workspacemembers`，不是项目成员、不是平台用户删除。 |
| 旧入口、源码、部署 | 旧路由 `/workspaces/:ws/members`、`/workspaces/:ws/members/:name`（及 `/projects` `/devops` 子路由）；源码 `console/src/pages/workspaces/containers/Members/**`、`src/actions/workspace.js`。参考站 `https://console-dev.brightaitoken.ai`。 |
| 新入口、工作树、构建 | `/kube-frontend/workspaces/$workspace/members`、`…/members/$name`。页面 `WorkspaceMembersPage.tsx`、`WorkspaceMemberDetailPage.tsx`、`WorkspaceMemberDialog.tsx`；API `packages/api-client/src/access.ts` 的 `workspaceMembersApi`。本地静态 `http://localhost:5178/kube-frontend`，BFF `8092`。本批 `pnpm --filter @kube-ai-hub/console-next build`。未提交、未推送、未部署生产前端。 |
| 环境、集群、角色 | 本地新 UI 经 BFF 读 B200；对照旧站同集群 admin。实测空间 `system-workspace`。未测 member、未测生产 ks-console。 |
| 视口、主题、语言 | 实测 1024 / 1280 / 1600。深色中文为首屏；浅色中文一帧。英文未作为本页主验（产品名中文约束优先）。未切其它色调。 |
| 子页面与状态 | 列表：搜索、邀请、行改角色/移除、批量移除、自我保护。详情：基本信息、项目页签、DevOps 页签（404→空态）。 |
| 明确排除及批准 | 邀请不改成旧搜索弹窗（继续用户名 + GET）；详情页签不做成独立 URL；不删平台账号；项目成员/配额/用户组不在本页。 |
| 并行文件 | 未改 `continue-migration-prompt.md`、edge-nodes、devops、s2ibuilder。中文产品名「租户(企业空间)」写在共享 `packages/locales`。 |
| 产品名 | 界面中文一律「租户(企业空间)」，不得再单独写「企业空间」。英文仍为 Workspace。 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-MEM-001 | Members Banner 企业空间成员 | 空间管理员 | 侧栏入口 | 保留，文案改为「租户(企业空间)成员」 | AC-MEMBERS-01；侧栏与页头 | 通过 |
| LEG-MEM-002 | 列用户名+邮箱，链到详情 | 恒显 | 点名称进 `/members/:name` | 保留 Link | AC-MEMBERS-02 | 通过 |
| LEG-MEM-003 | 角色列 `workspacerole` | hideBelow md | IAM 注解 | 保留 | AC-MEMBERS-01/02 | 通过 |
| LEG-MEM-004 | 状态 `USER_ACTIVE/DISABLED` | hideBelow lg | 活跃/已停用 | 保留 i18n，不展示 Active | AC-MEMBERS-02 | 通过 |
| LEG-MEM-005 | 最近登录；空 NOT_LOGIN_YET | hideBelow xl | `status.lastLoginTime` | 保留 + 尚未登录 | AC-MEMBERS-02 | 通过 |
| LEG-MEM-006 | `searchType=name` | 恒有 | 客户端过滤当前集合 | 保留，额外匹配邮箱 | AC-MEMBERS-02 | 通过 |
| LEG-MEM-007 | 邀请：用户名+角色 | 主按钮 | 角色来自当前空间 workspaceroles；账号须存在 | 保留 ResourceForm | AC-MEMBERS-01 | 通过（E2E） |
| LEG-MEM-008 | 行：修改角色 | 非自己 | 用户名只读 | 保留 | AC-MEMBERS-01 | 通过（E2E） |
| LEG-MEM-009 | 行：移除 | 非自己 | 输入用户名确认；只解绑 | 保留 DeleteDialog | AC-MEMBERS-01 | 通过（E2E） |
| LEG-MEM-010 | 批量移除 | 勾选非自己 | 确认词是人数不是名单 | 保留顺序 DELETE | AC-MEMBERS-02 | 通过（E2E） |
| LEG-MEM-011 | 不能操作自己 | 当前用户名 | 无菜单、无 checkbox | 保留 `useAuth().user.name` | AC-MEMBERS-02；admin 行无更多、无勾选 | 通过 |
| LEG-MEM-012 | 详情 WORKSPACE / ROLE / EMAIL | 恒显 | 旧独立路由 | 保留同页属性；文案「租户(企业空间)」「租户(企业空间)角色」 | AC-MEMBERS-03 | 通过 |
| LEG-MEM-013 | 详情项目页签 | 恒显 | tenant `…/namespaces` | 保留页内 Tabs；名称链项目控制台 | AC-MEMBERS-03；admin 16 个项目 | 通过 |
| LEG-MEM-014 | 详情 DevOps 页签 | 旧受 ksModule 开关 | tenant `…/devops` | 改进：始终展示；404 空态 | AC-MEMBERS-03；空文案可见、无错误面板 | 通过（改进） |
| LEG-MEM-015 | 详情 `/projects` `/devops` URL | 旧两路由 | 可分享子 URL | 批准不做：页内 Tabs（DEC-03） | members.md 明确不做 | 批准不做 |
| LEG-MEM-016 | 邀请搜索用户弹窗 | 旧 Modal | 远程搜用户 | 批准不做：输入用户名 + GET | members.md 明确不做 | 批准不做 |

检查表：

- [x] 列表列/搜索/主操作/行菜单/批量/自我保护已拆开。
- [x] 详情属性、项目/DevOps 页签、404/空态分开。
- [x] 加载、空、搜索无匹配、读错误、403≠空、DevOps 404 各有归宿。
- [x] 旧能力已映射；新增仅产品名统一与详情 Tabs 改进。

## 3. 数据契约与全链路

| 能力 ID | 请求路径 | 字段 | 映射 | 缺值/异常 | 对账 |
| --- | --- | --- | --- | --- | --- |
| LEG-MEM-001..011 | GET IAM `/workspaces/<ws>/workspacemembers?limit=-1` | username、email、role 注解、status、lastLoginTime | `toWorkspaceMemberSummary` | 缺 status 当 Active；缺登录「尚未登录」 | 列表行=同次 items |
| LEG-MEM-007 | POST 同集合，体 `[{username, roleRef}]` | roleRef 必须是本次角色名 | 邀请 | 账号 GET 404 不可提交 | E2E 回读 role |
| LEG-MEM-008 | PUT `/workspacemembers/<user>` `{username, roleRef}` | 用户名不变 | 改角色 | 运行中校验由服务端 | E2E |
| LEG-MEM-009/010 | DELETE 对象路径；批量顺序 DELETE | 无新动词 | 解绑 | 不调 users DELETE | E2E 平台用户仍在 |
| LEG-MEM-012 | GET IAM `/workspacemembers/<user>` | workspace、role、email | 详情属性 | 404 错误面板 | admin = system-workspace-admin |
| LEG-MEM-013 | GET tenant `…/workspacemembers/<user>/namespaces` 可带 `/klusters/<cluster>` | name/alias/createTime | 项目页签 | 空集合空态 | 16 行，名称可点 |
| LEG-MEM-014 | GET tenant `…/devops` | 同上 | DevOps 页签 | **404 → []**，403 仍是错误 | 空态文案，无 ResourceErrorPanel |

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 列表：搜索+邀请在上，表在中。详情：返回+身份+基本信息卡+Tabs | [1024 表](assets/workspace-members-20261115/members-list-1024.png)、[1600 列](assets/workspace-members-20261115/members-list-1600-cols.png)、[详情](assets/workspace-members-20261115/member-detail-basic.png) |
| 字段栅格 | 1024 隐藏最近登录；1280/1600 四列。详情 `dt` 宽 `minmax(8rem,12rem)`，值在标签右侧 | 1024：最近登录 `display:none`，角色 x=631、状态 x=831。1280：最近登录 x=1037 w=170。1600：角色 x=1037、状态 x=1237、最近登录 x=1357。详情值 x=449，与标签同行 y |
| 产品名 | 侧栏/页头/访问控制页签/详情标签均为「租户(企业空间)…」 | [访问控制页签](assets/workspace-members-20261115/access-workspaces-tab.png)；locales zh 无单独「企业空间」残留 |
| 主题 | 深色主验；浅色一帧 | [浅色 1280](assets/workspace-members-20261115/members-list-1280-light.png) 标题/侧栏对比度可读 |
| 通用控件 | ResourceList / Tabs / DeleteDialog / ResourceForm | 批量「移除」无选择时 disabled；自己无 checkbox |
| 详情 DevOps | 始终有页签；404 空态 | [DevOps 空](assets/workspace-members-20261115/member-detail-devops-empty.png) 计数 0，文案「还没有 DevOps 工程」 |

## 5. 编码与回归

- [x] PRD US1–3 / AC-01..03；design DEC-01..03；YAML/Python 镜像 MEMBERS-01/02/03。
- [x] 中文产品名约束写入 PRD「约束与边界」与 DEC 关键约束。
- [x] 旧能力表独立核对。
- [x] 单测/类型/构建/门禁/E2E 见下。
- [x] 写入仅 E2E 一次性用户，失败路径清理。
- [x] 1024/1280/1600 与深/浅截图。英文界面未作为本页主验。

## 6. 完成判定与证据

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 14 项（含 1 改进）；批准不做 2 | LEG-MEM-*；待补 0 | 无映射遗漏 |
| 数据语义 | 通过 | MEMBERS-01 回读角色；MEMBERS-03 属性与项目数 | member 角色未测 |
| 交互与权限 | 通过 | MEMBERS-02 搜索/自己/批量；admin 无勾选无更多 | 非管理员未测 |
| 视觉与主题 | 部分通过 | 1024/1280/1600、深色中文、浅色中文 | 英文页、其它色调未验 |
| 静态/类型/构建/测试 | 本批包通过 | 见下 | api-client 全包仍有既有 `network-create.test.ts` 类型债，本批未改 |
| 本地全栈/B200 读取 | 通过 | 5178 + 8092 → B200 IAM/tenant | — |
| 新版部署/member/全站 | 未验收 | 新 UI 仅本地静态；未 helm | 明确未执行 |

### 测试命令与结果

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @kube-ai-hub/console-next typecheck` | 通过（`vite build` 生成 routeTree 之后） |
| `pnpm exec vitest run test/workspace-members.test.ts`（api-client） | 7 passed |
| `pnpm exec vitest run test/workspace-members.test.tsx`（console-next） | 6 passed |
| `pnpm --filter @kube-ai-hub/console-next build` | 通过 |
| `python3 prd/tools/check_docs.py --strict` access-control | errors=0 warnings=0 |
| `pytest` MEMBERS-01/02/03 `KA_APP_URL=http://localhost:5178` | 3 passed / 22.27s。无 skip |

未跑：全仓 typecheck、Storybook、全站串行 E2E、生产/member。

## 选择依据

CHECK-05 在用户列表之后仍缺租户(企业空间)成员。旧页已有搜索、邮箱、自我保护、批量、详情下钻，新页原先只有邀请/改角色/单人移除。本环境 5178/8092 保持运行，未杀并行进程。产品名按用户要求在中文界面统一为「租户(企业空间)」。
