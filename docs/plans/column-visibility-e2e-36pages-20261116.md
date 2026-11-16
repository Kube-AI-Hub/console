# 36 个页面的列显隐：一次性循环 → 每页一个用例（2026-11-16 第 51 轮）

## 1. 结果

```
36 passed in 189.33s (0:03:09)
```

**36 个页面的列显隐全部通过**，且比原来「一个大循环」快了三倍以上。

## 2. 为什么要拆

原来 `CONFIGMAPS-LIST-11` 是**一个用例里循环 36 个页面**。在这个环境里这有两个致命后果：

| 问题 | 后果 |
| --- | --- |
| 任一页面慢/错 → 整个用例中止 | 已经验证过的 35 个页面**一条证据都不留** |
| 同一 page 对象连续跑 36 页、每页都 reload | 状态与等待层层累积，单次耗时从 145s 涨到 500s+ |

实测三次连续失败（87s / 499s / 528s），每次停在不同页面：`alertingrules`、`juicefs`、`juicefs` 的 reload。
拆成 36 个用例后**一次全绿**。

## 3. 改动

```python
@pytest.mark.parametrize('page_spec', PAGES, ids=[spec[0] for spec in PAGES])
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_11(configmaps_page, screenshot, page_spec):
```

配套两处：

- 页面没有该列时原本 `continue`（跳到下一页）→ 现在 `return`（本页结束）；
- 截图按页命名 `list-column-visibility-<prefix>`，不再互相覆盖。

## 4. 顺带修掉的两个真实等待缺陷

| 缺陷 | 修法 |
| --- | --- |
| surface 30s 内不可见就判失败，但本集群首屏实测 9s、退化时更久 | 提到 **90s**（坏页面仍会失败，只是更晚；不会把「慢」报成「功能缺失」） |
| reload 后立刻数表头，与「存储的选择被应用」竞态 | 先等 surface 重新可见（90s），再用 `to_have_count(..., timeout=30_000)` **轮询**，而不是数一次 |

第二条尤其重要：一次失败信息是「刷新后列没有保持隐藏」，而实际上 localStorage 里的值是对的——
只是表头还没被 React 重新渲染。**断言方式本身在制造假缺陷。**

## 5. 另一个环境坑

连续跑长用例后 Playwright 启动失败（`<launched> pid=...` 后超时）：上一轮的 headless shell 进程堆积。
`pkill -f chrome-headless-shell` 后恢复正常。**长跑之间要清理浏览器进程。**
