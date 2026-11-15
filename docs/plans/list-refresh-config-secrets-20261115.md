# 列表刷新与空态出口：配置/保密字典页族 + 存储页族 · 交付记录 2026-11-15

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

审计显示其余约 48 个列表仍未接入刷新，按页族分批推进（每族一个单元、一次闭环）：工作负载、集群资源（节点/组件/网关/IP 池）、监控与告警、访问控制、应用商店与 DevOps。存储页族的项目级两页（存储卷、存储卷快照）已在第二批完成。面板型列表（行数据由父级传入）没有自己的查询，刷新应在其父页面上接入，单独归类。
