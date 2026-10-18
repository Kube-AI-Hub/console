# UI 集成测试（Playwright）

覆盖智算平台控制台里本仓库维护的页面。用例事实源在 [`specs/`](specs/)，可读文档在 [`cases/`](cases/)（生成物）。

## 安装

```bash
cd console/tests/ui
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
cp env.example .env      # 填 KA_PASSWORD
```

## 跑

```bash
pytest -m core                     # L1 冒烟
pytest -m full                     # L2 一页 / 一条流程
pytest -m point                    # L3 功能点（含对比度与未翻译 key 断言）
pytest -m ui                       # 全部
pytest tests/cluster-storage -q    # 只跑某个模块
```

同一环境**串行**执行，不要加 `-n`。

## 目录

```text
specs/{module}/{sub}/TC-*.yaml      # 事实源，含 covers / story
cases/{module}/{sub}/TC-*.md        # 生成物（python generate_case_docs.py）
tests/{module}/{sub}/test_*.py      # Playwright 编排
pages/                              # 页面对象，选择器只在这里
helpers/                            # 登录、配置、对比度审计、i18n 断言
artifacts/                          # 截图与日志，不入库
```

## 选择器约定

- 选择器只写在 `pages/`，用例里不出现 CSS。
- 优先用文本与 `name` 属性定位；`[class*=x]` 只用于样式类名稳定的结构（卡片、表格行）。
- 页面结构变了改 `pages/`，不要改用例步骤。

## 对比度与未翻译 key

- `helpers/contrast.py` 在浏览器里遍历容器内的文本节点，取 `color` 与最近的不透明背景，按 WCAG 2.1 算比值；正文阈值 4.5:1（`KA_CONTRAST_TEXT`）。
- `untranslated_keys()` 找形如 `SHARED_STORAGE_XXX_PL` 的可见文本——控制台缺翻译时会直接显示 key。

这两条是硬断言：改颜色或改文案后跑 `pytest -m point` 就能拦住「文字看不清」「页面出现 _PL」这两类回归。

## 截图

每个用例失败时保留 `artifacts/<test>/` 下的截图。做 UI 改动时按 `.cursor/rules/ui-screenshot-verify.mdc` 在真实环境留 before / after 两套图。
