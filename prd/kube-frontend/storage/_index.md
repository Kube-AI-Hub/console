# 存储（L2）

[上级模块](../_index.md)

项目内的存储只读呈现：存储卷（PersistentVolumeClaim）与存储卷快照（VolumeSnapshot）。老 console 把它们放在侧栏「存储」分组，本模块把两者收进同一个功能区。

## 概述

- **路由**：`/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/{persistentvolumeclaims,volumesnapshots}`
- **谁用**：项目运维，排障时确认卷有没有绑上、绑到了哪个持久卷。
- **做哪几步**：看列表状态 → 进详情确认持久卷 → 必要时改 YAML 或删除。
- **看到什么**：两行名称的列表（名称 + 存储类型）、状态徽章、容量、访问模式。

## 用户故事

### US1 - 打开存储区就能看到两张表 (Priority: P1)

作为 **项目运维**，我希望 **在同一个功能区的两个页签之间切换**，以便 **不用回侧栏找入口**。

**Independent Test**：从存储卷切到存储卷快照，核对页签高亮变化且没有整页刷新。

## 验收场景

- **AC-FULL-KUBE-FRONTEND-STORAGE-01** — 已知已登录且有项目权限，当从存储卷页签切到存储卷快照，则两次都显示对应列表（或空态），页签高亮跟随，工作区栏项目不变。
- **AC-FULL-KUBE-FRONTEND-STORAGE-02** — 已知在存储卷列表，当点「编辑 YAML」，则先出现加载对话框再出现编辑器；当取消，则对象不变。

## 设计目标

1. 存储的列表、详情、空态、写路径与配置区完全同构——共用 `ResourceList`、`YamlDialog`、`DeleteDialog`。
2. 状态来自对象本身，不做二次推断。

## 约束与边界

- 读 kapis；写走原生端点，PVC 在核心组 `/api/v1`，快照在 `snapshot.storage.k8s.io/v1`（由 `kubePrefix` 表登记）。
- 作用域只从路由参数派生。

## UI 交互设计

工作区栏 + 区域页签（存储卷、存储卷快照）；列表五列；详情属性块；行操作编辑 YAML、删除。

## 页面结构

| 页签 | 路由 |
|---|---|
| 存储卷 | `…/persistentvolumeclaims` |
| 存储卷快照 | `…/volumesnapshots` |

## 文案与校验

- 表头：名称、状态、容量、访问模式、创建时间。
- 状态：已绑定 / 等待中 / 已丢失 / 就绪 / 扩容中 / 等待文件系统扩容。

## 边界情况

- 空项目：空态且不渲染表头。
- 未指定存储类型：副行显示 `-`。
- 快照列表没有访问模式列。

## 明确不做

- 快照创建（需要 VolumeSnapshot CRD，本集群未安装）。
- 集群级的持久卷页面（本模块只做存储类型，见集群管理）。
- 「挂载状态」列：需要扫描全部 Pod 的卷引用，代价高于收益。

## 假设

- 快照 CRD 在目标集群可能未安装，此时该页显示空态而不是报错。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-STORAGE-01`

## 异常态

- 加载中：表格骨架，页面 `data-ai-state="loading"`。
- 空：空态标题与说明，不渲染表头。
- 失败：错误面板 + 重试；401/403 提示无权限。
- 快照 CRD 未安装：按空态处理，不报错。

## 功能点

| 功能点 | 需求 |
|---|---|
| 列表 | [list.md](./list.md) |
| 详情 | [detail.md](./detail.md) |
| 编辑 YAML | [edit-yaml.md](./edit-yaml.md) |
| 删除 | [delete.md](./delete.md) |

## 功能需求

- **FR-FULL-KUBE-FRONTEND-STORAGE-01** — 两个页面共用同一套列表、详情、空态与写路径。
- **FR-FULL-KUBE-FRONTEND-STORAGE-02** — 区域内切换页签不产生文档请求。

## 成功标准

- **SC-FULL-KUBE-FRONTEND-STORAGE-01** — 与配置区一致的交互（空态无表头、YAML 先弹框）。
