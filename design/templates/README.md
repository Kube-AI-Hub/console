# 技术方案模板

三个文件对应三级，与 [`../README.md`](../README.md) 的章节顺序一一对应：

| 文件 | 级别 | 产物路径 | 用例套件 |
| --- | --- | --- | --- |
| [`L1-module.md`](L1-module.md) | L1 模块 | `design/{模块}/_index.md` | `core`（`TC-CORE-*`） |
| [`L2-submodule.md`](L2-submodule.md) | L2 子模块 | `design/{模块}/{子}/_index.md` | `full`（`TC-FULL-*`） |
| [`L3-feature.md`](L3-feature.md) | L3 功能点 | `design/{模块}/{子}/{功能}.md` | `point`（`TC-L3-*`） |

## 复制后要改什么

1. **技术方案 ID**：`DES-` 加用例 ID 去掉 `TC-` 的后缀。例如用例 `TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01` → 文档 `DES-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND`，决策 `DEC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01`。**编号由用例 ID 前缀替换推导**，不要 slugify（本仓库用例 ID 含下划线）。
2. **关联需求**：把该功能点需求里的**每一条** `AC-*` 用反引号列进 `## 关联需求`，一条一行。门禁按这里做 `AC ↔ DES` 追溯，漏一条就是 `ERROR`。
3. **仓库落点**：`## 仓库落点` 是 L3 必备章节。即使只改前端，也要把接口行写「不改」，让接手的人知道契约没动。
4. **删掉「待迁移」标记**：`build_prd.py` 生成的稿带 `待迁移：本文件由 prd/tools/build_prd.py 生成`；补全后必须删掉，否则门禁一直把它当生成稿（`--strict` 下失败）。
5. **决策写全四段**：备选 / 选定 / 原因 / 被否方案 / 何时重新考虑。只写「我们这么做了」等于没写。
6. **坑要写后果**：「如果不知道会怎样」是必填，没有后果的条目不是坑，是说明。

## 与需求的边界

- 需求写**用户看到什么**；技术方案写**为什么这样做、改哪里、破坏了谁会疼**。
- 需求里的 i18n 文案表只列 key 与文案；技术方案写 key 落在哪个 locale 文件、是否同时落 `en` / `zh`。
- 需求里的「明确不做」是产品决策；技术方案里的「非目标」是实现边界。两者可以重叠，但不要互相复制全文。

## 自检

- [ ] `## 关联需求` 覆盖了本功能点需求的全部 `AC-*`，且没有多余 AC。
- [ ] L3 有 `## 仓库落点`，且至少一条 `DEC-*`。
- [ ] 每条 `DEC-*` 都有被否方案与重新考虑条件。
- [ ] 每条 `GOT-*` 都写了「如果不知道会怎样」。
- [ ] 不复制 [`../../docs/constitution.md`](../../docs/constitution.md) 的条款，只引用。
- [ ] 跑 `python3 prd/tools/check_docs.py --strict` 无 `ERROR`。
