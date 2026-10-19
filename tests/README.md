# 智算平台 · 三级集成测试

与 [`../prd/`](../prd/)、[`../bugs/`](../bugs/) 平齐。UI 集成测试在 [`ui/`](ui/)，用 Playwright + pytest。

## 三级套件

| 级别 | Marker | 用途 | 跑法 |
|------|--------|------|------|
| L1 模块 | `core` | 部署后验收：打开入口，核对标题或主区 | `pytest -m core` |
| L2 子模块 | `full` | 一页的字段与操作，或一条跨多个关联页面的流程 | `pytest -m full` |
| L3 功能点 | `point` | 一个控件的完整交互，或一项不直接露出的能力的触发与可观察结果 | `pytest -m point` |
| 用户故事旅程 | `flow` | 按一条 `US` 的 Independent Test 跨页面走完 | `pytest -m full`（规格 `suite: flow`） |
| 全部 UI | `ui` | 三级合计 | `pytest -m ui` |
| 缺陷复现 | `bug` | `bugs/` 中的复现规格 | `pytest -m bug` |

`full` 不自动包含 `core`。同一环境**串行**执行，不要加 `-n`。

## 环境

```bash
cd console/tests/ui
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
cp env.example .env      # 填 base url 与账号
pytest -m point
```

`env.example` 的变量见 [`ui/README.md`](ui/README.md)。默认指向 B200 的 `https://console-dev.brightaitoken.ai`。

## L3 功能点必须覆盖什么

| 控件 | 必须测到 |
|------|----------|
| **按钮** | 点下去之后发生了什么：打开/关闭对话框、提交请求、跳转、二次确认、取消保持原状、成功/失败提示、禁用态 |
| **字段** | 标签、占位、默认值、全部可选值、必填/非法校验、合法填写后的提交值或回显 |
| **表格** | 全部表头、列数据、空态、操作列里的每一个按钮 |
| **图表** | 有数据时曲线可见，无数据时空态文案；单位正确；不出现未翻译 key |
| **其它交互** | Tab、筛选、排序、分页，按控件实际行为点完并核对结果 |

**可见性是可测的**：文字与背景的对比度 ≥ 4.5:1（`helpers/contrast.py` 会遍历容器内的文本节点并计算 WCAG 对比度）。只断言「元素存在」不算覆盖。

写操作只针对 `ui-it-*` 测试对象，测完删除；不要点受保护实例或现网业务数据。

## 追溯：AC ↔ DES ↔ TC ↔ 测试

每条 `AC-*` 必须**同时**被一条用例覆盖（`covers`）和一份技术方案承接（`design/` 的 `## 关联需求`）。需求里写了 `AC-*` 时，每条 `US<n>` 还要被一条用例的 `story` 引用。

**每条用例规格必须有一个测试文件**，路径与文件名镜像 `specs/`：`specs/{模块}/{子}/TC-X.yaml` ↔ `tests/{模块}/{子}/test_TC_X.py`。一个文件只放一个测试函数，docstring 首行是 `TC-*` 字面 ID。缺文件、缺 ID、孤儿文件、suite 与 marker 不一致，门禁都会报 `ERROR`。

```bash
cd console
python3 prd/tools/check_docs.py                     # 全部；未迁移只告警
python3 prd/tools/check_docs.py --strict            # 告警也失败
```

用例规格字段与 `covers` 写法见 [`ui/SPEC-SCHEMA.md`](ui/SPEC-SCHEMA.md)。

## 规格与文档

- SDD 入口：[`../docs/SDD.md`](../docs/SDD.md)
- 事实源：`ui/specs/{module}/{sub}/TC-*.yaml`（含 `covers`）
- 生成文档：`python generate_case_docs.py` → `ui/cases/{module}/{sub}/` 与 `ui/cases/_traceability.md`
- 测试文件：`ui/tests/{module}/{sub}/test_TC_*.py`，**一 spec 一文件、路径镜像 `specs/`**，docstring 首行写 `TC-*` 字面 ID
- 三大正文：[`../prd/`](../prd/) · [`../design/`](../design/) · 本目录
- 功能树：[`../prd/catalog.yaml`](../prd/catalog.yaml)

安装与约束见 [`ui/README.md`](ui/README.md)。
