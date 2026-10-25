# 用例模板

[`case.yaml`](case.yaml) 是 L3 功能点用例的起点。复制到 `specs/{模块}/{子}/{TC-ID}.yaml` 后填写。

## 三级套件

| 级别 | 前缀 | `suite` | pytest 标记 | 位置 |
| --- | --- | --- | --- | --- |
| L1 模块 | `TC-CORE-*` | `core` | `@pytest.mark.core` | `specs/{模块}/core/` |
| L2 子模块 | `TC-FULL-*` | `full` | `@pytest.mark.full` | `specs/{模块}/{子}/` |
| L3 功能点 | `TC-L3-*` | `point` | `@pytest.mark.point` | `specs/{模块}/{子}/` |
| 用户故事旅程 | `TC-FLOW-*` | `flow` | `@pytest.mark.full` | `specs/{模块}/flow/` |

`flow` 是规格侧的套件名，pytest 侧统一用 `full`（旅程比单点重）。`core/`、`flow/` 是套件目录，原样镜像到 `tests/`。

## 复制后要改什么

1. **`id`**：`TC-{CORE|FULL|L3}-<模块>-<子模块>-<功能>-<NN>`。模块段保留连字符（`CLUSTER-STORAGE`），子模块与功能段内的连字符换成下划线（`SHARED_STORAGE`）。L3 的 ID 由 `prd/tools/tree.py` 的 `tc_id()` 推导，不要手工造。
2. **`covers`**：每条 `AC-*` 必须能在同一份 `prd` 文件里找到；需求里的每个 `AC-*` 至少被一条用例覆盖。
3. **`story`**：每条 `US<n>` 必须能在同一份 `prd` 文件里找到；需求里出现 `AC-*` 时，其中每个 `US<n>` 至少被一条用例的 `story` 引用。
4. **`steps` / `expected`**：不能为空。不要抄 Given/When/Then，场景文案只在需求里写一次。
5. **`entry_url`**：用 `{BASE_URL}` 占位，路径写 console 的真实路由（`/clusters/default/...`）。
6. **不要留 `stub: true`**：`build_prd.py` 生成的桩带这个字段，门禁只告警，但 `--strict` 下失败。按实际行为改写后删掉。

## 一 spec 一测试文件

用例 YAML 只是规格，终点是会跑的测试。对应关系由**路径**决定：

```text
specs/{模块}/{子}/TC-L3-...-QUOTA-01.yaml
tests/{模块}/{子}/test_TC_L3_..._QUOTA_01.py
```

- 目录镜像 `specs/{模块}/{子}/`，`core/`、`flow/` 原样镜像。
- 文件名把 `TC-` 之后的连字符换成下划线，加 `test_` 前缀。
- 文件里**只有一个**测试函数，函数名与文件名一致，docstring 首行是字面 ID：

```python
@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_QUOTA_02(storage_page, screenshot):
    """TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02 配额弹窗：初始值、下限校验、取消不变、提交生效。"""
```

- 选择器只写在 `pages/`，用例里不出现 CSS。
- 可见性要可测：对比度 ≥ 4.5:1（`helpers/contrast.py`）、不出现未翻译 key（`untranslated_keys()`）。

`python3 prd/tools/check_docs.py --what tests` 会核对：测试文件是否存在、函数是否恰好一个、docstring 是否声明该 ID、`tests/` 下有没有对不上 spec 的孤儿文件、`suite` 与 `@pytest.mark.*` 是否一致。

## 收敛

```bash
cd console
python3 prd/tools/check_docs.py --strict
cd tests/ui && python3 generate_case_docs.py
```
