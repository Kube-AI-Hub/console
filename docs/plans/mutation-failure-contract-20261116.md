# 写请求失败必须有地方显示（2026-11-16）

> 新增 `kube-frontend/config/mutation-failure-contract.test.ts`（3 条）。守住「**不得伪造成功**」。

## 1. 这条规矩是怎么被破坏的

写法很安静：弹窗调 `mutateAsync`，请求失败，promise 被 reject，**什么都没渲染**。
读者看到的是一个没关的表单，没有任何原因；更糟的情况是乐观路径先关弹窗，改动其实没发生。

## 2. 三条断言

| 断言 | 内容 |
| --- | --- |
| 清单自检 | 含 `useMutation(` 的文件 > 40（当前 49） |
| **失败必须可见** | 每个发起写请求的文件都要把 rejection 送到读者能看见的地方 |
| **只在成功后关闭** | 提交路径里不得直接 `onOpenChange(false)`（必须走 `mutateAsync`/`onSuccess`） |

「可见」认可以下几种真实形态：

- 交给自带错误面的共享组件：`ResourceForm`（内部 `try { await onSubmit() } catch { setSubmitError() }`，已核对源码）、
  `ManifestCreateDialog`（自带 `role="alert"` 段落）；
- `MutationAlert`；
- 自己渲染：`{mutation.error…}` 配 `role="alert"` / `<p>`；
- **交给弹窗组件显示**：`{...(remove.error ? { error: errorMessage(t, remove.error) } : {})}`——本项目最常见的写法；
- 自己的 `catch` + `setError`，或 `onError:`。

## 3. 两次「契约写错了」的修正

第一版只认 `MutationAlert` / 自己渲染两种，于是把 `DevopsProjectsPage`、`WorkspaceMemberDetailPage`、
`WorkspaceMembersPage` 三个**其实已经正确处理**的文件判成违规——它们用的是「把 error 传给弹窗组件」。
把该形态纳入后全部通过。

**这是第二次同类教训**（第一次是导航契约把 `apps/instances` 判成缺失）：
静态契约写得太窄会制造假缺陷，比漏检更浪费——下一个人会去「修」一个不存在的问题。

## 4. 反向验证

把 `QuotaEditDialog` 里的 `ResourceForm` 改名成 `PlainForm`（让它失去错误面）→ 契约立刻失败并点名该文件；
恢复后全绿。

## 5. 结果

| 项 | 结果 |
| --- | --- |
| 含 `useMutation(` 的文件 | 49 |
| 无错误面 | **0** |
| 提交路径乐观关闭 | **0** |
| 契约套件 | **18 文件 / 1474 passed** |

## 6. 边界

静态检查只能证明「有地方显示」，不能证明文案有用、不能证明弹窗真的把它渲染出来。
真实失败的端到端验证仍需链路（本轮链路 `degraded`，批量用例卡在登录未跑成）。
