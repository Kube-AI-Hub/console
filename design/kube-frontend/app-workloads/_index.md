# 应用负载（L2）

[子模块需求](../../../prd/kube-frontend/app-workloads/_index.md)

## 概述

项目内的八种应用负载收进一个功能区：工作区栏 + 八页签 + 共享的列表与详情组件。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-BULK-01

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-FORM_UX-01

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_ACTIONS-01

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-MOBILE-01

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-INGRESSES-01

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-SERVICES-01

- AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-06

- AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-05

- AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-04

- AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-03

- `AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-01`
- `AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-02`
- `prd/kube-frontend/app-workloads/_index.md`

## 设计目标与非目标

目标：让列表、详情、状态、写路径各有**一处**定义。非目标：负载的创建表单、日志与终端。

## 关键约束

- 区域只影响导航，不进入 URL（DEC-AREA-01）：路径仍是 `…/projects/<ns>/<resource>`。
- 写操作按 API 组路由。
- 页签是真实链接，普通点击由布局转成客户端跳转。

## 方案决策

### DEC-L2-KUBE-FRONTEND-APP_WORKLOADS-01 — 八种资源共用一个功能区，页签平铺

**为什么**：老 console 用两级（分组 + 页签）。页签平铺后所有页面一步可达，区域在侧栏已表达，再分一级只会把页面藏起来。

**被否方案**：完全照搬两级导航。八页需要点两次，且第二级在窄屏变成下拉，反而更难发现。

**何时重新考虑**：区域内页面超过 12 个时。

### DEC-L2-KUBE-FRONTEND-APP_WORKLOADS-02 — 每页一个路由文件夹（`route` / `index` / `$name`）

**为什么**：文件式路由会让 `index.tsx` 成为 `$name.tsx` 的父路由；固定三件套让「列表吞掉详情」这个缺陷不可能复发，并让一个页面的三个文件在一起。

**被否方案**：平铺 `<page>.tsx` 与 `<page>.$name.tsx`。可行，但改动时容易只改一个文件而漏掉 `Outlet`。

**何时重新考虑**：不需要。

## 系统现状

老 console 在 `server/config.yaml` 的 `projectNavs` 里把八页分到「应用负载 / 任务」等分组；页面分散在 `pages/projects/containers/*`。

## 仓库落点

- `apps/console-next/src/areas/registry.ts`（区域声明）
- `apps/console-next/src/pages/app-workloads/`
- `src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/<resource>/`
- `packages/api-client/src/workloads.ts`

## 对外契约

读 kapis，写原生端点；列表分页参数 `page` / `limit` / `sortBy` / `order` / `name`。

## 不变量

1. 状态只有一处定义。
2. 写路径与 API 组一致。
3. 区域内切换不产生文档请求。

## 已知坑

- 写死 `/api/v1` 会让非核心组资源的写操作 404。
- 详情 URL 在父路由缺失 `<Outlet/>` 时会渲染成列表。

## 测试与可观测

单测：状态派生、API 组路由。E2E：`tests/kube-frontend/app-workloads/`。

## 后续改进

创建表单、扩缩容、日志与终端。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-01`

## 页面与技术结构

- **区域声明**：`src/areas/registry.ts` 的 `app-workloads`，八个页面按老 `projectNavs` 顺序排列。侧栏、页签栏、面包屑都读这一份。
- **路由**：每个页面一个文件夹 `<resource>/{route.tsx,index.tsx,$name.tsx}`。`route.tsx` 只渲染 `<Outlet/>`，`index.tsx` 是列表，`$name.tsx` 是详情。
- **组件**：`WorkloadListPage`（列表，描述符驱动）、`WorkloadDetailPage`（详情），共用 `components/resource/` 下的删除、YAML、加载对话框。
- **数据**：`packages/api-client/src/workloads.ts` 提供 `workloadsApi(client, kind)`、状态派生与 `restart()`。

## 状态与数据归属

- 页面状态只有 UI 态（对话框、搜索词、分页、选中），不缓存资源对象。
- 资源状态由 TanStack Query 持有，key 含 `kind` 与全部查询参数；写操作后按 `kind` 前缀失效。
- 作用域（workspace/cluster/namespace）只从路由参数派生，页面内不另存副本。

## 关键契约与依赖

- 读：`/kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/<resource>`。
- 写：`kubePrefix(resource)` → `/api/v1`（核心组）或 `/apis/<group>/<version>`；`PATCH` 必须 `application/merge-patch+json`。
- 依赖：`@kube-ai-hub/ui`（表格、对话框）、`@kube-ai-hub/ai-surface`（`actionProps`、`AiSurface`）、`@kube-ai-hub/locales`。

## 明确不做

- 负载创建表单（各资源的镜像/模板表单是独立页面）。
- 日志、终端（需要 WebSocket 通道）。
- 扩缩容与编辑信息（表单能力未迁移，记在计划文档待办）。
- 列显隐、列宽拖拽。

## 功能点

| 功能点 | 需求 | 技术方案 |
|---|---|---|
| 列表 | `prd/…/list.md` | `design/…/list.md` |
| 状态派生 | `prd/…/status.md` | `design/…/status.md` |
| 详情 | `prd/…/detail.md` | `design/…/detail.md` |
| 重新部署 | `prd/…/redeploy.md` | `design/…/redeploy.md` |
| 编辑 YAML | `prd/…/edit-yaml.md` | `design/…/edit-yaml.md` |
| 编辑设置 | `prd/…/edit-settings.md` | `design/…/edit-settings.md` |
| 删除 | `prd/…/delete.md` | `design/…/delete.md` |

### DEC-L2-KUBE-FRONTEND-APP_WORKLOADS-05 — 服务编辑只改端口，且整表提交

**为什么**：`spec.ports` 在 merge patch 下是**整体替换**的数组——只发一个端口会把其余端口删掉，所以提交的必须是完整列表。同时保留每个端口原有的 `name`：命名端口被 `targetPort` 按名引用，改名会让引用失效。

**被否方案**：把类型与选择器也放进这个对话框。改选择器等于把流量指向另一批 Pod，改类型会改变服务的可达方式，两者都不适合藏在一个单字段对话框里——它们仍走 YAML。

**何时重新考虑**：出现「暴露新端口」的引导式流程时。

### DEC-L2-KUBE-FRONTEND-APP_WORKLOADS-06 — 路由规则按「一层」扁平化再重建

**为什么**：Ingress 的规则是三层嵌套（rule → path → backend），而编辑器要的是"域名 / 路径 / 后端"一行。读取时扁平化成叶子，提交时按 host 重新分组并补上 `pathType: Prefix`。这样编辑器的字段与人们说法一致，而 `spec` 的结构由一处负责。

**被否方案**：让编辑器直接操作嵌套结构。字段会变成 `rules[0].http.paths[0].backend.service.port.number` 这种形状，用户与测试都难以书写。

**何时重新考虑**：需要多条 path 或 `ipBlock` 后端时，改为可增删行的表格。

### DEC-L2-KUBE-FRONTEND-APP-WORKLOADS-07 — 触摸目标：44px 目标预算、24px 硬底线

**为什么**：375px 实测发现两处真实缺陷——区域页签固定在 **36px**、表格排序按钮只有**文本高度**（16px）。两者在桌面都不明显，在手机上是"点不准"。修复遵循 shell 已有的配对写法：`h-11 sm:h-9`（触摸 44px、指针设备 36px）与 `min-h-11 sm:min-h-0`。

用例断言的底线是 **24×24**（WCAG 2.5.8），而不是 44——44px 是目标预算，24px 是可判定的合规底线。把两者的角色分开，避免用例因"差 2px"而红、也避免真正的过小目标漏过。

**被否方案**：全局 `min-height: 44px`。会让密集的表格与工具栏变松，桌面端反而更难用。

**何时重新考虑**：出现以触摸为主的部署形态（平板工控屏）时，把 44px 提到硬底线。

### DEC-L2-KUBE-FRONTEND-APP-WORKLOADS-08 — 扩缩容与重新部署同时出现在**列表行**与详情页

**为什么**：这两个操作最初只做在详情页。核对老 console 的行操作时发现它们在**列表菜单**里——而扩缩容的决策通常发生在浏览列表时（"这个太忙，加一份"），不是打开某个对象之后。两处都提供，代价只是共用同一个对话框与 hook。

**被否方案**：只在详情页提供。少的是一次点击，但把决策路径拉长了。

**何时重新考虑**：列表行操作超过 6 项、开始需要分组时，可把低频项收进详情页。

### DEC-L2-KUBE-FRONTEND-APP-WORKLOADS-09 — 表单自己捕获提交失败，并把焦点送到第一个错误字段

**为什么**：所有调用方都传 `mutateAsync`，失败时它**抛出**。修正前 `ResourceForm` 直接 `await onSubmit(...)`，没有 catch——于是失败只表现为浏览器控制台的一条 unhandled rejection，对话框既不关闭也不提示，用户看到的和"点了没反应"完全一样。同理，校验失败时虽然渲染了错误文案，但字段可能在折叠之下，看不出哪里错了。

现在：**提交被拒 → 表单内显示原因并保留输入**；**校验失败 → 焦点与视口移到第一个错误字段**。

**被否方案**：让每个调用方自己 try/catch。十七个调用方，漏一个就回到原样。

**何时重新考虑**：需要区分"可重试的网络错误"与"不可重试的校验错误"时，改为结构化错误并在对应字段上就地显示。

### DEC-L2-KUBE-FRONTEND-APP-WORKLOADS-10 — 批量删除按**数量**确认，单个删除按名称确认

**为什么**：单个删除要求逐字输入对象名，那是防止误点的摩擦。批量删除若要求输入 `a, b, c` 的完整拼接，**没有任何人会满足**——结果不是"麻烦"，而是"按钮永远禁用、批量删除完全不可用"。这个缺陷此前一直存在且未被发现，因为**批量删除从未有过用例**（本轮才第一次真正走通这条路径）。

现在：批量确认输入数量，单个确认仍输入名称。

**被否方案**：批量删除不做任何确认。破坏性操作至少需要一次"我确实看过数量"的动作。

**何时重新考虑**：删除的对象数量多到用户难以核对时，改为"输入框 + 名称列表并排显示"。
