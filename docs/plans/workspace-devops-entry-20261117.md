# 企业空间 DevOps 工程入口（2026-11-17）

> 本批交付证据。范围是**企业空间控制台**的一个用户任务：从空间侧栏查看本空间的 DevOps 工程并进入其中一个。
> 只补「空间作用域入口 + 按 workspace 聚合列表」；工程创建/编辑/删除仍在集群作用域（重纳决策 N-07）。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 企业空间管理员在 /kube-frontend/workspaces/<ws>/devops 看「我这个空间有哪些 DevOps 工程、在哪个集群、是否同步」，并进入工程详情 |
| 旧入口、部署 URL | 旧 console /workspaces/system-workspace/devops（空间侧栏「DevOps 项目」，带集群选择器），mlu370 http://10.1.37.18:30880，2026-11-17 实拍 |
| 新入口 | /kube-frontend/workspaces/<ws>/devops（空间侧栏「DevOps 工程」） |
| 环境、集群、角色 | mlu370 host + member（4paradigm）；账号 admin（sysadmin）；B200 本轮未用 |
| 视口、主题、语言 | 1600×900 / 1280×900 / 1024×900；深+紫、浅+紫、深+绿（1600）、深+英（1600） |
| 子页面与状态范围 | 入口（概览侧栏）、列表（含临时工程行/链接/搜索）、空态、未启用 DevOps 说明分支、部分失败/全部失败分支（未实测，见 §9） |
| 明确排除及批准 | 创建/编辑/删除不复制到空间页（N-07 决策：空间页只做列表+入口；写在集群作用域详情完成，行链接回那里）；旧集群选择器不迁移，改为自动合并各启用集群并显示集群列 |
| 并行文件与安全边界 | 不修改并行线登记与既有页面；E2E 只创建唯一临时 DevOps 工程并在断言后删除（含 finalizer 与命名空间清理），已核对无残留 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-WSDEV-01 | 旧空间侧栏「DevOps 项目」 | 空间成员 | 侧栏入口 | 保留：空间侧栏「DevOps 工程」 | AC-09；TC-09 从概览点入口 | 通过 |
| LEG-WSDEV-02 | 旧空间 DevOps 列表 | 空间成员 | 名称/状态/创建者/创建时间 | 保留/改进：名称（别名/对象名/描述）、集群、同步状态、创建者、创建时间；状态映射 successful/pending/failed → 已同步/同步中/同步失败，其它 - | AC-09；TC-09 行集合、别名、集群、链接 | 通过（host） |
| LEG-WSDEV-03 | 旧列表顶部集群选择器 | 多集群 | 选择某个集群后列该集群工程 | 改进：不提供选择器；自动合并各「就绪且 configz.devops」集群，行显示集群列 | AC-09；行集合 = 各集群聚合并集 | 通过（设计），member 行未实测 |
| LEG-WSDEV-04 | 旧列表「创建」 | 空间管理员 | 创建工程（名称/别名/描述） | 集群作用域承接：集群 DevOps 列表的创建入口（N-07 范围，空间页不放创建，避免跨作用域表单） | AC-DEVOPS_PROJECTS-04（既有） | 通过（承接，范围记录） |
| LEG-WSDEV-05 | 旧行/详情编辑、删除 | 空间管理员 | 编辑信息/删除 | 集群作用域详情承接（行链接进入） | AC-DEVOPS_PROJECTS-05/06（既有） | 通过（承接） |
| LEG-WSDEV-06 | 旧行进入工程详情 | 空间成员 | 名称链接 | 保留：链接到 /kube-frontend/clusters/<c>/devops/<name> | AC-09；TC-09 href 断言 | 通过 |
| LEG-WSDEV-07 | 旧无工程空态 | 空间成员 | 空态说明 | 保留/改进：无工程空态；集群都未启用 DevOps 用单独说明（不是空表/错误） | AC-09；TC-09 删除后空态断言 | 通过（空态）；未启用分支未实测 |
| LEG-WSDEV-08 | 旧名称搜索 | 空间成员 | 按名称过滤 | 保留/扩展：名称/别名/描述/集群 | AC-09；TC-09 搜索到目标行 | 通过 |

**计数**：8 项原子能力；通过 8（其中 2 项为集群作用域承接、2 项交互改进）、未验收 0、批准不做 0、未映射 0。

## 3. 数据契约与全链路

| 能力 ID | 请求路径/版本/作用域/参数 | 字段/标签 | 单位/精度/分母 | API 映射→页面位置 | 缺值/零/异常规则 | 同次响应对账断言 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-WSDEV-02/03 | 先 GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>/clusters?limit=-1 取可见集群 | metadata.name、status.conditions、status.configz.devops | — | 只保留 ready 且 configz.devops=true | 未启用/未就绪的集群不查询（未启用返回 404 是正常状态） | TC-09 用同一接口推导应查询的集群集合 |
| LEG-WSDEV-02 | host: GET /kapis/devops.kubesphere.io/v1alpha3/workspaces/<ws>/devops?limit=-1；member: /kapis/clusters/<c>/devops.kubesphere.io/v1alpha3/workspaces/<ws>/devops?limit=-1 | metadata.name/annotations.alias-name/description/creator、creationTimestamp、annotations[devopsproject.devops.kubesphere.io/syncstatus] | — | devopsApi.projects → 行项目 | 同步状态缺失 → -；空集合为空态；单集群失败保留其余行并列失败集群；全部失败为错误+重试 | TC-09 行集合 = 各集群聚合 items 并集；临时工程在 host 聚合中出现 |
| LEG-WSDEV-06 | GET /apis/devops.kubesphere.io/v1alpha3/devopsprojects/<name>（详情页） | — | — | 行链接 URL | 工程不存在由详情页 not-found 承接 | TC-09 断言 href 后缀 /kube-frontend/clusters/host/devops/<name> |

**实测（2026-11-17，mlu370）**：E2E 用 POST /kapis/devops.../workspaces/system-workspace/devops 建临时工程（generateName），列表出现一行（cluster=host，sync=已同步，creator=admin，created 正确）；删除后刷新进入「还没有 DevOps 工程」空态；创建与清理均通过，集群无 devopsprojects/命名空间残留。旧空间页 1024 仍横向溢出，新页三档均无溢出。

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 侧栏入口 + 标题/描述 + 工具条（搜索/显示列/刷新）+ 表格 + 分页；创建提示以描述说明在集群作用域完成 | 三档首屏/全页截图；侧栏入口与面包屑在空间作用域 |
| 表格 | 列：名称（别名/对象名/描述，链接）/ 集群 / 同步状态 Badge / 创建者 / 创建时间；默认页大小 20，选项 10/20/50/100 | 截图与 TC-09 行断言 |
| 主题 | 复用语义 token；深浅两套 | 深/浅 + 三档截图；绿/英 1600 截图 |
| 复用 | 不新增公共组件；ResourceList/useResourceListState/useListRefresh/useColumnVisibility/Badge/AiSurface 全部复用；仅扩展 devopsApi.projects 的 cluster 参数与 WorkspaceClusterSummary.devopsEnabled | 契约 1499 通过 |
| 状态 | 加载骨架；无工程/未启用/部分失败/全部失败分别呈现；行点击进入集群详情 | 空态由 E2E 断言；其余待补（§9） |

## 5. 编码与回归

- [x] AC/US/design DEC-16 同时覆盖入口、列表、数据口径、状态、缺失值与链接。
- [x] 一 spec 一测试；E2E 自建唯一临时工程并在断言后删除（含 finalizer/命名空间），已核对无残留。
- [x] 旧能力表独立比对；创建/编辑/删除按 N-07 明确留在集群作用域，未假装空间页具备。
- [x] 类型检查、构建、契约、api-client 单测、dev 与固定构建 E2E 分别记录。
- [x] 严格门禁覆盖本页 PRD/design/spec；三档 + 深浅 + 绿/英截图；旧站 1024 溢出对照。
- [x] 未改并行范围，未提交/未推送。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过（范围内） | 8 项：通过 8（2 项集群作用域承接、2 项改进）、未验收 0、未映射 0 | — |
| 数据语义 | 通过（host） | 行集合 = host 聚合 items；字段/链接/同步状态与接口对账；删除后空态 | member 集群行合并、部分失败/全部失败未实测 |
| 交互与权限 | 通过（admin） | 入口、搜索、链接、空态；空间控制台合并套件 9 passed（含本页与既有 01/05/07/08） | 非 admin / 无空间权限未验 |
| 视觉与主题 | 通过（已测组合） | 三档深浅 + 绿/英；旧站 1024 溢出对照 | 浅+绿、浅+英未逐张截图；未做设计评审签收 |
| 静态/类型/构建/测试 | 通过（含既有基线） | tsc 0；contracts 18 文件/1499；api-client 41 文件/416；E2E dev 与固定构建各 1 passed；build 通过 | api-client 测试文件既有 TS2379；console-next 两个既有基线失败未修（非本批文件） |
| 本地全栈/B200 | 通过（mlu370） | 本地 Vite/BFF → mlu370；B200 未用（上轮 502） | 未在 B200 验收 |
| 部署/member/全站 | 未验收 | — | 未部署镜像；member 只验证路径代码、未造 member 工程；全站串行 E2E 未跑 |

## 7. 测试命令与结果

    cd console/kube-frontend
    npx tsc --noEmit -p apps/console-next/tsconfig.json → 0 error
    npx vitest run --config config/vitest.config.ts → 18 files / 1499 passed
    pnpm --filter @kube-ai-hub/api-client test → 41 files / 416 passed
    pnpm --filter @kube-ai-hub/console-next build → 通过

    KA_APP_URL=http://localhost:5175 …（dev）
      pytest tests/kube-frontend/access-control/test_..._WORKSPACE_CONSOLE_09.py -n 0 → 1 passed (7.69s)
    KA_APP_URL=http://localhost:5176 …（固定 dist）
      pytest ...WORKSPACE_CONSOLE_09.py -n 0 → 1 passed (5.92s)
    KA_APP_URL=http://localhost:5175 … pytest ... -k WORKSPACE_CONSOLE -n 0
      → 9 passed (37.00s)

    cd console && python3 prd/tools/check_docs.py --strict       prd/kube-frontend/access-control/workspace-console.md       design/kube-frontend/access-control/workspace-console.md       prd/kube-frontend/cluster-management/devops-projects.md       design/kube-frontend/cluster-management/devops-projects.md       tests/ui/specs/kube-frontend/access-control
    → errors=0 warnings=0

## 8. 截图与记录

assets/workspace-devops-entry-20261117：
- 新 UI：devops-{dark,light}-{1600,1280,1024}.png、devops-green-zh-1600.png、devops-violet-en-1600.png
- 旧 console：old/devops-{1600,1024}.png

## 9. 剩余项与复查条件

| 项 | 状态 | 复查条件 |
| --- | --- | --- |
| member 集群的工程行合并 | 未实测 | 在 member 集群启用 DevOps 并创建一个工程，跑 TC-09 并核对两行不同 cluster |
| 未启用 DevOps / 部分失败 / 全部失败分支 | 未实测 | 构造一个无 devops 模块的集群（或 mock 组件测试），核对三种说明互不混用 |
| 非 admin / 无空间权限 | 未验收 | 普通空间成员账号，核对只读可见与认证失败提示 |
| 浅+绿、浅+英组合 | 未验收 | 设计走查时补截图 |
| 部署到 mlu370/生产/member/全站 | 未执行 | 构建推送镜像后按集成记录滚动并复测；全站串行 E2E 按链路健康协议执行 |

## 10. 流程反思（已并入方法文档）

| 本批踩到的事 | 已写入 |
| --- | --- |
| Devops 模块未启用的集群返回 404；把它当错误会让正常安装显示整页失败 | 指南 §8 #25：查询前按 status.configz.<module> 过滤，未启用是正常状态 |
| 空间作用域列表若读集群级 raw 集合再按标签过滤，会读到别的空间对象 | 指南 §8 #26：优先 kapis workspace 聚合（服务端过滤），成员集群把 clusters/<c> 段放 /kapis/ 之后 |
| 旧空间页的集群选择器把「多集群」做成显式交互 | 本批用自动合并 + 集群列，减少一次选择；记录在 design DEC-16 落地约定 |

## 11. 关联文档

- PRD：prd/kube-frontend/access-control/workspace-console.md（US3/AC-09）
- design：design/kube-frontend/access-control/workspace-console.md（DEC-16）
- 集群作用域 DevOps：prd & design cluster-management/devops-projects.md（scope 说明已同步）
- 用例：TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-09
