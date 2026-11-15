# DevOps 工程页族迁移交付记录（2026-11-15）

> 单元：集群管理 / DevOps 工程页族（列表 + 工程详情七页签 + 流水线详情）。
> 状态：**部分完成**——读写能力、规格、用例已交付并本地/B200 验证；运行成功与日志正文受 Jenkins 通道阻塞未验收（BLOCK-1）。
> 证据基线：2026-11-15，B200 host 集群，admin 角色；本地全栈 `http://localhost:5178`（BFF→B200，`scripts/dev-static-server.mjs apps/console-next/dist 5178 http://127.0.0.1:8092`）；console-next dist 构建于 21:16（含 Lead 对 Radix Select 哨兵值、Jenkinsfile 保存与 subtitle 文案的修复）。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 集群管理员 / DevOps 使用者在集群控制台创建与治理 DevOps 工程，并在工程内管理流水线、运行、凭证、成员、角色、代码仓库与持续部署白名单。作用域：集群（`/kube-frontend/clusters/<cluster>/devops`），无 workspace 段。 |
| 旧入口、源码版本、部署 URL | 旧 console `/:workspace/clusters/:cluster/devops`（tenant API）；`src/pages/devops/**`，源版本 `console` develop 工作树（提交基线 `6572282bf`）。旧部署 URL：`https://console-dev.brightaitoken.ai`。 |
| 新入口、提交及工作树、构建 | 新 UI `apps/console-next`：列表 `…/devops`、详情 `…/devops/<name>`、流水线详情 `…/devops/<name>/pipelines/<pipeline>`。工作树含未提交改动（本批只改规格；产品代码由 devops-pipelines/Lead 提交于 `a7c22c900`、`b1047a3fe` 等）。dist：`apps/console-next/dist`（21:16 重建）。 |
| 环境、集群、角色 | B200 host；本地全栈 BFF 端口 8092、静态站 5178；admin；单集群（`host`）。不涉及 member 集群与生产写入。 |
| 视口、主题、语言 | 用例默认 1600×900、zh-CN、深色主题（Playwright 默认）。1024/1280/1600 三档截图与深浅主题人工复核**未在本批执行**（见 §6）。 |
| 子页面与状态范围 | 列表（空态/加载/错误/创建对话框）；详情七页签（每集合 表格/空态/失败+重试）、编辑信息、删除、CD 白名单；流水线列表（分页/搜索/类型筛选/行操作）、创建/编辑/复制/删除；流水线详情（基本信息、运行记录、运行详情/日志错误、Jenkinsfile 配置）；凭证四类型、成员邀请/改角色/移除、角色只读、代码仓库导入/删除、CD 只读。 |
| 明确排除及批准 | 可视化流水线编辑器、代码质量/扫描/分支/PR/产物/事件/任务状态子页、运行停止、批量运行/删除、CD 创建/编辑/同步/回滚/明细、代码仓库编辑/YAML、角色 CRUD、凭证详情活动、成员批量、列表 4s 轮询：依据本批任务范围与 PRD「明确不做」，未逐项单独审批；均在 §2 登记为「不做」并给理由。 |
| 并行文件与安全边界 | 本批写作用域：`prd/.../devops-projects.md`、`design/.../devops-projects.md`、`tests/ui/specs|tests/kube-frontend/cluster-management/` 的 DEVOPS 用例、`tests/ui/pages/devops_page.py`、`prd/tools/tree.py`（仅本功能点 L3 列表）、生成物 `prd/catalog.yaml`/`tests/ui/cases/**`、本记录。未改 `pages/devops/**`、api-client、locales、cluster/user-settings/about/cluster-gpu 等并行范围；未执行 git commit/push。凭据不入库；kubesphere-config 只记录 host 与 username，不记录密码。 |

## 2. 旧能力全集与归宿

证据来源：`console/src/pages/devops/**` 的页面容器、子组件与 `stores/devops*`/`actions/devops*`；旧部署实际请求（B200 旧 console）与 2026-11-15 接口探测。每行只描述一个可单独判断的字段/动作/状态/选项。

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-devops-001 | `containers/Pipelines/PipelinesList/index.jsx` getColumns | 有 pipeline view 权限 | 列：名称（链接）/健康/类型/分支数/PR 数 | 保留（同样 5 列 + 操作列） | AC-…-DEVOPS_PIPELINES-01/02；TC-…-DEVOPS_PIPELINES-01 断言表头与每行 5 列 | 通过 |
| LEG-devops-002 | 同上 getTypes/filters | 列表筛选 | 类型：单分支/多分支，服务端过滤 | 保留（服务端 type 参数；全部类型不带参数） | AC-…-PIPELINES-01；TC-…-PIPELINES-01 断言请求带 type 且结果集变化 | 通过 |
| LEG-devops-003 | 同上 columns name.search | 列表搜索 | 名称子串搜索，服务端 | 保留（服务端 name） | AC-…-PIPELINES-01；TC-…-PIPELINES-01 断言请求带 name、结果均匹配 | 通过 |
| LEG-devops-004 | `stores/devops/pipelines.js` list 参数 | 列表 | page/limit/totalItems，服务端分页 | 保留 + 增加 20/50 档 | AC-…-PIPELINES-01；TC-…-PIPELINES-01 断言「共 N 条」= totalItems、翻页行数 | 通过 |
| LEG-devops-005 | itemActions run / `pipeline.params` | 行操作 | 运行（有分支/参数先弹窗） | 保留（行运行 + 详情运行表单） | AC-…-DEVOPS_RUNS-01；TC-…-DEVOPS_RUNS-01 断言 POST pipelineruns 与页面提示 | 通过 |
| LEG-devops-006 | itemActions edit / `pipeline.advance.edit` | 行操作 | 编辑（旧版为图形化/代码高级编辑） | 改进：表单编辑元数据 + Jenkinsfile（图形化编辑器不迁移） | AC-…-PIPELINES-04；TC-…-PIPELINES-02 断言名称/类型只读、别名保存回读 | 通过 |
| LEG-devops-007 | itemActions copy / `pipeline.copy` | 行操作 | 复制（预填源、要求新名称） | 保留 | AC-…-PIPELINES-04；TC-…-PIPELINES-02 断言名称空、类型/Jenkinsfile 沿用 | 通过 |
| LEG-devops-008 | itemActions delete / resource.delete | 行操作 | 删除（单条） | 保留（输入完整名称确认） | AC-…-PIPELINES-04；TC-…-PIPELINES-02 断言行消失 | 通过 |
| LEG-devops-009 | selectActions 批量运行 + `pipeline.batch.run` | 选中行 | 批量运行（多分支时旧版自身拒绝） | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-010 | selectActions 批量删除 + `pipeline.batch.delete` | 选中行 | 批量删除 | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-011 | PipelinesList refreshTimer 4000ms | 有运行中行 | 4 秒轮询列表 | 不迁移（改为显式刷新 + 写后 invalidate） | PRD「明确不做」 | 不做 |
| LEG-devops-012 | handleCreate / `pipeline.create` | create 权限 | 创建（图形化/代码两种模式） | 改进：表单创建单分支 Jenkinsfile / 多分支 SCM | AC-…-PIPELINES-03；TC-…-PIPELINES-02 断言两种 spec body | 通过 |
| LEG-devops-013 | `components/Health/index.jsx` | 列表/详情 | weatherScore 分档（旧版缺省 100） | 改进：缺值→「无状态」，不伪造健康 | AC-…-PIPELINES-02；TC-…-PIPELINES-01 用接口映射逐行对账 | 通过 |
| LEG-devops-014 | `components/Status/index.jsx` + `utils/status` | 运行记录 | 运行状态映射 8 种 | 保留（集中在 format.ts 与 api-client） | AC-…-DEVOPS_RUNS-02；TC-…-DEVOPS_RUNS-01 断言「未运行」 | 通过 |
| LEG-devops-015 | `Detail/PipeLine/index.jsx` + `components/Pipeline/**` | 配置 tab | 图形化 Jenkinsfile 编辑器 + 代码模式 | 改进：文本编辑 + `PUT …/jenkinsfile?mode=raw`，保存后回读 | AC-…-PIPELINES-05；TC-…-PIPELINES-03 断言保存后回读 | 通过 |
| LEG-devops-016 | `Detail/CodeQuality/index.jsx` | 有 sonarqube | 代码质量 tab | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-017 | `Detail/Activity/index.jsx` | 流水线详情 tab | 运行记录：状态/编号/提交/分支/消息/耗时/更新时间/操作 | 保留（列 状态/编号/提交/分支/最近消息/耗时/开始时间/操作） | AC-…-DEVOPS_RUNS-02；TC-…-DEVOPS_RUNS-01 | 通过 |
| LEG-devops-018 | `Detail/Branch/index.jsx` | 多分支 | 分支 tab | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-019 | `Detail/PullRequest/index.jsx` | 多分支 | PR tab | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-020 | `Detail/TaskStatus/index.jsx` | 运行详情 | 任务状态图 | 等价承接：运行详情显示控制器阶段/状态/消息 | AC-…-RUNS-02；TC-…-RUNS-01 断言 run-phase/run-status | 等价承接 |
| LEG-devops-021 | `Detail/Parameters/index.jsx` | 有参数 | 构建参数子页 | 不迁移（运行表单可填参数，无独立子页） | PRD「明确不做」 | 不做 |
| LEG-devops-022 | `Detail/Commit/index.jsx` | 运行详情 | 提交子页 | 等价承接：运行记录/运行详情显示短提交 | AC-…-RUNS-02；TC-…-RUNS-01 表头含「提交」 | 等价承接 |
| LEG-devops-023 | `Detail/Artifacts/index.jsx` | 运行详情 | 产物子页 | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-024 | `Detail/Events/index.jsx` | 运行详情 | 事件子页 | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-025 | `Detail/PipelineLogDialog/**` | 运行中/已完成 | 实时日志、全文日志 | 阻塞：kapis 日志路由 404；页面显示失败原因+重试 | AC-…-RUNS-02 阻塞条；TC-…-RUNS-01 断言 run-log-error/retry、无空日志 | 阻塞（BLOCK-1） |
| LEG-devops-026 | `pipeline.params` 弹窗 | 多分支/有参数 | 选分支、填参数后运行 | 保留简化版（run-form：分支下拉 + 每参数一个输入） | AC-…-RUNS-01；TC-…-RUNS-01 用无参数流水线覆盖提交链路 | 通过（参数分支未单测） |
| LEG-devops-027 | `Activity.handleReplay` | 已完成运行 | 重放 | 保留（运行记录行「重新运行」） | AC-…-RUNS-02；TC-…-RUNS-01 断言第二条运行对象 | 通过 |
| LEG-devops-028 | `Activity.handleStop` / RunDetail stop | 运行中 | 停止 | 不迁移（明确不做：需 Jenkins 写接口） | PRD「明确不做」 | 不做 |
| LEG-devops-029 | `Activity.handleScanRepository` | 多分支 | 扫描仓库 | 阻塞：kapis `…/scan` 404（实测）；不迁移 | PRD「明确不做」+ 接口探测证据 | 不做（接口 404） |
| LEG-devops-030 | `containers/Members/index.jsx` getColumns | members view | 列：名称/状态/角色/最近登录 | 保留（用户名/角色/状态/最近登录/操作） | AC-…-DEVOPS_MEMBERS-01；TC-…-DEVOPS_MEMBERS-01 断言表头与行 | 通过 |
| LEG-devops-031 | `member.invite` modal | create 权限 | 邀请（搜索用户 + 角色） | 改进：用户名精确邀请 + 预置角色 | AC-…-MEMBERS-02；TC-…-MEMBERS-01 断言空名校验/角色选项/邀请回读 | 通过 |
| LEG-devops-032 | `member.edit` modal | edit | 修改角色 | 保留 | AC-…-MEMBERS-02；TC-…-MEMBERS-01 断言 operator 回读 | 通过 |
| LEG-devops-033 | `member.remove` | delete | 移除成员（单条） | 保留（输入用户名确认） | AC-…-MEMBERS-02；TC-…-MEMBERS-01 断言行消失 | 通过 |
| LEG-devops-034 | `member.remove.batch` | delete | 批量移除 | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-035 | Members.showAction（username !== 当前用户） | 当前用户行 | 自己不可改/移除 | 未迁移：新实现对任何行都显示操作（GOT-…-DEVOPS_MEMBERS-01） | 待补 | 待补 |
| LEG-devops-036 | `containers/Roles/index.jsx` getColumns | roles view | 列：名称/描述/创建时间 | 改进：名称/别名/权限模块/角色类型/创建时间 + 数量徽标 | AC-…-DEVOPS_ROLES-01；TC-…-DEVOPS_PROJECTS-05 断言表头/分类/数量 | 通过 |
| LEG-devops-037 | Roles itemActions（新建/编辑信息/编辑权限/删除） | edit/delete | 角色 CRUD | 不迁移（明确不做：本轮只读） | PRD「明确不做」 | 不做 |
| LEG-devops-038 | `containers/Credential/index.jsx` getColumns | credentials view | 列：名称/类型/描述/创建时间 | 改进：名称/类型/用户名/同步状态/描述/操作 | AC-…-DEVOPS_CREDENTIALS-01；TC-…-DEVOPS_CREDENTIALS-01 | 通过 |
| LEG-devops-039 | `devops.credential.create` modal | create | 四类型创建 | 保留四类型 + 类型特有字段 | AC-…-CREDENTIALS-01；TC-…-CREDENTIALS-01 断言四类型与 Secret type | 通过 |
| LEG-devops-040 | `containers/Credential/detail/**` | 行点击 | 凭证详情 + 活动页 | 不迁移（明确不做：列表行编辑替代） | PRD「明确不做」 | 不做 |
| LEG-devops-041 | Credential/detail 操作 | edit/delete | 编辑/删除凭证 | 等价承接：列表行编辑/删除（PUT ?content=1、DELETE） | AC-…-CREDENTIALS-02；TC-…-CREDENTIALS-01 断言描述更新/删除 404 | 等价承接 |
| LEG-devops-042 | `containers/CodeRepo/CRList/index.jsx` | codeRepos view | 列：名称/来源/地址/创建时间 | 改进：名称/提供方/仓库地址/访问凭证/操作 | AC-…-DEVOPS_CODE_REPOS-01；TC-…-CODE_REPOS-01 | 通过 |
| LEG-devops-043 | `codeRepo.create` modal | create | 导入（provider/秘钥） | 保留（5 个 provider，SVN 内联分支不迁移） | AC-…-CODE_REPOS-01；TC-…-CODE_REPOS-01 断言 GitRepository 回读 | 通过 |
| LEG-devops-044 | `codeRepo.edit` | edit | 编辑仓库 | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-045 | `resource.yaml.edit` | edit | 编辑 YAML | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-046 | `codeRepo.delete` | delete | 删除仓库 | 保留（输入名称确认） | AC-…-CODE_REPOS-01；TC-…-CODE_REPOS-01 断言行消失 | 通过 |
| LEG-devops-047 | `containers/CD/CDList/index.jsx` getColumns | cd view | 列：名称/健康/同步/目标命名空间 + 状态摘要与筛选 | 改进：只读 4 列（摘要/筛选不迁移） | AC-…-DEVOPS_CD-01；TC-…-DEVOPS_PROJECTS-05 断言表头/空态 | 通过 |
| LEG-devops-048 | `cd.create` / `fluxcd.create` | create | 创建 CD | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-049 | CD itemActions 编辑信息/设置/YAML | edit | 编辑 CD | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-050 | `cd.sync` | edit | 同步 CD | 不迁移（明确不做：需写接口） | PRD「明确不做」 | 不做 |
| LEG-devops-051 | `cd.delete` / `fluxcd.delete` | delete | 删除 CD | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-052 | `containers/CD/detail/**` | 行点击 | CD 明细页（Flux/Argo） | 不迁移（明确不做） | PRD「明确不做」 | 不做 |
| LEG-devops-053 | `containers/BaseInfo/index.jsx` | detail 默认 | 名称/企业空间/创建者/创建时间/角色数/成员数 | 保留 + 新增 别名/描述/工程命名空间/同步状态/部署集群 | AC-…-DEVOPS_PROJECTS-07；TC-…-PROJECTS-05 断言字段与计数 | 通过 |
| LEG-devops-054 | `DevOpsEdit` modal | devops-settings edit | 编辑工程别名/描述 | 保留（整对象 PUT 保留 argo/labels） | AC-…-PROJECTS-05；TC-…-PROJECTS-04 断言注解回读 | 通过 |
| LEG-devops-055 | DeleteModal | delete | 删除工程 | 保留（输入名称确认） | AC-…-PROJECTS-06；TC-…-PROJECTS-04 断言列表消失 | 通过 |
| LEG-devops-056 | BaseInfo allow-list 区 + `devops.edit.allowlist` | host 集群 | CD 白名单 sourceRepos/destinations 展示/编辑 | 保留（两行文本域编辑 spec.argo） | AC-…-DEVOPS_CD-02；TC-…-PROJECTS-04 断言 spec.argo 回读 | 通过 |
| LEG-devops-057 | `containers/Base/List` + `stores/devops.js` | workspace 路由 | 按企业空间的工程列表 | 等价承接：cluster-scoped CRD 列表（DEC-…-PROJECTS-01） | AC-…-PROJECTS-01；TC-…-PROJECTS-01 断言行数=CRD items | 等价承接 |
| LEG-devops-058 | 列表创建 + generateName | create 权限 | 创建工程，接口追加 5 位后缀 | 保留（跳转接口返回名） | AC-…-PROJECTS-04；TC-…-PROJECTS-04 断言生成名与注解 | 通过 |
| LEG-devops-059 | `routes/index.js` PATH `/:workspace/clusters/...` | 所有页 | 企业空间作用域 URL 与工作区选择器 | 不迁移（本页为 cluster scope，DEC-01 重新考虑条件） | PRD「明确不做」 | 不做 |
| LEG-devops-060 | `components/DetailNav` + Layout Selector | 详情 | 左侧子导航 + 工程选择器 | 改进：顶部页签 + 返回链接 | AC-…-PROJECTS-07；TC-…-PROJECTS-05 断言页签顺序 | 通过 |
| LEG-devops-061 | `routes/detail.js` | 详情 | 流水线详情独立路由 | 保留（`…/devops/<name>/pipelines/<pipeline>`） | AC-…-PROJECTS-03；TC-…-PROJECTS-03 断言链接 href | 通过 |

计数：61 条原子能力；通过 33、等价承接 4、不做 22、阻塞 1、待补 1（逐行统计见 §6）。未映射能力 0，未经证明承接 0。

## 3. 数据契约与全链路

| 能力 ID | 请求路径/版本/作用域/参数 | 字段或指标/标签 | 原单位→显示单位/精度/分母 | API 映射→页面位置 | 缺值/零/异常/过期值规则 | 同次响应对账断言 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-devops-057 | GET `/apis/devops.kubesphere.io/v1alpha3/devopsprojects`（cluster） | metadata.name/creationTimestamp/labels/annotations、status.adminNamespace、spec.argo | 时间→本地 `YYYY-MM-DD HH:mm:ss` | `toDevopsProjectSummary` → 列表行/详情 | 无 description 显示 `-`；workspace 标签缺失显示 `-`；详情 404→not-found | TC-…-PROJECTS-01：列表行数=items 数 |
| LEG-devops-058/055 | POST `/kapis/devops…/workspaces/<ws>/devops`；PUT/DELETE `/apis/…/devopsprojects/<name>` | metadata.generateName、labels.kubesphere.io/workspace、annotations alias/description、spec.argo | — | 列表/详情/白名单 | 后缀 5 位；失败保留输入并显示消息 | TC-…-PROJECTS-04：创建后列表出现返回名、编辑后注解回读、删除后 404 |
| LEG-devops-001..004 | GET `/kapis/devops…/devops/<project>/pipelines?page&limit&name&type&ascending` | items[].metadata/spec.type、annotations（jenkins-metadata/syncstatus/jenkinsfile.validate）、totalItems | 页码 1 起、每页 10/20/50 | `toPipelineRow` → 列表列 | weatherScore 缺失→无状态；分支/PR 缺失→`-`；类型缺省 pipeline | TC-…-PIPELINES-01：表头/行数/total/请求参数/健康映射逐行对账 |
| LEG-devops-012/006/007/008 | POST/PUT/DELETE `/kapis/devops…/devops/<project>/pipelines[/<name>]` | spec.type、spec.pipeline.jenkinsfile/parameters、spec.multi_branch_pipeline | — | 创建/编辑/复制/删除对话框 | 名称唯一；整对象 PUT 保留未展示字段 | TC-…-PIPELINES-02：两种 spec body、注解回读、行消失 |
| LEG-devops-015 | GET 详情；PUT `/kapis/…/pipelines/<p>/jenkinsfile?mode=raw` body {data} | spec.pipeline.jenkinsfile | — | 配置页签文本域 | 缺 mode→400；GET→405；保存后回读 | TC-…-PIPELINES-03：保存后接口回读=提交内容；多分支只读 |
| LEG-devops-025/026/027 | POST `/apis/…/namespaces/<ns>/pipelineruns`；GET `…/pipelineruns[?labelSelector]`；GET `/kapis/…/pipelines/<p>/runs/<id>/log/` | labels.devops.kubesphere.io/pipeline、spec.pipelineRef/scm/parameters、annotations.jenkins-pipelinerun-status | durationInMillis→1h 20m/2m 5s/9s，缺失 0→0s | 运行记录/运行详情 | 无注解→未运行；日志 404→错误+重试；排序按 startTime/creationTimestamp 倒序 | TC-…-RUNS-01：label/pipelineRef 对账、状态未运行、日志错误、重放创建第二条 |
| LEG-devops-038/039/041 | 读 `/api/v1/namespaces/<ns>/secrets`；写 `/kapis/…/credentials[/<name>?content=1]` | type credential.devops.kubesphere.io/*、data base64 username/password/private_key/passphrase/secret/content、annotations syncstatus/description | — | 凭证列表/对话框 | 未知 type 保留 secretType 原文；密码/私钥不回显 | TC-…-CREDENTIALS-01：四类创建+Secret type 回读、描述/密码回读、删除 404 |
| LEG-devops-030..034 | `/kapis/iam…/devops/<name>/members` GET/POST（数组）/PUT/DELETE | metadata.name、annotations.iam.kubesphere.io/role、spec.email、status.state/lastLoginTime | 最近登录→本地时间，空→尚未登录 | 成员页签 | 角色缺失 `-`；自己操作未保护（GOT） | TC-…-MEMBERS-01：viewer→operator→移除的接口回读 |
| LEG-devops-036 | `/kapis/iam…/devops/<name>/roles?limit=-1` | metadata.name/creationTimestamp、annotations alias/description/module、labels.role-template | 时间→本地 | 角色页签 | preset=viewer/operator/admin；模板按标签；其他→自定义 | TC-…-PROJECTS-05：数量徽标=接口条数、分类文案 |
| LEG-devops-042/043/046 | GET/POST/DELETE `/apis/…/namespaces/<ns>/gitrepositories[/<name>]` | spec.provider/url/secret.name | — | 代码仓库页签 | provider 原值显示；secret 缺失 `-` | TC-…-CODE_REPOS-01：导入后回读 provider/url、删除后列表消失 |
| LEG-devops-047 | GET `/apis/gitops.kubesphere.io/v1alpha1/namespaces/<ns>/applications` | spec.argoApp.spec.destination.namespace、status.argoApp（JSON 字符串） | — | CD 页签 | sync/health 缺失 `-`；行不消失 | TC-…-PROJECTS-05：表头/空态（当前 0 个应用） |
| LEG-devops-056 | GET/PUT `/apis/devops…/devopsprojects/<name>`（整对象） | spec.argo.sourceRepos[]、spec.argo.destinations[{name,namespace,server}] | — | 基本信息白名单区 | 空→「未选择」；每行一个；位置格式 集群/项目 | TC-…-PROJECTS-04：保存后 spec.argo 回读、基本信息回显 |

跨链路说明：所有读取都经 `packages/api-client/src/devops.ts` 的 `devopsCollectionsApi`（原生）或 `devopsApi`（kapis/工程写），页面不直接 fetch；写后统一 invalidate 对应 query，成员/角色数在基本信息常驻读取。运行状态不读 CRD `status`（该字段未使用）。

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 列表一个主任务（浏览/创建）；详情第一屏是基本信息与 CD 白名单；流水线页签主任务是筛选与行操作 | 用例断言默认页签、页签顺序、主操作按钮存在；截图 `devops-*` 随用例生成 |
| 字段栅格 | 基本信息两列 definition list，统计两个计数；流水线表 6 列；运行表 8 列（多分支才显分支）；对话框字段纵向排列 | 用例断言表头顺序与字段文案；未做坐标级检查 |
| 主题 | 复用 ai-kit 语义 token；本批未改产品样式 | 未做 computed style / 对比度 / 深浅主题复核（见 §6） |
| 图标与图表 | 无图表；健康/运行状态用 Badge（与状态唯一映射同源）；缺值不画成功色 | TC-…-PIPELINES-01/03 断言缺值「无状态」 |
| 通用控件 | 分页/搜索/表单/页签/错误/确认全部复用 `@kube-ai-hub/ui` 与共享 ResourceErrorPanel/EditInfoDialog/DeleteDialog；不私造同类结构 | 用例通过 data-ai-id 验证共享控件；未新增公共组件，无需 Storybook 故事 |
| 表单与弹窗 | 一次性提交、名称唯一定位、删除输入完整名称、失败保留输入、取消不写 | TC-…-PROJECTS-04/PIPELINES-02/CREDENTIALS-01/CODE_REPOS-01 断言空名校验、只读字段、失败保留 |
| 链接与状态 | 同一集群作用域下钻；名称链接可复制；页签四态（loading/ready/empty/error） | TC-…-PROJECTS-03 断言 href；各用例断言三态唯一 |
| 控制台 | 不适用（本页族没有终端） | 不适用 |
| 复用决定 | 仅组合现有组件；无需新增/扩展共享组件 | 不新增 Storybook 故事；共享组件回归由 Lead 全站执行 |

## 5. 编码与回归

- [x] PRD 的 AC 同时承接功能、数据语义、状态、权限、交互与视觉（含七页签、健康分档、运行状态、写操作回读与失败保留）；design 写完整决策与被否方案（DEC-…-PROJECTS-08..11、PIPELINES-01..04、RUNS-01、CREDENTIALS-01、MEMBERS-01、CD-01/02；CON/INV/GOT 见 design）。
- [x] YAML 与 Python 一一镜像、句柄稳定（`data-ai-id`）；既有 DEVOPS_PROJECTS-01/02/03 更新为新实现的页签/面板/字段句柄（covers/story 不变），没有放宽断言：仍断言三态唯一、命名空间取值、运行记录失败+重试。
- [x] 旧能力表独立比对新实现：61 行逐行给归宿与 AC/TC（§2）；可自动检出的部分由 `check_docs --strict` 与 12 条用例覆盖，其余为人工逐行核对，不声称已有通用自动门禁。
- [x] 门禁：`python3 prd/tools/check_docs.py --strict prd/kube-frontend/cluster-management/devops-projects.md design/kube-frontend/cluster-management/devops-projects.md tests/ui/specs/kube-frontend/cluster-management/` → `errors=0 warnings=0`（生成物：`build_prd.py` 更新 catalog；`generate_case_docs.py` 写出 368 份 cases + `_traceability.md`）。
- [x] 本批只改规格，未改产品代码；显式类型检查/生产构建由 Lead 统一执行（本记录不声称通过）。console-next dist 21:16 重建为跑 E2E 的固定产物。
- [x] 相关 E2E（本地全栈 5178 → BFF 8092 → B200，串行 `-n 0`）：12 passed in 81.46s（命令：`KA_APP_URL=http://localhost:5178 python3 -m pytest tests/kube-frontend/cluster-management/test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_*.py -m ui -q -p no:cacheprovider -n 0`）。
- [x] 写用例自清理：每个写用例用唯一前缀创建对象并在 finally 删除（工程/流水线/运行/凭证/代码仓库/成员绑定）；只使用测试账号 `ui-test`；未删除他人的探针工程 `tc-devops-…`（只作为读写容器）。
- [ ] 视觉三档截图（1024/1280/1600）与深浅主题/中英文人工复核：本批未执行。
- [ ] 共享组件（Modal/Select/ResourceErrorPanel/DeleteDialog/Tabs）的组件级回归与 Storybook：未执行，由 Lead 统一安排。
- [ ] 全站串行 E2E 与新版部署/member 验收：未执行（超出单页判定）。

## 6. 完成判定与证据

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 部分完成 | 61 行原子能力：通过 33、等价承接 4（运行任务状态/提交、凭证详情编辑、工程列表作用域）、不做 22、阻塞 1、待补 1；未映射 0、未经证明承接 0 | 待补：成员「不能操作自己」保护；阻塞：运行日志正文；不做项见 §2 理由 |
| 数据语义 | 通过（阻塞项除外） | 请求→mapper→展示逐项对账（§3）；运行状态正分支、health 正分支、日志正文未验 | 运行成功/失败状态、耗时正分支、日志正文（BLOCK-1） |
| 交互与权限 | 部分完成 | 12 条用例覆盖列表/七页签/流水线 CRUD/运行链路/凭证/成员/角色/代码仓库/CD 白名单的读写回读；写后回读与自清理通过 | member 角色（非 admin）与 403 分支、视觉三档未验 |
| 视觉与主题 | 未验收 | 用例生成截图 `artifacts/<test>/`；未做 1024/1280/1600 三档与深浅主题计算色复核 | 全部视觉判定 |
| 静态/类型/构建/测试 | 部分通过 | 本批：check_docs --strict 0/0；12/12 E2E 通过（本地全栈→B200）；未跑 tsc/build/单元测试 | tsc/build/单元测试与全站回归由 Lead 执行 |
| 本地全栈/B200 读取 | 通过 | B200 host、admin；读：devopsprojects/kapis pipelines/iam members+roles/gitops applications/gitrepositories/pipelineruns；写：工程、流水线、凭证、成员、代码仓库、运行请求均实测回读 | 无 |
| 新版部署/member/全站 | 未验收 | 未在部署环境与本页族之外执行 | 全站串行、新版生产、member 角色 |

### 阻塞与复查条件

- **BLOCK-1（运行成功 / 日志正文）**：`devops-controller` CrashLoopBackOff（pod `devops-controller-85bf6b9c66-bjkwc`，restartCount 27，exitCode 1），日志逐字 `Error: the token of the Jenkins needs to update`；`kubesphere-config` 的 `devops.host=http://devops-jenkins.kubesphere-devops-system.svc/`、`devops.username=admin`。`POST /apis/…/pipelineruns` 返回 201 且对象可读，但无 `jenkins-pipelinerun-status` 注解；日志 kapis 路由 404。复查条件：controller 就绪不再重启、Jenkins whoami/crumb 200、新运行 60 秒内出现状态注解、日志 200 非空；四条满足后重跑 TC-…-DEVOPS_RUNS-01 并追加证据。
- **BLOCK-2（新工程集合回退）**：新建工程在控制器恢复前无 `status.adminNamespace`，其 kapis 集合回退到平台级数据（members 返回平台用户、roles 返回 533 条模板、pipelines 返回其他工程）。工程创建用例只验收创建/编辑/删除与命名空间回退；复查条件：新建工程 30 秒内出现 adminNamespace 后补该场景。
- **待补（LEG-devops-035）**：成员行对当前登录用户仍显示改角色/移除（旧 console 有 showAction 保护）；已在 design GOT-…-DEVOPS_MEMBERS-01 记录，本批不实现（产品代码归 devops-pipelines），用例只用 `ui-test` 账号避免误操作。
- **已知实现差异（不是阻塞）**：无注解运行的耗时显示 `0s`（mapper 把缺失 durationInMillis 归 0，与「未运行」并存）；代码仓库提供方显示 `spec.provider` 原值（如 `github`，旧 console 标题化）。两条都写入 AC/设计并由用例按实际行为断言。

### 证据文件

- 需求：`prd/kube-frontend/cluster-management/devops-projects.md`（US1–US14，22 条 AC，含 BLOCK-1/2 与明确不做）
- 技术方案：`design/kube-frontend/cluster-management/devops-projects.md`（DEC/CON/INV/GOT、契约表、阻塞证据）
- 用例规格：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_*.yaml`（12 条）
- 自动化：`tests/ui/tests/kube-frontend/cluster-management/test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_*.py`（12 个，一文件一函数）、`tests/ui/pages/devops_page.py`
- 生成物：`prd/catalog.yaml`、`tests/ui/cases/kube-frontend/cluster-management/TC-L3-…-DEVOPS_*.md`、`tests/ui/cases/_traceability.md`
- 运行证据：pytest 输出与 `tests/ui/artifacts/<test>/` 截图；接口探测证据：devops-controller 日志、kubesphere-config、kapis 404/405/400 探测（记录在 design 关键约束与 GOT）。
- 能力矩阵：本页族对应行由 Lead 统一更新（`docs/plans/capability-matrix.md` 不在本批写作用域）。
