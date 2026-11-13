# 添加集群（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/add-cluster.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-02

## 概述

集群列表的主操作：粘贴成员集群 kubeconfig，创建 Cluster 对象完成接入。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-ADD_CLUSTER-04 — 别名与描述在创建时写入

**为什么**：两者都存在注解里，创建时一次写上，与后来「编辑信息」写的是同一处。分两步做会让「刚接入的集群在列表里只有对象名」成为常态，而列表正是读者确认接入成功的地方。

**被否方案**：创建后自动打开编辑弹窗。多一步打断，且用户可能只想先接上。

**何时重新考虑**：接入流程需要分步向导（例如批量接入）时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-ADD_CLUSTER-05 — 代理连接要说明「提交之后会怎样」

**为什么**：代理连接的集群提交后**立即出现但不会就绪**。不提前说，读者会把它当成接入失败；说清楚「等待代理部署」后，未就绪就是一个预期状态。

**被否方案**：等就绪后再出现在列表。读者会以为提交没生效。

**何时重新考虑**：平台能生成接入清单时（本安装未部署 tower 组件，清单接口返回错误），可把清单直接放进对话框。

## 系统现状

老 console 的「添加集群」（`src/actions/cluster.js` 的 `cluster.add`）有两条路径：
`way-to-add: new` 用 KubeKey 新建集群，另一条导入已有集群。表单模板 `IMPORT_CLUSTER_SPEC`：

```yaml
spec:
  provider: ''
  connection: { type: direct, kubeconfig: '' }
  joinFederation: true
```

导入时 kubeconfig 先 `safeBtoa` 再写入。本页实现导入这一条。

## 仓库落点

- `apps/console-next/src/pages/cluster/AddClusterDialog.tsx`
- `apps/console-next/src/pages/cluster/MultiClusterListPage.tsx`（主操作）
- `packages/api-client/src/cluster.ts` 的 `clusterImportApi`

## 对外契约

`POST /apis/cluster.kubesphere.io/v1alpha1/clusters`，body 为完整 Cluster 对象。

## 设计目标与非目标

目标：把「接入一个集群」压缩成两个输入框。非目标：新建集群、编辑连接信息、移除集群。

## 关键约束

- kubeconfig 必须是 base64：直接发 YAML 会创建一个永远连不上的集群（老 console 同样编码）。
- 走 apis 而非 kapis：kapis 对该组写请求返回 400。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-ADD-CLUSTER-01 — 只做导入，不做 KubeKey 新建

**为什么**：新建要求主机清单、SSH 凭据与 kubekey 控制器，且失败会留下半装状态；导入是一次对象写入，是平台日常动作。

**被否方案**：照搬老 console 的双路径。代价是要迁 kubekey 整套表单与轮询，而本部署没有该控制器。

**何时重新考虑**：平台接入裸机自动化流程后。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-ADD-CLUSTER-02 — 提交前做结构校验，不解析 YAML

**为什么**：用户最常见的错误是「粘错了文档」。检查 `apiVersion` / `clusters` / `server` 三个标记即可拦住，且不会因 YAML 方言差异误判。

**被否方案**：引入 YAML 解析器做完整校验。代价是多一个依赖与一类误报，而服务端仍会最终裁定。

**何时重新考虑**：出现「结构正确但内容错误」的高频误用。

## 不变量

1. 提交的 `spec.connection.kubeconfig` 一定是 base64。
2. 校验失败不发请求。

## 已知坑

- `primaryAction` 只带 `key`，点击经 `onAction` 回到页面；给它加 `onClick` 编译期不报错但运行时无反应（本页第一版就是这样）。
- 集群接入后不会立刻 Ready，列表要展示控制器给出的原因，否则用户以为接入失败。

## 测试与可观测

E2E：`tests/kube-frontend/cluster-management/`，创建后读回对象校验 type/base64/joinFederation，并在 `finally` 删除。

## 后续改进

- 移除集群、更新 kubeconfig。
- 接入进度（等待 Ready 的轮询提示）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01`
