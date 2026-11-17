# 企业空间概览 · 集群信息页签（2026-11-17）

> 本批交付证据。范围是**企业空间控制台概览页**的一个用户任务：从空间概览查看该空间可见的集群及其状态与资源使用率。
> 只补这一页的缺口；不重做项目/成员页，也不是全站审计。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 企业空间管理员在 /kube-frontend/workspaces/<ws>/overview 判断「这个空间能落在哪些集群、各自是否就绪、用了多少资源」 |
| 旧入口、源码版本、部署 URL | /workspaces/:ws/overview/clusters（旧概览三页签之一），mlu370 http://10.1.37.18:30880，2026-11-17 实拍 |
| 新入口 | /kube-frontend/workspaces/<ws>/overview 的「集群信息」页签 |
| 环境、集群、角色 | mlu370 host + member（4paradigm）集群；账号 admin（sysadmin）。B200 本轮不可达（BFF 502），单集群分支未验 |
| 视口、主题、语言 | 1600×900 / 1280×900 / 1024×900；深色+紫、浅色+紫、深色+绿（1600）、深色+英（1600） |
| 子页面与状态范围 | 概览两个页签；集群卡片（身份/就绪/供应商/K8s 版本/节点数/可见性/四项使用率/链接）；空态；错误+重试；未就绪卡 |
| 明确排除及批准 | 旧卡片雷达图不原样迁移，改为同卡四项使用率（百分比 + 明细：CPU/内存「已用/已分配/总量」，容器组/磁盘「已用/总量」），资源趋势由链接到的集群概览回答；空间级存储用量不显示（既有 DEC-15） |
| 并行文件与安全边界 | 不修改并行线的重纳登记与既有页面；本批只读，无写入对象 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-WSOV-01 | 旧概览三页签：资源用量 / 用量排行 / 集群信息 | 空间成员 | 三个同级页签 | 改进：两个页签（资源用量与排行合并，集群信息独立）；上一批已把前两者做成同页区块，拆回去会改动已交付 AC-07 | AC-08；TC-08 断言两页签与默认资源区块 | 通过（改进已记录） |
| LEG-WSOV-02 | 旧概览基本信息 | 空间成员 | 名称/别名/管理员/创建者/创建时间/集群 | 保留；「部署集群」优先取聚合集群名、回落 placement | AC-01/08；TC-08 断言页面不出现与卡片矛盾的占位 | 通过 |
| LEG-WSOV-03 | 旧概览资源用量区块 | 空间成员 | CPU/内存/Pod/网络 | 上一批已交付（空间概览记录），本批回归 | TC-07 | 通过（上一批） |
| LEG-WSOV-04 | 旧概览项目用量排行 | 空间成员 | CPU/内存 Top 5、名称下钻 | 上一批已交付，本批回归 | TC-07 | 通过（上一批） |
| LEG-WSOV-05 | 旧 Overview/Clusters 列表 | 多集群配置下显示 | 每集群一张卡：名称/别名、就绪、供应商、Kubernetes 版本、节点数、可见性 | 保留/改进：数据改用 tenant 聚合（完整 Cluster 对象）；新增节点数与可见性；单集群也显示单卡 | AC-08；TC-08 逐卡与 API 对账 | 通过 |
| LEG-WSOV-06 | 旧卡片雷达图（CPU/内存/Pod/磁盘使用率 + 已用/已分配/总量） | 就绪集群 | 四轴使用率图 + 资源明细 | 改进：同卡四项百分比 + 可见明细（CPU/内存已用/已分配/总量；容器组/磁盘已用/总量），不做图表 | AC-08；TC-08 与监控接口同次 used/total 取整对账 + 明细存在性 | 通过（改进已记录） |
| LEG-WSOV-07 | 旧卡片对未就绪集群的处理 | 未就绪 | 不显示监控/入口 | 保留：卡片显示「未就绪」，无进入链接并说明 | AC-08 | 通过 |
| LEG-WSOV-08 | 旧「无可用集群」空态 | 集合为空 | 空态说明 | 保留/改进：空态与读取失败分开 | AC-08；TC-08 空集合分支 | 通过 |
| LEG-WSOV-09 | 旧页签在单集群部署隐藏 | 单集群 | 不显示页签 | 改进：单集群也显示单卡（DEC-17，避免两套布局）；本环境不可验（B200 不可达） | AC-08 | 未验收（单集群分支） |
| LEG-WSOV-10 | 旧概览无项目/成员计数卡 | — | 新 UI 新增 | 保留（资源页签内） | TC-01/07 | 通过（回归） |
| LEG-WSOV-11 | 旧卡片进入集群详情 | 就绪集群 | 链接到集群概览 | 保留：/kube-frontend/clusters/<name>/overview | AC-08；TC-08 断言 href | 通过 |

**计数**：11 项原子能力；通过 10、未验收 1（单集群展示，环境不可达）、批准不做 0、未映射 0。

## 3. 数据契约与全链路

| 能力 ID | 请求路径/版本/作用域/参数 | 字段/标签 | 单位/精度/分母 | API 映射→页面位置 | 缺值/零/异常规则 | 同次响应对账断言 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-WSOV-05 | GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>/clusters?limit=-1 | metadata.name、annotations.alias-name/description、spec.provider、status.kubernetesVersion/nodeCount/conditions、labels.visibility | — | workspaceDetailApi.clusters → 卡片身份/就绪/供应商/版本/节点数/可见性 | Ready 条件非 True 即未就绪；nodeCount 缺失显示 -；空 items 为空态；请求失败为错误+重试 | TC-08 逐卡与接口条数、字段、Ready 对账 |
| LEG-WSOV-06 | host: GET /kapis/monitoring.kubesphere.io/v1alpha3/cluster?metrics_filter=...；成员: /kapis/clusters/<name>/monitoring.kubesphere.io/v1alpha3/cluster?metrics_filter=... | cluster_cpu_usage/total、memory_usage_wo_cache/total、pod_running_count/quota、disk_size_usage/capacity | used/total 取整百分比；悬停 已用/总量（core/GiB/个） | clusterMetricsApi.usage → 卡片四项 | 任一侧缺失、total≤0、非有限值显示 -；监控失败只影响该卡比率 | TC-08 与同一集群同次 used/total 取整对账 |
| LEG-WSOV-02 | GET /kapis/tenant.../workspaces/<ws>（placement）+ 上表聚合 | spec.placement.clusters / 聚合集群名 | — | 基本信息「部署集群」 | 聚合为空/失败回落 placement；都无显示 - | 截图与卡片名一致 |

**关键实测（2026-11-17，mlu370）**：cluster= 查询参数对成员集群**无效**——/kapis/monitoring.../cluster?cluster=4paradigm 返回 host 的 128 核，而 /kapis/clusters/4paradigm/monitoring.../cluster 返回该成员的 384 核；页与用例都改为路径形态。修复前两卡曾显示同一组数字（4%/13%/42%/53%），修复后 4paradigm 为 7%/4%/38%/64%、host 为 4%/14%/42%/53%（同一时刻）。

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 基本信息常驻；「资源用量与排行」（默认）与「集群信息」两页签；集群信息内 1/2/3 列卡片栅格 | 1600/1280/1024 首屏与全页截图；默认页签含既有资源/排行/计数 |
| 字段栅格 | 卡片：标题（别名/对象名/就绪徽标）→ 描述 → 4 字段（2×2）→ 使用率（2×2）→ 链接/不可用说明 | 三档截图；1024 无横向溢出（旧页 1024 溢出） |
| 主题 | 复用 ai-kit 语义 token | 深/浅 + 紫/绿截图；深色 computed：body rgb(11,24,77)、文字 rgb(222,235,246)、卡边框 rgb(62,76,146) |
| 图标与图表 | 不画雷达；使用率用文本百分比 + 可见「已用/已分配/总量」明细，缺失不画 0% | 截图与 TC-08 数值/明细断言 |
| 通用控件 | 页签/卡片/徽标/空态/错误重试全部复用 | config 契约 1490 通过 |
| 链接与状态 | 就绪卡链接集群概览；未就绪不链接；页签不写 URL | TC-08 href 断言；截图 |

复用决定：不新增 ai-kit 公共组件；扩展 api-client（workspace clusters 映射、cluster metrics 成员路径修复）与 locales；页面内组合 Tabs/Badge/ResourceErrorPanel/Skeleton。

## 5. 编码与回归

- [x] AC 同时覆盖功能、数据语义、状态、缺失值、交互与视觉；design DEC-17 记录被否方案与实测更正。
- [x] 一 spec 一测试、YAML 与 Python 镜像；原能力回归（TC-01/07）保留。
- [x] 旧能力表独立比对新实现；雷达→四项使用率作为改进记录，四类事实未减。
- [x] API/mapper 单测、显式类型检查、构建、严格门禁、相关 E2E 分别记录。
- [x] 固定构建（dist）复跑本页族 E2E；同次数据核对使用监控与聚合接口。
- [x] 三档 + 深浅主题 + 绿/英截图；旧 console 同页对照（1024 溢出，新无）。
- [x] 只读交付，无临时对象；未改并行范围。

## 6. 完成判定与证据

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过（范围内） | 11 项：通过 10、未验收 1、批准不做 0、未映射 0 | 单集群「显示单卡」分支（B200 不可达） |
| 数据语义 | 通过（host + 4paradigm） | 卡片字段/Ready 与聚合接口对账；四项使用率与监控接口同次对账；成员路径修复后两集群数字不同 | 指标极端缺失/失败分支未用模拟数据覆盖 |
| 交互与权限 | 通过（admin） | 两页签、默认资源区、链接、未就绪/空态分支；只读 | 非 admin / 无空间权限身份未验 |
| 视觉与主题 | 通过（已测组合） | 深/浅×三档、深+绿/英 1600；computed 记录；旧站 1024 溢出对照 | 浅+绿、浅+英组合未逐张截图；未做设计评审签收 |
| 静态/类型/构建/测试 | 通过（有既有基线） | 严格门禁 errors=0/warnings=0（本页范围）；console-next tsc 0；contracts 18 文件/1490；api-client 40 文件/413；E2E：dev 合并套件 8 passed，固定构建 TC-08 + WC-05 单条 2 passed；build 通过 | api-client 测试文件 3 处既有 TS2379；console-next 两个既有基线失败未修（非本批文件）；WC-05 在合并套件中偶发刷新竞态（单条复跑通过，非本批页） |
| 本地全栈/B200 读取 | 通过（mlu370） | 本地 Vite/BFF → mlu370；B200 本轮 502 不可用 | 未在 B200 验收 |
| 新版部署/member/全站 | 未验收 | — | 未部署镜像；member 仅 host 可观测；全站串行 E2E 未跑 |

## 7. 测试命令与结果

    cd console && python3 prd/tools/check_docs.py --strict \
      prd/kube-frontend/access-control/workspace-console.md \
      design/kube-frontend/access-control/workspace-console.md \
      tests/ui/specs/kube-frontend/access-control
    → errors=0 warnings=0

    cd console/tests/ui && python3 generate_case_docs.py → generated 443 case docs

    cd console/kube-frontend
    npx tsc --noEmit -p apps/console-next/tsconfig.json → 0 error
    npx vitest run --config config/vitest.config.ts → 18 files / 1490 passed
    pnpm --filter @kube-ai-hub/api-client test → 40 files / 413 passed
    pnpm --filter @kube-ai-hub/console-next build → 通过

    KA_APP_URL=http://localhost:5175 KA_CLUSTER=host KA_USERNAME=admin KA_PASSWORD=*** \
      pytest tests/kube-frontend/access-control -k WORKSPACE_CONSOLE -n 0 → 8 passed (32.94s)
    KA_APP_URL=http://localhost:5176 …（固定 dist）
      pytest ...WORKSPACE_CONSOLE_08.py ...WORKSPACE_CONSOLE_05.py -n 0 → 2 passed (12.56s)

WC-05（用户组删除）在合并套件里两次偶发失败（删除后树节点刷新竞态），单条复跑均通过；本批未改用户组页，按既有 flaky 记录，不当作本批回归。

## 8. 截图与记录

assets/workspace-overview-clusters-20261117：
- 新 UI：resources-{dark,light}-{1600,1280,1024}.png、clusters-{dark,light}-{1600,1280,1024}.png、clusters-green-zh-1600.png、clusters-violet-en-1600.png
- 旧 console：old/clusters-{1600,1024}.png

## 9. 剩余项与复查条件

| 项 | 状态 | 复查条件 |
| --- | --- | --- |
| 单集群「显示单卡」分支 | 未验收 | B200 恢复后跑 TC-08（工作空间只有 1 个集群）或构造单集群环境 |
| 指标缺失/失败分支 | 未用模拟覆盖 | 临时让某集群监控不可用（或 mock 组件测试），核对四项显示 - 且身份/链接不变 |
| 非 admin / 无空间权限 | 未验收 | 提供普通空间成员账号，核对只读可见与认证失败提示 |
| 浅+绿、浅+英组合 | 未验收 | 设计走查时补截图 |
| 部署到 mlu370/生产/member/全站 | 未执行 | 构建推送镜像后按集成记录滚动并复测；全站串行 E2E 按链路健康协议执行 |

## 10. 流程反思（已并入方法文档）

| 本批踩到的事 | 已写入 |
| --- | --- |
| 监控接口的 cluster= 查询参数对成员集群无效，返回主集群数字（有数但不属于它） | 指南 §8 #24；api-client 修复 + 单测 |
| 成员卡片曾把两个集群显示成同一组使用率 | 同 #24；TC-08 用路径形态取 expected 并对账 |
| 嵌套 data-ai-row 污染列表行定位（使用率标签被当成行） | 本批改用 data-ai-value；接入表格行属性时先确认选择器契约 |
| 页面聚合读能纠正对象字段的空值（placement 缺失导致「部署集群 -」与卡片矛盾） | design 不变量与 PRD 边界；同类「对象字段 vs 聚合」以聚合为准并保留回落 |

## 11. 关联文档

- PRD：prd/kube-frontend/access-control/workspace-console.md
- design：design/kube-frontend/access-control/workspace-console.md（DEC-…-17）
- 用例：TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-08
- 上一批：资源用量与排行见 workspace-overview-usage-20261116.md
