# 编辑服务账户 · 技术方案（L3）

> 承接 [`prd/kube-frontend/serviceaccounts/edit.md`](../../../prd/kube-frontend/serviceaccounts/edit.md)。

## 概述

「编辑 / 编辑信息」复用共享 `EditInfoDialog`（注解合并 + PUT），「编辑 YAML」复用 `YamlDialog`（名称锁定）。角色不在本路径修改。

## 关联需求

- `AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-EDIT-01`

## 设计目标与非目标

**目标**：信息编辑不触碰角色与 `secrets[]`；YAML 编辑可改任意字段但不可改名。

**非目标**：在编辑器里改角色。

## 关键约束

- 打开前先 `GET` 详情（`openWithDetail`），不用列表摘要。
- 信息编辑把合并后的注解写入 `metadata.annotations`，其余元数据原样带回。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-01 — 信息编辑与保密字典共用 PUT 路径，不单独处理 `secrets[]`

**为什么**：PUT 的 body 含读取时的 `secrets[]`；服务端会忽略客户端对受控字段的修改（`secrets` 是有效字段但通常由控制器维护，写入后下次调谐覆盖）。为这一潜在不一致增加「过滤受控字段」的逻辑，会让编辑路径与共享弹窗分叉，而实际观察到的漂移会在一个调谐周期内自愈。

**被否方案**：PUT 前删除 `secrets` 与 `imagePullSecrets`。这确实能避免写回旧值，但 `kubectl apply` 的用户语义是「你没写的字段保留」，直接删除会让通过 UI 修改 `imagePullSecrets` 的 YAML 路径失效。

**何时重新考虑**：观察到用户因旧 `secrets[]` 写回而产生实际故障时。

## 系统现状

老控制台 `Modals/EditServiceAccount` 修改名称（禁用）、别名、描述，走 `store.patch(detail, data)`；新实现用 PUT（理由见保密字典技术方案中编辑路径的决策）。

## 仓库落点

| 层 | 路径 |
|---|---|
| 信息弹窗 | `apps/console-next/src/components/resource/EditInfoDialog.tsx` |
| YAML 弹窗 | `apps/console-next/src/components/resource/YamlDialog.tsx` |
| 页面装配 | `apps/console-next/src/pages/serviceaccounts/ServiceAccountsPage.tsx`、`routes/...serviceaccounts.$name.tsx` |

## 对外契约

`PUT /api/v1/namespaces/{ns}/serviceaccounts/{name}`（携带 `resourceVersion`）。

## 不变量

- **INV-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-01** — 信息编辑不改变 `iam.kubesphere.io/role`。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-01** — `metadata.uid` 等只读字段从读取的对象带回是安全的，但若页面缓存的是旧对象，`resourceVersion` 会被 `resourceApi.update` 重新读取并覆盖。
  处置：`update()` 总是先 GET 取最新版本号。

## 测试与可观测

- 单元：`test/serviceaccounts-page.test.tsx`（角色不变、YAML 改名被拒）。
- 端到端：`TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-01`。

## 后续改进

并发编辑的可视化冲突提示。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-01`
