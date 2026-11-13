# 存储列表（L3）

[子模块需求](../../../prd/kube-frontend/storage/list.md)

## 概述

两个页面共用的列表组件，描述符决定标题与空态文案。

## 关联需求

- AC-L3-KUBE-FRONTEND-STORAGE-LIST-04

- AC-L3-KUBE-FRONTEND-STORAGE-LIST-03
- AC-L3-KUBE-FRONTEND-STORAGE-LIST-01
- AC-L3-KUBE-FRONTEND-STORAGE-LIST-02

- `prd/kube-frontend/storage/list.md`

## 设计目标与非目标

与配置区同构：共用表格、弹窗与写路径。非目标见 L2 的「明确不做」。

## 关键约束

- 作用域只从路由参数派生。
- 空列表不渲染表头（共享 `Table` 负责）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-STORAGE-LIST-01 — 与配置区共用组件，不新建

**为什么**：存储与配置的交互完全一致，新写一套只会产生第二套规则。

**被否方案**：为存储单独实现表格与弹窗。

**何时重新考虑**：存储需要配置区没有的交互（例如容量趋势图）时。

## 系统现状

老 console 对应页面已具备同等能力。

## 仓库落点

- `pages/storage/StorageListPage.tsx`
- `pages/storage/queries.ts`

## 对外契约

读 `/kapis/…/namespaces/<ns>/<resource>`；分页与搜索参数随请求下发。

## 不变量

列集合固定为五列；快照没有访问模式列。

## 已知坑

- 集群级 PVC 查询慢，首屏必须有骨架。

## 测试与可观测

E2E 见 `tests/kube-frontend/storage/`。

## 后续改进

扩容与快照创建。

## 验收用例

- `TC-L3-KUBE-FRONTEND-STORAGE-LIST-01`
- `TC-L3-KUBE-FRONTEND-STORAGE-LIST-02`

### DEC-L3-KUBE-FRONTEND-STORAGE-LIST-05 — 扩容入口按存储类的 `allowVolumeExpansion` 门控

**为什么**：本集群的默认存储类 `openebs-hostpath` **不支持扩容**（未设置 `allowVolumeExpansion`）。若不门控，用户点「扩容」→ 提交 → apiserver 拒绝，界面只能报一个看起来像我们代码出错的失败。实测确认：同一集群里 `juicefs-shared` 可扩容、`local-static` 与 `openebs-hostpath` 不可。

**被否方案**：始终显示，让服务端报错。把「这个存储类本来就不支持」包装成错误提示，是让用户替我们排查配置。

**何时重新考虑**：平台提供「哪些卷可扩容」的聚合接口时（现在需一次存储类列表 + 每行比对）。
