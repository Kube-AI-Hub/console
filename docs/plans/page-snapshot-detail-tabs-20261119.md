# 存储快照详情页签（2026-11-19）

> 本页记录：快照对象详情补回旧 console 的「数据来源 / 事件」两个页签。方法见[迁移指南](../legacy-ui-migration-guide.md)，
> 模板见[单页交付模板](page-migration-template.md)。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 项目作用域：打开一个快照，回答「它从哪个声明来的、为什么还没就绪」 |
| 旧入口、源码 | `VolumeSnapshots/Detail/routes.js` 的 `source`（默认）与 `event` 两个路由；`Detail/index.jsx` 的属性区 |
| 新入口、构建 | `apps/console-next/src/pages/storage/StorageDetailPage.tsx` 的快照分支：由单列改为两个页签（`volumesnapshots-detail:tab:source` / `:tab:events`） |
| 环境、集群、角色 | mlu370 `https://ka.watering.ai` + 本地 preview 5178；admin |
| 子页面与状态范围 | 数据来源（属性）/ 事件（表或空态）；加载/失败沿用页面既有分支 |
| 明确排除及批准 | 快照不增加「元数据」页签（沿用 PRD：元数据由快照页签与 YAML 覆盖）；写操作仍只在列表与详情头 |
| 并行文件与安全边界 | 只改该页、locale、该功能 PRD/design/spec/tests 与记录；E2E 自建唯一命名快照并删除 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码证据 | 显示条件 | 字段/动作 | 归宿 | 新 AC/用例 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-SNAPSHOT-DETAIL-001 | `routes.js` 的 `source` 为 index 路由 | 始终 | 默认停在「数据来源」 | 页签 `source` 默认选中 | AC-STORAGE-DETAIL_TABS-02 / TC-02 | 通过 |
| LEG-SNAPSHOT-DETAIL-002 | `Detail/index.jsx` 属性区 | 始终 | 来源声明、快照类型、容量、状态等 | 数据来源页签内的属性区 | 同上 | 通过 |
| LEG-SNAPSHOT-DETAIL-003 | `routes.js` 的 `event` | 始终 | 该快照的事件（类型/原因/消息/次数/最近发生） | 事件页签（`storage-detail:events` 表 / `:events-empty` 空态） | 同上 | 通过 |
| LEG-SNAPSHOT-DETAIL-004 | 老页事件空态 | 无事件 | 空态说明 | 「这个对象还没有事件。」 | 同上 | 通过 |

## 3. 数据契约与全链路

| 能力 ID | 请求 | 返回类型 | 字段 | 显示 | 缺值规则 | 对账 |
| --- | --- | --- | --- | --- | --- | --- |
| 001–004 | 快照对象读（`volumesnapshotsApi.get`）+ 事件读（`useObjectEvents(kind='VolumeSnapshot')`） | JSON | `spec.source.persistentVolumeClaimName`、`status`、`spec.volumeSnapshotClassName`；事件 `type/reason/message/count/lastSeen` | 属性行 + 事件表 | 事件为空显示空态句；快照未就绪时 `status` 显示原值（不填 0） | 事件查询本来就按 kind 取，补页签不增加请求 |

## 4. 交互、视觉与复用基线

- 页签顺序：数据来源 → 事件（旧页顺序）；默认数据来源。
- 事件表列：类型 / 原因 / 消息 / 次数 / 最近发生（与存储卷事件页签同一组件）。
- 复用 ai-kit `Tabs` 与页面既有 `EventsPanel`；不新增公共组件。

## 5. 编码与回归

- [x] 快照分支由单列改为两页签；属性区块复用同一份 `attributes`，不复制。
- [x] AC/design 更新（并改正 PRD 里「快照详情不增加事件页签」的旧结论）。
- [x] E2E 自建快照（引用不存在的声明即可创建对象），断言两个页签、默认数据来源、事件表或空态；结束删除。
- [x] 存储详情相关既有用例同批复跑。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 4 条原子 ID | — |
| 数据语义 | 通过 | 事件按 `VolumeSnapshot` kind 读；空态与有事件分开 | — |
| 交互与权限 | 通过 | 只读；写入口不变 | — |
| 视觉与主题 | 部分通过 | 1280 深色截图（`snapshot-detail-events`） | 1024/1600、浅色、英文 |
| 静态/类型/构建/测试 | 通过 | typecheck 0；build；strict 门禁 0/0 | — |
| 本地全栈/mlu370 | 通过 | E2E 见 §7 | — |
| 新版部署/member/全站 | 未验收 | — | 生产、member、全站串行 E2E |

## 7. E2E（mlu370，`-n 0`）

| 用例 | 结果 |
| --- | --- |
| TC-…-STORAGE-DETAIL_TABS-02（新增，自建快照） | 通过（3.32s） |
| 存储 DETAIL 相关既有用例（PVC 详情四页签等） | 通过 |

命令：`pytest tests/kube-frontend/storage -q -n 0 -k "DETAIL"` → **5 passed, 17 deselected in 13.79s**。
