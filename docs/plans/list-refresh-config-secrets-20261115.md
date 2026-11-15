# 列表刷新与空态出口：配置/保密字典、存储、企业空间控制台、监控告警、集群存储十二个页族 · 交付记录 2026-11-15

按[交付模板](page-migration-template.md)记录的完整迁移单元：`configmaps` 与 `secrets` 两个页族（项目级 + 集群级共 4 个列表）的**刷新按钮**与**空态出口**。

## 1. 基线

- 分支 `develop`，起始提交 `803afbf62`；环境 B200 host 集群，BFF :8092 + 前端 :5178，admin。
- 选择依据：能力矩阵 CHECK-08「通用列表、详情结构及公共组件接入」中的 R-26（无刷新按钮）与 R-28（空态无出口）。审计 54 个使用 `ResourceList` 的页面：**0 个提供刷新按钮，3 个提供空态清空出口**；本批先闭环配置/保密字典这一页族（两个资源 × 项目与集群作用域）。

## 2. 原子能力与归宿

| ID | 旧能力 | 新落点 | AC/TC | 结论 |
| --- | --- | --- | --- | --- |
| CFG-01 | 列表刷新（老 console 每个列表都有） | `useListRefresh` → schema.refresh + onRefresh | CONFIGMAPS-LIST-07 / SECRETS-LIST-03 | 本批补齐 |
| CFG-02 | 空态提供出口 | 同一 hook 的 `emptyLabels`（清空搜索与筛选 / 刷新） | 同上 | 本批补齐 |
| CFG-03 | 集群级同名页面 | 集群配置字典 / 集群保密字典同样接入 | 同上（AC 内注明） | 本批补齐 |
| STG-01 | 存储卷与存储卷快照列表刷新与空态出口 | 同一个列表组件随 `kind` 产出 `persistentvolumeclaims:refresh` / `volumesnapshots:refresh` | STORAGE-LIST-05 | 第二批补齐 |
| WS-01 | 企业空间控制台的三个列表（角色/项目/配额）刷新 | 三个页面各持查询，统一 `useListRefresh` | ACCESS_CONTROL-WORKSPACE_LISTS-01 | 第三批补齐 |
| WS-02 | 企业空间用户组树节点的裸 `<button>` 违反 AI 表面契约 | 改用 `Button` 组件（`variant=ghost`），保留行样式与句柄 | 契约套件 1334/1334 | 第三批修复 |
| MON-01 | 监控告警五个页面（项目告警消息/告警策略/自定义监控、集群告警消息/告警策略）刷新 | 各自 `useListRefresh`；集群告警策略两页签聚合为一个刷新源 | MONITORING-LIST_REFRESH-01 | 第四批补齐 |
| MON-02 | 项目自定义监控的空态块自带刷新 | 空态块内的 `project-custom-monitoring:empty:refresh` | 同上 | 第四批补齐 |
| CST-01 | 集群存储五个列表（存储类型/持久卷/集群声明/卷快照/快照类）刷新 | 各自 `useListRefresh`，每页只刷新自己的查询 | CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-01 | 第五批补齐 |
| CCR-01 | 集群服务账号/网络策略/组件/IP 池四个列表刷新 | 各自 `useListRefresh`，刷新保留筛选与排序 | CLUSTER_MANAGEMENT-CLUSTER_CONFIG_LISTS_REFRESH-01 | 第六批补齐 |
| ACL-01 | 平台用户、集群成员、集群、联邦项目列表刷新 | 三页接入 hook；集群列表沿用其内联刷新 | ACCESS_CONTROL-ACCESS_LISTS_REFRESH-01 | 第七批补齐 |
| PS-01 | 项目成员、项目角色、网络策略列表刷新 | 成员/角色共用 `SettingsListPage`，句柄随 kind；网络策略页只刷新策略列表 | PROJECT_SETTINGS-SETTINGS_LISTS_REFRESH-01 | 第八批补齐 |
| AS-01 | 企业空间应用与仓库列表刷新 | 仓库页补齐 schema 的 refresh 条目（原本只有 onRefresh，按钮因此不渲染）；商店管理页保留其页面级刷新 | APP_STORE-APPSTORE_LISTS_REFRESH-01 | 第九批补齐 |
| CR-01 | 自定义资源列表 + 某个 CRD 的实例列表刷新 | 两层各自 `useListRefresh`，实例页只刷新当前 CRD | CLUSTER_MANAGEMENT-CUSTOM_RESOURCES_REFRESH-01 | 第十批补齐 |
| AGG-01 | 聚合型列表：集群资源监控（指标+归属两个来源）、企业空间用户组（树+成员）、企业空间成员详情（四个查询一起失效） | 聚合刷新源；成员详情的表用 `invalidateQueries()` 并放弃忙碌态（schema memo 不随 loading 重建） | PROJECT_SETTINGS-AGGREGATE_LISTS_REFRESH-01 | 第十二批补齐 |
| RST-01 | 其余六页：DevOps 工程 / JuiceFS 卷 / 集群自定义监控 / 灰度发布 / 镜像构建器 / 项目服务账号 | 各自 `useListRefresh`；JuiceFS 的按钮随「卷」页签 | CLUSTER_MANAGEMENT-REMAINING_LISTS_REFRESH-01 | 第十一批补齐 |

## 3. 实现

- 新增 `@/components/resource/useListRefresh`：一次给出 `refresh`（含 aiId 前缀与 `busy`）与 `onRefresh`，页面无法只接一半（`ResourceList` 只在两者都在时渲染按钮）；`busy` 取查询自身的 `isFetching`，因此后台重取也会反映在按钮上。
- 接入页面：`configmaps/ConfigMapsPage.tsx`、`secrets/SecretsPage.tsx`、`cluster/ClusterConfigMapsPage.tsx`、`cluster/ClusterSecretsPage.tsx`。
- 空态文案复用既有 `table.clearSearchAndFilters` 与 `common.refresh`，不新造说法。

## 4. 验证

| 范围 | 命令 | 结果 |
| --- | --- | --- |
| 应用单测 | `console-next: vitest run` | 179 passed |
| 显式类型检查 | `console-next: tsc --noEmit` | 0 error |
| 构建 | `console-next: vite build` | ✓ built |
| 严格规格门禁 | `check_docs.py --strict` | errors=0 warnings=0 |
| E2E（`-n 0`） | CONFIGMAPS-LIST-01/07、SECRETS-LIST-01/03、CLUSTER_CONFIG-01 | 5 passed |
| 契约套件 | `npx vitest run --config config/vitest.config.ts` | 1333 passed / 1 failed（既有基线：WorkspaceUserGroupsPage 裸 button） |

实测：在页面之外新建 ConfigMap/Secret 后点击刷新，新行出现；搜索不存在名称进入空态，分别用「清空搜索与筛选」「刷新」两个出口回到有数据的列表。

## 5. 视觉

1024/1280/1600 无横向滚动；刷新按钮与搜索框同排，忙碌时按钮禁用。截图：`/tmp/configmaps-refresh.png`、`/tmp/secrets-refresh.png`。

## 6. 遗留（同能力、其他页族）

**过程发现**：企业空间控制台的 schema memo 依赖数组不包含查询的 `isFetching`，导致「刷新」按钮在首帧抓到 `busy=true` 后永久禁用；已把 `query.isFetching` 加入三个页面的依赖数组，并把「按钮必须可用」写进用例断言（正是这类 bug 的指纹）。

**又一个真 bug**：`useListRefresh` 的 `busy` 进入 schema，若页面的 useMemo 依赖不包含 `isFetching`，「刷新」按钮会永久禁用——企业空间控制台与监控告警两批都踩到，已在两个页族把「按钮必须可用」写成断言。

刷新能力已覆盖全部带列表的页面（12 个页族 / 约 56 个列表）。

审计显示其余约 21 个列表仍未接入刷新，按页族分批推进（每族一个单元、一次闭环）：工作负载、集群资源（节点/组件/网关/IP 池）、监控与告警、访问控制、应用商店与 DevOps。存储页族的项目级两页（存储卷、存储卷快照）已在第二批完成。面板型列表（行数据由父级传入）没有自己的查询，刷新应在其父页面上接入，单独归类。
