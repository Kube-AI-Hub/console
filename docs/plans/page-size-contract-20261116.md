# 每页档位的机械守卫 + 商店评论表修复

> 档位接入（26 个列表）之后的收口：把两类「类型检查抓不到」的缺陷变成契约测试。日期 2026-11-16。

## 1. 新增契约测试 `config/page-size-contract.test.ts`（3 条）

| 检查 | 防的是哪个缺陷 |
| --- | --- |
| 声明了 `pageSizeOptions` 就必须同时给 `onPageSizeChange` | 共享 `ResourceList` 缺任一个都不渲染选择器，`tsc` 不报错 |
| 请求参数不得写 `pageSize: PAGE_SIZE`（`pager-less on purpose` 可显式豁免） | 选择器改了状态、请求仍用常量（商店评论表就是这样） |
| 服务端分页列表的查询键必须含 `list.pageSize` | 键不变 → react-query 返回缓存 → 「选择器显示 50、表格还是 20 行」 |

## 2. 契约测试当场抓到的真实缺陷

`appstore/StoreManagePage.tsx` 的**评论表**：查询键已含 `list.pageSize`、分页器也接了选择器，但请求仍是
`storeReviewsApi.list({ pageSize: PAGE_SIZE })`——选 50 只会换一页同样的 10 条。已改为跟随状态。

另有一处显式豁免：`monitoring/AlertMessagesTimeline.tsx` 是策略详情里的固定窗口时间线（不分页），保留常量并
加注释说明，契约测试按 `pager-less on purpose` 标记跳过。

## 3. 验证

| 项 | 结果 |
| --- | --- |
| 新契约测试 | **3 passed** |
| console-next tsc | 0 error |
| 全站串行 E2E | 本轮启动后台运行（见 `docs/plans/full-suite-baseline-20261116.md` 的窗口说明），结果另记 |
