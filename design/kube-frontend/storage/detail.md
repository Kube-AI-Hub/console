# 存储详情（L3）

[子模块需求](../../../prd/kube-frontend/storage/detail.md)

## 概述

详情展示属性与操作；PVC 显示持久卷，快照显示来源卷。

## 关联需求

- AC-L3-KUBE-FRONTEND-STORAGE-DETAIL-02
- AC-L3-KUBE-FRONTEND-STORAGE-DETAIL-01

- `prd/kube-frontend/storage/detail.md`

## 设计目标与非目标

与配置区同构：共用表格、弹窗与写路径。非目标见 L2 的「明确不做」。

## 关键约束

- 作用域只从路由参数派生。
- 空列表不渲染表头（共享 `Table` 负责）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-STORAGE-DETAIL-01 — 与配置区共用组件，不新建

**为什么**：存储与配置的交互完全一致，新写一套只会产生第二套规则。

**被否方案**：为存储单独实现表格与弹窗。

**何时重新考虑**：存储需要配置区没有的交互（例如容量趋势图）时。

## 系统现状

老 console 对应页面已具备同等能力。

## 仓库落点

- `pages/storage/StorageDetailPage.tsx`

## 对外契约

读单个对象；返回目标由当前 URL 推出。

## 不变量

属性来自对象本身，缺字段显示 `-`。

## 已知坑

- 对象名可能含点号，不要用字符串替换构造返回地址。

## 测试与可观测

E2E 见 `tests/kube-frontend/storage/`。

## 后续改进

扩容与快照创建。

## 验收用例

- `TC-L3-KUBE-FRONTEND-STORAGE-DETAIL-01`

### DEC-L3-KUBE-FRONTEND-STORAGE-DETAIL-02 — 详情必须有「状态」，供应者取自 PVC 注解

**为什么**：第一版详情漏了状态——而状态正是读者打开详情要看的第一项，且列表里明明有。供应者同理：老 console 在详情显示它，读者要判断卷由哪个驱动支撑。供应者取自 PVC 的 `volume.kubernetes.io/storage-provisioner` 注解，而不是再请求一次集群级的 StorageClass（一个字符串不值得多一次往返）。

**被否方案**：查 StorageClass 取 provisioner。多一次请求，且存储类可能已被删除而卷仍在。

**何时重新考虑**：需要显示存储类的其它属性（如绑定模式）时。
