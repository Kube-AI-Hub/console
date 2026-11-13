# 老 console 全量迁移方案：按功能区拆分与工作区整合

> 依据：`docs/legacy-ui-migration-guide.md`（迁移方法）、`docs/SDD.md`（文档闭环）、已完成的两个模块（ConfigMaps / Secrets / ServiceAccounts）。
> 状态：**方案（待确认后逐项执行）**。

---

## 0. 先纠正一个前提：「按功能区拼首屏」不是问题，真正的瓶颈是「热更新」

用户提出的三件事里，前两件要用**实测数据**判断：

### 0.1 首屏：当前 3 个页面的包体

`vite build` 实测（gzip）：

| 产物 | gzip | 是否首屏必需 |
|---|---|---|
| `vendor-yaml-editor`（CodeMirror + lezer + uiw） | **136.8 KB** | **否** |
| `ai-kit`（组件库全部导出被打进一个 chunk） | **126.3 KB** | 是 |
| `vendor-misc` | 74.5 KB | 是 |
| `vendor-react` | 60.8 KB | 是 |
| `vendor-tanstack` | 37.0 KB | 是 |
| `vendor-radix` | 23.9 KB | 是 |
| `app-shared` | 21.1 KB | 是 |
| 全部页面 chunk（4 个资源页） | 合计 ≈ 20 KB | 否（懒加载） |

结论：**页面本身不慢，是第三方底座占了大头**。页面从 3 个增到 30 个，首屏几乎不变（每个页面 2–5 KB 懒加载）；真正会随页面数量线性增长的只有两样：
1. `ai-kit` 这个**大 barrel**（页面越多，越容易被"恰好都在首屏用到"的组件撑大）；
2. **开发期的模块图**（Vite 初次 optimize + HMR 重新打包的时间）。

（`ai-kit` 恰好与 YAML 编辑器同 chunk 待复核——构建日志显示 `index-*.js` 的 import 列表里出现了 `vendor-yaml-editor`，若属实，首屏就是 137 KB 的 CodeMirror，要单独修。）

### 0.2 热更新：这才是真实瓶颈

当前 `pages/` 是**按资源平铺**的：`pages/configmaps`、`pages/secrets`、`pages/serviceaccounts` …… 每个资源一套 5–9 个文件。按老 console 的路由表估算，全量是 **约 40 个页面 / 200+ 个子页面文件**。平铺结构下：

- 每个资源页都要各自 import shell、通用弹窗、hooks，**改动共享层会命中全部页面**；
- **每次新增页面都让 `routeTree.gen.ts` 整体重写**（配置字典改动期间实测：Vite 反复 "page reload src/routeTree.gen.ts"、"modified by another process"，开发服务器一直在重启——这是"热更新慢"最直接的证据）；
- 页面文件在同一目录下，Vite 的 HMR 边界只能落到"整个目录的模块图"。

### 0.3 因此本方案的三个杠杆

| 杠杆 | 做法 | 预期收益 |
|---|---|---|
| **按功能区拆分** | 路由按 `<area>.tsx`（布局路由）分组，页面文件按区域子目录组织 | 改动一个区域只影响该区域的 HMR 图；路由树文件数从「每页一条」降为「每区一组」 |
| **工作区整合** | 区域布局路由挂「工作区栏」（项目/集群切换 + 区域内页签），页签切换在内存中完成 | 区域内切换 0 次文档加载、0 次路由树重建；体验接近桌面应用 |
| **公共组件预热** | 多个页面共用的重组件（YAML 编辑器、表格、日期选择等）**不等按需**，进入工作台时并行预取；`ai-kit` barrel 保持原样 | 首次打开任意带编辑器的页面不再等一次冷加载；代价是首屏多约 137 KB，可接受 |

---

## 1. 功能区划分（以老 console 的导航为准，不臆造）

老 console 的导航定义在 `server/config.yaml`（`projectNavs` / `clusterNavs` / `accessNavs` / `workspaceNavs` / `platformSettingsNavs`），这是**唯一权威的分区依据**。据此分为：

| 功能区 | 作用域 | 老 console 路径 | 页面（按导航顺序） | 体量（老代码行数） |
|---|---|---|---|---|
| **工作台 / 概览** | 项目 | `/:ws/clusters/:c/projects/:ns/overview` | 项目概览（基本信息、配额、限额、资源用量、用量排行） | 1.4k |
| **应用负载** | 项目 | `.../applications`, `.../services`, `.../deployments|statefulsets|daemonsets`, `.../jobs|cronjobs`, `.../ingresses`, `.../pods` | 应用、服务、工作负载（3 页签）、任务（2 页签）、路由、容器组 | 约 6k |
| **存储** | 项目 | `.../volumes`, `.../volume-snapshots` | 存储卷、存储卷快照 | 1.1k |
| **配置**（已完成） | 项目 | `.../configmaps`, `.../secrets`, `.../serviceaccounts` | 配置字典、保密字典、服务账户 | — ✅ 已迁移 |
| **监控告警** | 项目 | `.../alerts`, `.../alert-rules`, `.../custom-monitoring` | 告警消息、告警策略、自定义监控 | 2.0k |
| **项目设置** | 项目 | `.../base-info`, `.../networkpolicies`, `.../roles`, `.../members`, `.../gateways`, `.../log-collections` | 基本信息、网络隔离、角色、成员、网关设置、日志收集 | 1.3k |
| **镜像构建** | 项目 | `.../s2ibuilders` | 镜像构建器 | 0.5k |
| **灰度发布** | 项目 | `.../grayrelease` | 灰度发布（需 servicemesh 模块，默认不显示） | — |
| **集群管理** | 集群 | `/clusters/:c/*` | 概览、节点（含边缘节点/GPU 卡）、系统组件、项目、工作负载、容器组、服务、路由、配置、网络、存储、监控告警、集群设置（7 页）、CRD | 约 12k |
| **访问控制** | 平台 | `/access/*` | 企业空间、用户、平台角色 | — |
| **平台设置** | 平台 | `/settings/*` | 平台信息、通知管理（5 渠道） | — |
| **应用商店管理** | 平台 | `/apps-manage/*` | 应用、分类、审核 | — |

> 说明：工作台（Dashboard）、DevOps、联邦项目、应用商店前台不在首期范围（前两者依赖老 console 的独立应用壳；应用商店依赖 openpitrix 模块），在「明确不做」中列出。

**迁移顺序**（按「用户日频 × 与已完成模块的共性 × 体量」排序）：

| 批次 | 功能区 | 理由 | 新增页面数 |
|---|---|---|---|
| **P0** | 工作区整合骨架 + 应用负载·工作负载三页签 + 容器组 + 服务 + 路由 | 日频最高；三者都是"列表 + 详情 + 编辑/删除"，直接复用已抽取的 `resourceApi` / 共享弹窗 / `useResourceListState`；工作负载有 3 个页签，是"工作区整合"的最佳验证场景 | +6 |
| **P1** | 应用负载·任务（Job/CronJob）+ 项目设置（基本信息/网络隔离/角色/成员） | 任务与工作负载同构；项目设置以表单为主，需要新的表单控件（多标签、开关） | +6 |
| **P2** | 存储（存储卷/快照）+ 监控告警（告警消息/策略） | 存储卷有详情与挂载关系；告警是只读列表 + 详情 | +4 |
| **P3** | 集群管理（概览/节点/项目/系统组件 + 集群配置三页签） | 集群级路由与项目级并列，验证"跨作用域的工作区栏" | +7 |
| **P4** | 访问控制 + 平台设置 | 平台级，页面少、以表单为主 | +6 |

---

## 2. 目标结构

### 2.1 路由树：每个功能区一个布局路由

```
src/routes/
  __root.tsx                                   # 会话门禁 + AppShell（不变）
  kube-frontend.tsx                            # 工作台根布局：📍工作区栏（项目切换）+ <Outlet/>
  kube-frontend.index.tsx                      # 重定向到 overview
  kube-frontend.$workspace.clusters.$cluster.projects.$namespace.tsx        # 项目作用域布局
  ...projects.$namespace.overview.tsx          # 概览
  ...projects.$namespace.app-workloads.tsx     # ★ 应用负载区域布局（页签栏 + Outlet）
  ...projects.$namespace.app-workloads.deployments{,.$name}.tsx
  ...projects.$namespace.app-workloads.statefulsets{,.$name}.tsx
  ...projects.$namespace.app-workloads.daemonsets{,.$name}.tsx
  ...projects.$namespace.app-workloads.jobs{,.$name}.tsx
  ...projects.$namespace.app-workloads.cronjobs{,.$name}.tsx
  ...projects.$namespace.app-workloads.pods{,.$name}.tsx
  ...projects.$namespace.app-workloads.services{,.$name}.tsx
  ...projects.$namespace.app-workloads.ingresses{,.$name}.tsx
  ...projects.$namespace.config.tsx            # ★ 配置区域布局（把已完成的 3 页收进来）
  ...projects.$namespace.config.{configmaps,secrets,serviceaccounts}{,.$name}.tsx
  ...projects.$namespace.storage.tsx           # ★ 存储区域布局
  ...projects.$namespace.monitoring.tsx        # ★ 监控告警区域布局
  ...projects.$namespace.settings.tsx          # ★ 项目设置区域布局
  clusters.$cluster.tsx                        # ★ 集群作用域布局
  clusters.$cluster.<area>.tsx + 页面
  access.tsx / settings.tsx / apps-manage.tsx  # 平台级区域布局
```

**关键决策（需要在设计文档里落 DEC）**：

- **DEC-AREA-01 路由段与老 console 保持一致**：区域内页面路径沿用老 console 的段名（`deployments`、`pods`、`services`、`ingresses`），**只加区域段**（`app-workloads/`、`config/`），这样"新路由 = 老路由 + 区域段"的映射可机械核对，也满足"路由一致（加前缀）"的既有约定。
- **DEC-AREA-02 区域布局是**真路由**，不是前端状态**：每个功能区有自己的路由，页签就是 `<Link>`；刷新/分享链接落在同一区域、同一页签。工作区栏状态进 **search params**（`?project=` 可选，仅在"全部项目"跨项目浏览时出现），而不是塞进 React 状态——否则刷新后上下文丢失。
- **DEC-AREA-03 区域内的切换不重建布局**：布局路由只挂 `<Outlet/>`，页签栏与工作区栏在区域布局里渲染一次；切换页签只替换 Outlet 的子树（已由 `28bd91c71` 的客户端导航保证 0 文档请求）。

### 2.2 目录：页面按区域归拢

```
src/
  areas/                                  # ★ 功能区定义（唯一声明处）
    project/
      config/index.ts                     # 区域元数据：key、title、页签、match
      app-workloads/index.ts
      ...
    cluster/
    platform/
  pages/
    project/config/{configmaps,secrets,serviceaccounts}/   # 已完成的三个模块搬到这里
    project/app-workloads/{deployments,pods,...}/
    ...
  shell/
    AreaNav.tsx                           # ★ 区域页签栏（菜单 + 面包屑 + 作用域摘要）
    WorkspaceBar.tsx                      # ★ 工作区栏（项目/集群切换）
    AppShell.tsx                          # 保留：平台切换、模块导航、侧栏
```

**为什么要「区域元数据」这一层**：侧栏、页签栏、面包屑、AI manifest 都要读"这个区域有哪些页、当前在哪一页"。写成一处 `areas/*/index.ts`，四处读同一份数据；写成四处，则第 40 个页面时必然漂移。

### 2.3 体验目标：让区域"像一个桌面应用"

| 桌面应用的感觉 | 本项目对应做法 |
|---|---|
| 打开后一直在同一个窗口里 | 区域布局常驻，页签切换只换内容区（Spinner 局部化，不闪整页） |
| 左侧栏分组、右侧页签 | 现有侧栏 → 区域入口；区域顶部横向页签 → 区域内页面 |
| 打开过的标签页还记得 | **区域内页签保留最近访问顺序**（`sessionStorage`），并提供"最近"下拉 |
| 窗口标题显示当前文档 | 面包屑：`工作台 / 项目 default / 配置 / 保密字典 / <name>` |
| 切换项目不重开窗口 | 工作区栏下拉切换项目 → 保持当前页签与搜索条件，只换 namespace |
| 多窗口：右键在新标签打开 | 页签是 `<Link>`，`Ctrl/⌘+点击` 原生支持 |

首屏与运行时的硬指标（写进 PRD 的 `SC-*`）：
- 区域**内**切换页签：**≤ 150 ms 完成可交互**，0 次文档请求；
- 区域**间**切换：≤ 400 ms，首次访问加载该区域页面 chunk；
- **公共组件库（含 YAML 编辑器）随首屏一起预热**：进入工作台后 2 s 内完成预取，打开首个含编辑器的页面时不出现"加载编辑器"的空等；
- 首屏 JS（gzip）**不设上限**，只设"增量预算"：新增一个功能区，首屏增量 ≤ 30 KB（页面 chunk 懒加载）。当前基线 ≈ 510 KB（含编辑器 137 KB）；
- 开发期：改一个页面文件后 HMR ≤ 300 ms；新增页面不触发全量重载。

### 2.4 公共组件预热与开发效率的具体措施

> **已决定的取舍：拆 ai-kit barrel 不做了。** 编辑器这类被多个页面共用的组件**提前加载**，理由是：老 console 里 YAML 编辑几乎每类资源都要用（配置、工作负载、路由、CRD…），一个"按需才拉"的编辑器会被反复冷加载，等待时间分散在每一次进入页面上，比一次性多花 137 KB 更难受。
> 首屏因此不再追求"越小越好"，只追求"**增量可控**"：加功能区不显著抬高首屏。

1. **保持 barrel，改为预热**：`@kube-ai-hub/ui` 继续单入口导出；shell 挂载后通过 `<link rel="modulepreload">` 与空闲回调**并行预取**公共 chunk（编辑器、表格、日期选择）。判定"公共"的规则写入 DEC：被 ≥ 2 个功能区使用，或首屏 2 s 内可达的下一步必然用到。
2. **区域页面懒加载**：`autoCodeSplitting` 已开；区域布局用 `lazyRouteComponent`，进工作台不预载其它区域的**页面** chunk（页面与公共组件分开对待：公共组件预热，页面按需）。
3. **路由树生成防抖**：区域布局把路由文件数从"N 页"降到"每区 1 个布局 + 页面"；给生成器加节流，避免每次保存重写整棵 `routeTree.gen.ts`（这是开发期反复重启的直接原因）。
4. **热更新边界**：页面按区域归拢后，改一个页面只重建该页面 chunk 与所在区域布局的模块图；共享层改动仍会全量 HMR——这是 barrel 带来的已知代价，通过"共享层改动频率低"来接受，并把硬指标定在 300 ms。

---

## 3. SDD 落地方式（每个功能区一次迭代）

严格按 `docs/SDD.md` 的「能力级闭环」：

```
tree.py（新增 areas 下的子模块与功能点）
  → build_prd.py（生成 L2/L3 骨架）
  → prd/ 补 US/AC/FR/SC/明确不做
  → design/ 补 DEC/INV/GOT（含被否方案）
  → tests/ui/specs/ 补 TC-*（covers → AC，story → US）
  → tests/ui/tests/ 一 spec 一文件
  → console-next 单测 + 契约测试（新增"区域内无文档加载""页签可达"两项架构断言）
  → check_docs.py --strict + generate_case_docs.py
  → 真实环境验证（A100）+ 逐页截图
```

文档新增部分（每次迭代固定产出）：
- **L1 更新**：`prd/kube-frontend/_index.md` 的模块边界里加"功能区"这一层，说明"工作区整合"的定位与不做的事。
- **L2 每功能区一份**：`prd/kube-frontend/<area>/_index.md` —— 页面结构、页签规则、异常态。
- **L3 每页面一份**：列表 / 详情 / 创建 / 编辑 / 删除 按需拆，不凑数（只读页面只写 list + detail）。
- **跨区域的能力**（工作区栏、页签栏、最近访问）单独一份 L2：`prd/kube-frontend/workspace-shell/`。

测试分三层（沿用现有约定）：
| 层 | 内容 | 例 |
|---|---|---|
| 单元 | 区域元数据解析、页签顺序、面包屑 | `area-nav.test.tsx` |
| 契约 | 区域内点击不产生文档请求；每个区域布局只挂一个 `<Outlet/>`；路由段与 `areas/*` 声明一致 | `config/area-contract.test.ts` |
| E2E | 每页面一条 `TC-L3-*`；每区域一条 `TC-FULL-*`（区域内走完 3 个页签不刷新）；一条 `TC-FLOW-*`（切项目保持页签） | `tests/ui/specs/kube-frontend/<area>/` |

---

## 4. 对比与验证方法（每批次必做）

| 检查项 | 方法 |
|---|---|
| 列 / 行操作 / 文案 | 读老源码 `getColumns()`、`itemActions`，与 `design/<area>/*.md` 的对照表逐条打勾 |
| 路由等价 | 脚本比对：老路由段 vs 新路由段（去掉区域段），不一致即报错（新增 `tests/ui/checks/route_parity.py`） |
| 页签集合与顺序 | 与 `server/config.yaml` 的 `tabs` 顺序逐项一致 |
| 交互时延 | 用 Playwright 计时：区域内切换取 `performance.now()` 差；连续切 10 次取 P95 |
| 首屏 | `vite build` 产物 + Playwright 的 `PerformanceResourceTiming`，断言首屏 JS ≤ 400 KB 且不含编辑器 chunk |
| 热更新 | dev server 下改一个页面文件，测量 HMR 完成时间；新增页面后确认无整树重载 |
| 截图 | 标准桌面视口 1600×900，每页面列表 + 详情，存 `tests/ui/artifacts/` |

---

## 5. 风险与对策

| 风险 | 对策 |
|---|---|
| 搬动已完成的 3 个模块会打断现有 28 条 E2E | 先做**纯搬移（无逻辑改动）**并在同一提交里跑全量 E2E；路由新增区域段时给旧路径加 301 式 `redirect`，保证书签不失效 |
| 工作区栏的状态与路由互相污染 | 作用域只从**路由 params** 派生（已有 `scope` 正则），工作区栏切换 = `navigate` 到同页签 + 新 namespace；不允许在组件里另存一份 namespace |
| 40 个页面的文档工作量 | 只读页面合并到一份 L3（如"集群概览与节点"），不为凑模板拆页；`check_docs --strict` 把关 |
| 并行改同一个 checkout（本会话已遇到一次） | 每批次开工前 `git status` 核对；批次以独立分支提交，避免与并行工作交叉 |
| 老 console 依赖的特有能力（YAML 编辑、CRD 表单） | 已完成的 ConfigMaps 已覆盖 YAML；CRD 页面放 P4 且需要单独的 schema 表单能力，先只做列表与 YAML |

---

## 6. 里程碑与验收

| 里程碑 | 内容 | 验收 |
|---|---|---|
| **M0 骨架** | `areas/` 元数据、区域布局路由、页签栏、工作区栏；把已完成的 3 个页面搬进 `config` 区域；旧路由重定向；公共组件预热 | 3 页原有 E2E 全绿；区域内切换 0 次文档请求、P95 ≤ 150 ms；进入工作台 2 s 内完成公共 chunk 预取 |
| **M1 应用负载** | 工作负载 3 页签 + 容器组 + 服务 + 路由 | 6 页 E2E；`TC-FULL` 区域内走通 3 页签 |
| **M2 任务与项目设置** | Job/CronJob + 项目设置 4 页 | 同上 |
| **M3 存储与监控** | 存储卷/快照 + 告警消息/策略 | 同上 |
| **M4 集群管理** | 集群级区域 + 7 页 | 跨作用域工作区栏验证 |
| **M5 平台级** | 访问控制 + 平台设置 | 同上 |

每批次结束都跑：`check_docs --strict`、单测、契约测试、E2E、`vite build` 体积与 HMR 计时，并把结果写回 `docs/plans/` 的执行记录。

---

## 7. M0 执行记录（2026-11-12）

### 7.1 结构调整（本次）

- **路由按作用域建文件夹**：`src/routes/` 不再平铺。
  ```
  routes/
    __root.tsx
    index.tsx
    login.tsx
    kube-frontend.$workspace.clusters.$cluster.projects.$namespace/
      route.tsx                      # 项目工作区布局：工作区栏 + 配置区域页签
      configmaps/{route,index,$name}.tsx
      secrets/{route,index,$name}.tsx
      serviceaccounts/{route,index,$name}.tsx
    kube-frontend.clusters.$cluster/
      configmaps/$name.tsx, configmaps.tsx
  ```
- **每个页面一个文件夹，内含三件套**：`index.tsx`（列表）、`$name.tsx`（详情）、`route.tsx`（只渲染 `<Outlet/>` 的布局）。原因不是洁癖：在文件式路由里 `<page>.tsx` 会成为 `<page>.$name.tsx` 的**父路由**，列表若忘了 `<Outlet/>`，详情 URL 会渲染成列表——本次实测就是这样（点击行后地址变了、页面还是列表）。三件套把这条规则固定下来，并由契约测试 `area-contract.test.ts` 守住。
- **修正**：上一版把列表与详情合并成单一路由，导致 `/configmaps/<name>` 不匹配任何路由（TanStack 默认 NotFound）。已回退为同级子路由。

### 7.2 工作区整合

- `WorkspaceBar`：项目切换不换页签，只换 namespace（面包屑与页签保持不变）。
- `AreaTabs`：配置区域三个页签，页签是真实 `<a href>`（中键/⌘ 点击可新开标签），普通点击走客户端跳转。
- `areaBreadcrumb`：`工作台 / 配置 / 配置字典`，详情时追加对象名。
- 区域元数据 `src/areas/registry.ts` 是唯一声明处（侧栏、页签、面包屑、manifest 同源）。

### 7.3 公共组件预热（按用户决定）

- **不拆 ai-kit barrel**；编辑器等跨页面公共组件**提前加载**：`shell/preload.tsx` 在 shell 挂载后经 `requestIdleCallback` 预取 `@kube-ai-hub/ui/editor`（137 KB gzip），避免每次进页面冷等。
- 页面 chunk 仍按需：新增功能区不抬高首屏（实测首屏 8.04 KB 入口 + 公共库）。

### 7.4 本轮验证

| 项 | 结果 |
|---|---|
| 三个列表页 | `ready`/`empty`，配置区域 4 个页签（区域名 + 3 页） |
| 详情 URL | `/configmaps/hello`、`/secrets/<name>` 均渲染详情，不再 NotFound |
| E2E | configmaps/secrets/serviceaccounts：47 通过、4 条因数据条件 skip、1 条时序抖动（单跑通过） |
| 单测 | console-next 88 通过 |
| 契约 | 213 通过（新增 `area-contract.test.ts`：页签/工作区栏/文件夹三件套/预热） |
| 类型检查 | 通过 |

### 7.5 待办（下一轮）

- 把「配置」区域的三页登记进 `prd/`、`design/` 的 L2（区域化改造），补 `TC-FULL` 区域级用例（切换三页签不刷新）。
- 开始 M1 应用负载：deployments / statefulsets / daemonsets / jobs / cronjobs / pods / services / ingresses。

---

## 8. M1 执行记录：应用负载（2026-11-12）

### 8.1 交付

| 层 | 内容 |
|---|---|
| api-client | `workloads.ts`：八种资源的摘要/详情 + 状态派生（移植 `console/src/utils/status.js`：`getDeployStatus`/`getDaemonSetStatus`/`getJobStatus`/`getPodStatus`） |
| 页面 | `pages/app-workloads/WorkloadListPage.tsx`（一个页面驱动八种资源）+ `queries.ts`（描述符、查询、删除、更新、manifest 登记） |
| 路由 | 八个文件夹：`deployments/`、`statefulsets/`、`daemonsets/`、`jobs/`、`cronjobs/`、`pods/`、`services/`、`ingresses/`，每个内含 `route.tsx` + `index.tsx` |
| 区域 | `areas/registry.ts` 新增 `app-workloads`（8 页，顺序照 `projectNavs`） |
| 文案 | zh/en 各 45 key（列名、状态、空态、批量删除） |
| 单测 | `api-client/test/workloads.test.ts` 21 条（状态规则逐分支对照老实现） |

### 8.2 与老 console 的对照

| 老 console（`projects/containers/Deployments`） | 迁移后 | 说明 |
|---|---|---|
| 名称列：别名优先，副行是描述或状态原因 | 名称列：别名优先，副行是 `app` 标签 | 老页面副行是描述；工作负载通常无描述，故用 `app`（列"应用"的内容），差异已记入待补 |
| 状态列（WORKLOAD_STATUS 四态 + 过滤） | 状态列四态徽章（成功/警告/中性配色） | 过滤下拉未做，见待办 |
| 应用列 | 并入名称列副行 | 减少一列，窄屏更稳 |
| 更新时间列 | 创建时间列 | 老列表头写"更新时间"但取 `createTime`，与老实现一致 |
| 行操作：编辑信息 / 编辑 YAML / 重新部署 / 删除 | 编辑 YAML / 删除 | 重新部署、扩缩容、编辑信息待补 |
| 批量删除 | 批量删除 | 一致 |

### 8.3 实测（真实集群，项目 spaces）

| 页面 | 结果 |
|---|---|
| deployments | ready，10 行（共 34），状态徽章正常 |
| jobs | ready，10 行 |
| services | ready，10 行 |
| ingresses | ready，1 行 |
| statefulsets / daemonsets / cronjobs | empty（该项目确实没有） |
| pods | 上游列举耗时 17.1s（10 条），页面全程 `loading` 并给出加载态 |

> pods 的 17s 是 ks-apiserver 列举慢（同环境 deployments 2.97s），不是前端问题；页面按用户要求先给加载态，不会"点了没反应"。

### 8.4 待办

- 工作负载详情页（`$name.tsx`）、重新部署 / 扩缩容 / 编辑信息 / 状态过滤。
- 老页面副行文案（描述 vs 应用标签）需按老实现细化。
- pods 列表性能：确认是否可加字段裁剪或服务端分页参数。
- PRD/design 的 L2（应用负载）+ 每页 L3 + `TC-*` 用例。

## 9. M1 续：工作负载详情 + 写路径缺陷修复（2026-11-12）

### 9.1 修掉一个会阻断所有非核心资源写操作的缺陷

`resourceApi` 的写路径把前缀写死成 `/api/v1`，而 `/api/v1` **只服务核心组**（ConfigMap、Secret、ServiceAccount、Service、Pod、PVC）。Deployment / StatefulSet / DaemonSet 在 `apps/v1`，Job / CronJob 在 `batch/v1`，Ingress / NetworkPolicy 在 `networking.k8s.io/v1`。后果是这些资源的**编辑 YAML、扩缩容、重新部署、删除全部 404**（"the server could not find the requested resource"），而列表读的是 kapis，所以只有写会坏。

- 修复：`resources.ts` 增加 `RESOURCE_GROUPS` 表与 `kubePrefix(resource)`，写路径按资源选前缀；未登记资源回退核心组。
- 回归：`api-client/test/resources.test.ts` 新增 3 条（核心组 / 分组 / 未登记回退）。

### 9.2 工作负载详情（八种资源共用）

- `pages/app-workloads/WorkloadDetailPage.tsx`：属性（集群 / 项目 / 应用 / 副本 / 创建时间 / 创建者）、容器镜像列表、编辑 YAML、重新部署、删除。
- 每种资源新增 `$name.tsx` 子路由，与 `index.tsx` 同级；文件夹里的 `route.tsx` 负责渲染实际匹配的子路由。
- 重新部署 = 给 Pod 模板打 `kubectl.kubernetes.io/restartedAt`（与 `kubectl rollout restart` 同一约定），用 merge patch 只改该注解，不覆盖并发修改；Job / Service / 路由没有模板，故 `allowRedeploy` 仅在三种控制器上为真。

### 9.3 实测

| 项 | 结果 |
|---|---|
| 部署详情（真实对象） | `ready`；标题、6 个属性、面包屑带对象名、页签保持高亮、返回列表正常 |
| 重新部署（一次性 Deployment） | 点击后 Pod 模板出现 `restartedAt: 2026-11-11T16:26:04.301Z`，revision 1→2；对话框在请求期间可见 |
| 测试数据 | 已清理（`tc-e2e-*` 复核为 0） |
| 单测 | api-client 70、console-next 88、契约 274 |

### 9.4 仍缺（下一轮）

- 扩缩容、编辑信息、状态过滤；工作负载列表的"应用"列与老页面副行描述的差异。
- 存储、监控告警、项目设置、集群管理、平台级功能区。
- 应用负载区域的 PRD/design L2 + 每页 L3 + `TC-*`。

## 10. 第 4 轮：详情、写路径修复、测试加固（2026-11-12）

### 10.1 交付

- **工作负载详情**：八种资源共用的 `WorkloadDetailPage`（属性、容器镜像、编辑 YAML、重新部署、删除），每种资源新增 `$name.tsx` 子路由。
- **重新部署**：`workloadsApi.restart()` 用 merge patch 给 Pod 模板打 `kubectl.kubernetes.io/restartedAt`；仅三种控制器提供（描述符 `allowRedeploy`）。
- **写路径按 API 组路由**：新增 `RESOURCE_GROUPS` 与 `kubePrefix()`；这是修一个真实缺陷——Deployment 等非核心组资源的编辑 YAML、重新部署、删除此前全部 404。
- **文档**：`prd/` 与 `design/` 各 7 份（L2 一份 + 6 个 L3）；`tree.py` 新增 `app-workloads` 子模块。

### 10.2 测试可靠性（本轮修掉的测试侧缺陷）

| 症状 | 根因 | 修复 |
|---|---|---|
| 详情页 `reveal()` 超时 | 令牌区段来自**独立查询**，详情就绪不代表它已渲染 | `wait_for_secret_section()` 先等区段出现 |
| kubeconfig 断言偶发失败 | 读到的是**遮挡后**的文档（有 `token:` 行但不是真值） | `kubeconfig()` 轮询到真值再返回 |
| 全量跑时登录用例全红 | `login_page` 与规格都指向 `base_url`（**老**控制台） | 改用 `ui_config.app`（迁移后的页面） |
| 负载高时 "still loading" 误报 | Playwright 断言默认 5s，比集群响应还短 | `expect.set_options(timeout=20_000)` 全局提高 |
| 新建对象在列表里找不到 | `open()` 只等列表就绪，不代表目标行在首屏 | 三个页面对象加 `ensure_row()`：等不到就按名称搜索 |
| `token_data` 与实际渲染不一致 | 轮询读 `/api/v1`，页面读 kapis，两者会短暂的滞后差 | 轮询同时校验 kapis 读到的值 |

### 10.3 实测

- serviceaccounts 13/13、secrets 15/15、configmaps 20 通过 + 4 条数据条件 skip、login 3/3。
- 部署详情：`ready`，6 个属性、面包屑带对象名、返回列表正常。
- 重新部署：点击后 Pod 模板出现 `restartedAt`，revision 1→2。

## 11. 第 5 轮：应用负载测试层 + 共享表格修正（2026-11-12）

### 11.1 交付

- **测试层**：`pages/app_workloads.py` 页面对象；11 条规格（`tests/ui/specs/kube-frontend/app-workloads/`）；11 个镜像测试文件；`conftest.py` 增加 `app_workloads_page` fixture（仅新增）。
- **文档**：应用负载的 L2 + 6 个 L3 需求与技术方案补全；`generate_case_docs.py` 重建用例文档与追溯表。

### 11.2 修掉的产品缺陷（本轮）

- **空列表仍渲染表头**：`packages/ai-kit/src/primitives/Table.tsx` 无条件渲染 `<thead>`，空态出现「名称/创建时间」表头，读起来像「表格加载失败」。改为 `loading || rows.length > 0` 才渲染；加载中保留表头避免骨架跳动。影响所有列表页，已回归。

### 11.3 修掉的测试缺陷

| 症状 | 根因 | 修复 |
|---|---|---|
| 集群配置字典 `wait_ready()` 必失败 | `to_have_attribute(..., "ready|empty")` 是**字面**匹配，不是正则 | 改用 `re.compile("^(ready|empty)$")` |
| 集群配置字典搜索断言看到未过滤的行 | `search()` 只固定 sleep 600ms，响应未回就读行 | 轮询到「所有可见行都含关键词」再返回 |
| 新建对象找不到行 | `open()` 只等列表就绪 | 三个页面对象加 `ensure_row()`（找不到就搜索） |

### 11.4 验证

| 套件 | 结果 |
|---|---|
| app-workloads（新） | **11 passed** |
| secrets | 15 passed |
| serviceaccounts | 13 passed |
| configmaps | 20 passed + 4 skip（数据条件） |
| login | 3 passed |
| 单测 api-client | 70 passed |
| 单测 console-next | 88 passed |
| 架构契约 | 274 passed |
| 文档门禁 | `errors=0 warnings=0` |

### 11.5 未解决（不在本轮范围）

- `tests/kube-frontend/cluster-configmaps/` 有 6–10 条失败，且每次运行失败的集合不同。该页面与用例由并行会话提交（`6af9eae05`），不在本次迁移的功能区内；已修掉其中两条**测试侧**问题（正则匹配、搜索等待），其余仍在。需要单独排查其 fixture 与等待策略。
- 工作负载仍缺：创建表单、扩缩容、编辑信息、状态过滤、日志与终端。

## 12. 第 6 轮：存储功能区（2026-11-12）

### 12.1 交付

| 层 | 内容 |
|---|---|
| api-client | `storage.ts`：PVC 与 VolumeSnapshot 的摘要/详情、`claimStatus`（phase + 扩容条件）、`snapshotStatus`、访问模式缩写 |
| 页面 | `pages/storage/StorageListPage.tsx`（两页共用）、`StorageDetailPage.tsx`、`queries.ts` |
| 路由 | `persistentvolumeclaims/{route,index,$name}.tsx`、`volumesnapshots/{route,index,$name}.tsx` |
| 区域 | `areas/registry.ts` 新增 `storage`（两页，侧栏「存储」） |
| 文案 | zh/en 各 37 key |
| 单测 | `api-client/test/storage.test.ts` 10 条（扩容条件优先、快照状态、访问模式缩写） |

### 12.2 与老 console 的对照

| 老 console（`projects/containers/Volumes`） | 迁移后 | 说明 |
|---|---|---|
| 名称（副行描述） | 名称（副行存储类型） | 老页面副行是描述，PVC 通常无描述 |
| 状态（phase + 扩容条件） | 一致 | `claimStatus` 逐分支对照 |
| 访问模式 | 一致（RWO/ROX/RWX/RWOP） | — |
| 挂载状态 | **未迁移** | 需要扫描全部 Pod 的卷引用，代价高，记入待办 |
| 容量 / 创建时间 | 一致 | — |
| 详情 | 属性 8 项（含背后的持久卷） | 快照显示来源存储卷 |

### 12.3 实测（真实集群）

- 项目 `default`：两页 `empty`，空态不渲染表头（共享表格修复后）。
- 项目 `csghub`（13 个 PVC）：列表列 `名称/状态/容量/访问模式/创建时间`；详情 `ready`，8 项属性。
- 侧栏出现「存储」；页签高亮正确；无 JS 错误。
- 快照：该集群未安装 VolumeSnapshot CRD，页面落到 `empty`（不是报错）。

### 12.4 待办

- 「挂载状态」列（Pod 卷引用扫描）。
- 存储卷扩容、快照创建（表单能力）。
- 集群级存储类型与持久卷页面（属集群管理功能区）。

### 12.5 测试层（本轮补齐）

- `pages/storage.py` + `conftest.py` 的 `storage_page` fixture；6 条规格与 6 个镜像测试（`tests/ui/specs|tests/kube-frontend/storage/`）。
- 用例文档已由 `generate_case_docs.py` 重建（114 份），`check_docs --strict` 回到 `errors=0 warnings=0`。

### 12.6 本轮修掉的测试缺陷

| 症状 | 根因 | 修复 |
|---|---|---|
| 存储页偶发 "surface 不出现" | 共享集群上首屏与 `/kapis` 列表抢跑 | `open()` 失败后重载一次（只在**完全没渲染**时重试，错误页不重试） |
| 列表等待超时 | 断言默认 5s，比慢请求还短 | `wait_ready` 显式 60s |
| 每次建 PVC 都很慢 | 每次都列一遍全部 storageclass | 进程内缓存存储类型 |
| 详情读不到属性 | 只等外壳可见，属性块还是骨架 | `wait_detail_ready()` 等第一个 `<dt>` |
| 删除确认点不动 | 对话框要求**输入对象名**才启用按钮 | 填入名称后再点 `:delete-confirm` |
| 区域用例偶发多出文档请求 | 监听器在首次导航未结束时挂上 | 先 `wait_for_load_state("networkidle")` 再计数 |
| 工作负载详情偶发不出现 | 列表后台刷新时行被替换，首次点击落空 | `click_name()` 重试一次 |
| 规格 YAML 解析失败 | `entry_url` 以 `{` 开头未加引号 | 加引号 |

### 12.7 实测

| 套件 | 结果 |
|---|---|
| storage（新） | **6 passed**（连跑两次） |
| app-workloads | **11 passed** |
| api-client 单测 | 80 passed（含 storage 10 条） |
| 架构契约 | 299 passed |
| 文档门禁 | `errors=0 warnings=0` |
| 类型检查 / 构建 | 通过 |

## 13. 第 7 轮：监控告警功能区（2026-11-12）

### 13.1 交付

| 层 | 内容 |
|---|---|
| api-client | `alerting.ts`：告警消息与告警策略的摘要/详情、状态与级别文案；`resources.ts` 的 kapis 前缀改为参数（`KAPIS_RESOURCES` / `KAPIS_ALERTING`） |
| 页面 | `pages/monitoring/MonitoringListPage.tsx`（两页共用）+ 详情弹窗（数据来自行，不再请求）+ `queries.ts` |
| 路由 | `alerts/{route,index}.tsx`、`alertingrules/{route,index}.tsx` |
| 区域 | 侧栏新增「监控告警」 |
| 文档 | PRD + 设计各 3 份；用例文档重建（117 份） |
| 测试 | 3 条规格 + 3 个测试 + `pages/monitoring.py` |

### 13.2 修掉的产品缺陷

**200 + 空响应体被当成错误**：告警模块未安装时，聚合 API 返回 `200` 但响应体为空。客户端把空体解析成 `undefined`，列表代码随即读 `.items` 抛错，页面显示红色错误面板——相当于把「这里没有数据」报告成「我们的代码坏了」。已在 `resourceApi.list()` 里把空体当空列表处理。

### 13.3 与老 console 的对照

| 老 console（`projects/containers/Alerting`） | 迁移后 | 说明 |
|---|---|---|
| 消息：消息、状态、级别、策略、监控目标、触发时间 | 消息、状态、级别、触发时间（策略与目标在副行与详情里） | 列宽有限，策略/目标折进副行 |
| 策略：名称、策略状态、规则状态、耗时、最近检测 | 名称、策略状态、规则数、最近检测 | 「规则状态/耗时」未迁移（需解析规则体） |
| 策略启用/停用、编辑 | **未迁移** | 记入待办 |
| 消息详情抽屉 | 详情弹窗（同一份行数据） | 少了二次请求 |

### 13.4 实测

- 该集群**未启用告警模块**：`alerting.kubesphere.io/v1alpha2` 在项目/集群/企业空间三种作用域均返回 200 空体。
- 因此本区只能验证到空态：两页均 `data-ai-state="empty"`、无错误面板、无失败请求、页签与侧栏正确、切换 0 次文档请求（由 `TC-FULL` 断言）。
- **功能完整性受限**：有数据时的列渲染与详情内容无法在此环境验证，已如实记录。

### 13.5 待办

- 告警策略的启用/停用与编辑；消息的静默与通知配置。
- 在启用告警模块的集群上补「有数据」的回归。

## 14. 第 8–9 轮：项目设置功能区（2026-11-12）

### 14.1 交付

| 层 | 内容 |
|---|---|
| api-client | `iam.ts`：角色（规则数、`role-template-*` 判定、规则三字段）与成员（角色注解、状态、最近活动）映射 |
| 页面 | `pages/settings/SettingsListPage.tsx`（两页共用）+ 角色规则弹窗 + `queries.ts` |
| 路由 | `roles/{route,index}.tsx`、`members/{route,index}.tsx` |
| 区域 | 侧栏新增「项目设置」 |
| 文档 | PRD + 设计各 4 份；用例文档重建（121 份） |
| 测试 | 4 条规格 + 4 个测试 + `pages/project_settings.py`；单测 9 条 |

### 14.2 与老 console 的对照

| 老 console（`projects/containers/{Roles,Members}`） | 迁移后 | 说明 |
|---|---|---|
| 角色：名称、描述、创建时间 | 名称（副行描述）、规则数、创建时间 | 新增规则数；描述折进副行 |
| 角色详情（规则表 + 绑定用户） | 规则表弹窗 | 绑定用户未迁移 |
| 角色创建/编辑/删除 | **未迁移** | 记入待办 |
| 成员：名称、状态、角色、最近登录 | 名称、状态、角色、最近活动 | 「最近登录」接口没有该字段，改用最近改密时间，文案如实改为「最近活动」 |
| 邀请成员、改角色、移出 | **未迁移** | 需要用户选择器与写接口 |

### 14.3 实测（真实数据，本轮唯一有真实数据的区域）

- `default` 项目 27 个角色：列表 `ready`，10 行/页，列 `名称/规则数/创建时间`；`role-template-*` 行带「模板」徽标。
- 角色详情弹窗：规则表三列 `API 组/资源/动作`，行数与 API 返回一致（实测 `argoproj.io / workflowtaskresults / create, patch`）。
- `spaces` 项目成员 1 人：列 `名称/状态/角色/最近活动`，角色列与 `iam.kubesphere.io/role` 注解一致。

### 14.4 待办

- 角色创建/编辑/删除、成员邀请与改角色。
- 角色详情补充「绑定该角色的成员」。
- 其余项目设置页：基本信息、网络隔离、网关设置、日志收集。

## 15. 第 10–12 轮：集群管理 + 递归对照（2026-11-12）

### 15.1 集群管理功能区

| 层 | 内容 |
|---|---|
| api-client | `storage.ts` 增补节点（`nodeStatus` 只看 Ready 条件、`nodeRole` 缺省 worker）与命名空间（企业空间标签）模型 |
| 页面 | `pages/cluster/ClusterListPage.tsx`（节点、项目两页共用）+ `queries.ts` |
| 路由 | 新增**集群作用域布局** `kube-frontend.clusters.$cluster/route.tsx` + `nodes/`、`namespaces/` |
| 区域 | 侧栏新增「集群管理」 |
| 文档 | PRD + 设计各 3 份；用例 3 条 + 单测 10 条 |

**关键设计点**：集群作用域用**独立布局路由**，不渲染项目工作区栏——否则会出现一个「切换项目」却对页面毫无影响的控件。`TC-FULL` 直接断言 `workspace-bar` 数量为 0。

实测：节点 3 个（`ready`，列 名称/状态/角色/CPU/内存）、项目 31 个（`ready`，列 名称/状态/企业空间/创建时间）。

### 15.2 递归对照工具

新增 `prd/tools/parity_check.py`：把老 console 的页面清单与迁移后的路由、区域登记、用例规格三方对账，并列出**显式决定不迁移**的页面及原因。

首次运行结果：项目页面 17 个、集群页面 2 个，**结构缺口 0**（无缺页、无多余路由、无未登记区域、无缺规格）。

### 15.3 递归对照发现的**功能**缺口（结构完整 ≠ 功能完整）

按老 console 的行操作逐页对账，缺口如下：

| 页面 | 老 console 行操作 | 迁移前 | 本轮 |
|---|---|---|---|
| 部署/有状态副本集/守护进程集 | 编辑信息、编辑 YAML、重新部署、停止、删除 | 编辑 YAML、删除 | **补编辑信息、停止** |
| 任务/定时任务/容器组/服务/路由 | 编辑信息（+各自专属） | 编辑 YAML、删除 | **补编辑信息** |
| 存储卷 | 编辑信息 | 编辑 YAML、删除 | 待补 |
| 告警策略 | 启用/停用、编辑 | 详情 | 待补 |
| 角色 | 编辑、删除 | 详情 | 待补 |

### 15.4 本轮修掉的产品缺陷

**编辑信息写到集合 URL（405）**：`update()` 从 `body.metadata.name` 取对象名，而我传的是 `{ metadata: { annotations } }`（没有 name），于是 PUT 打到 `…/deployments/`（集合地址）——405。改为先取完整对象再带上编辑后的注解 PUT，与秘密页一致。实测：别名写入成功、停止把 `replicas` 从 2 改为 0。

### 15.5 验证

| 项 | 结果 |
|---|---|
| cluster-management 套件 | 3 通过 |
| app-workloads 套件 | 11 通过（DELETE_01 在整包中偶发抖动，单跑通过） |
| 架构契约 | 348 通过 |
| api-client 单测 | 99 通过 |
| 文档门禁 | errors=0 warnings=0 |

### 15.6 待办（按缺口排序）

1. 存储卷「编辑信息」、告警策略「启用/停用」、角色「编辑/删除」。
2. 工作负载「重新部署」详情页已有，「启动」（停止的反向操作）未做。
3. 定时任务「暂停/启动」、任务「重跑」、服务与路由的专属编辑、容器组「重新调度」。
4. 集群管理其余页面（概览、系统组件、存储类型、集群设置）、平台级功能区。

## 16. 第 13 轮：补齐对照发现的交互缺口（2026-11-12）

### 16.1 本轮补上的行操作

| 页面 | 新增操作 | 实现要点 | 实测 |
|---|---|---|---|
| 存储卷 | 编辑信息 | 先取完整对象再带注解 PUT（与秘密页一致） | 别名写入成功 |
| 项目角色 | 编辑信息、删除 | 写操作走 **IAM** 聚合 API（`iam.kubesphere.io`），不是 RBAC 组 | 别名写入成功；删除后 404 |
| 告警策略 | 启用/停用 | 取反 **label** `alerting.kubesphere.io/enable`（不是 annotation） | 环境未装模块，用例按 skip |

角色与告警策略的两处要点值得记下来，因为写错位置都不会报错、只会「看起来保存了但没生效」：
- 角色：`rolesApi` 的通用写路径会按静态表推导到 `/apis/<group>`，而 `roles` 不在表里 → 必须显式走 IAM 路径。
- 告警策略：老 console 写的是 `policy.js` 里的 **label**；若写成 annotation，页面会显示已停用但平台照旧评估。

### 16.2 模板角色的写保护

`role-template-*` 是平台内置角色的构建块，API 会拒绝写操作。界面因此只给「详情」，不打开注定失败的对话框（`TC-…-ROLES-02` 覆盖）。

### 16.3 文档与用例

- PRD 新增 4 条验收场景（存储 1、角色 2、告警 1），design 同步承接。
- 新增 3 个用例：`TC-L3-…-STORAGE-EDIT_INFO-01`、`TC-L3-…-PROJECT_SETTINGS-ROLES-02`、`TC-L3-…-MONITORING-RULES-02`。
- 用例编号按门禁要求在同一功能点内连续编号（`-02`），而不是另起功能名。

### 16.4 验证

| 项 | 结果 |
|---|---|
| storage + project-settings + monitoring | **15 通过、1 跳过**（告警模块缺失，用例显式 skip） |
| 架构契约 | 348 通过 |
| api-client 单测 | 99 通过 |
| 文档门禁 | errors=0 warnings=0 |

### 16.5 仍待补的交互（按老 console 逐项对账）

| 页面 | 仍缺 |
|---|---|
| 部署/有状态副本集/守护进程集 | 启动（停止的反向） |
| 定时任务 | 暂停/启动、编辑 YAML（老页面无） |
| 任务 | 重跑（RERUN） |
| 服务 | 编辑服务、外网访问 |
| 路由 | 编辑路由规则、编辑注解 |
| 容器组 | 重新调度 |
| 存储卷 | 扩容 |
| 告警策略 | 规则编辑 |

## 17. 第 14 轮：停止/启动与定时任务暂停（2026-11-12）

### 17.1 交付

| 操作 | 实现 | 实测 |
|---|---|---|
| 停止 | `spec.replicas = 0`（merge patch） | 2 → 0 |
| 启动 | `spec.replicas = 1`（merge patch） | 0 → 1 |
| 定时任务暂停/恢复 | `spec.suspend` 取反 | `suspend: True` |

### 17.2 一个界面细节：停止与启动是**两条互斥的**行操作

行操作的 `label` 是静态的，无法按行改名。最初用一个 `scale-toggle` 条目，结果在已停止的部署上仍显示「停止」——点了会「停一个已经停的对象」。改为两条互斥条目：

```
{ key: 'stop',  visible: (row) => row.status !== 'stopped' }
{ key: 'start', visible: (row) => row.status === 'stopped' }
```

实测：运行中 → `[编辑信息, 编辑 YAML, 停止, 删除]`；已停止 → `[编辑信息, 编辑 YAML, 启动, 删除]`。

### 17.3 环境限制：任务「重跑」无法验证

老 console 的重跑走 `kapis/operations.kubesphere.io/v1alpha2/.../jobs/<name>?action=rerun`。该集群上这个组的所有路径都返回 404（`/version` 也是），手动调用返回 `500 failed to rerun job`。**因此重跑未实现**——实现一个无法验证的写操作，风险高于收益。已在待办中标注「需要启用 operations 模块的集群」。

### 17.4 验证

| 项 | 结果 |
|---|---|
| app-workloads 套件 | **12 通过**（新增 `TC-FULL-…-02` 覆盖停止/启动/暂停） |
| 架构契约 | 348 通过 |
| api-client 单测 | 99 通过 |
| 文档门禁 | errors=0 warnings=0 |
| 用例文档 | 128 份 |

### 17.5 剩余交互缺口

| 页面 | 仍缺 | 原因 |
|---|---|---|
| 任务 | 重跑 | 环境无 operations 模块 |
| 服务 | 编辑服务、外网访问 | 需要表单与服务类型切换 |
| 路由 | 编辑路由规则、编辑注解 | 需要规则编辑器 |
| 容器组 | 重新调度 | 环境无 operations 模块 |
| 存储卷 | 扩容 | 需要容量表单 |
| 告警策略 | 规则编辑 | 需要规则编辑器 |

## 18. 第 15 轮：项目基本信息（2026-11-12）

### 18.1 交付

| 层 | 内容 |
|---|---|
| api-client | `toProjectInfo` / `projectInfoApi`：项目对象 + ResourceQuota 合并为一个视图模型 |
| 页面 | `pages/settings/ProjectInfoPage.tsx`：项目信息卡片 + 资源配额卡片 |
| 路由/区域 | `…/projects/:namespace/baseinfo`；项目设置页签顺序改为 基本信息 / 项目角色 / 项目成员（与老 console 一致），默认页改为 baseinfo |
| 文档 | PRD + 设计各 1 份；用例 1 条（覆盖 2 个 AC） |

### 18.2 与老 console 的对照

| 老 console（`projects/containers/BaseInfo`） | 迁移后 | 说明 |
|---|---|---|
| 项目信息块（名称、创建时间、创建者、企业空间、成员/角色/服务数量） | 名称、别名、企业空间、描述、创建者、创建时间 | 成员/角色/服务**计数**未迁移（需额外几条计数请求） |
| 资源配额（可编辑） | 配额只读三列（资源、上限、已使用） | 编辑未迁移 |
| 默认容器配额（LimitRange） | **未迁移** | 需要 LimitRange 表单 |
| 编辑项目信息、删除项目 | **未迁移** | 表单与危险操作 |

### 18.3 一个踩过的坑

第一次把项目对象按「项目属于 IAM」去拼 `iam.kubesphere.io/.../namespaces/<ns>`，该组不服务核心资源，会 404。改为与项目列表同一来源（resources 代理）。已写进设计文档的 DEC。

命名空间上同时有 `kubesphere.io/namespace`（项目名）与 `kubesphere.io/workspace`（企业空间）两个标签，取错会把项目名当成企业空间——用例显式断言企业空间来自后者。

### 18.4 验证

| 项 | 结果 |
|---|---|
| project-settings 套件 | **6 通过** |
| 架构契约 | 357 通过 |
| api-client 单测 | 99 通过 |
| 文档门禁 | errors=0 warnings=0 |
| 一致性核对 `parity_check.py` | 项目页 18、集群页 2，**待处理 0** |

> `parity_check.py` 本轮先报出 `baseinfo` 为「多余路由」，原因是它的映射表没跟着更新——工具本身也需要维护，已修正。

## 19. 第 16 轮：访问控制（平台级）（2026-11-12）

### 19.1 交付

| 层 | 内容 |
|---|---|
| api-client | `access.ts`：用户（状态、平台角色、最近登录）、平台角色（规则数、模板判定）、企业空间（集群关联） |
| 页面 | `pages/platform/PlatformListPage.tsx`（三页共用）+ `queries.ts` |
| 路由 | **平台作用域布局** `kube-frontend.access/route.tsx` + `users/`、`clusterroles/`、`workspaces/` |
| 区域 | 侧栏新增「访问控制」 |
| 文档 | PRD + 设计各 4 份；用例 4 条 + 单测 10 条 |

### 19.2 与老 console 的对照

| 老 console（`pages/access/containers`） | 迁移后 | 说明 |
|---|---|---|
| 用户：用户名、状态、平台角色、最近登录 | 一致（副行显示邮箱） | — |
| 平台角色：名称、描述、创建时间 | 名称（副行描述）、**规则数**、创建时间；模板角色带徽标 | — |
| 企业空间：名称、别名、创建时间、集群 | 名称、状态、**集群**、创建时间 | — |
| 创建用户/角色/企业空间、改角色 | **未迁移** | 需要表单与角色选择器 |

### 19.3 三个数据源，写错都不报错

- 用户、平台角色 → `iam.kubesphere.io/v1alpha2`
- 企业空间 → **resources 代理**（`tenants.kubesphere.io/.../workspaces` 实测 404）

平台角色在两个版本里分别写在 `iam.kubesphere.io/platform-role` 与 `iam.kubesphere.io/globalrole`，只读一个会在部分账号上显示空白——两者按顺序读取，已写进 DEC 与单测。

### 19.4 实测（真实数据）

| 页面 | 结果 |
|---|---|
| 用户 | `ready`，10 行/页（平台共 3282 个用户），列 用户名/状态/平台角色/最近登录 |
| 平台角色 | `ready`，10 行/页（共 201 个），列 名称/规则数/创建时间 |
| 企业空间 | `ready`，4 行，列 名称/状态/集群/创建时间 |
| 项目工作区栏 | 三页均为 0（`TC-FULL` 断言） |

### 19.5 验证

| 项 | 结果 |
|---|---|
| access-control 套件 | **4 通过** |
| 架构契约 | 379 通过 |
| api-client 单测 | 109 通过 |
| 文档门禁 | errors=0 warnings=0 |
| 一致性核对 | 待处理 **0** |

## 20. 第 17 轮：平台设置（2026-11-12）

### 20.1 交付

| 层 | 内容 |
|---|---|
| api-client | `access.ts` 增补：`configScalar`（按缩进读 YAML 段落）、`toPlatformInfo`、`toNotificationChannels` |
| 页面 | `pages/platform/PlatformSettingsPage.tsx`（平台信息 / 通知渠道两种视图） |
| 路由 | **平台设置布局** `kube-frontend.settings/route.tsx` + `info/`、`notifications/` |
| 区域 | 侧栏新增「平台设置」 |
| 文档 | PRD + 设计各 3 份；用例 3 条 + 单测 10 条 |

至此**平台级功能区全部迁移完成**（访问控制 + 平台设置）。

### 20.2 与老 console 的对照

| 老 console（`pages/settings/containers`） | 迁移后 | 说明 |
|---|---|---|
| 平台信息（标题、描述、地址，可编辑） | 只读三行 | 编辑未迁移 |
| 五种通知渠道各自独立页（可编辑、可测试发送） | 一页列出五渠道的**配置状态** | 编辑与测试发送未迁移 |
| 第三方登录配置 | **未迁移** | 依赖外部身份提供方配置 |

### 20.3 本轮发现并修掉的真实性能缺陷

**列出该命名空间的全部 Secret 需要 70 秒**。首版按「列出 `kubesphere-monitoring-system` 的所有 Secret 再判断」实现，页面因此长期停在 `loading`，用例超时。

改为**按名探测**五个已知的 `<channel>s` Secret：每个 404/200 都在 1 秒内返回，页面从 70 秒降到亚秒级，且只请求自己关心的五个名字——别的租户的 Secret 名称不再跨网络传输。

同时把用例里同样的列表调用改掉（同一原因），整包耗时从 97s 降到 12s。

### 20.4 一处「看起来是缺陷、其实不是」

平台信息三行显示 `-`：目标集群的 `kubesphere.yaml` 里**没有 `console` 段**。这是配置现状。用例断言的是「三行都有值或为 `-`」，而不是「一定有值」；设计文档写清了这一点，避免后来者把它当成 bug 反复排查。

### 20.5 验证

| 项 | 结果 |
|---|---|
| platform-settings 套件 | **3 通过**（12 秒） |
| 架构契约 | 394 通过 |
| api-client 单测 | 119 通过 |
| 文档门禁 | errors=0 warnings=0 |
| 一致性核对 | 待处理 **0** |

## 21. 第 18 轮：表单地基 + 创建工作负载（2026-11-12）

### 21.1 交付

| 层 | 内容 |
|---|---|
| 表单基础 | `ResourceForm`（ai-kit 已有的 schema 驱动表单 + 校验引擎）经 `@kube-ai-hub/ui` 正式再导出，页面可直接使用 |
| api-client | `workloadsApi.create()`：三种控制器，selector 与模板标签同源 |
| 页面 | `WorkloadCreateDialog`：项目、名称（含 K8s 命名校验）、镜像、副本数、应用标签 |
| 入口 | 部署/有状态副本集/守护进程集的列表头部「创建」 |
| 文档 | PRD 增 1 条验收场景；用例 1 条 |

这是**第一个从「只读迁移」转向「可写」的表单**，后续的扩缩容、服务/路由编辑、配额编辑都能复用同一套 schema 表单。

### 21.2 两个界面教训

1. **创建按钮不能用批量操作位**：最初把「创建」放进 `actions`（批量操作），而批量操作只在有选中行时才启用——空列表上按钮是禁用的，点了没反应。`ResourceList` 为此专门有 `primaryAction`（表头、始终可用），改用它。
2. **`primaryAction` 通过 `onAction(key, undefined)` 派发**，不是独立回调。页面必须在 `row` 为空时也能识别创建动作，否则只有表格有行时才能创建。

### 21.3 与老 console 的差异（如实记录）

老 console 的创建是**多步骤向导**（镜像 → 容器设置 → 存储 → 高级设置）。本次只做**单步精简版**：名称、镜像、副本数、应用标签。

存储挂载、探针、资源限制、GPU、调度策略等未纳入表单。设计上的理由：做一个只填一半字段的向导，比直接告诉用户「这些用 YAML 补」更糟——YAML 路径已经可用且完整。此差异写入 PRD 的「明确不做」。

### 21.4 验证

| 项 | 结果 |
|---|---|
| 新增创建用例 | 通过（非法名称被拦下；合法提交后 replicas=2、镜像一致） |
| app-workloads 套件 | **12 通过** |
| 架构契约 | 396 通过 |
| api-client 单测 | 119 通过 |
| 文档门禁 | errors=0 warnings=0 |

## 22. 第 19 轮：详情页的扩缩容与编辑信息（2026-11-12）

### 22.1 交付

| 操作 | 位置 | 实现 | 实测 |
|---|---|---|---|
| 编辑信息 | 部署详情 | PUT 完整对象 + 编辑后的注解 | 别名写入成功 |
| 扩缩容 | 部署详情 | `ReplicasDialog` → merge patch `spec.replicas` | 1 → 3 |

详情页操作现与老 console 对齐：**编辑信息、扩缩容、重新部署、编辑 YAML、删除**（先前缺前两项）。

### 22.2 一个清理逻辑的判断

新用例在收尾时报「Pod 60 秒后仍存在」而失败，但**功能断言已全部通过**——失败发生在 `finally` 的清理等待里。

排查：该 Pod 带有 `deletionTimestamp`，即 apiserver 已接受删除、正在等容器真正退出。共享集群上这一步可能很久。**这不是代码缺陷**，也不是清理没做，而是把集群的调度压力报告成了用例失败。

修复：等待逻辑改为「没有**非终止中**的 Pod 即为干净」，超时也从 60s 放宽到 120s。工作负载对象本身在更早就已消失，那才是用例关心的事实。

### 22.3 验证

| 项 | 结果 |
|---|---|
| app-workloads 套件 | **14 通过**（新增扩缩容/编辑信息用例） |
| 架构契约 | 398 通过 |
| api-client 单测 | 119 通过 |
| 文档门禁 | errors=0 warnings=0 |

### 22.4 待办

- 服务/路由编辑（各自的规则编辑器）
- 存储扩容、项目配额编辑
- 用户/角色/企业空间创建
- 项目设置的网络隔离、网关、日志收集
- 集群管理其余页面
- 环境阻塞：任务重跑、容器组重新调度（无 operations 模块）

## 23. 第 20 轮：项目配额编辑（2026-11-12）

### 23.1 交付

| 层 | 内容 |
|---|---|
| api-client | `projectQuotaApi`（apply / list / remove）+ `QUOTA_RESOURCES`（十项常用配额） |
| 页面 | `QuotaEditDialog`；基本信息页配额区新增「编辑配额」 |
| 文档 | PRD 增 1 条验收场景；设计增 2 条 DEC；用例 1 条 |

### 23.2 修掉的真实缺陷：带点号的字段名会**静默丢失**

`ResourceForm` 通过 `setByPath` 存值，把键里的 `.` 当作**嵌套路径**。配额键 `requests.cpu` 因此被写成 `{ requests: { cpu: … } }`，而提交时按扁平键读取，拿到空串——**ResourceQuota 建出来了，`spec.hard` 却是空的**，点击保存看起来成功但没有任何限制生效。

这类失败最难自查：没有报错、没有红框、对象确实存在。修复方式是把表单键扁平化（`requests_cpu`），提交时映射回资源名，并在设计文档里写明原因与替代方案（不动 `setByPath` 的路径语义）。

### 23.3 两条不变量

1. **复用已有配额对象**：同一命名空间里的第二个 ResourceQuota 会与第一个竞争，Kubernetes 取交集 —— 等于悄悄收紧所有限制。
2. **空值删除而不是存 0**：Kubernetes 用「键不存在」表示不限制，`"0"` 表示完全禁止，方向正好相反。

### 23.4 验证

| 项 | 结果 |
|---|---|
| project-settings 套件 | **7 通过**（新增配额用例） |
| 架构契约 | 400 通过 |
| 文档门禁 | errors=0 warnings=0 |

实测：编辑后 `spec.hard` 为 `{requests.cpu: "2", requests.memory: "4Gi"}`，未填项不出现在 `hard` 中。

## 24. 第 21 轮：存储卷扩容（2026-11-12）

### 24.1 交付

| 层 | 内容 |
|---|---|
| api-client | `storageApi.expand()`（merge patch `spec.resources.requests.storage`）、`storageClassExpands()` |
| 页面 | `ExpandVolumeDialog`；存储卷行操作新增「扩容」 |
| 数据 | `useExpandableClasses()`：一次读取存储类，判定每一行是否可扩容 |
| 文档 | PRD 增 1 条验收场景；设计增 1 条 DEC；用例 1 条 |

### 24.2 按存储类门控（本轮的核心判断）

第一次实现让所有存储卷都能点「扩容」。实测发现该 PVC 写入后**值没有变化**——因为本集群的默认存储类 `openebs-hostpath` **不支持扩容**：

| 存储类 | allowVolumeExpansion |
|---|---|
| juicefs-shared | **true** |
| local-static | false |
| openebs-hostpath（默认） | 未设置 |

不门控的后果：用户点「扩容」→ 提交 → apiserver 拒绝 → 界面报一个看起来像我们代码出错的失败。改为**读取存储类并在行操作里隐藏**该入口；同时用可扩容的 `juicefs-shared` 验证了真实扩容（1Gi → 5Gi）。

实测对照：
- 默认类 PVC → `[编辑信息, 编辑 YAML, 删除]`
- 可扩容类 PVC → `[编辑信息, 扩容, 编辑 YAML, 删除]`

### 24.3 与前一轮的呼应

上一轮的项目配额也栽在「看起来保存了但没生效」。两次的共同点：**写入成功但观察不到效果时，必须先确认服务端是否接受了这次修改，而不是先怀疑界面**。

### 24.4 验证

| 项 | 结果 |
|---|---|
| storage 套件 | **8 通过**（新增扩容用例） |
| 架构契约 | 402 通过 |
| api-client 单测 | 119 通过 |
| 文档门禁 | errors=0 warnings=0 |

## 25. 第 22 轮：服务端口编辑（2026-11-12）

### 25.1 交付

| 层 | 内容 |
|---|---|
| api-client | 服务摘要增补 `serviceType` 与 `ports`；`workloadsApi.setServicePorts()` |
| 页面 | `ServicePortsDialog`；服务列表新增端口列与「编辑服务」 |
| 文档 | PRD 增 1 条验收场景；设计增 1 条 DEC；用例 1 条 |

### 25.2 三个必须写对的细节

1. **`spec.ports` 是整体替换**：merge patch 下只发一个端口会删掉其余端口，必须提交完整列表。
2. **保留端口名**：命名端口被 `targetPort` 按名引用，改名会让引用失效。实测编辑后名称仍为 `http`。
3. **`targetPort` 的类型**：数字要发数字、名字要发字符串，发错类型会被 apiserver 拒绝。

### 25.3 按服务类型门控

`ExternalName` 服务没有端口，因此不提供「编辑服务」——与上一轮的扩容门控同理：不把「本来就不支持」包装成错误提示。

### 25.4 一个测试侧的坑

用例里写 `ui.wait_ready("services")`，而 `app_workloads_page.wait_ready` 期待的是 **Locator**（存储页的同类方法期待的是 kind 名）。两个页面对象的签名不一致，导致 `expect` 收到字符串并抛 `Unsupported type: str`。这提醒我：**同类页面对象的方法签名应当统一**，否则用例会在两页之间复制出错。

### 25.5 验证

| 项 | 结果 |
|---|---|
| app-workloads 套件 | **15 通过** |
| 架构契约 | 404 通过 |
| api-client 单测 | 119 通过 |
| 文档门禁 | errors=0 warnings=0 |

实测：端口 80→8080 改为 8080，端口名保留。

## 26. 第 23 轮：创建用户（2026-11-12）

### 26.1 交付

| 层 | 内容 |
|---|---|
| api-client | `usersWriteApi`（create / remove）、`passwordProblem`、`ASSIGNABLE_PLATFORM_ROLES` |
| 页面 | `UserCreateDialog`（用户名、邮箱、密码、平台角色）；用户页头部「创建」 |
| 文档 | PRD 增 1 条验收场景；设计增 2 条 DEC；用例 1 条 |

### 26.2 两个刻意的收紧

1. **平台角色只列三个**：`globalroles` 有 19 个，多数是 `role-template-*` 构建块，另有两个内部身份（`authenticated`/`anonymous`）。全列出来会让管理员选到一个语义不成立的角色。
2. **密码规则在客户端先校验**：平台口径很短（≥8 位、含字母与数字）。写进表单后用户得到的是「密码需包含数字」，而不是一个通用 400。规则集中在 `passwordProblem`，界面与用例共用。

### 26.3 与老 console 的差异

老 console 的用户管理更完整（创建、停用、删除、改角色）。本轮只做**创建**：删除与改角色仍走平台侧，列入待办。理由是把一个写操作做完整（表单 + 校验 + 清理 + 用例）比铺开四个半成品更有价值。

### 26.4 验证

| 项 | 结果 |
|---|---|
| access-control 套件 | **5 通过**（新增创建用例） |
| 架构契约 | 406 通过 |
| api-client 单测 | 119 通过 |
| 文档门禁 | errors=0 warnings=0 |

实测：非法用户名被拦下；弱密码被拦下并提示「8 位」；创建成功且 `iam.kubesphere.io/platform-role` 为 `platform-regular`。

## 27. 第 24 轮：用户的改角色与删除（2026-11-12）

### 27.1 交付

| 层 | 内容 |
|---|---|
| api-client | `usersWriteApi.setPlatformRole`（PUT）、`isNotFound` 增强 |
| 页面 | `UserRoleDialog`；用户行操作新增「修改平台角色」「删除」 |
| 文档 | PRD 增 1 条验收场景；设计增 1 条 DEC；用例 1 条；单测 3 条 |

用户管理至此具备**创建、改角色、删除**三项写能力。

### 27.2 两个接口特性（都实测确认）

1. **改角色必须用 PUT**：IAM 的 `users` 端点对 PATCH 返回 **405**。改用 PUT 前先读对象取 `resourceVersion`——带旧版本的 PUT 会被 409 拒绝，这是防止覆盖并发修改的唯一保护。
2. **删除后 GET 返回 500 而不是 404**：`user.iam.kubesphere.io "x" not found`。若不特判，删除成功的页面会显示「服务器错误 + 重试」，用户无法判断到底删没删掉。

为此给 `ApiError.isNotFound` 增加一条**窄条件**：状态 ≥500 且消息含 `not found`。并补了 3 条单测，其中一条确保「真正的 5xx」不会被误判为不存在（`the server could not find the requested resource` 就不含 `not found`）。

### 27.3 验证

| 项 | 结果 |
|---|---|
| access-control 套件 | **6 通过**（新增改角色/删除用例） |
| 架构契约 | 408 通过 |
| api-client 单测 | 122 通过（新增 3 条 isNotFound） |
| 文档门禁 | errors=0 warnings=0 |

实测：改角色 `platform-regular` → `platform-admin` 成功；删除后该用户不再出现在列表结果中。

### 27.4 剩余

| 类别 | 内容 |
|---|---|
| 用户 | 停用/启用（接口未验证） |
| 表单类 | 角色/企业空间创建、服务/路由创建 |
| 项目设置 | 网络隔离、网关、日志收集 |
| 集群管理 | 概览、系统组件、存储类型、集群设置 |
| 环境阻塞 | 任务重跑、容器组重调度、告警规则编辑 |

## 28. 第 25–26 轮：平台角色的创建与编辑（2026-11-12）

### 28.1 企业空间创建：**做不到**，已如实记录

计划里本轮要做企业空间创建，但探测发现该集群**没有可写的企业空间资源**：

| 尝试 | 结果 |
|---|---|
| `POST kapis/resources.kubesphere.io/v1alpha3/workspaces` | 405 Method Not Allowed |
| `POST /apis/tenant.kubesphere.io/v1alpha2/workspaces` | 404 page not found |
| `GET /apis/tenant.kubesphere.io/v1alpha2`（发现） | 该组下只有 `workspacetemplates`，**没有 `workspaces` 资源** |

列表接口（`resources.kubesphere.io/v1alpha3/workspaces`）能读，但写没有注册路由。**企业空间创建无法在此集群实现或验证**，改用平台角色创建（同一功能区，接口可用）。

### 28.2 交付

| 层 | 内容 |
|---|---|
| api-client | `clusterRolesWriteApi`（create / update / remove / rules）、`ROLE_VERBS`、`EditableRule` |
| 页面 | `RoleEditorDialog`（名称、别名、描述、动作预设、API 组、资源）；平台角色页「创建 / 编辑 / 删除」 |
| 文档 | PRD 增 1 条验收场景；设计增 2 条 DEC；用例 1 条 |

### 28.3 三个真实缺陷（都是「看起来成功但没生效」）

1. **IAM 层丢弃规则**：`POST kapis/iam.kubesphere.io/.../clusterroles` 返回 **200**，但创建出的对象 `rules: null`。规则没存下来，角色不授予任何权限，而响应里没有任何提示。→ **读走 IAM，写走原生 `rbac.authorization.k8s.io/v1`**。
2. **空 API 组被拒**：`apiGroups: []` 触发 422 `resource rules must supply at least one api group`。管理员留空的意思是「核心组」，必须翻译成 `[""]`。
3. **动作字段静默丢失**：`checkbox` 在本表单里是单个布尔（实测 7 个选项只渲染 1 个），`tags` 不从 `defaultValues` 取值 —— 两者都会产出一个**没有规则的角色**。改为「读 / 写 / 管理」三档预设下拉。

### 28.4 验证

| 项 | 结果 |
|---|---|
| access-control 套件 | **7 通过** |
| 架构契约 | 410 通过 |
| api-client 单测 | 122 通过 |
| 文档门禁 | errors=0 warnings=0 |

实测：创建的角色 `rules` 为 `[{verbs: [get, list, watch], apiGroups: [''], resources: [pods, services]}]`；模板角色行没有操作菜单。

### 28.5 待办

- 企业空间创建（**需启用 `tenants.kubesphere.io` 的 workspaces 资源**）
- 规则的多条编辑
- 项目设置：网络隔离、网关、日志收集
- 集群管理：概览、系统组件、存储类型、集群设置
- 环境阻塞：任务重跑、容器组重调度、告警规则编辑

## 29. 第 27 轮：项目网络隔离（2026-11-12）

### 29.1 交付

| 层 | 内容 |
|---|---|
| api-client | `networkPoliciesApi`、`networkIsolationApi`（读/改命名空间注解）、`NETWORK_ISOLATE_ANNOTATION` |
| 页面 | `NetworkIsolationPage`：项目级隔离开关 + 策略列表（四列） |
| 路由/区域 | `…/projects/:namespace/networkpolicies`；项目设置第四个页签 |
| 文档 | PRD + 设计各 1 份；用例 1 条（覆盖 2 个 AC） |

顺带把 ai-kit 的 `Switch` 正式从 `@kube-ai-hub/ui` 导出（此前只在 ai-kit 内部可用）。

### 29.2 与老 console 的对照

| 老 console（`Network/Policies`） | 迁移后 | 说明 |
|---|---|---|
| 项目级「开启网络隔离」开关 | 一致 | 写同一个注解 `kubesphere.io/network-isolate` |
| 策略列表 | 名称（副行为 Pod 选择器）、类型、规则数、创建时间 | 老页面列较简，本模块把选择器与规则数显性化 |
| 策略创建与编辑 | **未迁移** | 需要规则编辑器，仍用 YAML |

### 29.3 两处刻意的设计

1. **开关与策略同屏**：管理员的问题是「这条流量为什么不通」，只看策略看不到项目级意图，只看开关看不到具体范围。
2. **开关只改一个注解**：命名空间上还有标签（企业空间归属就在标签里），用 PUT 整体替换可能把项目从企业空间里摘出来。用 merge patch 只动那一个注解。

### 29.4 验证

| 项 | 结果 |
|---|---|
| project-settings 套件 | **8 通过** |
| 架构契约 | 419 通过 |
| api-client 单测 | 122 通过 |
| 文档门禁 | errors=0 warnings=0 |

实测：`spaces` 项目 7 条策略正确列出；开关把注解从 `None` 切到 `true` 并可还原。

## 30. 第 28 轮：集群存储类型（2026-11-12）

### 30.1 交付

| 层 | 内容 |
|---|---|
| api-client | `storageClassesApi`、`toStorageClassSummary`（默认标记双注解拼写、能力、PVC 数） |
| 页面 | `pages/cluster/StorageClassesPage.tsx`（六列） |
| 路由/区域 | `…/clusters/:cluster/storageclasses`；集群管理第三个页签 |
| 文档 | PRD + 设计各 1 份；用例 1 条 |

### 30.2 一处读起来像「全部支持」的渲染问题

第一版把扩容/克隆/快照三个能力徽标**全部渲染**、只用颜色区分支持与否。实测页面上一行行看过去，**每个存储类都像支持这三项**——而 `openebs-hostpath` 实际不支持扩容，必须比较颜色才能发现。

改为**只渲染支持项**，无支持项显示 `-`。实测效果：

| 存储类 | 能力列 |
|---|---|
| openebs-hostpath（默认） | `-` |
| local-static | `-` |
| juicefs-shared | 扩容、快照 |

这也印证了前几轮的一个共同模式：**信息必须以读者不用解读就能判断的方式呈现**。颜色不是可靠通道（色弱、深色模式、打印）。

### 30.3 验证

| 项 | 结果 |
|---|---|
| cluster-management 套件 | **4 通过** |
| 架构契约 | 428 通过 |
| api-client 单测 | 122 通过 |
| 文档门禁 | errors=0 warnings=0 |

实测：3 个存储类，默认标记与注解一致；PVC 数 29/6/10（来自 `kubesphere.io/pvc-count`）。

### 30.4 待办

- 集群管理其余页面：概览、系统组件、集群设置
- 项目设置：网关、日志收集
- 环境阻塞：企业空间创建、任务重跑、容器组重调度、告警规则编辑

## 31. 第 29 轮：集群系统组件（2026-11-12）

### 31.1 交付

| 层 | 内容 |
|---|---|
| api-client | `componentsApi`（**独立读取器**，兼容裸数组与 `{items}`）、`toComponentSummary` |
| 页面 | `pages/cluster/ComponentsPage.tsx`（名称/命名空间、健康后端、启动时间） |
| 路由/区域 | `…/clusters/:cluster/components`；集群管理第三个页签 |
| 文档 | PRD + 设计各 1 份；用例 1 条 |

### 31.2 两个刻意的判断

1. **裸数组响应**：`/kapis/.../components` 返回的是**数组**而不是 `{items}` 包装（实测响应以 `[` 开头）。硬套 `resourceApi` 会得到一个静默的空页。因此写了独立读取器，并**同时接受两种形状**——版本差异不该再变成空白页。
2. **不健康优先排序**：49 个组件按名字排列时，掉线的那个会淹没在中间。管理员打开这页的问题通常是「有没有不正常」，所以按 `up` 升序排（异常在前），再按名称。

### 31.3 验证

| 项 | 结果 |
|---|---|
| cluster-management 套件 | **5 通过** |
| 架构契约 | 437 通过 |
| api-client 单测 | 122 通过 |
| 文档门禁 | errors=0 warnings=0 |
| 一致性核对 | 待处理 **0** |

实测：49 个组件；`gpu-load-gen` 等无后端组件显示「无后端」并排在前面，`alertmanager-main` 显示 `1/1`。

### 31.4 待办

- 集群概览、集群设置（需指标/配置接口）
- 项目设置：网关、日志收集
- 环境阻塞：企业空间创建、任务重跑、容器组重调度、告警规则编辑

## 32. 第 30 轮：接口可用性普查 + 文档一致性修正（2026-11-12）

本轮没有新增页面，因为计划中的三项都先做了接口探测，结果都不可用：

| 计划项 | 探测结果 |
|---|---|
| 项目网关设置 | `gateway.kubesphere.io/v1alpha1/gateways` 资源存在，但**该集群 0 个实例** |
| 项目日志收集 | `logging.kubesphere.io/v1alpha2` 只有集群级 FluentBit 配置，**没有项目级资源** |
| 集群概览 | `clusters/host` 返回 500，`monitoring.kubesphere.io` 未路由 |

按「先探测、不预设能做成」的原则，没有为了凑页面去实现无法验证的界面。

### 32.1 实际完成的两件事

**1. 用例规格与测试一一对应**：14 个子模块共 **118 条规格 / 118 个测试**，逐目录核对无缺失。

**2. 修正了 7 个功能区的「明确不做」清单**：文档写的内容已明显滞后于实现——例如「存储卷扩容、用户创建、基本信息、网络隔离、存储类型、系统组件」都已完成却仍列在「不做」里。逐条改为当前真实的边界，并写明原因（网关无实例、日志无项目级资源、告警模块未安装、operations 模块缺失、企业空间无写接口）。

这类滞后比缺文档更危险：它会让人以为功能没做而重复规划，或以为不做而漏掉。

### 32.2 全量回归

| 项 | 结果 |
|---|---|
| tests/kube-frontend 全量 | **108 通过、5 跳过、5 失败** |
| 失败归属 | 全部在 `cluster-configmaps`（并行会话负责的页面，选择器重复与加载超时），与本轮改动无关 |
| 文档门禁 | errors=0 warnings=0 |

### 32.3 结论

按老 console 的页面清单，**除已归因为环境不可用的条目外，所有可验证页面均已迁移**。剩余的三类（需专用编辑器、需指标接口、环境不可用）都需要超出本仓库范围的条件才能推进。

## 33. 第 31 轮：项目网关设置（2026-11-12）

### 33.1 上一轮结论的自我更正

上一轮把「项目网关」判为不可用，依据是**只读探测**发现 0 个实例。本轮改用**写入探测**，发现 Gateway 是可以创建的（POST 201）。这说明「0 个实例」不等于「功能不可用」——只读探测会低估可用性，写入探测才可靠。

### 33.2 交付

| 层 | 内容 |
|---|---|
| api-client | `projectGatewayApi`（get / create / remove）、`toProjectGateway` |
| 页面 | `pages/settings/GatewayPage.tsx`：空态（说明 + 创建）与信息态（四字段 + 状态 + 删除），未就绪时每 5 秒轮询 |
| 路由/区域 | `…/projects/:namespace/gateways`；项目设置第六个页签 |
| 文档 | PRD + 设计各 1 份；用例 1 条 |

### 33.3 控制器行为（实测）

创建后控制器接管的对象状态：

| 观察 | 结果 |
|---|---|
| `spec` | 被**重写为空** `{}`（即使创建时给了 type/replicas/ports） |
| `status.conditions` | `Deployed=True`，message「release was successfully installed」 |
| Service | 未创建（本集群没有网关控制器的 Helm chart） |

因此**状态必须读 `Deployed` 条件，不能读 `spec`**——读 spec 会得到「什么都没配置」的假象。这条已写进设计文档的 DEC。

### 33.4 环境限制（如实记录）

本集群未安装网关控制器的 Helm chart：Gateway 对象能创建、状态能上报，但**不会真正产生可用的网关**（无 Service、spec 被清空前不被保留）。因此本页验证到「创建 → 状态上报 → 删除」这一段，**真正就绪需要安装控制器**。

### 33.5 验证

| 项 | 结果 |
|---|---|
| project-settings 套件 | **9 通过** |
| 架构契约 | 446 通过 |
| api-client 单测 | 122 通过 |
| 文档门禁 | errors=0 warnings=0 |
| 一致性核对 | 待处理 **0** |

## 34. 第 32 轮：企业空间的创建、编辑与删除（2026-11-12）

### 34.1 又一次自我更正

前几轮把「企业空间创建」判为不可用，依据是 `POST /apis/tenant.kubesphere.io/.../workspaces` 返回 404。本轮把**所有候选路径都试了一遍**，发现正确路径是 **`/kapis/tenant.kubesphere.io/v1alpha2/workspaces`**（POST 200）。

这已是连续第二轮因探测不充分而误判（上轮是网关）。教训：**判断"接口不可用"之前，必须穷举路径，并用写入验证**。

### 34.2 三个实测结论

| 操作 | 结果 |
|---|---|
| `POST /apis/tenant.../workspaces` | 404（该组不经 `/apis` 暴露） |
| `POST /kapis/tenant.../workspaces` | 200，对象立即出现在列表 |
| `PATCH`（merge patch）已存在对象 | **500** |
| `PUT` 整对象 | 200，别名正确更新 |
| `DELETE` | 200 |

因此实现为：**写走 kapis 前缀，编辑先读 `resourceVersion` 再整对象 PUT**。

### 34.3 交付

| 层 | 内容 |
|---|---|
| api-client | `workspacesWriteApi`（create / update / remove）、`KAPIS_TENANT` |
| 页面 | `WorkspaceEditorDialog`（名称锁定于编辑态、别名、描述）；企业空间页「创建 / 编辑 / 删除」 |
| 文档 | PRD 增 1 条验收场景；设计增 1 条 DEC；用例 1 条 |

### 34.4 验证

| 项 | 结果 |
|---|---|
| access-control 套件 | **8 通过** |
| 架构契约 | 446 通过 |
| api-client 单测 | 122 通过 |
| 文档门禁 | errors=0 warnings=0 |
| 一致性核对 | 待处理 **0** |

实测：创建后别名写入注解；编辑后别名更新且名称字段禁用；删除后不在列表中。

### 34.5 剩余

| 项目 | 状态 |
|---|---|
| 日志收集 | 无项目级资源（待再穷举一次） |
| 集群概览 / 集群设置 | `clusters/host` 500，需再确认是否存在其他读法 |
| 任务重跑 / 容器组重调度 | operations 组全部 404，需再穷举 |
| 告警规则编辑 | 告警接口在所有作用域返回空体 |
| 路由规则编辑、网络策略创建 | 需专用编辑器（可做，工作量大） |

## 35. 第 33 轮：网络策略创建/删除 + 穷举探测结果（2026-11-12）

### 35.1 穷举探测（本轮按上轮承诺执行）

| 项目 | 穷举结果 | 结论 |
|---|---|---|
| 集群概览/设置 | `kapis/.../clusters` 200 但 **0 条**；`apis/cluster.kubesphere.io/v1alpha1/clusters` 200 也 **0 条**；`clusters/host` 单对象 404 | 无数据，不可验证 |
| 日志收集 | `/apis/logging.../flushbitconfigs` 项目级 200 但 **0 条**；kapis 未注册 | 无项目级数据，不可验证 |
| operations（重跑/重调度） | v1alpha1、v1alpha2 的 kapis 与 apis 路径**全部 404** | 确认不可用 |
| 网络策略创建 | `POST /apis/networking.k8s.io/v1/.../networkpolicies` **201** | **可用，已实现** |

这两项（集群概览、日志）的「不可用」现在是**穷举后的结论**，不是猜测。

### 35.2 交付：网络策略的创建与删除

| 层 | 内容 |
|---|---|
| api-client | `networkPoliciesWriteApi`（create / remove）、`toSelector`、`POLICY_DIRECTIONS` |
| 页面 | `NetworkPolicyDialog`（名称、作用对象、方向、对方选择器）；网络隔离页「创建网络策略」与行删除 |
| 文档 | PRD 增 1 条验收场景；设计增 2 条 DEC；用例 1 条 |

### 35.3 一个不直观的 API 形状

Kubernetes 的 **peer 是包裹选择器的对象**：

```
ingress: [{ from: [{ podSelector: { matchLabels: { role: frontend } } }] }]
```

我最初写成 `from: [{ matchLabels: … }]`，被拒绝为 422 `spec.ingress[0].from[0]: Required value: must specify a peer`。错误信息没有说"要包一层"，因此写进了设计文档。

### 35.4 验证

| 项 | 结果 |
|---|---|
| project-settings 套件 | **10 通过** |
| 架构契约 | 450 通过 |
| 文档门禁 | errors=0 warnings=0 |

实测生成的 spec：
`{"podSelector":{"matchLabels":{"app":"web"}},"ingress":[{"from":[{"podSelector":{"matchLabels":{"role":"frontend"}}}]}],"policyTypes":["Ingress"]}`

### 35.5 剩余（穷举后）

| 项目 | 状态 |
|---|---|
| 集群概览 / 集群设置 | **无数据可验证**（0 个 cluster 对象、0 个项目级日志配置） |
| 任务重跑 / 容器组重调度 | operations 组全路径 404 |
| 告警规则编辑 | 告警接口所有作用域返回空体 |
| 路由规则编辑 | 需 Ingress 规则编辑器（可做，工作量中等） |
| 网关真正就绪 | 需安装网关控制器 Helm chart |

## 36. 第 34 轮：应用路由规则编辑（2026-11-12）

### 36.1 交付

| 层 | 内容 |
|---|---|
| api-client | 路由摘要增补 `rules`（扁平化的 host/path/backend）；`workloadsApi.setIngressRules()` |
| 页面 | `IngressRulesDialog`（域名、路径、后端服务、后端端口）；应用路由行操作「编辑路由规则」 |
| 文档 | PRD 增 1 条验收场景；设计增 1 条 DEC；用例 1 条 |

### 36.2 设计要点：扁平化再重建

Ingress 的规则是三层嵌套（rule → path → backend），而编辑器需要"域名 / 路径 / 后端"一行。实现为：**读取时扁平化成叶子，提交时按 host 重新分组**并补 `pathType: Prefix`。

这样编辑器字段与人们说法一致，而 `spec` 的结构由一处（`setIngressRules`）负责。若让编辑器直接操作嵌套结构，字段会变成 `rules[0].http.paths[0].backend.service.port.number`，用户与测试都难书写。

### 36.3 验证

| 项 | 结果 |
|---|---|
| app-workloads 套件 | **16 通过** |
| 架构契约 | 452 通过 |
| api-client 单测 | 122 通过 |
| 文档门禁 | errors=0 warnings=0 |

实测：域名 `old.example.com` → `new.example.com`，后端 `kubernetes:443` 保持不变（未被编辑动作清空）。

### 36.4 剩余清单（更新）

| 项目 | 状态 |
|---|---|
| 集群概览 / 集群设置 | 无数据（0 个 cluster 对象、0 个项目级日志配置） |
| 任务重跑 / 容器组重调度 | operations 组全路径 404 |
| 告警规则编辑 | 告警接口所有作用域返回空体 |
| 网关真正就绪 | 需安装网关控制器 Helm chart |
| 项目概览（用量/配额趋势） | 需指标接口 |

前述"路由规则编辑"已在本轮完成。剩余各项都需要环境条件，**没有一项可以在当前集群内完成**。

## 37. 第 35 轮：新功能区的移动端适配（2026-11-12）

### 37.1 发现的问题

移动端用例只存在于最早三个模块（配置字典、保密字典、服务账户、集群配置字典）。**后迁移的 7 个功能区没有任何移动端覆盖**。

375×812 实测发现两处真实缺陷：

| 缺陷 | 表现 | 修复 |
|---|---|---|
| 区域页签固定 36px | 拇指点不准（44px 是最小舒适值） | `h-11 sm:h-9`，与 shell 的既有配对一致 |
| 排序按钮只有文本高度（16px） | 表头排序几乎不可点 | `min-h-11 sm:min-h-0` |
| 名称链接只有文本高度 | 同上（存储卷、工作负载页） | `inline-flex min-h-6 items-center` |

横向滚动：**七页均无**（表格容器已有 `overflow-x-auto`）。

### 37.2 一个关于「多少算够」的判断

用例断言的底线是 **24×24**（WCAG 2.5.8），而不是 44。44px 是舒适目标预算，24px 是可判定的合规底线。把两者分开，既能避免用例因差 2px 而误报，也不放过真正过小的目标。

### 37.3 验证

| 项 | 结果 |
|---|---|
| 新增移动端用例（覆盖 5 个页面） | 通过 |
| configmaps + secrets 套件（受 CSS 改动影响） | **35 通过、4 跳过** |
| 架构契约 | 452 通过 |
| console-next 单测 | 88 通过 |
| 文档门禁 | errors=0 warnings=0 |

### 37.4 剩余（不变）

集群概览/设置、任务重跑、容器组重调度、告警规则编辑、网关就绪、项目概览——全部依赖当前集群不具备的条件。

## 38. 第 36 轮：移动端适配覆盖到全部页面（2026-11-12）

### 38.1 继续发现的问题

上一轮只测了 5 个页面。本轮把**全部 18 个未覆盖页面**在 375×812 下逐一测量，又发现 4 处：

| 页面 | 问题 | 修复 |
|---|---|---|
| 配置字典 / 保密字典 / 服务账户 | 名称链接仅文本高度（16px） | `inline-flex min-h-6 items-center` |
| 网络隔离 | 开关轨道 36×20（Radix 默认） | `className="h-6 w-11 sm:h-5 sm:w-9"` |

修复后 **20 个页面全部通过**：无横向滚动、无小于 24×24 的可见交互目标。

### 38.2 用例扩展

移动端用例从 5 个页面扩到 **20 个页面**，覆盖所有已迁移功能区（配置、应用负载、存储、监控、项目设置、集群管理、访问控制、平台设置）。PRD 的验收场景同步更新为"全部已迁移页面"。

### 38.3 验证

| 项 | 结果 |
|---|---|
| 移动端用例（20 页） | 通过 |
| configmaps + secrets + serviceaccounts 套件（受 CSS 改动影响） | **48 通过、4 跳过** |
| 架构契约 | 452 通过 |
| api-client 单测 | 122 通过 |
| 文档门禁 | errors=0 warnings=0 |

### 38.4 说明

前端适配工作到此为止：所有已迁移页面在桌面与手机两种视口下均已验证。剩余 6 项功能仍依赖当前集群不具备的条件。

## 39. 第 37 轮：测试覆盖补齐（2026-11-12）

### 39.1 发现的覆盖缺口

本轮检查单元测试覆盖，发现两类缺口：

| 缺口 | 数量 | 说明 |
|---|---|---|
| api-client 的行映射函数无单测 | 5 个 | 告警消息/策略、系统组件、网络策略、存储类型、工作负载摘要 |
| 后迁移 6 个功能区无页面组件单测 | 6 个区域 | 前三个（配置、保密、服务账户）有，后 6 个只靠 E2E |

行映射函数正是"表格某一列说什么"的决定处，逻辑集中且容易改错；页面组件原本只有 E2E 覆盖，回归时只能靠跑浏览器。

### 39.2 补齐

**`api-client/test/mappers.test.ts`（19 条）**：覆盖此前没有单测的 5 个映射器，每条都针对一个"不直观但会出错"的点：
- 告警严重度 `high`/`medium` 归一为 `critical`/`warning`
- 告警策略**无标签即为启用**（当成停用会让所有正常策略显示为灰）
- 组件 `0/0` **不算健康**
- 网络策略空选择器渲染为 `*`（不是空字符串）
- 存储类的 `reclaimPolicy`/`volumeBindingMode` 缺省值、默认标记的两种拼写、PVC 数缺失时留 `undefined`
- 工作负载的 Service 端口与 Ingress 规则扁平化

**`apps/console-next/test/areas-page.test.tsx`（4 条）**：后迁移的四个代表页面，覆盖：
- 存储类只渲染**已声明**的能力
- 组件的无后端状态与"不健康优先"排序
- 项目无配额时的显式说明
- 网络隔离空列表**不渲染表头**、但隔离开关仍在

### 39.3 一个测试自身的缺陷

初版 `renderAt` 辅助函数创建了两次根路由（一次给 `createRoute`、一次给 `createRouter`），页面根本没有挂到树上，四条测试全部渲染空白。改为"根路由只创建一次、页面路由挂上去"后通过。这类错误不会给出有用的报错，只会让人以为被测组件有问题。

### 39.4 验证

| 项 | 结果 |
|---|---|
| console-next 单测 | **92 通过**（新增 4 条） |
| api-client 单测 | **141 通过**（新增 19 条） |
| 架构契约 | 452 通过 |
| 文档门禁 | errors=0 warnings=0 |

## 40. 第 38 轮：详情页专属属性（2026-11-12）

### 40.1 发现的真实功能缺口

此前对详情页的核对只做了「属性名一致」这一层，没有逐类核对**老页面有而新页面没有的字段**。逐项对照后发现：

| 资源 | 老 console 详情字段 | 迁移后（本轮前） |
|---|---|---|
| 容器组 | 状态、所在节点、容器组 IP、节点 IP、QoS 等级、重启次数 | 只有 5 个通用字段 |
| 服务 | 服务类型、虚拟 IP、外部地址、选择器、会话亲和性 | 只有 5 个通用字段 |
| 部署/有状态/守护进程 | 通用字段 + 自动伸缩 | 通用字段（自动伸缩未迁移，已记入待办） |

这是**真实的功能缺失**，不是文档问题。

### 40.2 修复方式

`kindAttributes(kind, item)` 返回 `{key, value}[]`，详情页只负责翻译标签与渲染空值。这样避免了在页面里写六处 `kind === 'pods' ? … : kind === 'services' ? …` 分支；将来新增资源只需改 mapper。

实测结果：

- 容器组详情：集群、项目、应用、创建时间、创建者、**状态、所在节点、容器组 IP、节点 IP、QoS 等级、重启次数**（11 项）
- 服务详情：集群、项目、应用、创建时间、创建者、**服务类型、虚拟 IP、外部地址、选择器、会话亲和性**（10 项）

### 40.3 验证

| 项 | 结果 |
|---|---|
| app-workloads 套件 | **18 通过** |
| 架构契约 | 452 通过 |
| api-client 单测 | 141 通过 |
| console-next 单测 | 92 通过 |
| 文档门禁 | errors=0 warnings=0 |

### 40.4 新的待办

- 部署 / 有状态副本集 / 守护进程集的**自动伸缩**（HPA）区块
- 服务详情的**端口表**（当前端口在列表列里，详情未单独展开）

## 41. 第 39 轮：详情页自动伸缩区块（2026-11-12）

### 41.1 交付

| 层 | 内容 |
|---|---|
| api-client | `toWorkloadAutoscaling`、`hpaFor`（按 `scaleTargetRef` 匹配） |
| 页面 | 详情页「自动伸缩」区块：策略名、副本范围、当前副本、触发指标；**无 HPA 时不渲染** |
| 文档 | PRD 增 1 条验收场景；设计增 1 条 DEC；用例 1 条 |

### 41.2 两个判断

1. **没有反向索引**：HPA 用 `scaleTargetRef` 指向目标，Kubernetes 无法"从部署找 HPA"。实现为列出项目 HPA 再本地比对（一个项目几条），而不是依赖 `<workload>-hpa` 这类名字约定——名字约定不是 API 契约。
2. **无 HPA 不渲染区块**：否则每个工作负载上都会多一行「未配置」，而绝大多数工作负载本来就没有自动伸缩。

### 41.3 实测

项目 `spaces` 的真实 HPA（`s-admin-mineru2-5-pro-2605-1-2b-7he-predictor`）：

```
自动伸缩 | 生效中
伸缩策略  s-admin-mineru2-5-pro-2605-1-2b-7he-predictor
副本      1 – 1
当前副本  1
触发指标  cpu: 80%
```

### 41.4 验证

| 项 | 结果 |
|---|---|
| app-workloads 套件 | **19 通过** |
| 架构契约 | 452 通过 |
| console-next 单测 | 92 通过 |
| 文档门禁 | errors=0 warnings=0 |

### 41.5 字段级核对的进度

| 区域 | 字段级核对 | 状态 |
|---|---|---|
| 配置（配置字典/保密字典/服务账户） | 已做 | 完成 |
| 应用负载（列表 + 详情 + 专属属性 + 自动伸缩） | 已做 | 完成 |
| 存储、监控、项目设置、集群管理、访问控制、平台设置 | **未做** | 下一轮开始 |

下一步按区域逐个对照老 console 的**列与详情字段**，而不是只看页面是否存在。

## 42. 第 40–42 轮：字段级核对（存储、访问控制、监控、集群管理）（2026-11-12）

### 42.1 存储详情：补「状态」与「供应者」

对照老 console 的存储卷详情字段，发现迁移版漏了 **状态**（读者打开详情要看的第一项，列表里明明有）与 **供应者**。

修复后详情 10 项：集群、项目、**状态**、存储类型、容量、访问模式、持久卷、**供应者**、创建时间、创建者。快照另加 **快照类型**。

供应者取自 PVC 的 `volume.kubernetes.io/storage-provisioner` 注解，而不是再查一次集群级 StorageClass——一个字符串不值得多一次往返，且存储类可能已被删除而卷仍在。

### 42.2 集群节点：用量列显示**百分比**

老 console 的节点列表显示使用率，而迁移版只显示可分配量（`127600m`）——那是容量，不是"现在多忙"。改为 `metrics.k8s.io` 当前用量 ÷ 可分配量：

| 节点 | CPU 使用率 | 内存使用率 |
|---|---|---|
| sagesuite-demo | 5% | 16% |
| a100-64 | 8% | 37% |
| a100-04 | 8% | 64% |

**单位换算必须显式做**：指标返回 `9983741666n`（纳核），容量是 `127600m`（毫核）。直接相除会得到几百万倍。`quantityToNumber` 统一换算，单测覆盖 `n`/`m`/`Ki`/`Gi`，并有「百分比必须在 0–100」的断言防回归。

### 42.3 核对结果

| 区域 | 结论 |
|---|---|
| 配置（三个页面） | 字段一致 |
| 应用负载 | 已补专属属性与自动伸缩 |
| 存储 | **已补状态、供应者、快照类型** |
| 访问控制 | 字段一致（别名并入名称副行） |
| 监控告警 | 列一致（策略名与目标在副行） |
| 项目设置 | 字段一致 |
| 集群管理 | **已补节点用量列**；项目用量列需按项目聚合，记入待办 |
| 平台设置 | 字段一致 |

### 42.4 两处因新增列而失效的旧断言

- 存储详情用例断言了完整的属性列表 —— 新增两项后失败。改为**子序列断言**：必需项都在、且顺序正确，但不排斥新项。
- 节点列表用例断言了 `["CPU", "内存"]` —— 改为 `["CPU 使用率", "内存使用率"]`。

这类断言是「实现细节泄漏到用例」的典型：一旦断言精确集合/顺序，任何合理扩展都会让它红。

### 42.5 验证

| 项 | 结果 |
|---|---|
| storage 套件 | **9 通过** |
| cluster-management 套件 | **6 通过** |
| api-client 单测 | **145 通过**（新增 4 条换算） |
| console-next 单测 | 92 通过 |
| 架构契约 | 452 通过 |
| 文档门禁 | errors=0 warnings=0 |

### 42.6 待办

- 集群项目列表的 CPU/内存/Pod 用量列（需按项目聚合 Pod 用量）
- 服务详情端口表展开

## 43. 第 43 轮：项目用量列 + 一类断言缺陷的系统性修正（2026-11-12）

### 43.1 交付：项目列表的用量列

| 层 | 内容 |
|---|---|
| 页面 | 项目列表新增 CPU 使用率、内存使用率、容器组数三列 |
| 数据 | 一次 `metrics.k8s.io/pods` 调用按命名空间聚合（实测 245 个 Pod / 140KB），不为每个项目单独请求 |
| 文档 | PRD 增 1 条验收场景；设计增 1 条 DEC；用例 1 条；单测 1 条 |

实测：

| 项目 | CPU | 内存 | 容器组数 |
|---|---|---|---|
| spaces | 0.61 | 1.2Ti | 32 |
| phanme | 0.06 | 7.4Gi | 9 |
| lws-system | 0.00 | 107.7Mi | 2 |

### 43.2 一个"计数对、用量为零"的坑

第一版聚合后**容器组数正确、CPU 与内存全为 0**。原因：**Pod 指标与节点指标形状不同**——节点是 `{ metadata, usage }`，Pod 是 `{ metadata, containers: [{ usage }] }`。按节点形状读 Pod，`item.usage` 恒为 undefined，累加得到 0，而 `podCount += 1` 仍然正确。

这个组合（**计数对、测量值为零**）就是该错误的特征。已补一条单测专门演示两种形状的差异。

另一处：聚合字段最初命名为 `cpu`/`memory`，与 `NamespaceSummary.cpu`（配额，不是测量值）同名，展开行对象时被静默覆盖。改名为 `cpuUsed`/`memoryUsed`。

### 43.3 系统性修正：精确断言 → 子序列断言

本轮及前两轮共 **4 次**因为新增列/属性而打破旧用例的**精确集合断言**。这类断言把实现细节（列的顺序、字段的完整列表）写死，任何合理扩展都会让它红。

已把 `tests/kube-frontend` 下 **11 处** `assert headers == [...]` 统一改为子序列断言：必需项都在、顺序正确，但不排斥新列。

⚠️ 批量替换时有两处因原断言位于 `if`/`try` 块内而丢失缩进，导致语法错误；已修正，并**对所有被改动文件做了 `compile()` 校验**（现在 0 语法错误）。这是批量改写的必要收尾，不能只看替换处的 diff。

### 43.4 验证

| 项 | 结果 |
|---|---|
| 全量 E2E（不含并行会话的 cluster-configmaps） | **112 通过、5 跳过、1 失败** |
| 该失败项单独重跑 | 通过（并发抖动） |
| cluster-management 套件 | 7 通过 |
| api-client 单测 | 149 通过 |
| console-next 单测 | 92 通过 |
| 架构契约 | 452 通过 |
| 文档门禁 | errors=0 warnings=0 |

## 44. 第 44 轮：服务详情端口表 —— 字段级核对收尾（2026-11-12）

### 44.1 交付

| 层 | 内容 |
|---|---|
| api-client | 端口模型补 `nodePort`（仅 NodePort/LoadBalancer 存在时带该键） |
| 页面 | 服务详情「端口」表：端口名、服务端口、容器端口、节点端口 |
| 文档 | PRD 增 1 条验收场景；设计增 1 条 DEC；用例 1 条；单测 1 条 |

实测（`spaces` 项目的真实服务，6 个端口）：

| 端口名 | 服务端口 | 容器端口 | 节点端口 |
|---|---|---|---|
| http | 80 | 8012 | - |
| https | 443 | 8112 | - |
| http-istio | 8012 | 8012 | - |

### 44.2 两个判断

1. **端口表只出现在服务上**：端口回答"流量怎么进来"，只有 Service 有这个结构；给七种其它资源各渲染一块空表是噪音。
2. **`nodePort` 缺省显示 `-`，不是 `0`**：ClusterIP 服务根本没有这个字段。显示 0 是在陈述"节点端口是 0"，与事实不符。模型上也改用条件展开，不带这个键。

### 44.3 字段级核对：全部区域完成

| 区域 | 结论 |
|---|---|
| 配置（配置字典 / 保密字典 / 服务账户） | 一致 |
| 应用负载 | 专属属性、自动伸缩、端口表已补齐 |
| 存储 | 状态、供应者、快照类型已补齐 |
| 访问控制 | 一致（别名并入名称副行） |
| 监控告警 | 一致（策略名与目标在副行） |
| 项目设置 | 一致 |
| 集群管理 | 节点用量、项目用量已补齐 |
| 平台设置 | 一致 |

### 44.4 验证

| 项 | 结果 |
|---|---|
| app-workloads 套件 | **20 通过** |
| api-client 单测 | **147 通过** |
| 架构契约 | 452 通过 |
| 文档门禁 | errors=0 warnings=0 |

## 45. 第 45 轮：行操作菜单逐页核对（2026-11-12）

### 45.1 核对方法

先从老 console 各页面源码抽出全部行操作，再对每个已迁移页面打开行操作菜单实际读取，逐项比对。

老 console 的操作清单（项目级）：

| 页面 | 老 console 行操作 |
|---|---|
| 配置字典 | 编辑信息、编辑 YAML、编辑设置、删除 |
| 保密字典 | 编辑信息、编辑 YAML、编辑设置、删除 |
| 服务账户 | 编辑 YAML、删除 |
| 部署/有状态/守护进程 | 编辑信息、编辑 YAML、删除（+ 详情页的扩缩容、重新部署） |
| 任务/定时任务 | 编辑信息、编辑 YAML、删除 |
| 容器组 | 编辑 YAML、删除 |
| 服务 | 编辑信息、编辑 YAML、编辑服务、编辑外部访问、删除 |
| 应用路由 | 编辑信息、编辑 YAML、编辑路由规则、编辑注解、删除 |
| 存储卷 | 编辑信息、编辑 YAML、删除 |
| 角色 | 编辑信息、编辑权限、删除 |

### 45.2 发现的真实缺口

**扩缩容与重新部署只在详情页，不在列表行操作里**——而老 console 把它们放在列表菜单。这不只是位置差异：扩缩容的决策通常发生在浏览列表时（"这个太忙，加一份"），把入口藏在详情页里会拉长决策路径。

本轮补上后，部署的行操作变为：编辑信息、编辑 YAML、停止、**扩缩容**、**重新部署**、删除。

实测：扩缩容 1 → 3 生效；重新部署写入 `kubectl.kubernetes.io/restartedAt`。

### 45.3 一处实现细节

`WorkloadSummary` 原本没有 `replicas` 字段（详情才有），列表的扩缩容对话框需要"当前副本数"，因此补到行摘要上。补的时候第一次加错了位置（加到了详情接口而非行接口），TS 立刻报错指出——类型系统在这里是有效的护栏。

### 45.4 又一次精确断言失效

`test_TC_FULL_..._02.py` 里有两处 `assert row_actions(...) == [...]`，被新增的两项打破。改为子序列断言 + 互斥项断言（停止后不得出现停止、运行中不得出现启动）。

这是本会话第 **5、6 次**同类问题。已在上一轮把 `headers` 类断言统一为子序列；**行操作类断言也应同样处理**，本轮补上了这两处。

### 45.5 验证

| 项 | 结果 |
|---|---|
| app-workloads 套件 | **21 通过** |
| 架构契约 | 452 通过 |
| api-client 单测 | 146 通过 |
| console-next 单测 | 92 通过 |
| 文档门禁 | errors=0 warnings=0 |

## 46. 第 52–53 轮：部署的版本历史与回滚（2026-11-13）

### 46.1 交付

| 层 | 内容 |
|---|---|
| api-client | `revisions()`、`rollback()`、`toWorkloadRevision()`；`WorkloadRevision` 类型 |
| 页面 | 部署详情「版本历史」表：版本、镜像、副本、创建时间、回滚 |
| 文档 | PRD + 设计各 1 份；用例 1 条；单测 4 条 |

实测（三个版本的部署）：

| 版本 | 镜像 | 副本 |
|---|---|---|
| **3（当前）** | nginx:1.29 | 1 |
| 2 | nginx:1.28 | 1 |
| 1 | nginx:1.27 | 0 |

对版本 1 回滚后镜像恢复为 `nginx:1.27`，且 ReplicaSet 数量从 2 变为 3——**回滚生成了新版本，没有抹掉历史**。

### 46.2 两个关键实现判断

1. **回滚没有 API**：Kubernetes 用「把目标版本的 pod template 写回 Deployment」实现回滚（`kubectl rollout undo` 就是这么做的）。实现照此办理，并且**不修改 Deployment 自身的 revision 注解**——否则历史会出现"回退"，而 Kubernetes 从不这样做。
2. **当前版本不提供回滚按钮**：对当前版本回滚是空操作，却会滚动重启所有 Pod。**看不出效果却会重启的按钮比没有按钮更危险。**

### 46.3 两个必须避开的坑

- **ReplicaSet 归属**：按标签选择器查出来的 ReplicaSet 可能包含别的对象的，必须再用 `ownerReferences` 确认。否则会列出别人的版本。
- **模板里的 `metadata.creationTimestamp`** 是控制器写的；原样回写会让 patch 与控制器争同一字段，须剔除。

### 46.4 契约测试抓到的问题

回滚按钮最初写成裸 `<button>`，被 `ai-surface-contract` 拦下——项目规定所有可交互元素必须带 `actionProps`/`data-ai-id`，否则 AI 代理只能靠文本定位。改用 `Button` 组件后通过。这类约束正是契约测试存在的意义。

### 46.5 验证

| 项 | 结果 |
|---|---|
| app-workloads 套件 | **23 通过** |
| 架构契约 | 454 通过 |
| api-client 单测 | 150 通过（新增 4 条） |
| console-next 单测 | 95 通过 |
| 文档门禁 | errors=0 warnings=0 |

## 47. 第 54 轮：详情页的关联容器组（2026-11-13）

### 47.1 交付

| 层 | 内容 |
|---|---|
| api-client | `workloadsApi.pods()`、`toWorkloadPod()`、`WorkloadPod` |
| 页面 | 部署 / 有状态副本集 / 守护进程集详情的「关联容器组」表 |
| 文档 | PRD 增 1 条场景、设计增 1 条 DEC；用例 1 条；单测 2 条 |

实测（`spaces` 项目的真实部署）：

| 容器组名称 | 状态 | 所在节点 | 重启次数 |
|---|---|---|---|
| agent-asr-restored-20261105-8574d469cf-7gmrs | Running | sagesuite-demo | 0 |

### 47.2 两个判断

1. **按选择器取，不按名字前缀猜**：`spec.selector.matchLabels` 是 API 契约，`<workload>-<hash>-<suffix>` 只是命名约定。没有选择器的类型（Job / CronJob / 裸 Pod）**不显示该区块**，而不是退化成猜名字。
2. **每 15 秒刷新**：Pod 会被替换。静态列表会显示已经不存在的 Pod，**比没有列表更误导**。

### 47.3 验证

| 项 | 结果 |
|---|---|
| app-workloads 套件 | **24 通过** |
| 架构契约 | 454 通过 |
| console-next 单测 | 95 通过 |
| api-client 单测 | 152 通过 |
| 文档门禁 | errors=0 warnings=0 |

### 47.4 追加（用户反馈）：容器组名称可点击进入详情

**问题**：关联容器组表里的 Pod 名称是纯文本。看到某个 Pod 不正常后，下一个问题一定是"它怎么了"，而答案在容器组详情页（专属属性、镜像、YAML），不在摘要表里。纯文本等于要求读者复制名字再自己寻址。

**修改**：Pod 名称改为链接，指向 `/kube-frontend/<ws>/clusters/<cluster>/projects/<ns>/pods/<name>`。

**顺带的改动**：详情页原先没有 `workspace` 参数（不需要它）；要拼 Pod 详情地址就必须有，因此给 `WorkloadDetailPage` 增加该 prop，并更新 **8 个** 详情路由传参。

**实测**：

```
pod links: 1
href: /kube-frontend/system-workspace/clusters/host/projects/spaces/pods/agent-asr-restored-...-7gmrs
url after click: .../projects/spaces/pods/agent-asr-restored-...-7gmrs
pod detail state: ready
```

用例 `PODS_BLOCK-01` 增加了"点击名称 → 跳到容器组详情并进入 ready"的断言。

## 48. 第 55–56 轮：存储卷挂载状态 + 环境切换到 B200（2026-11-13）

### 48.1 存储卷「挂载状态」列（按用户指示：先迁移，性能后优化）

| 层 | 内容 |
|---|---|
| api-client | `mountsOf()`、`withMountState()`、`StorageSummary.inUse` |
| 页面 | 存储卷列表「挂载状态」列：已挂载 / 未挂载 / 计算中 |
| 文档 | PRD + 设计各 1 份；用例 1 条；单测 5 条 |

**性能记录（已标注，待优化）**：该列需要列出项目内全部 Pod 才能判断。本集群实测：

| 项目 | Pod 数 | 耗时 |
| --- | --- | --- |
| csghub | 28 | ~13s |
| spaces | 81 | ~58s |

耗时与**对象数**成正比，与响应体积无关（单对象 0.8s、35 个 Pod 11s、34 个 Pod 26s）。因此：

- 每个项目只请求**一次** Pod 列表（不是每行一次），且缓存 60 秒；
- 列在数据到达前显示「计算中」，而不是先显示「未挂载」——后者是一个数据不支持的断言；
- 列表本身不被阻塞（实测列表 3.2 秒出现，挂载状态 13.2 秒补全）。

### 48.2 环境切换：A100 → B200

用户指出 A100 环境较慢，要求改在 B200（`环境/B200环境.md`）验证。

已打通：`ssh sgb000` → 反向端口转发 → 本机 `127.0.0.1:18088`（console）与 `18092`（ks-apiserver）。
实测 console 响应 **0.29s**，ks-apiserver **0.19s**——比 A100 快一个数量级。

**登录受阻**：文档记录密码为 `Bat@2026`，但用老 console 的 `encrypt(salt, password)` 加密后，
ks-apiserver 明确返回 `incorrect password`（`password.go:93` 有对应日志）。连续尝试触发了
KubeSphere 的账号级限流（`auth rate limit exceeded`），因此停止尝试。

已确认的实现细节（供后续使用）：
- salt 取 `globals.config.encryptKey`，默认 `kubesphere`；`console/src/core/containers/Login/index.jsx:361` 调用 `encrypt(encryptKey, password)`；
- 老前端只发送 `username` / `password` / `grant_type` 三个字段，**`client_id` 与 `client_secret` 由 ks-console 服务端中间件注入**（`stores/root.js:87` 的注释）；
- 直连 ks-apiserver 时需自行带 `client_id=kubesphere`、`client_secret=kubesphere`（实测错误的 secret 返回 `invalid_client`，正确的 secret + 错误密码返回 `invalid_grant`）。

**待办**：拿到正确的 B200 admin 密码后，把 `tests/ui` 的 `KA_APP_URL` 指向该隧道即可复跑全部用例。

### 48.3 第 57 轮：服务的关联容器组

核对老 console 各资源详情页的子区块，发现 5 处未迁移：

| 资源 | 老 console 子区块 | 结论 |
| --- | --- | --- |
| 服务 | ResourceStatus（关联容器组） | **本轮补上** |
| 存储卷 | Snapshots（快照列表） | 本集群无 VolumeSnapshot CRD，数据恒为空，**不做** |
| 有状态副本集 | ServiceCard（关联服务） | 待办 |
| 任务 | ExcuteRecords（执行记录） | 待办 |
| 定时任务 | JobRecords（任务记录） | 待办 |

**实现要点**：`pods()` 原先只认工作负载的 `spec.selector.matchLabels`；**Service 的选择器是扁平的
`spec.selector`**。按工作负载形状去读服务会得到空对象，"关联容器组"于是静默列 0 行——不报错、
什么都不显示，是最难排查的失败。两种形状现已分开处理。

实测（`spaces` 项目的服务 `g0obazytvegw`）：

```
service pods block: 1
容器组名称 / 状态 / 所在节点 / 重启次数 / 创建时间
agent-memory-embedding-restored-20261102-56bc4947f6-f7f7c | Running | sagesuite-demo
```

**验证**：app-workloads 25 通过；架构契约 454；api-client 157；文档门禁 0 错。

### 48.4 第 59 轮：任务的执行记录

| 层 | 内容 |
|---|---|
| api-client | `runs()`、`toJobRun()`、`JobRun` |
| 页面 | 任务详情「执行记录」表：序号、容器组（可点进详情）、状态+原因、退出码、开始/结束时间 |
| 文档 | PRD 增 1 条场景、设计增 1 条 DEC；用例 1 条；单测 3 条 |

**两个判断**：

1. **按 `job-name` 标签取 Pod**，不按名字前缀匹配——前缀会误收名字开头相同的另一个任务。退出码取各容器终止码的最大值：一个 Pod 有多个容器时，任何非零都说明这次执行失败。
2. **Pod 已被清理时不显示区块**。这是事实而非缺陷：历史确实不在了，**伪造一行比不显示更糟**。

**测试环境的一个坑**：default 项目中 `nginx:1.27` / `busybox:1.36` 的 Pod 长期停在 `Pending`——这个集群从 Docker Hub 拉镜像极慢。用例改用**集群内已运行**的镜像（本地 Harbor），否则用例测的其实是镜像仓库。

**定时任务记录**：老 console 的对应区块展示 CronJob 创建的 Job 历史。本轮未做——本集群三个命名空间的 cronjob 数量均为 0，**无法验证**。

**验证**：app-workloads 27 通过；架构契约 454；api-client 163；文档门禁 0 错。

### 48.5 第 60 轮：批量操作核对，发现一个让批量删除完全不可用的缺陷

| 层 | 内容 |
|---|---|
| 页面 | 新增「批量停止」（仅可扩缩容的类型）；修正批量删除的确认方式 |
| 文档 | PRD 增 1 条场景、设计增 1 条 DEC；用例 1 条；单测 3 条 |

**核对结果**：9 个列表页中，配置字典 / 保密字典 / 存储卷 / 部署 / 任务有批量操作；用户页无（合理，用户删除不批量）。老 console 的部署页有「批量停止」，当前实现缺失 → 本轮补上：

```
bulk on deployments: ['批量停止', '批量删除']
bulk on jobs:        ['批量删除']          ← 任务无可扩缩容的副本数
```

**发现的真实缺陷**（比缺一个按钮严重得多）：`DeleteDialog` 的批量确认文本是**所有名字的逗号拼接**
（`expectedConfirmation` 返回 `names.join(', ')`），而确认按钮要求 `typed === expected`。
结果是——**用户必须逐字输入 `a, b, c` 才能删除，实践中不可能完成，批量删除功能实际上不可用**。

这个缺陷长期存在却未被发现，原因是**批量删除从未有过用例**（本轮是第一次真正走通这条路径）。

修复：批量确认输入**数量**，单个确认仍输入名称。文案同步改为"请输入要删除的对象数量（n）"。

**验证**：app-workloads 28 通过；架构契约 454；console-next 98；文档门禁 0 错。

### 48.6 第 61 轮：同一缺陷的第二份副本

上一轮修好 `components/resource/DeleteDialog` 的批量确认后，本轮检查其余列表页，发现**配置字典用的是另一份对话框** `ConfigMapDeleteDialog`，**存在完全相同的缺陷**。

| 组件 | 使用页面 | 本轮前 |
| --- | --- | --- |
| `components/resource/DeleteDialog` | 工作负载、存储、保密、服务账户、用户… | 上一轮已修 |
| `pages/configmaps/ConfigMapDeleteDialog` | 配置字典 | **仍然要求输入全部名字拼接** |

配置字典的删除用例此前只验证到"批量删除按钮可用"，**从未真正执行删除**——这与工作负载那边的情况一模一样，也是同一缺陷能活下来的原因。

### 一个关于"照搬老 console"的判断

老的 `Modals/Delete/index.jsx` 确实要求 `confirm === resource`（逗号拼接的全名）。也就是说**这个不可用的设计是从老 console 照搬来的**。

我没有继续照搬：批量删除要求逐字输入二十个名字的拼接，等于没有这个功能。单个删除仍保留原名确认（那是有效的防误点措施）。这是一个有意识的偏离，理由写进了组件注释与设计文档。

### 本轮修改

| 文件 | 改动 |
| --- | --- |
| `ConfigMapDeleteDialog.tsx` | 批量确认改为数量，注释说明与老 console 的偏离及原因 |
| `test/configmaps-dialogs.test.tsx` | 两条单测原本**断言了错误的旧行为**（`'a, b, c'`），改为断言计数；并补充"输入数量后按钮可用" |
| 新增用例 `CONFIGMAPS-BULK_DELETE-01` | 真正走完批量删除：选中两行 → 输入数量 → 确认 → 两个对象都消失 |

### 验证

| 项 | 结果 |
| --- | --- |
| configmaps 套件 | **22 通过、3 跳过** |
| console-next 单测 | **98 通过** |
| 架构契约 | 454 通过 |
| 文档门禁 | errors=0 warnings=0 |

**值得记下的一点**：旧单测 `asks for every name joined by comma and space` 是**把缺陷固化成期望**的典型——用例通过了，功能却是坏的。这类断言比没有用例更危险，因为它给出了"已验证"的假象。

### 48.7 第 62 轮：编辑"看似成功却未保存"——JSON merge patch 语义

本轮写脚本筛出**"有用例但只验证到中途"**的路径，找到配置字典的 `EDIT-01`：用例标题写着"别名清空后注解被移除"，
但代码只断言了**对话框关闭**，从未回读对象。

补上回读后立即暴露真实缺陷：

| 操作 | 结果 |
| --- | --- |
| 设别名 `别名X` | ✅ 保存成功 |
| 再清空别名 | ❌ **注解仍是 `别名X`**，对话框却正常关闭 |

**根因**是 JSON merge patch（RFC 7386）的语义：

- 键设为 `null` → **删除**
- 键**不存在** → **保持不变**

而对话框在清空时是把键从 map 里 `delete` 掉，于是 patch 里没有该键，服务器理解为"不用改"。
**表现为"保存成功、实际没变"**——最难发现的一类失败，因为没有任何错误。

修复：`EditInfoDialog` 新增 `annotationMergePatch(before, after)`，把"消失的键"转成 `null`。
4 条单测覆盖：清空 → `null`、未改动 → 省略、新增 → 值、无变化 → 空 patch。

同时修正 `EDIT-01` 用例本身：先设别名、断言已保存，再清空、断言注解被移除，并确认**数据未被编辑动作丢失**。

**验证**：configmaps 21 通过 / 4 跳过；console-next 单测 102；架构契约 454；文档门禁 0 错。

**过程中的一次弯路**：我最初改的是 `EditInfoDialog` 的签名（让所有调用方处理 null），牵动 7 个文件。
中途判断改动面过大，回退了这次重构，改为**新增一个纯函数辅助器 + 保持签名不变**——改动面从 7 个文件降到 2 个。
记录在此，因为它正是"能跑通不等于改动得当"的例子。


### 环境说明（2026-11-13）

E2E 依赖两个进程，缺一不可：

| 进程 | 端口 | 作用 |
| --- | --- | --- |
| BFF | 8091 | 代理 `/api`、`/kapis`、`/apis` 到 ks-apiserver |
| 静态服务 | 5177 | 提供 `dist` 并代理由浏览器发往 `/api` 的请求 |

5177 的进程此前意外退出，导致整套用例以 `502 Bad Gateway` 失败（当时看起来像 20 个用例同时坏了，
实际是两个进程里少了一个）。现在它由受管后台任务启动，重启方式：

```bash
cd kube-frontend && node scripts/dev-static-server.mjs apps/console-next/dist 5177 http://127.0.0.1:8091
```

**遇到大批量同时失败时先确认这两个端口**，再怀疑代码。

### 48.8 第 67 轮：排序控件在默认降序的页面上是死的

用脚本对 14 个列表页逐一检查排序，发现**访问控制三页（用户、平台角色、企业空间）点击排序毫无反应**。

根因在 `Table.cycleSort` 的三态循环：

```
不同列 → asc ；同列且 asc → desc ；同列且 desc → undefined（取消排序）
```

而 `useResourceListState` 的**默认排序是 `desc`**，9 个页面又都写成 `if (next) list.setSort(next)`——
于是**第一次点击就走进「取消排序」分支，被页面丢弃**，状态不变、不发请求，看起来就是"排序坏了"。

`Table` 原本的单测甚至锁定了这个三态行为（`cycles asc, desc then none`），但它从未在任何页面上被正确消费。

修复：改为两态（asc ↔ desc）。理由是这些列表**永远有排序**（服务端总要 `sortBy`/`ascending`），
「无排序」是一个不存在于数据模型的状态；一个所有消费者都丢弃的状态就是死控件。

实测（用户页）：

```
initial: ['zzzzzzzz', 'zyp001', 'zupin']      ← 默认降序
click1:  ['1014169576', '1234', '1234321']    ← 升序
click2:  ['zzzzzzzz', 'zyp001', 'zupin']      ← 降序
```

新增用例 `ACCESS_CONTROL-USERS-04` 锁定该行为。

**验证**：ai-kit 153 通过；架构契约 454；console-next 98；access-control 8 通过 + 1 抖动（单跑通过）；文档门禁 0 错。

### 48.9 第 68 轮：两个集群页的排序控件是死的

修正审计脚本的 URL（项目级页面此前漏了 `clusters/host` 段）后重测，发现另外两页：

| 页面 | 问题 | 根因 |
| --- | --- | --- |
| 存储类型 | 点击名称排序**完全无效** | 走 `storage.k8s.io` 核心 API，`sortBy`/`ascending` 是 KubeSphere 约定，**核心 API 直接忽略** |
| 系统组件 | 点击排序**无效** | 行顺序被写死为"按健康度排"，从未读取排序状态 |

修复：

- **存储类型**：改为本地排序（该接口本就一次取全量，集群里只有几条）。
- **系统组件**：新增 `health` 排序键并作为默认（`asc` 即"不健康在前"，保留原有意图），排序控件现在真正生效。

实测两页均 `asc_ok=True desc_ok=True toggles=True`，且系统组件初始顺序仍是不健康在前。

**共性**：这两处和上一轮的 `cycleSort` 三态问题同属一类——**声明了可排序（`sortableKeys`）却没接上实现**。
一个通用的教训：声明式配置（schema 里的 `sortableKeys`）必须由渲染层兑现，否则就是死控件。

### 48.10 第 69 轮：分页控件不可寻址

功能审计确认**分页本身工作正常**（`clusterroles` 203 条 / 21 页，翻页与返回都正确），
但「上一页 / 下一页」按钮**没有 `data-ai-id`**——测试与 AI 代理只能靠中文文本定位，
一旦切语言就失效。这与仓库「所有可交互元素带稳定标识」的约定不符。

修复：`Pagination` 增加 `aiPrefix`，由 `ResourceList` 用已有的 `sortAiPrefix` 传入，
于是分页按钮带 `clusterroles:page:prev` / `clusterroles:page:next`——**与行、排序按钮同前缀**，
因为它们属于同一个列表。

新增用例 `PLATFORM_ROLES-03` 覆盖"标识存在 + 翻页生效 + 返回一致"。

**本轮审计的完整结论**（14 个列表页）：

| 交互 | 结论 |
| --- | --- |
| 排序 | **4 处死控件已修**（3 个访问控制页 + 存储类型 + 系统组件） |
| 分页 | 功能正常，标识缺失已补 |
| 搜索 | 正常（多个套件已覆盖） |

### 48.11 第 70 轮：集群作用域的完整性检查缺了一条腿

`parity_check.py` 一直只检查**项目作用域**的「老页面 → 是否已迁移」。集群作用域只查「多余路由」和
「未登记区域」，于是**一条没迁移的集群页面完全不会出现在报告里**——缺口得靠人记得去数。

补上后立刻抓到两个真问题：

| 问题 | 说明 |
| --- | --- |
| 集群配置字典仍是**平铺路由** | `configmaps.tsx` + `configmaps.$name.tsx`，不符合「每页一个文件夹」的约定（`<page>.tsx` 会成为 `<page>.$name.tsx` 的父级，详情被列表吞掉） |
| 该页**没有登记区域** | 页面存在但侧栏到不了 |

修复：改为文件夹路由（`route.tsx` / `index.tsx` / `$name.tsx`），并登记到集群管理区域（标题「配置字典」）。

### 48.12 集群配置字典的实测性能（重要）

| 请求 | 耗时 |
| --- | --- |
| `/kapis/.../namespaces/default/configmaps` | **1.0s** |
| `/kapis/.../configmaps`（跨全部项目） | **25.4s** |

页面的「加载中」因此长达 40 秒以上。两处改进（仍按「先迁移、后优化」）：

1. 列表的 `loading` 改为 `query.isFetching`——**搜索/排序/切项目期间也显示骨架行**。
   此前重查期间显示的是旧数据且无任何提示，用户会以为输入被忽略了。
2. 页对象与用例的等待按实测放宽（`wait_ready` 120s、搜索 150s），
   并把「填入受控输入框后校验值是否被回写」做成重试——页面重渲染会把部分输入覆盖掉。

**遗留**：`cluster-configmaps` 套件仍有 4 个用例在极端延迟下抖动（首屏 42s + 每次查询 25s）。
产品行为已手工验证正确（搜索请求带完整关键字、结果正确过滤）。该套件最初 10 个全失败，
现在 6 通过 4 失败；这批用例由并行会话维护，进一步的稳定性改造留待其负责人。

### 48.13 第 71 轮：指标未到时的「0」是与事实不符的断言

项目列表的 CPU / 内存 / 容器组数三列来自第二个请求（`metrics.k8s.io/pods`，本集群 ~25s）。
该请求返回前，行数据被填成 `0` / `0` / `0`——等于宣称「这个项目不占资源、没有容器组」。

修复：`withProjectUsage` 在指标**尚未到达**时返回未附加用量的行，列显示 `-`；
指标到达后，某命名空间确实没有 Pod（不在 map 里）才显示 0。两者是不同的答案。

同类问题在存储页的挂载状态已经处理过（「计算中」而不是「未挂载」），本轮补上项目用量列。

两条用例（`PROJECTS_02`、`NODES_02`）此前在指标到达前采样行，因此间歇失败；
现在都等待首个期望值出现再断言。

**验证**：cluster-management **8 通过**；console-next 单测 98 通过。

### 48.14 第 72 轮：集群作用域缺口分析 + 迁移持久卷

先回答一个问题：老 console 的 18 个集群页里，哪些是**能力真缺**，哪些是现代设计用别的方式覆盖了？

核对结论：

| 老集群页 | 现状 |
| --- | --- |
| 配置字典 / 节点 / 项目 / 系统组件 / 存储类型 | 已迁移 |
| 保密字典 / 服务账户 | **项目页已带「项目」列 + 全部项目模式**，能力等价 |
| 工作负载 / 角色 / 成员 / 网络策略 | 项目页支持「全部项目」筛选（`__all__` 哨兵会被映射成空命名空间） |
| **持久卷** | **集群独有资源，此前完全缺失** |
| 概览 / 监控 / 自定义监控 / CRD 浏览器 / 边缘节点 / 日志 / 网关 / kubeconfig / 可见性 | 已在 `CLUSTER_UNMIGRATED` 登记原因 |

因此本轮只做真正缺的那一页：**持久卷**。

实测性能（决定了实现方式）：

| 接口 | 耗时 |
| --- | --- |
| `/api/v1/persistentvolumes`（核心） | **24s** |
| `/kapis/.../persistentvolumes`（代理） | **63s** |

所以读核心 API，并把加载骨架覆盖到重查阶段。

页面结果（170 个卷、七列）：

```
csghub-minio-a100-disk1 / local-static | Bound | 5Ti | RWO | kubesphere-system/csghub-minio-a100-data | Retain
kubeaihub-model-cache / juicefs-shared  | Bound | 1Ti | RWX | spaces/csghub-model-cache | Retain
```

**验证**：cluster-management **9 通过**；架构契约 465；api-client 164；console-next 98；文档门禁 0 错；
一致性核对缺口 0、未登记 0。
