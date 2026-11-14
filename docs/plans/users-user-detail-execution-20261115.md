# 用户列表与用户详情迁移记录

> 当前批次证据。台账入口见[能力矩阵](capability-matrix.md) CHECK-05。
> 未提交；工作树相对 `develop` `25be94462`。不要把本文件追加到其它历史计划。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 平台管理员管理平台用户：看名单与登录、创建、启停、改资料/角色、管理员重置密码、翻看登录历史。作用域为平台 IAM，不是集群/项目。 |
| 旧入口、源码、部署 | 旧路由 `/access/accounts`、`/access/accounts/:name/login-history`；源码 `console/src/pages/access/containers/Accounts/**`、`src/actions/user.js`、`src/stores/user.js`、`UserMapper`。参考站 `https://console-dev.brightaitoken.ai/access/accounts`（B200，角色 admin）。 |
| 新入口、工作树、构建 | `/kube-frontend/access/users`、`/kube-frontend/access/users/$name`。页面 `PlatformListPage.tsx`（users）、`UserDetailPage.tsx`、`LoginHistoryPanel.tsx`、`UserCreateDialog.tsx`、`UserResetPasswordDialog.tsx`；API `packages/api-client/src/access.ts`；共享表格选择态 `packages/ai-kit` Table。本地静态 `http://localhost:5178/kube-frontend`，BFF `8092`，本批 `pnpm --filter @kube-ai-hub/console-next build`（2026-11-15）。未提交、未推送、未部署生产前端。 |
| 环境、集群、角色 | 本地新 UI 经 BFF 读 B200 host；对照旧站同集群同 admin。未测 member、未测生产 ks-console 包。 |
| 视口、主题、语言 | 实测 1024 / 1280 / 1600。深色中文为首屏；浅色中文、浅色英文各一帧。色调未另切。分页控件「选择页码」在英文下仍有中文残留，记未验收而非通过。 |
| 子页面与状态 | 列表：搜索、排序、创建、行菜单、批量启停、预置保护、分页。详情：基本信息、登录历史分页、管理员重置；停用/编辑/删除仍在列表。 |
| 明确排除及批准 | 列显隐与刷新按钮归 CHECK-08；头像旧值恒为 `default-user.svg`，新页用用户名+邮箱副行；个人设置改自己的密码（必须 currentPassword）不搬到本页；企业空间成员/用户组/配额/跨作用域授权不在本页。 |
| 并行文件 | 未改 `continue-migration-prompt.md`、edge-nodes、devops、s2ibuilder、appstore。未跑 `build_prd.py`，避免重写并行 catalog。 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-USERS-001 | `Accounts/index.jsx` Banner 用户 | 平台管理员 | 入口「访问控制 › 用户」 | 保留 `/access/users` | AC-USERS-01；页头「用户」 | 通过 |
| LEG-USERS-002 | `getColumns` 用户名+邮箱副行 | 恒显 | 名称链到详情 | 保留 | AC-USERS-01 表头第一列 | 通过 |
| LEG-USERS-003 | 状态列 `USER_ACTIVE/DISABLED` | 恒显；`hideBelow md` | 活跃/已停用 | 保留 Badge | AC-USERS-01/05 | 通过 |
| LEG-USERS-004 | `globalrole` 列 | 旧只读 `iam.kubesphere.io/globalrole` | 空显示 `-` | 改进：`platformRoleOf` 先读 `platform-role` 再 `globalrole`（DEC-01）。同次对象上 ui-test 新页 `platform-regular`、旧页 `-` | AC-USERS-01 | 通过（改进） |
| LEG-USERS-005 | `lastLoginTime: status.lastLoginTime`；空 `NOT_LOGIN_YET` | 1280 起显示（`hideBelow xl`） | 不把改密注解当登录 | 保留 + 注解回退（DEC-09） | AC-USERS-01；E2E 对账 `status.lastLoginTime`；空「尚未登录」 | 通过 |
| LEG-USERS-006 | `BaseStore` 默认 `sortBy=createTime` | 首屏 | 降序，最新创建在前 | 本批改为 users 默认 createTime（DEC-11）；名称排序仍可点列 | AC-USERS-01 行序=同次 API；AC-USERS-04 点名称升/降 | 通过 |
| LEG-USERS-007 | `searchType=name` | 恒有 | 按名称搜索 | 保留 `users:search` | 列表搜索框 | 通过（人工） |
| LEG-USERS-008 | `limit` 默认 10、`totalItems`、分页 | 多于一页才翻 | 服务端分页 | 保留 PAGE_SIZE=10 | 本环境 5–7 条未翻页；总量「第 1–5 条，共 5 条」 | 通过（当前规模） |
| LEG-USERS-009 | `user.create`：用户名/邮箱/密码/角色/描述；无条件 `uninitialized=true` | 创建按钮 | 三角色 `platform-regular` / `self-provisioner` / `admin` | 保留（DEC-03/10） | AC-USERS-02 | 通过 |
| LEG-USERS-010 | 创建密码强度 | 输入后 | 四条规则 | 保留 PasswordStrength `users` | AC-USERS-02 | 通过（E2E/单测） |
| LEG-USERS-011 | 行：编辑信息 | `showAction` | 邮箱+描述 | 保留行菜单 | AC-USERS-06 | 通过 |
| LEG-USERS-012 | 行：停用/启用 | `showAction` | 互斥 | 保留 | AC-USERS-05 | 通过 |
| LEG-USERS-013 | 行：删除 | `showAction` | 确认后消失 | 保留 | AC-USERS-03/05 | 通过 |
| LEG-USERS-014 | 批量启用/停用 | 勾选非保护行 | 全员同状态才可点对应按钮 | 保留；保护行省略复选框（Table 改进，原为 disabled） | AC-USERS-07/08 | 通过 |
| LEG-USERS-015 | `presetUsers` + 当前用户名 `showAction` | admin/sonarqube/自己 | 无停用删除改角色；checkbox disabled | 保留并补重置入口；省略 checkbox（DEC-08） | AC-USERS-08 | 通过 |
| LEG-USERS-016 | 点名称进详情 | 所有行 | `/access/accounts/:name` | 保留 `/access/users/$name` | AC-USER_DETAIL-01 | 通过 |
| LEG-USERS-017 | 列 `isHideable` + 刷新齿轮 | 旧表头 | 列开关、手动刷新 | 批准不做 / CHECK-08 | users.md 明确不做 | 批准不做 |
| LEG-USERS-018 | Avatar `/assets/default-user.svg` | 恒显示 | 无用户 avatar 字段 | 批准不做：用户名+邮箱 | users.md 明确不做 | 批准不做 |
| LEG-USERS-019 | 旧列表无「重置密码」「修改平台角色」独立项 | — | 改角色在编辑流、改密在详情 | 新增列表行菜单两项，不抵消旧能力 | AC-USERS-03/08、AC-USER_DETAIL-03 | 通过（新增） |
| LEG-UDET-001 | `getAttrs` 平台角色/邮箱/最近登录 | 详情侧栏 | 空登录 NOT_LOGIN_YET | 保留并补用户名/状态/创建时间/描述栅格 | AC-USER_DETAIL-01 | 通过 |
| LEG-UDET-002 | 唯一页签登录历史 | 默认 | 时间/成功失败/源 IP/原因 | 保留四列同一页下半（DEC-03） | AC-USER_DETAIL-01/02 | 通过 |
| LEG-UDET-003 | `fetchLoginRecords` page/limit/sortBy=createTime | total>limit 才分页 | 每页 10 | 保留；标题「共 N 条」 | AC-USER_DETAIL-02；ui-test `共 100 条`，页 2 首行与页 1 不同 | 通过 |
| LEG-UDET-004 | `spec.success` 缺省当 FAILED | 旧 Indicator | 新 DEC：缺失显示 `-`，不造失败 | 改进 | AC-USER_DETAIL-02 | 通过（改进） |
| LEG-UDET-005 | `CHANGE_PASSWORD`，体无 currentPassword | `showEdit` 非 preset | 旧详情也排除 preset，不排除自己 | 改进：详情也排除当前用户；自己改密走个人设置 | AC-USER_DETAIL-03 | 通过 |
| LEG-UDET-006 | 详情编辑/删除 | `showEdit` | 写同一 User 对象 | 等价承接：列表行操作 | user-detail.md 明确不做 | 通过（等价） |
| LEG-UDET-007 | 登录记录失败不影响用户对象 | 两请求 | — | 保留独立 query（DEC-02） | 人工：基本信息与历史分区 | 通过 |

检查表：

- [x] 路由、详情页签（旧仅登录历史）、更多菜单、创建/重置弹窗、预置与当前用户分支已清点。
- [x] 列/默认排序/搜索/分页、详情属性/历史、表单字段与校验已拆开。
- [x] 缺登录、空角色 `-`、未知 success `-`、无权限未在本环境用 member 账号测（记未验收）。
- [x] 旧能力已映射；新增行菜单不抵消遗漏。

## 3. 数据契约与全链路

| 能力 ID | 请求 | 字段 | 单位/精度 | 映射→页面 | 缺值规则 | 同次对账 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-USERS-005 | `GET /kapis/iam.kubesphere.io/v1alpha2/users?page&limit&sortBy` | `status.lastLoginTime` | 本地 `YYYY-MM-DD HH:mm:ss` | `toUserSummary.lastLogin` → 最近登录列 | 无 status 且无注解 →「尚未登录」，不填 0/`-` | E2E USERS-01 读同一用户对象 |
| LEG-USERS-006 | 同上 `sortBy=createTime&ascending=false` | items 顺序 | — | `useResourceListState` users 默认 createTime | — | E2E 行名=同次 items |
| LEG-USERS-004 | 用户对象 annotations | `platform-role` 然后 `globalrole` | 字符串 | 平台角色列 | 都无 → `-` | 旧站同用户可显示 `-`（只读 globalrole） |
| LEG-USERS-009 | `POST /users` | `uninitialized=true`、可选 description | — | `usersWriteApi.create` | 描述空不写注解 | E2E USERS-02 回读 |
| LEG-UDET-003 | `GET /users/<name>/loginrecords?page&limit=10&sortBy=createTime&ascending=false` | items、totalItems、`spec.success/sourceIP/reason` | 时间本地化 | LoginHistoryPanel | success 缺失 `-`；IP/原因空 `-` | USER_DETAIL-02 翻页；ui-test total=100 |
| LEG-UDET-005 | `PUT /users/<name>/password` 体 `{ password }` | — | — | `resetPassword` | 弱口令客户端拦截 | USER_DETAIL-03 新密 200、旧密 ≥400 |

登录历史模拟未另造 >10 条：B200 `ui-test` 真实 `totalItems=100`。

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 列表：搜索+创建在上，表在中，分页在下。详情：返回+身份+重置在上，基本信息卡，登录历史卡 | [1024 表](assets/users-20261115/new-users-1024-table.png)、[详情基本信息](assets/users-20261115/new-user-detail-ui-test-basic.png)、[登录历史](assets/users-20261115/new-user-detail-ui-test-logins.png) |
| 字段栅格 | 1600/1280 四列；1024 隐藏最近登录；详情两列定义列表，描述单独一行 | 1024 实测 `最近登录 display:none`；1280 `x=1025` 可见。详情 1600 下列与值间距偏大，可读、未遮挡 |
| 主题 | 深/浅；成功徽章绿、失败红 | 深色主验；浅色中文/英文 [light-zh](assets/users-20261115/new-users-1600-light-zh.png) [light-en](assets/users-20261115/new-users-1600-light-en.png) [详情浅色](assets/users-20261115/new-user-detail-ui-test-light.png) |
| 通用控件 | ResourceList/Table/Pagination/Modal/PasswordStrength；保护行省略 checkbox | ai-kit schema 单测 16；USERS-07/08 |
| 表单 | 创建含描述；重置无当前密码、弱口令不发请求 | [创建](assets/users-20261115/new-users-create-dialog.png)、[重置](assets/users-20261115/new-users-reset-dialog-crop.png) |
| 对照旧站 | 同 admin、同 B200 | [旧列表](assets/users-20261115/old-users-1600.png) 四列+尚未登录+admin 无勾选；[旧详情历史](assets/users-20261115/old-user-detail-ui-test.png) 四列+分页 1/10。旧有头像与列齿轮，本批批准不做 |

英文列：Username / Status / Platform role / Last sign-in；空登录 `Not logged in yet`。分页 `aria` 仍有「选择页码」中文，**视觉主题维度不把英文分页标通过**。

## 5. 编码与回归

- [x] PRD/design 承接功能、数据、权限、默认排序与断点；DEC-11 默认 createTime。
- [x] YAML 与 Python 镜像；`generate_case_docs.py` 更新 USERS-01 可读稿与追溯矩阵。未手改 catalog。
- [x] 旧能力表独立核对。
- [x] 单测/类型/构建/门禁见下。
- [x] 相关 E2E `-n 0`。USER_DETAIL-03 首次因创建后立刻登录 400 失败；改为等到旧密码可登录再重置，重跑通过。属夹具时序，不是产品回退。
- [x] 写入仅 `tc-e2e-*` 临时用户，失败路径删除。
- [x] 新旧同角色截图；密码未进截图。

## 6. 完成判定与证据

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 22 项（含 2 等价、2 改进、2 新增）；批准不做 2 | LEG-* 表；分母 24，待补 0 | 无映射遗漏 |
| 数据语义 | 通过 | USERS-01 最近登录与 createTime 序；USER_DETAIL-02 四列与翻页 | member 未测 |
| 交互与权限 | 通过 | USERS-02..08、USER_DETAIL-03；admin 无重置、无行菜单 | 非 admin 角色未测 |
| 视觉与主题 | 部分通过 | 1024/1280/1600、深色中文、浅色中/英 | 英文分页句柄中文残留；未切其它色调 |
| 静态/类型/构建/测试 | 本批包通过 | 见下命令 | api-client 全包 `typecheck` 基线仍有 `test/network-create.test.ts`、`test/workspace-members.test.ts` exactOptionalPropertyTypes，本批未改、未豁免 |
| 本地全栈/B200 读取 | 通过 | 5178 + 8092 → B200 IAM | — |
| 新版部署/member/全站 | 未验收 | 未 helm/ks-console 滚动，未全站 E2E | 明确未执行 |

### 测试命令与结果

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @kube-ai-hub/console-next typecheck`（kube-frontend） | 通过 |
| `pnpm --filter @kube-ai-hub/locales typecheck` | 通过 |
| `pnpm exec vitest run test/access.test.ts`（api-client） | 25 passed |
| `pnpm exec vitest run test/user-access.test.tsx`（console-next） | 2 passed |
| `pnpm exec vitest run test/schema.test.tsx`（console/packages/ai-kit） | 16 passed |
| `pnpm --filter @kube-ai-hub/console-next build` | 通过，5.03s |
| `python3 prd/tools/check_docs.py --strict` 本批 users/user-detail 路径 | errors=0 warnings=0，121s |
| `pytest` USERS-01..08 + USER_DETAIL-01..03 `-n 0` | 10 passed；USER_DETAIL-03 首轮 fail（登录过早 400），夹具等待后 1 passed / 6.22s。无 skip |

未跑：`verify.py --no-e2e`、全仓 typecheck、Storybook 构建、全站串行 E2E、生产/member。

## 选择依据

CHECK-05 台账仍把管理员改密、登录历史分页、预置保护列为退出条件；列表 CRUD 已有骨架不等于详情整页完成。本环境 5178/8092 已在跑，未杀并行进程。
