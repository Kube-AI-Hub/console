# 智算平台 · 技术方案

本目录是**技术方案的正文**，与 [`../prd/`](../prd/)（需求）和 [`../tests/`](../tests/)（用例）平齐，形状也一致。三份文档用同一套后缀 ID 互相钉住。

```
prd      L1/L2/L3 需求        AC-*      做什么、验收是什么
design   L1/L2/L3 技术方案    DES/DEC/CON/INV/GOT   为什么这么实现
tests    L1/L2/L3 用例        TC-*      怎么验证
```

## 分层

| 级别 | 需求 | 技术方案 | 用例套件 | 技术方案回答什么 |
|------|------|----------|----------|------------------|
| L1 模块 | `prd/{模块}/_index.md` | `design/{模块}/_index.md` | `core` | 前端路由与菜单落点、后端 group、数据归属、共享契约 |
| L2 子模块 | `prd/{模块}/{子}/_index.md` | `design/{模块}/{子}/_index.md` | `full` | 页面结构、状态与数据流、依赖与风险 |
| L3 功能点 | `prd/{模块}/{子}/{功能}.md` | `design/{模块}/{子}/{功能}.md` | `point` | 决策（含被否方案）、契约、不变量、已知坑 |

## 仓库落点（每个 L3 必写）

智算平台横跨两个仓库，技术方案必须写清「改哪里」：

```markdown
## 仓库落点

| 层 | 路径 |
| --- | --- |
| 页面 | `console/src/pages/...` |
| 状态 | `console/src/stores/...` |
| 接口 | `kube-server/pkg/kapis/<group>/v1alpha1/...` |
| 指标 | `kube-server/pkg/models/monitoring/named_metrics.go` |
```

## ID 规则

| 类型 | 形态 | 例（对应用例 `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01`） |
|------|------|--------------------------------------------------|
| 技术方案文档 | `DES-<用例 ID 去掉 TC->` | `DES-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA` |
| 设计决策 | `DEC-<同上>-<NN>` | `DEC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01` |
| 对外契约 | `CON-<同上>-<NN>` | `CON-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01` |
| 不变量 | `INV-<同上>-<NN>` | `INV-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01` |
| 已知坑 | `GOT-<同上>-<NN>` | `GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01` |

L1/L2 用该层用例 ID 的同后缀：`TC-CORE-CLUSTER_STORAGE-01` → `DES-L1-CLUSTER-STORAGE`。

**编号由用例 ID 机械推导**（`prd/tools/build_prd.py` 的 `design_id_for`），不要手工造。本仓库用例 ID **含下划线**，推导时用**前缀替换**而不是 slugify。

## 关联需求（`covers`）

技术方案用 `## 关联需求` 一节把需求接上。**必须是反引号包起来的 AC ID，一条一行**：

```markdown
## 关联需求

- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01`
```

规则：本功能点需求里的**每条 `AC-*` 都必须被技术方案承接**；`关联需求` 里出现的每个 AC 都必须真实存在于同一份需求文件。

## 章节顺序

- **L3**：概述 → 关联需求 → 设计目标与非目标 → 关键约束 → 方案决策 → 系统现状 → 仓库落点 → 对外契约 → 不变量 → 已知坑 → 测试与可观测 → 后续改进 → 验收用例
- **L2**：概述 → 关联需求 → 设计目标与非目标 → 关键约束 → 页面与技术结构 → 状态与数据归属 → 关键契约与依赖 → 不变量 → 已知坑 → 测试与可观测 → 明确不做 → 后续改进 → 功能点 → 验收用例
- **L1**：概述 → 关联需求 → 设计目标与非目标 → 运行时拓扑 → 模块边界与仓库落点 → 数据归属 → 关键共享契约 → 不变量 → 已知坑 → 测试与可观测 → 明确不做 → 后续改进 → 入口与子模块 → 验收用例

**空章节不许留**；确无内容时写「不适用」并说明原因。

## 一个事实只有一个家

| 事实 | 唯一正文 |
|------|----------|
| 架构铁律 C1–C5 | [`../docs/constitution.md`](../docs/constitution.md) |
| 主题色 token | `console/src/scss/variables.scss` |
| 指标名与单位 | `kube-server/pkg/models/monitoring/named_metrics.go`、`prometheus/promql.go` |
| **能力级技术方案** | **本目录** |

## 怎么改

1. 改功能树时编辑 [`../prd/tools/tree.py`](../prd/tools/tree.py)，跑 `python3 prd/tools/build_prd.py`。
2. 写或改技术方案。**决策要留「为什么 + 被否方案 + 何时重新考虑」，坑要留「不知道会怎样」**。三级模板见 [`templates/L1-module.md`](templates/L1-module.md)、[`templates/L2-submodule.md`](templates/L2-submodule.md)、[`templates/L3-feature.md`](templates/L3-feature.md)，复制后要改什么见 [`templates/README.md`](templates/README.md)。
3. 跑门禁与生成：
   ```bash
   cd console
   python3 prd/tools/check_docs.py --strict
   cd tests/ui && python3 generate_case_docs.py
   ```

## 门禁查什么

`prd/tools/check_docs.py` 是唯一门禁：

- `catalog.yaml` 每个功能点：需求、技术方案、≥1 条 L3 用例**都存在**；
- 每条 `AC-*`：**至少一条用例覆盖**且**至少一份技术方案承接**；
- 写了 `AC-*` 时，每条 `US<n>` 至少被一条用例的 `story` 引用；
- 技术方案 `关联需求` 与用例 `covers` 指向的 AC **必须真实存在**；
- 三层必备章节齐全（L3 技术方案必须有 `## 仓库落点` 与 `DEC-*`）；
- `AC`/`DEC`/`CON`/`INV`/`GOT` 编号全局唯一；
- 不留 `[NEEDS CLARIFICATION]`；
- 不写「完成主路径」这类套话；
- 页面 SCSS 不出现十六进制色值（宪法 C3 的机械检查）。
