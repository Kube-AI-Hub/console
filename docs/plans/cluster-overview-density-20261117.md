# 集群概览密度与节点块布局

> **本批交付证据。** 记录 2026-11-17 的两项视觉调整（节点块铺满、信息块行式属性表）及其验收范围；
> 不代表全站、生产或 member 集群已验收。

## 范围与用户要求

在 `http://localhost:5178/kube-frontend/clusters/host/overview`（5178 静态构建 + 8092 BFF 读 B200）：

1. 调整「节点数」block 与「节点资源用量 Top 5」的布局协调性，避免块内中间留空。
2. 调整「基本信息」与「Kubernetes 状态」block，让字段名称与值更容易区分，并提高信息密度。
3. 整体复核集群概览，使其适合作为产品智算管理的概览页。

列宽比例（1:2）与「节点块左边界/宽度与基本信息一致」是既有 AC-07 与 TC-06 的约束，本轮**不改变**；
节点块只重排块内结构。信息块改为行式属性表（用户确认的形态）。

## 实现

### 共享组件（`console/packages/ai-kit`）

- `DescriptionList` 新增 `variant?: 'default' | 'dense'` 与 `divided?: boolean`。
  - `dense` 在父级 `<dl>` 上同时改字号与颜色：`[&>dt]:text-xs [&>dt]:tracking-wide [&>dt]:text-ai-fg-muted`、
    `[&>dd]:text-sm [&>dd]:text-ai-fg`（12px 标签 vs 14px 值）。
  - `divided` 用 `nth-child` 边界在每行之间画 1px `border-ai-line`，首行不加（避免与面板头部边框叠成双线）。
  - 两列从 `sm` 起生效，标签列 `minmax(4.5rem, 8rem)`；`<sm` 堆叠。
  - 单元格用 `items-start` 而不是 `items-baseline`：分隔线画在标签与值两个单元格上，
    基线对齐会让两半的顶边错开（实测标签的边框比值的低 2.5px），一行因此断成两段。
    网格行起点对齐后两半首尾相接，且值换行时标签仍停在首行，符合属性表读法。
- `Panel` 新增可选 `icon`、`titleLevel`（默认 3）、`headerClassName`、`bodyClassName`。
- `@kube-ai-hub/ui` barrel 导出 `Panel` / `PanelProps`——此前未导出，这正是概览页复制了一份的原因。

样式挂在 `<dl>` 而不是给 `DescriptionItem` 加 prop：该组件只渲染裸 `dt`/`dd` 片段（既有测试
`renders DescriptionItem as a bare dt/dd fragment` 锁定），所以父级选择器覆盖全部行，
24 处既有详情页调用点零改动。

### 页面（`apps/console-next/src/pages/cluster`）

- `ClusterOverviewPage.tsx`：删除页面内 `function Panel`，改用共享 `Panel`（`icon` + `titleLevel={2}`）。
  `BasicInfoPanel` 与 `KubernetesStatusPanel` 改为 `<DescriptionList variant="dense" divided />`；
  状态徽标与就绪消息、可见性短标签与说明都并入值节点，保留全部 `aiId`。
- `OverviewResourcePanel.tsx`：拆出 `NodeSummaryPanel`（原先靠 `nodeOnly` 分支复用同一个组件）。
  面板 `flex h-full flex-col`，头部 `min-h-[3.75rem]`，正文 `flex-1`；块内环图在左、就绪/总量数字在右，
  作为一组 `items-center` 垂直居中，环心显示就绪率，数字下方是进度条。动作只有「查看全部节点」链接。
- `NodeRankingPanel.tsx`：preview 分支改用共享 `Panel`，头部与节点块同一个下限，两块基线一致。
- `OverviewComponents.tsx`：改用共享 `Panel`；条目改为 `flex` + `truncate`，计数右对齐。
- `ModulesPanel`：标题右侧显示「已启用/总数」，chip 间距收到 `gap-1.5`，未启用组加分隔线。

## 验收

### 数据与功能（未削减）

- OVERVIEW-01 至 09 全部通过（10 条含新增 10），串行 53.27 秒：字段与接口对账、九维 Top5、
  真实历史采样、受控时钟刷新、kubectl 一键终端均未改变。
- 关联 NODE_USAGE / COMPONENTS / COMPONENT_DETAIL / KUBECTL 共 6 条通过。
- 新增 OVERVIEW-10（本批镜像用例）：断言两块均为两列属性表、标签字号小于值字号、标签与值不同色、
  标签列与值列起点一致、标签行盒数为 1、行分隔线只出现在第二行起、标签与值的分隔线上边界在同一 y
  （贯穿两列）、节点块头部与排行头部高度差 <2px、块内按钮数为 0、环图与数字组垂直居中偏差 <4px、
  就绪率只出现一次、三档无横向溢出、深浅主题可区分。

### 高度（1600 档实测）

| 区块 | 改动前 | 改动后 |
| --- | --- | --- |
| 基本信息 | 614px | 426px |
| Kubernetes 状态 | 222px | 261px（五字段改单列行式） |
| 两块合计 | 852px | 703px（含 16px 间距） |

信息块单列堆叠改成两列行式后，八行字段的**逐行**高度从 20px 标签 + 20px 值 + 12px 间距降到 37px 一行，
同一屏可读字段更多；Kubernetes 状态从 2×3 网格改成五行，右列空槽消失。

### 视觉（三档 + 深浅 + 中英）

- 1024 / 1280 / 1600 三档全页截图核对：无横向溢出，标签不换行，节点块与排行头部等高，
  左列（基本信息/Kubernetes 状态）与节点块左边界及宽度一致（偏差 <2px）。
- 深色与浅色主题下标签/值仍可区分；中英文截图中标签列宽不变、值换行而非溢出。
- 计算色（深色）：标签 `rgb(201 225 243)` 11px，值 `rgb(222 235 246)` 13px，面板底 `rgb(44 58 124)`。

### 门禁与静态检查

- `check_docs.py --strict prd/kube-frontend design/kube-frontend`：`errors=0 warnings=0`。
- `catalog.yaml`、`tests/ui/cases/**`、`_traceability.md` 由 `build_prd.py` / `generate_case_docs.py` 重新生成（435 份）。
- 应用 `typecheck`、`ui` / `ai-surface` / `locales` 包 `typecheck` 通过；应用构建通过；
  ai-kit `tsc --noEmit`、Storybook 构建通过。
- `config` 契约测试 1482 条中 1481 通过；`config/overview-parity-contract.test.ts` 新增一条
  「概览用共享 Panel 与 dense 属性表、页面内不得再有 `function Panel`」的护栏。
- 应用单测 191 条中 189 通过；新增 ai-kit DescriptionList dense/divided 3 条与 Panel 4 条全部通过。

## 已知基线（与本批无关，未修复）

- `config/ai-surface-contract.test.ts` 失败于未修改的 `KubectlPage.tsx`（缺 retry 路径）；
  该失败在 2026-11-17 之前的历史记录中已存在。
- 应用单测 `gpu-parity` 与 `configmaps-page` 两条失败：前者要求 stats 查询串为空、后者断言未命中，
  均指向未修改的页面与既有夹具。
- `packages/api-client` 全量 `typecheck` 仍有既有 `exactOptionalPropertyTypes` 夹具错误
  （`workspace-groups.test.ts`）。
- ai-kit 全量单测有既有重复 React 运行时导致的 `Dropdown` 用例失败（`use-callback-ref` 自带 React）。

## 边界

- 未部署生产、未验收真实 member 集群、未跑全站串行 E2E。
- 截图中的集群属性、节点数与用量是采集时的实时状态，不是代码写入。
- 未新增后端字段或指标；本轮只改展示层与共享组件可选属性。

## 截图

- 改动前 1600：`assets/overview-dense-20261117/before-1600.png`
- 改动后 1600 / 1280 / 1024：`overview-dense-{1600,1280,1024}.png`
- 深浅主题信息块：`info-1280.png`、`info-1280-light.png`
- 节点块（环图左置）：`node-ring-left-v2.png`
- E2E 自动截图见 `tests/ui/artifacts/test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_10[chromium]/`。
