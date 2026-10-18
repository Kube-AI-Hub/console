# 用例规格（`specs/**/*.yaml`）

事实源是 `specs/` 下的 YAML，`cases/` 下的 Markdown 由 `generate_case_docs.py` 生成，不要手改。

## 字段

```yaml
id: TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01
level: 3                                # 1 L1 模块 / 2 L2 子模块 / 3 L3 功能点
suite: point                            # core / full / point / flow
module: cluster-storage
submodule: shared-storage
feature: quota
title: 共享存储 · 调整配额
entry_url: "{BASE_URL}/clusters/default/juicefs-storage/volumes"
prd: prd/cluster-storage/shared-storage/quota.md
design: design/cluster-storage/shared-storage/quota.md   # 可选；缺失时按 catalog 推导

covers:                                 # 本用例覆盖需求里的哪些 AC
- AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01

story:                                  # 本用例验证需求里的哪些用户故事
- US1

edge_cases:                             # 选填：额外压到的边界
- 输入低于已用的值时确定按钮禁用

product: 一句话说明本用例验证的产品行为。
preconditions:
- 已登录，且在 default 集群
steps:
- 打开 /clusters/default/juicefs-storage/volumes
expected:
- 表格出现两行共享卷
troubleshoot:                           # 选填：失败时先看什么
- 先确认 mount pod 的 metrics 已开启
update_automation:
- 文案变化时改 pages/
```

## `covers` 是硬约束

- 每条 `covers` 里的 `AC-*` 必须能在同一份 `prd` 文件里找到，否则门禁失败。
- 需求里出现的每个 `AC-*` 必须至少被一条用例覆盖。
- **不要**把 Given/When/Then 抄进 YAML。场景文案只在需求里写一次。

## `story` 是用户故事的硬约束

- 每条 `story` 里的 `US<n>` 必须能在同一份 `prd` 文件里找到。
- 需求里出现 `AC-*` 时，其中每个 `US<n>` 必须至少被一条用例的 `story` 引用。

## 套件与流程用例

| 套件 | 级别 | 组织方式 |
|------|------|----------|
| `core`（`TC-CORE-*`） | L1 | 模块入口冒烟 |
| `full`（`TC-FULL-*`） | L2 | 一页的骨架，或一条跨页流程的步骤 |
| `point`（`TC-L3-*`） | L3 | 一个控件，或一项页面上不直接露出的能力 |
| `flow`（`TC-FLOW-*`） | — | 按用户故事走完整旅程 |

## 命名

`TC-{CORE|FULL|L3}-<模块>-<子模块>-<功能>-<NN>`，流程用例是 `TC-FLOW-<旅程名>`。技术方案侧的编号由**用例 ID 前缀替换**推导（`TC-` → `DES-`/`AC-`/`DEC-`/`CON-`/`INV-`/`GOT-`），**不要 slugify**。

## `steps` 两种形态

字符串数组（沿用旧写法）：

```yaml
steps:
- 打开 /clusters/default/juicefs-storage/volumes
- 点「调整配额」
```

给定/当/那么（场景并列）：

```yaml
steps:
- given: 已有共享卷
  when: 输入低于已用的配额
  then: 确定按钮禁用并提示
```

## 校验

```bash
cd console
python3 prd/tools/check_docs.py
python3 prd/tools/check_docs.py --strict
cd tests/ui && python3 generate_case_docs.py
```
