# 卷与配额 · 技术方案（L3）

## 概述

卷页是唯一的写入口。读：`GET /volumes`（PV + kubelet 统计 + 驱动 ConfigMap）。写：`PUT /volumes/{pv}`，后端做两件事——patch PV 的 `spec.capacity`，再起一次性 Job 跑 `juicefs quota set`。前端只负责校验、确认与刷新。

## 关联需求

- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01`
- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02`
- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-03`

## 设计目标与非目标

**目标**：表格里的配额是驱动会保持的值；改动即时生效；失败可见且可回滚；文字可读。

**非目标**：不做卷的创建/删除；不做子目录配额。

## 关键约束

- 配额权威值是 PV 的 `spec.capacity`。
- 缩小配额不能低于 `usedBytes`，前后端各拦一次。

## 方案决策

### DEC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01 — 配额权威值取 PV 的 `spec.capacity`

CSI 驱动的 `NodePublishVolume` 每次挂载都会用 `PV.Spec.Capacity` 覆盖目录 quota（`pkg/driver/node.go`）。因此页面与接口都以 PV 容量为准。

- **为什么**：只跑 `juicefs quota set` 的话，下一次任何 Pod 挂载该卷都会把配额改回 PV 的值，页面就成了「改完又变回去」。
- **被否方案**：把 `volumeAttributes.capacity` 当配额。该字段不可变，改它必须重建 PV（会短暂让卷不可发布）。
- **被否方案**：改 PVC 的 `requests.storage`。只能增不能减，且静态 PV 的扩容行为依赖 external-resizer，本集群未验证。
- **何时重新考虑**：如果驱动改为从 PVC 读取配额，或集群改用动态供给。

### DEC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02 — 改配额 = patch PV + 一次性 Job

先 patch PV 容量（权威值），再创建 Job 执行 `juicefs quota set --path <subPath> --capacity <GiB>`；Job 失败时把 PV 容量回滚。

- **为什么**：patch 保证「下次挂载不会被改回」，Job 保证「现在就生效」。两者缺一都会留下漂移。
- **被否方案**：只 patch PV，等下一次挂载生效。生产上卷可能几天不重新发布，运维看不到效果。
- **被否方案**：在 ks-apiserver 里内嵌 JuiceFS 客户端。需要 CGO 与元数据库驱动，镜像会重很多。
- **何时重新考虑**：JuiceFS 提供 HTTP 管理接口时，可去掉 Job。

### DEC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-03 — 颜色只用主题 token

- **为什么**：见概览的 `DEC-...-OVERVIEW-02`。表格正文写死 `#242e42` 时在卡片底上只有 2.12:1。
- **被否方案**：给表格单独加一层深色覆盖。会在 hover、选中、斑马纹上各错一次。
- **何时重新考虑**：主题层变化时。

## 系统现状

- 页面：`console/src/pages/clusters/containers/Storage/JuiceFS/Volumes/index.jsx`、`Volumes/QuotaModal/index.jsx`
- 接口：`kube-server/pkg/kapis/juicefs/v1alpha1/handler.go` 的 `setQuota`，Job 模板在 `job.go`

## 仓库落点

| 层 | 路径 |
| --- | --- |
| 页面 | `console/src/pages/clusters/containers/Storage/JuiceFS/Volumes/index.jsx` |
| 弹窗 | `console/src/pages/clusters/containers/Storage/JuiceFS/Volumes/QuotaModal/index.jsx` |
| 状态 | `console/src/stores/juicefs.js` 的 `setQuota` |
| 接口 | `kube-server/pkg/kapis/juicefs/v1alpha1/{handler.go,job.go}` |

## 对外契约

- **CON-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01** — `PUT /volumes/{pv}` body `{"capacity":"6Ti"}`；成功返回 `{volume, jobName, message}`；容量非法或低于已用返回 400；Job 失败返回 500 且 PV 容量已回滚。
- **CON-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02** — `GET /volumes` 的 `capacityBytes` 来自 PV 的 `spec.capacity`，不是 statfs。

## 不变量

- **INV-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01** — 成功返回后，PV 的 `spec.capacity` 与 JuiceFS 目录 quota 都等于提交值。
- **INV-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02** — 失败返回后，PV 的 `spec.capacity` 等于提交前的值。

## 已知坑

- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01** — Job 的 label 里不能有 `/`。`subPath` 是 `model-cache/public`，直接当 label 值会被 API server 拒绝（`Invalid value`），写路径整条失败。
- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02** — CLI 的 `--capacity` 只接受整数（GiB）或 `5T` 这种后缀，`5Ti` 会被拒。
- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-03** — `Table` 读 `column.render`；`Form.Item` 会覆盖受控 `Input`；`Input.onChange` 是 `(event, value)`。三处都会让表格或弹窗静默失效。

## 测试与可观测

- L3 用例：表格八列与配额值（`TC-...-QUOTA-01`）、弹窗校验与提交（`TC-...-QUOTA-02`）、对比度（并入 01 的可见性断言）。
- 后端单测：`pkg/kapis/juicefs/v1alpha1/handler_test.go` 覆盖 label 合法性、低于已用拒绝、Job 命令拼装。

## 后续改进

- 把 Job 的失败原因结构化为错误码，而不是贴 CLI 输出。

## 验收用例

- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01`
- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02`
