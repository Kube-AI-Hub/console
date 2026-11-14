# 应用负载（L2）

[上级模块](../_index.md)

项目内的八种应用负载分两批：**工作负载**（部署、有状态副本集、守护进程集）、**任务**（任务、定时任务）、**服务入口**（服务、应用路由）与**实例**（容器组）。老 console 把它们放在侧栏的两个分组里，本模块把它们收进同一个功能区，用顶部页签切换。

## 概述

- **路由**：`/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/{deployments,statefulsets,daemonsets,jobs,cronjobs,pods,services,ingresses}`
- **谁用**：项目运维与开发。日常工作里打开频率最高的一组页面。
- **做哪几步**：看当前项目有哪些负载、各自是否正常（状态、就绪副本）、点进详情、改 YAML、重启一个卡住的部署、删掉不再需要的。
- **看到什么**：一张带状态徽章的列表；点名称进详情，详情里是属性、容器镜像与同一组操作。

## 用户故事

### US1 - 一眼看出哪些负载不健康 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到每个负载的状态与就绪副本**，以便 **不必逐个点开就知道哪里出了问题**。

**Independent Test**：打开部署列表，核对状态列与就绪列，任取一行与 `kubectl get deploy` 的结果比对。

### US2 - 在项目内切换负载类型而不离开当前上下文 (Priority: P2)

作为 **项目运维**，我希望 **在同一个功能区的页签之间切换**，以便 **保持对项目和集群的认知，不必重新选择上下文**。

**Independent Test**：从部署切到容器组再切回，核对页签高亮与工作区栏里的项目始终不变，且浏览器没有整页刷新。

### US3 - 重启一个部署 (Priority: P2)

作为 **项目运维**，我希望 **在详情页点一次「重新部署」就滚动重启**，以便 **不必去命令行打注解**。

**Independent Test**：打开任一无状态部署的详情，点「重新部署」，核对 Pod 模板上出现 `kubectl.kubernetes.io/restartedAt` 且 revision 递增。

## 验收场景

- **AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-01** — 已知已登录且有项目权限，当打开任一负载页，则列表出现（或给出空态），页签高亮对应当前页，工作区栏显示当前项目。
- **AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-02** — 已知在部署列表，当依次切到容器组、服务、部署，则每次都不产生文档请求，且最终回到部署列表。

> 状态、详情、重新部署、编辑 YAML、删除、空态这些点各有自己的 L3 验收场景，见对应功能点文件；这里只保留「整个功能区能进去、能切换」这一层。

- **AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-03** — 已知一个已停止的部署（`replicas=0`），当其行操作被打开，则只提供「启动」而不提供「停止」；点「启动」后 `spec.replicas` 变为 1。
- **AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-04** — 已知一个定时任务，当点「暂停/启动」，则其 `spec.suspend` 被取反，列表状态随之变化。

- **AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-05** — 已知在部署列表，当点「创建」并填写名称、镜像与副本数后提交，则对象被创建，其 `spec.replicas` 与容器镜像与填写内容一致；名称不符合 Kubernetes 命名规则时提交被拦下并给出提示。

- **AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-06** — 已知一个部署的详情页，当用「编辑信息」改别名、用「扩缩容」把副本数改为 3，则 `kubesphere.io/alias-name` 注解被更新且 `spec.replicas` 为 3。

## 设计目标

落实两条不变量：

1. **状态只有一处定义**：列表与详情的状态来自同一套派生规则（见 `status.md`），两处不可能给出不同答案。
2. **写操作走正确的 API 组**：核心组走 `/api/v1`，其余走 `/apis/<group>/<version>`（见 `design` 的 DEC）。这条曾以缺陷形式出现过——Deployment 的写操作全部 404。

## 约束与边界

- **读**：`/kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/<resource>`（项目内）。
- **写**：`PATCH`（merge patch）与 `DELETE` 走 Kubernetes 原生端点；`PATCH` 必须带 `application/merge-patch+json`。
- **作用域**：一切以路由参数为准（workspace / cluster / namespace），页面内不另存副本。
- **分页**：服务端分页，每页 10 条；排序与搜索参数随请求下发。
- **不做**：创建负载（老 console 走镜像/模板的复杂表单，属于独立页面）。日志与终端已落地：日志读 ES 索引 + 实时 tail（HTTP chunked），终端走 BFF 的 WebSocket upgrade（见 `container-detail.md` 的对应验收场景）。

## UI 交互设计

- 顶部：工作区栏（项目切换）+ 区域页签（八个页面）。
- 列表：名称列两行（别名优先，副行为 `app` 标签）、状态徽章、就绪计数、创建时间；行操作「编辑 YAML」「删除」；支持多选批量删除。
- 详情：面包屑追加对象名；属性块 + 容器镜像块；操作「重新部署」（仅三种控制器）「编辑 YAML」「删除」。
- 所有需要先取详情的弹窗：**先弹出对话框，再加载**，加载期间显示加载态（见 `redeploy.md` 与 `edit-yaml.md`）。

## 页面结构

| 页签 | 路由 | 与老 console 的差异 |
|---|---|---|
| 部署 | `.../deployments` | 无 |
| 有状态副本集 | `.../statefulsets` | 无 |
| 守护进程集 | `.../daemonsets` | 无 |
| 任务 | `.../jobs` | 无 |
| 定时任务 | `.../cronjobs` | 无 |
| 容器组 | `.../pods` | 无 |
| 服务 | `.../services` | 无 |
| 应用路由 | `.../ingresses` | 老 console 称「应用路由」，路径段是 `ingresses`，保持一致 |

## 异常态

- **加载中**：骨架或表格占位，页面 `data-ai-state="loading"`。
- **空**：区分「没有数据」与「搜索无结果」，两者文案不同。
- **失败**：`ResourceErrorPanel`，带重试按钮；401/403 提示无权限而不是「加载失败」。
- **详情不存在**：提示对象不存在并给回列表的入口。

## 功能需求

- **FR-1** 列表按类型展示，状态与就绪计数由统一规则派生。
- **FR-2** 支持按名称搜索、按名称/创建时间排序、服务端分页、多选批量删除。
- **FR-3** 详情展示属性与容器镜像，并提供重新部署、编辑 YAML、删除。
- **FR-4** 所有写操作在提交期间给出进行中反馈，成功后刷新列表。

## 成功标准

- **SC-1** 八种负载的列表在 2 秒内给出首屏骨架（数据到达前），不出现空白。
- **SC-2** 区域内切换页签不产生文档请求，P95 ≤ 150 ms（不含数据请求本身）。
- **SC-3** 状态派生与老 console 的 `utils/status.js` 逐分支一致（由单测覆盖）。
- **SC-4** 写操作的目标路径与资源所属 API 组一致（由单测覆盖）。

## 明确不做

- 日志与终端：已交付（`container-detail.md`）。仍需 WebSocket 的只剩 kubectl 代理与节点 shell。
- 列显隐与列宽拖拽：八页共用一张表，先保证列一致。
- 服务与路由的**创建**、路由规则编辑（需要各自的规则编辑器）。
- 任务重跑、容器组重新调度：目标集群没有 operations 模块（实测该组全部 404）。

## 假设

- kapis 的 `totalItems` 是切片前总数，服务端分页每页 10 条。
- 八种负载的读写路径与 API 组由 `packages/api-client/src/resources.ts` 统一决定。
- 对象状态由控制器写入，页面只读。

## 功能点

| 功能点 | 需求 | 技术方案 |
|---|---|---|
| 区域入口与页签切换 | `_index.md` | `_index.md` |
| 列表 | `list.md` | `list.md` |
| 状态派生 | `status.md` | `status.md` |
| 详情 | `detail.md` | `detail.md` |
| 重新部署 | `redeploy.md` | `redeploy.md` |
| 编辑 YAML | `edit-yaml.md` | `edit-yaml.md` |
| 编辑设置 | `edit-settings.md` | `edit-settings.md` |
| 定制编辑表单（镜像/环境变量/拉取策略/副本数） | `edit-form.md` | `edit-form.md` |
| 删除 | `delete.md` | `delete.md` |

## 验收用例

- `TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-03`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-02`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-02`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_YAML-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DELETE-01`

## 服务的端口编辑

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-SERVICES-01** — 已知一个 ClusterIP 服务有端口 80→8080，当在列表看到端口列并用「编辑服务」改为 8080，则 `spec.ports` 只剩一个端口、`port` 为 8080、端口名仍为 `http`；当服务类型是 `ExternalName`，则行操作中不出现「编辑服务」。

## 应用路由的规则编辑

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-INGRESSES-01** — 已知一条应用路由有 `host=old.example.com` 且后端为 `kubernetes:443`，当行操作「编辑路由规则」把域名改为 `new.example.com`，则 `spec.rules[0].host` 更新且后端仍为 `service.port.number=443`。

## 移动端适配

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-MOBILE-01** — 已知在 375×812 视口下，当依次打开全部 20 个已迁移页面（配置、应用负载、存储、监控、项目设置、集群管理、访问控制、平台设置），则每页的文档宽度不超过视口（无横向滚动），且所有可见的按钮与带 `data-ai-id` 的链接均不小于 24×24。

## 列表行操作

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_ACTIONS-01** — 已知一个部署，当打开其行操作菜单，则含「扩缩容」与「重新部署」；当扩缩容改为 3，则 `spec.replicas` 为 3；当重新部署并确认，则模板注解 `kubectl.kubernetes.io/restartedAt` 存在。

## 表单交互

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-FORM_UX-01** — 已知创建表单有必填字段，当在未填写时提交，则焦点移到第一个未通过校验的字段；当提交被服务端拒绝（例如同名对象已存在），则对话框保持打开、在表单内显示失败原因，且用户已填内容不被清空。

## 批量操作

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-BULK-01** — 已知选中两个部署，则批量操作含「批量停止」与「批量删除」，点批量停止并确认后两者的 `spec.replicas` 都为 0（对象仍在）；已知选中一个任务，则批量操作只有「批量删除」；已知批量删除 n 个对象，则确认框要求输入数量 `n`。
