# 单页迁移 / 优化 Prompt

以下正文可直接作为其他 AI agent 的任务输入。它只补充**针对某一页**的定位、阅读顺序与验收要求；
全流程规则以[续迁移 Prompt](continue-migration-prompt.md) 与[迁移指南](../legacy-ui-migration-guide.md) 为准，不在此重复。

---

你负责把旧 AGPL console 的**一个指定页面**迁移或优化到新 UI（`console-next`），或改进该页已有的实现。
请实际完成编码、规格同步、测试与交付记录，不只输出分析。范围就是用户指定的这一页及其直接子页、页签、
弹窗和状态分支；不要顺手扩大到相邻模块，也不要缩成其中几个区块。

## 一、先定位，再决定读什么

工作区 `/Users/yuan/code/kube-ai-hub`，前端仓库 `console`。三棵代码树各有分工：

| 位置 | 是什么 | 什么时候读 |
| --- | --- | --- |
| `console/src/pages/<模块>/` | **旧** AGPL 实现，行为契约的来源 | 清点旧能力、确认交互与字段时 |
| `console/kube-frontend/apps/console-next/src/pages/` | **新**页面，你要改的地方 | 看现有实现到什么程度 |
| `console/packages/ai-kit/src/` | 公共组件（**注意**：不在 `kube-frontend/packages/ai-kit`） | 动手前，先确认有没有现成控件 |
| `console/kube-frontend/packages/api-client/src/` | 所有请求的入口 | 每次新增或修改调用时 |
| `console/kube-frontend/apps/console-next/src/areas/registry.ts` | 侧栏、页签、路由的唯一清单 | 页面入口或导航变化时 |

按顺序做三件事，不要跳：

1. **打开旧页面**（能打开就打开，别只读源码）。旧 console 在未就绪、无权限、空数据时常常**整页换成另一个视图**，
   而那个判断写在父组件里——只看子组件会得出「在页内加一块提示」的错误结论。
   旧站入口见 `/Users/yuan/code/kube-ai-hub/环境/` 下对应环境文档（mlu370 的验证入口与耗时见 `环境/mlu370环境.md`）。
2. **读新页面现状**：`pages/` 下的页面文件、它引用的 `api-client` 方法、`areas/registry.ts` 里的登记。
   判断这是「从零迁移」还是「改进已有实现」——两者的验收范围不同。
3. **读该页的 PRD/design/spec**：`console/prd/<模块>/<子>/<功能>.md`、`design/` 同路径、`tests/ui/specs/` 同路径。
   已有 AC 就是已承诺的契约，改行为要同步改它们，不能让代码和 AC 分叉。

**旧页有页签/子页时，先写「场景 + 归宿」表再动手。** 逐页签（含默认页签与条件隐藏页签）写：
用户任务、包含的区块/图表、归宿（页内 Tab / 独立子路由 / 页内分区 / 不做）与批准依据；
评估该页是否应拆成多个子页/block。图表多的页面先定分组与「主图+明细」结构。
把页签内容平铺成一屏、或用数值/进度条替代旧页图表，都是退化，不算迁移完成（见指南 §1/§2.4/§8）。

方法文档只在需要时查，不整本通读：

- `docs/README.md` — 文档分工与当前入口
- `docs/SDD.md` — 规格怎么组织、门禁怎么跑、AI 的硬要求
- `docs/constitution.md` — 不可违反的架构铁律与 UI 原则（动页面结构、主题、指标口径前必读）
- `docs/legacy-ui-migration-guide.md` — 清点方法、验收维度、高频坑清单（**动手前至少过一遍 §8**）
- `docs/plans/page-migration-template.md` — 该页的旧能力表与验收记录，复制后填
- `docs/plans/capability-matrix.md` — 这一页当前登记的状态，不要重复别人正在做的部分

## 二、动手前必须写下来的三件事

写代码之前，用一段话回答下面三问；答不上来说明还没准备好：

1. **旧页面的完整状态分支是什么？** 至少覆盖「正常 / 未就绪 / 无权限 / 空」四种，并说明每一种在新页面里是
   页内区块、整页接管，还是跳转。把它们写进模板 §2 的旧能力表，每种状态各占一行。
2. **每个接口返回什么类型？** JSON / YAML / 纯文本 / 流，写进模板 §3 的「返回类型」列。
   返回非 JSON 的端点必须传 `responseType: 'text'`，否则客户端会 `JSON.parse` 失败——请求 200 而页面
   显示「未知错误」。先找 `api-client/src/` 里的同类调用照抄（`kubectl.ts` 就是先例），别凭接口名猜。
3. **哪些共享组件已经能做这件事？** 先查 `packages/ai-kit`（`Panel`、`DescriptionList`、`Menu`、`YamlEditor`、
   `ResourceList` 等）与应用内 `components/`。现有组件不足才扩展公共 API，补 Storybook 与消费者回归，
   不为单页私造同类控件。

## 三、实现与验收

- **规格先行**：该页的 AC 同时承接功能、数据语义、状态、权限、交互与视觉；design 写「为什么 + 被否方案 + 何时重新考虑」。
  视觉决策写成**关系**（「标签是行里更大的那一半」），不写像素——像素是实现细节，回填进 AC 会让「方向对不对」无法判断。
- **一个动作一个入口**：同一操作不要在页头和面板各放一个；说明性文案不算入口，但在有加载指示时重复「正在刷新」也是冗余。
- **状态可分**：加载中 / 空 / 无匹配 / 失败 / 无权限是五种画面，不能互相顶替；失败保留用户输入并给出重试。
- **断言覆盖用户实际要看的东西**：对展示型区块（清单、代码块、图表）断言它可见且内容有代表性特征，
  不要只断言标题或说明文字——否则整块消失时用例照样通过。

固定本批构建后按顺序验证，每一步都要真实跑过（4 分钟级的全量文档门禁与 E2E 不要叠跑，本批只跑一次；
迭代期用秒级的 `check_docs --what prd/design`；耗时与编排见 `docs/SDD.md` §2「验证节奏」）：

```bash
cd console
python3 prd/tools/check_docs.py --strict <本页PRD> <本页design>   # 规格门禁
cd kube-frontend
pnpm --filter @kube-ai-hub/console-next typecheck
pnpm --filter @kube-ai-hub/console-next build
cd apps/console-next && npx vitest run test/<本页相关>.test.tsx
cd console/tests/ui
python3 generate_case_docs.py                                     # 改过 AC 文案就必须重跑
pytest tests/kube-frontend/<模块> -k <本页> -q -n 0                # 判定用串行
```

改完 UI 必须**打开真实页面截图核对**：展开到出问题的那个状态（菜单点开、弹窗打开、tab 切到、长列表滚到位），
对比改动前后，量一下对齐/间距（`getBoundingClientRect()` 的差值），不要只看构建通过或 DOM 文本。
本地起服务：

```bash
cd console/kube-frontend
pnpm dev        # 源码 + HMR，5174
pnpm build && pnpm preview   # 构建产物，5178（验收用这一层）
```

## 四、交付

- 更新该页的 PRD / design / spec、生成的 cases 与追溯矩阵（用 `generate_case_docs.py`，不手改生成物）。
- 在该页的交付记录里写清：日期、提交/构建、验证范围、未验收的部分。
- 结论分开写：本地该页通过 / 全仓静态通过 / 全站 E2E 通过 / 部署环境验收，不能用一行「全部完成」合并。
- **不要自行提交或推送**。用户要求提交后，只提交本批已核对的文件，不混入并行工作。

最后用中文简洁报告：改了什么、每项验证的实际结果（含失败与 skip）、截图路径、仍未覆盖的部分。
