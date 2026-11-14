# 项目成员迁移记录

> 当前批次证据。台账入口见[能力矩阵](capability-matrix.md) CHECK-05。
> 未提交。不要把本文件追加到其它历史计划。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 项目管理员管理项目成员：名单/搜索/邀请/改角色/移除/批量移除。作用域是 IAM `namespaces/<ns>/members`，不是租户(企业空间)成员、不是平台用户删除。点名称不进详情。 |
| 旧入口、源码、部署 | 旧路由 `/projects/:ns/members`；源码 `console/src/pages/projects/containers/Members/index.jsx`、`src/actions/project.js` 的 `member.*`。名称 `noLink`。 |
| 新入口、工作树、构建 | `/kube-frontend/<ws>/clusters/<cluster>/projects/<ns>/members`。页面 `SettingsListPage.tsx` members 分支、`MemberDialog.tsx`；API `packages/api-client/src/iam.ts` 的 `membersApi` / `membersWriteApi`。本地静态 `http://localhost:5178/kube-frontend`，BFF `8092`。本批 `pnpm --filter @kube-ai-hub/console-next build`。未提交、未推送、未部署生产前端。 |
| 环境、集群、角色 | 本地新 UI 经 BFF 读 B200；实测项目 `spaces`（1 名成员 admin）、`default`（空）。未测 member、未测生产 ks-console。 |
| 视口、主题、语言 | 实测 1024 / 1280 / 1600。深色中文为首屏；浅色中文一帧。英文未作为本页主验。 |
| 子页面与状态 | 列表：搜索、邀请、行改角色/移除、批量移除、自我保护、空态。无详情页。 |
| 明确排除及批准 | 邀请不改成旧搜索弹窗（继续用户名 + GET）；不做项目成员详情页（旧页 `noLink`）；不删平台账号；租户(企业空间)成员不在本页。 |
| 并行文件 | 未改 app-store / gray-release / federated / devops 并行文档。 |
| 产品名 | 本页标题仍是「项目成员」。中文界面其它处一律「租户(企业空间)」。 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-PMEM-001 | Banner `PROJECT_MEMBER` | 项目管理员 | 页签「项目成员」 | 保留 | AC-MEMBERS-01；页头与页签 | 通过 |
| LEG-PMEM-002 | Avatar 用户名+邮箱，`noLink` | 恒显 | 点名称不进详情 | 保留无链接 | AC-MEMBERS-01/03 | 通过 |
| LEG-PMEM-003 | 角色列 `iam.kubesphere.io/role` | hideBelow md | 注解 | 保留 | AC-MEMBERS-01 | 通过 |
| LEG-PMEM-004 | 状态 `USER_${status}` | hideBelow md | 活跃/已停用 | 保留 i18n，不展示 Active | AC-MEMBERS-01；spaces admin = 活跃 | 通过 |
| LEG-PMEM-005 | 最近登录；空 NOT_LOGIN_YET | hideBelow xl | `status.lastLoginTime` | 保留 + 尚未登录 | AC-MEMBERS-01；admin = `2026-11-15 06:47:03`；1024 隐藏 | 通过 |
| LEG-PMEM-006 | `searchType=name` | 恒有 | 客户端过滤当前集合 | 保留 | AC-MEMBERS-03 | 通过（E2E） |
| LEG-PMEM-007 | 邀请：用户名+角色 | 主按钮 | 角色来自当前项目非模板角色；账号须存在 | 保留 MemberDialog | AC-MEMBERS-02 | 通过（E2E） |
| LEG-PMEM-008 | 行：修改角色 | 非自己 | 用户名只读 | 保留 | AC-MEMBERS-02 | 通过（E2E） |
| LEG-PMEM-009 | 行：移除 | 非自己 | 输入用户名确认；只解绑 | 保留 DeleteDialog | AC-MEMBERS-02 | 通过（E2E） |
| LEG-PMEM-010 | 批量移除 | 勾选非自己 | 确认词是人数不是名单 | 保留顺序 DELETE | AC-MEMBERS-03 | 通过（E2E） |
| LEG-PMEM-011 | 不能操作自己 | 当前用户名 | 无菜单、无 checkbox | 保留 `useAuth().user.name` | AC-MEMBERS-03；admin 行无更多、无勾选 | 通过 |
| LEG-PMEM-012 | 邀请搜索用户弹窗 | 旧 Modal | 远程搜用户 | 批准不做：输入用户名 + GET | members.md 明确不做 | 批准不做 |
| LEG-PMEM-013 | 成员详情页 | 旧无 | Avatar `noLink` | 批准不做 | members.md 明确不做 | 批准不做 |
| LEG-PMEM-014 | 空态 `PROJECT_MEMBER_EMPTY_DESC` | 无成员 | 引导邀请 | 保留 | default「暂无项目成员」 | 通过 |

检查表：

- [x] 列表列/搜索/主操作/行菜单/批量/自我保护已拆开。
- [x] 无详情页，已记为批准不做。
- [x] 加载、空、搜索无匹配、读错误各有归宿。
- [x] 旧能力已映射；新增仅最近登录读 `lastLoginTime` 而不是改密时间。

## 3. 数据契约与全链路

| 能力 ID | 请求路径 | 字段 | 映射 | 缺值/异常 | 对账 |
| --- | --- | --- | --- | --- | --- |
| LEG-PMEM-001..011 | GET IAM `/namespaces/<ns>/members?limit=-1`（host 无 `clusters/` 前缀） | username、email、role 注解、status、lastLoginTime | `toMemberSummary` | 缺 status 当 Active；缺登录「尚未登录」 | spaces 1 行 admin |
| LEG-PMEM-007 | POST 同集合，体 `[{username, roleRef}]` | roleRef 必须是本次角色名 | 邀请 | 账号 GET 404 不可提交 | E2E 回读 role |
| LEG-PMEM-008 | PUT `/members/<user>` `{username, roleRef}` | 用户名不变 | 改角色 | 运行中校验由服务端 | E2E |
| LEG-PMEM-009/010 | DELETE 对象路径；批量顺序 DELETE | 无新动词 | 解绑 | 不调 users DELETE | E2E 平台用户仍在 |

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 搜索+邀请在上，表在中 | [1024](assets/project-members-20261115/members-list-1024.png)、[1280](assets/project-members-20261115/members-list-1280.png)、[1600 列](assets/project-members-20261115/members-list-1600-cols.png) |
| 字段栅格 | 1024 隐藏最近登录；1280/1600 四列。状态宽 120、角色 140、最近登录 170 | 1024：最近登录 `display:none`，状态 x=691、角色 x=811。1280：最近登录 x=1037 w=170。1600：状态 x=1097、角色 x=1217、最近登录 x=1357 |
| 自我保护 | 当前用户无 checkbox、无行菜单；批量空选 disabled | spaces 的 admin：checkbox `null`、more `null`；「移除」disabled |
| 主题 | 深色主验；浅色一帧 | [浅色 1280](assets/project-members-20261115/members-list-1280-light.png) 标题/列对比度可读 |
| 邀请 | MemberDialog：用户名 + 角色 | [邀请弹窗](assets/project-members-20261115/members-invite-dialog.png) |
| 空态 | default 无成员 | [空](assets/project-members-20261115/members-list-empty.png)「暂无项目成员」 |

## 5. 编码与回归

- [x] PRD US1–3 / AC-01..03；design DEC-01..04；YAML/Python 镜像 MEMBERS-01/02/03。
- [x] 旧能力表独立核对。
- [x] 单测/类型/构建/门禁/E2E 见下。
- [x] 写入仅 E2E 一次性用户，失败路径清理。
- [x] 1024/1280/1600 与深/浅截图。英文界面未作为本页主验。

## 6. 完成判定与证据

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 12 项；批准不做 2 | LEG-PMEM-*；待补 0 | 无映射遗漏 |
| 数据语义 | 通过 | MEMBERS-01 角色注解；MEMBERS-02 回读角色 | member 角色未测 |
| 交互与权限 | 通过 | MEMBERS-03 搜索/自己/批量；admin 无勾选无更多 | 非管理员未测 |
| 视觉与主题 | 部分通过 | 1024/1280/1600、深色中文、浅色中文 | 英文页、其它色调未验 |
| 静态/类型/构建/测试 | 本批包通过 | 见下 | api-client 全包仍有既有 `network-create.test.ts` 类型债，本批未改 |
| 本地全栈/B200 读取 | 通过 | 5178 + 8092 → B200 IAM | — |
| 新版部署/member/全站 | 未验收 | 新 UI 仅本地静态；未 helm | 明确未执行 |

### 测试命令与结果

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @kube-ai-hub/console-next typecheck` | 通过 |
| `pnpm exec vitest run test/iam.test.ts`（api-client） | 11 passed |
| `pnpm --filter @kube-ai-hub/console-next build` | 通过 |
| `python3 prd/tools/check_docs.py --strict` project-settings members | errors=0 warnings=0 |
| `pytest` MEMBERS-01/02/03 `KA_APP_URL=http://localhost:5178` | 3 passed / 15.22s。无 skip |

未跑：全仓 typecheck、Storybook、全站串行 E2E、生产/member。

## 选择依据

CHECK-05 在租户(企业空间)成员之后仍缺项目成员。旧页已有搜索、邮箱、自我保护、批量，新页原先只有邀请/改角色/单人移除，且把改密时间标成最近活动。本环境 5178/8092 保持运行，未杀并行进程。跳过 B200 部署：仅新 UI。
