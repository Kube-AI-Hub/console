# 需求模板

三个文件对应三级，与 [`../README.md`](../README.md) 的章节顺序一一对应：

| 文件 | 级别 | 产物路径 | 用例套件 |
| --- | --- | --- | --- |
| [`L1-module.md`](L1-module.md) | L1 模块 | `prd/{模块}/_index.md` | `core`（`TC-CORE-*`） |
| [`L2-submodule.md`](L2-submodule.md) | L2 子模块 | `prd/{模块}/{子}/_index.md` | `full`（`TC-FULL-*`） |
| [`L3-feature.md`](L3-feature.md) | L3 功能点 | `prd/{模块}/{子}/{功能}.md` | `point`（`TC-L3-*`） |

## 复制后要改什么

1. **标题**：一级标题写中文名，L1/L2 追加 `（L1）` / `（L2）`。
2. **上级链接**：L2 顶部的 `[上级模块](../_index.md)`、L3 顶部的 `[子模块需求](./_index.md)` 保持相对路径。
3. **入口**：`## 概述` 与 `## UI 交互设计` 里写清真实路由（`/clusters/:cluster/...`），不要写「某页面」。
4. **ID 后缀**：`AC-` / `FR-` / `SC-` 的后缀与用例 ID 共享，只把 `TC-` 换前缀。例如用例 `TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01` → `AC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01`。**编号不要手工造**，按 `prd/tools/tree.py` 的 `tc_id()` 推导。
5. **i18n 文案表**：L3 的 `## 文案与校验` 必须列出 key、中文、英文与出现位置。新增 key 要同时落 `locales/en/` 与 `locales/zh/`。
6. **不写实现**：需求里不写组件名、store 名、函数名；那些进 [`../../design/`](../../design/)。
7. **删掉模板提示**：`>` 开头的模板说明可以保留（门禁不查），但「（谁用……）」这类占位必须替换成真实内容。

## 与生成器的关系

`python3 prd/tools/build_prd.py` 只补**缺失**文件，已有 Markdown 一律不动。它生成的需求稿带 `待迁移：本文件由 prd/tools/build_prd.py 生成` 一行；按本模板补全后**删掉这一行**，否则门禁会一直把它当作未迁移。

## 自检

- [ ] 「设计目标」写了为什么，而不只是控件叫什么。
- [ ] 「约束与边界」写了对象落在哪、列表按什么过滤、和相邻模块的边界。
- [ ] 跨模块变化有 Mermaid 图。
- [ ] 每条 `AC-*` 至少有一条用例覆盖它、一份技术方案承接它；每条 `US<n>` 至少有一条用例的 `story` 引用它。
- [ ] 可见性写成了可测的验收：对比度阈值、单位、空态文案，而不是「看起来清楚」。
- [ ] 「明确不做」仍在。
