# 智算平台 · 产品需求

本目录是产品行为的**唯一上游**，由**产品经理维护 Markdown**。每份需求独立写清概述、设计目标、架构与交互，**不引用、不摘抄产品手册**。

> **SDD 入口** → [`../docs/SDD.md`](../docs/SDD.md)。技术方案在同级 [`../design/`](../design/)，用例在 [`../tests/`](../tests/)。三者用同一套后缀 ID 互相钉住，门禁是 `python3 prd/tools/check_docs.py`。

## 三级

| 级别 | 需求文档 | 技术方案 | 用例套件 | 说明 |
|------|----------|----------|----------|------|
| L1 模块 | `{模块}/_index.md` | `../design/{模块}/_index.md` | `core`（`TC-CORE-*`） | 模块定位、对象模型与核心路径验收 |
| L2 子模块 | `{模块}/{子}/_index.md` | `../design/{模块}/{子}/_index.md` | `full`（`TC-FULL-*`） | 一页，或一条跨多个关联页面的流程 |
| L3 功能点 | `{模块}/{子}/{功能}.md` | `../design/{模块}/{子}/{功能}.md` | `point`（`TC-L3-*`） | 一个控件，或一项页面上不直接露出的能力 |

固定章节：**概述 → 用户故事 → 验收场景 → 设计目标 → 约束与边界 → UI 交互设计 → 规则/结构 → 边界情况 → 功能需求 → 成功标准 → 明确不做 → 假设 → 验收用例**。L1 的「规则/结构」位放 `入口与子模块 / 状态`，L2 放 `页面结构 / 异常态`，L3 放 `文案与校验 / 边界情况`。

- **概述**：谁用、从哪个入口、做哪几步、看到什么。
- **用户故事**：`US1..USn`，每条写清谁、从哪个入口、做哪几步、看到什么。`Independent Test` 写可重复的步骤。不要用「完成主路径」这类套话代替。
- **验收场景**：`AC-*`，逐条 Given/When/Then；用例的 `covers` 指到这里。
- **设计目标**：为什么这样做、成功长什么样、迭代时不得丢掉的不变量。
- **约束与边界**：对象与生命周期、读写接口、权限、与相邻模块的边界。跨模块能力须有 Mermaid 图。
- **UI 交互设计**：页面地图、默认值、校验、异常态。**可见性要求写进验收场景**：文字与背景对比度、单位、空态。
- **功能需求**：`FR-*`，MUST 句式。
- **成功标准**：`SC-*`，可度量。
- **明确不做**：每个功能点都要有。

## ID 规则

`AC`/`FR`/`SC` 全局唯一，且**后缀与用例 ID 共享**（`TC-` 换前缀）：

| 类型 | 形态 | 例（对应用例 `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01`） |
|------|------|--------------------------------------------------|
| 验收场景 | `AC-<用例 ID 去掉 TC->` | `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01` |
| 功能需求 | `FR-<同上>` | `FR-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01` |
| 成功标准 | `SC-<同上>` | `SC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01` |

`AC` 一行一条，生成器按此格式取值：

```markdown
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01** — Given 已登录，When 打开配额表单，Then 初始值等于当前配额。
```

**一个 ID 只有一种拼写。** 分隔符由路径决定，不是随手写的：

| 段 | 分隔符 | 来源 | 例 |
|---|---|---|---|
| 层级 | `-` | `CORE` / `FULL` / `L2` / `L3` | `TC-L3-` |
| 模块 | `-` | `specs/` 下的模块目录链 | `cluster-storage` → `CLUSTER-STORAGE` |
| 子模块、特性 | `_` | `submodule` / `feature` 字段 | `shared-storage` → `SHARED_STORAGE` |

各段之间用 `-` 连接：`TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01`。

写成 `TC-L3-CLUSTER_STORAGE-...`（模块用了 `_`）或 `TC-L3-...-SHARED-STORAGE-...`（特性用了 `-`）都会被 `check_docs.py` 报出来。这不只是格式偏好：两种拼写并存的直接后果是同一条 `AC` 被当成两条——需求稿里那条显示「没有被任何用例覆盖」，而覆盖它的用例就在隔壁目录。

`check_id_spelling` 负责这条检查，报错会给出应写的完整 ID。

## 平台级约束（必须保留）

| 主题 | 必须保住的目标 |
|------|----------------|
| 集群上下文 | 页面都在 `/clusters/:cluster` 下；接口路径按 `globals.app.isMultiCluster` 加 `clusters/<id>` 前缀 |
| 权限 | 菜单项按 `clusterNavs` 的 `authKey`/`authAction` 控制；写操作需要 `volumes:manage` 一类权限 |
| 主题 | 深色主题，颜色只取语义 token（见宪法 C3） |
| 指标 | 只经 monitoring kapis，单位与语义必须一致（见宪法 C4） |

改这些约束等于改产品方向，需要在 L1 写清新目标、新图、迁移与兼容。

## 产品经理怎么改

1. 改对应 Markdown（模块 / 子模块 / 功能点）。**保留**「设计目标」「约束与边界」和已有 Mermaid 图。
2. 同步 `tests/ui/specs/{module}/{sub}/TC-*.yaml`（补 `covers` 与 `story`）与同级 [`../design/`](../design/) 的技术方案（`## 关联需求` 承接 AC）。
3. 跑门禁：`python3 prd/tools/check_docs.py --strict`，再 `cd tests/ui && python3 generate_case_docs.py`。

新增模块/子模块/功能点：先改 [`tools/tree.py`](tools/tree.py)，再跑生成器**补齐缺失文件**（默认不覆盖已有 Markdown）。

## 模板

三级的需求稿分别从 [`templates/L1-module.md`](templates/L1-module.md)、[`templates/L2-submodule.md`](templates/L2-submodule.md)、[`templates/L3-feature.md`](templates/L3-feature.md) 起手。复制后要改什么（标题、上级链接、入口路由、AC 后缀、i18n 文案表）见 [`templates/README.md`](templates/README.md)。

## 写需求时的自检

- [ ] 「设计目标」写了为什么，而不只是控件叫什么。
- [ ] 「约束与边界」写了对象落在哪、列表按什么过滤、和相邻模块的边界。
- [ ] 跨模块变化有 Mermaid 图。
- [ ] 每条 `AC-*` 至少有一条用例覆盖它、一份技术方案承接它；每条 `US<n>` 至少有一条用例的 `story` 引用它。
- [ ] **可见性写成了可测的验收**：对比度阈值、单位、空态文案，而不是「看起来清楚」。
- [ ] 「明确不做」仍在。
