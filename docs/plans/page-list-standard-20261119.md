# 列表页交互标准化（2026-11-19）

> 本页记录：把节点列表的四项交互标准推广到其余列表页，并补回集群级工作负载页在并行提交中丢失的项目筛选与行操作。
> 方法见[迁移指南](../legacy-ui-migration-guide.md)，模板见[单页交付模板](page-migration-template.md)。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 全站列表：项目/集群/企业空间/平台作用域 |
| 参考页 | `pages/cluster/NodesPage.tsx`（固定首尾列、列头字段筛选、列头说明、刷新遮罩、清除全部条件、主操作在列表动作区） |
| 旧实现对照 | `console/src/pages/projects/containers/*/index.jsx`、`console/src/components/Tables/List`、`utils/constants.js` 的状态词表 |
| 新入口、构建 | `kube-frontend/apps/console-next/src/pages/**`、`components/resource/useListRefresh.ts`；构建 `assets/index-Dq2erOh7.js` |
| 环境、集群、角色 | mlu370 后端（经本地 preview `http://127.0.0.1:5180`），`host` 集群，admin |
| 视口、主题、语言 | 1280×900 与 700/760/900 窄视口；**深色与浅色**；**中文与英文** |
| 子页面与状态范围 | 列表的加载/刷新/空/无匹配/错误五态；行操作菜单；列选择器；列头筛选浮层 |
| 明确排除及批准 | 面板型表格（`NodeRankingPanel` / `NodeResourcesPanel` / `GpuPodsPanel`）不套用工具栏与固定列规则：它们嵌在卡片里，没有独立行身份 |
| 并行文件与安全边界 | 只改前端页面、共享 hook、locales、契约与文档；E2E 建唯一命名对象并删除 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件 | 字段、动作、默认项与完整选项 | 归宿 | 新 AC/用例 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-LIST-001 | 老列表 `Table` 的固定列 | 始终 | 横向滚动时首列固定 | `ListColumn.pin='start'` + 显式宽度 | LIST_STANDARD-01 / TC-01 | 通过 |
| LEG-LIST-002 | 老列表行操作菜单 | 始终 | 行操作列贴右 | `ResourceList` 自动 `pin='end'` | LIST_STANDARD-01 / TC-01 | 通过 |
| LEG-LIST-003 | 老列表 `getFilteredValue` 列筛选 | 列可筛 | 状态/类型等字段在列头筛选 | `ListFilter.column` | LIST_STANDARD-03 / TC-02 | 通过 |
| LEG-LIST-004 | `utils/constants.js` `WORKLOAD_STATUS` / `JOB_STATUS` / `PODS_STATUS` / `CRONJOB_STATUS` | 按资源类型 | 各类型状态词表 | `WorkloadDescriptor.statusFilter` 按类型声明 | LIST_STANDARD-03 / TC-02 | 通过 |
| LEG-LIST-005 | 老列表刷新 | 始终 | 刷新当前条件 | `useListRefresh`（含 `refreshing`） | LIST_STANDARD-02 / TC-01 | 通过 |
| LEG-LIST-006 | 老 console 列表无「清除全部」 | — | — | 新增：`filterLabels.clearFilters` | LIST_STANDARD-03 / TC-02 | 新增能力 |
| LEG-LIST-007 | 节点列表列头 tooltip | 可选字段 | 单位与口径说明 | `ListColumn.hint` | LIST_STANDARD-04 / TC-02 | 通过 |
| LEG-CLUSTER-WL-001 | `Workload/Deployments/index.jsx` 项目下拉 | 始终 | 按项目筛选 | 恢复 `useProjectFilter` + `namespace` 参数 | CLUSTER_WORKLOADS-03 / TC-03 | 通过（修复回归） |
| LEG-CLUSTER-WL-002 | 同上 行操作 | 非联邦行 | 编辑信息 | `editInfo` + `EditInfoDialog`（按行命名空间） | CLUSTER_WORKLOADS-03 / TC-03 | 通过（修复回归） |
| LEG-CLUSTER-WL-003 | 同上 | 非联邦行 | 编辑 YAML | `editYaml` + 懒加载编辑器 | CLUSTER_WORKLOADS-03 / TC-03 | 通过（修复回归） |
| LEG-CLUSTER-WL-004 | 同上 | 非联邦行 | 删除（输入名称确认） | `delete` + `DeleteDialog` | CLUSTER_WORKLOADS-03 / TC-03 | 通过（修复回归） |
| LEG-CLUSTER-WL-005 | 同上 | 有勾选 | 批量删除（按项目分组） | `bulk-delete` + 按命名空间分组 | CLUSTER_WORKLOADS-03 / TC-03 | 通过（修复回归） |
| LEG-CLUSTER-WL-006 | `isFedManaged` | 联邦托管 | 行操作收敛 | `visible: (row) => !row.federated` | CLUSTER_WORKLOADS-03 / TC-03 | 通过（修复回归） |

**页面级状态分支**：列表五态（loading / refreshing / ready / empty / no-match / error）各页由 `AiSurface` + `ResourceList` 统一发布；无匹配与真空态文案不同（`narrowed`）。

## 3. 数据契约与全链路

| 能力 ID | 请求路径/版本/作用域/参数 | 返回类型 | 字段或指标 | 原单位→显示 | 映射→页面 | 缺值规则 | 同次对账 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 001–002 | 无（纯渲染） | — | `position: sticky` / `--ai-pin-start|end` | — | 首尾列 | — | `getBoundingClientRect` 两次滚动位置差值 < 2px |
| 003–004 | `GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/<kind>?status=<v>` | JSON | `status` | — | 列头筛选 → 请求参数 | 未知值返回 0 行（实测部署/任务/定时任务/容器组） | 选「已停止」得 0 行 + 「没有匹配的结果」 |
| 005 | 同列表读 | JSON | `isFetching` / `isPending` | — | `refreshing` 遮罩 | 首次加载走骨架 | 遮罩可见 + `aria-busy=true` + 行数不变 |
| LEG-CLUSTER-WL-001 | `GET …/<kind>?namespace=<项目|空>` | JSON | `items`/`total` | — | 列表 + 分页 | 空 = 跨项目 | namespace 进 queryKey |
| LEG-CLUSTER-WL-002 | `PATCH …/namespaces/<行ns>/<kind>/<name>` | JSON | 注解 | — | 对话框 | 清空键发 null | E2E 回读 `kubesphere.io/description` |
| LEG-CLUSTER-WL-004–005 | `DELETE …/namespaces/<行ns>/<kind>/<name>`（批量按项目分组） | JSON | — | — | 删除确认 | 按行命名空间 | E2E 确认对象从列表与集合消失 |

## 4. 交互、视觉与复用基线

- 工具栏顺序：跨字段筛选 → 搜索 → 显示列（图标）→ 刷新 → 清除全部条件 → 右对齐批量动作与主操作。
- 固定首列背景（`--ai-pin-start`）比普通行更突出；固定尾列（`--ai-pin-end`）仅略突出；表头与相邻表头同色。
- 列头说明按钮 24px 盒子，悬浮与聚焦均显示，点击不触发排序。
- 状态筛选从工具栏移到状态列头；选项按资源类型给出（部署 3 项、任务 3 项、定时任务 2 项、容器组 4 项）。

## 5. 编码与回归

- [x] AC/design/spec/tests 同步；`generate_case_docs.py` 重跑（510 篇）。
- [x] 契约：新增 `config/list-standard-contract.test.ts`（5 条，含面板豁免与「守卫本身匹配到页面」自检）。
- [x] 单测：console-next 320 passed；架构契约 1634 passed；api-client 496 passed（5 条 node 相关失败为既有基线，已在 stash 后复现）。
- [x] 显式类型检查：`@kube-ai-hub/console-next`、`@kube-ai-hub/api-client` 均 0 error。
- [x] 构建：`pnpm build` 成功，served asset 哈希与 `dist/index.html` 一致（`index-Dq2erOh7.js`）。
- [x] E2E（串行 `-n 0`，`KA_APP_URL=http://127.0.0.1:5180`）：`CLUSTER_WORKLOADS-01/02/03` 3 passed；`LIST_STANDARD-01/02` 2 passed；`APP_WORKLOADS STATUS_01/02`、`SERVICES_01`、`GRAY_RELEASE_02` 单跑 4 passed。
- [x] 文档门禁：`check_docs.py --strict` 全量 errors=0 warnings=0。
- [ ] 全站串行 E2E（`pytest tests/kube-frontend -n 0`）未跑：本次为共享层改动，已按受影响的页族串行跑过，全站判定留给发布前。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 13 条原子 ID（含 1 条新增能力）；集群级负载 6 条为修复回归 | — |
| 数据语义 | 通过 | 状态筛选按 getter 词表；写按行命名空间；E2E 回读 | 未知状态值在其它 getter 上的行为只实测了 4 类 |
| 交互与权限 | 部分通过 | 固定列/刷新遮罩/列头筛选/清除全部条件均实测；联邦行无操作 | 真实非 admin 403 分支未在部署验证 |
| 视觉与主题 | 部分通过 | 深色 + 浅色主题实测：深色固定首列 `rgb(44,58,124)`、浅色 `rgb(225,219,240)`，文字 `rgb(31,44,106)` 均可读；表头与相邻表头同色；中文 + 英文表头/提示标签均正确（`环境/screenshots/list-standard-*.png`） | 绿色色调、1600 全页、其余列表页逐页截图未做 |
| 静态/类型/构建/测试 | 通过 | 见 §5；api-client 5 条基线失败已用 stash 复现 | — |
| 本地全栈 | 通过 | mlu370 后端 + preview 5180 | — |
| 新版部署/member/全站 | 未执行 | — | B200 部署、member 集群、全站串行 E2E |

### 本批修复的回归

集群级工作负载页（`ClusterWorkloadsPage.tsx`）在并行提交中丢失了整块「按项目筛选 + 四个行操作 + 批量删除」，文档（`docs/plans/page-cluster-workloads-writes-20261119.md`）与 E2E（`CLUSTER_WORKLOADS-03`）都还写着它存在。修复前 `CLUSTER_WORKLOADS-03` 在 `cluster-deployments:filter:project` 上 30s 超时；修复后 3 条串行通过。

这类「页面还在、能力整块消失」的问题现在由 `config/list-standard-contract.test.ts` 的接线检查部分兜住（固定列/刷新/清除全部条件），但页面级动作块仍只能靠 E2E 发现，已在能力矩阵登记。
