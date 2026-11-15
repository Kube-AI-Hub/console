# 添加集群（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/add-cluster.md)

## 关联需求

- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-02`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03`

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

| 层 | 仓库 | 路径 | 改动 |
| --- | --- | --- | --- |
| 页面 | `console` | `kube-frontend/apps/console-next/src/pages/cluster/AddClusterDialog.tsx` | 对话框内 Alert + Notify |
| 页面 | `console` | `src/components/Forms/Cluster/Configuration/index.jsx` | 老向导连接设置步的错误条 |
| 状态 | `console` | `src/stores/cluster/index.js`、`src/actions/cluster.js` | 校验失败写入 `validationError` 并 Notify |
| 文案 | `console` | `kube-frontend/packages/locales`、`locales/{zh,en}/l10n-clusterManagement-clusters.js` | 失败原因映射 |
| 接口 | `kube-server` | `pkg/kapis/cluster/v1alpha1/handler.go` | 不改；前端消化现有 text/plain 400/5xx |

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

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-06 — 失败时在对话框内展示服务端原因，并弹出通知

**为什么**：`/clusters/validation` 用 `http.Error` 返回 **text/plain**。新 UI 若把 5xx 一律显示成「网络异常」，jwtSecret / clusterRole 这类配置错误看起来像超时。老 console 的 `validate()` 还把 reject 回调参数顺序写反了一半路径，`err.message` 经常是空的，全局 `onunhandledrejection` 又包了一层 `t(message)`，页面上只剩「校验失败。」。读者需要的是对话框**顶部**留得住的说明（表单字段多时底部提示条会卷到 `max-h-[70vh]` 下面、被确认按钮挡住），外加一条**不自动关闭**的失败通知。

**被否方案**：只弹 toast、不写进表单。全屏添加向导和 Modal 都会挡住或盖住短时 toast，用户关掉通知后原因就没了。只改后端错误码、不改前端：部署周期更长，且已发出的 400 原文仍然可以被映射。

**何时重新考虑**：校验接口改为 kube `Status` JSON（带 `reason`/`code`）之后，映射表可以收成按 `reason` 分支。

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03 — 校验失败的可见契约

`POST /kapis/cluster.kubesphere.io/v1alpha1/clusters/validation` 失败时正文是纯文本（Go `http.Error`），不是 kube Status。前端必须把这段原文（或映射后的句子）写进 `data-ai-id="clusters:add-error"`，不得替换成通用「网络异常」。已知原文：

| 服务端原文片段 | 界面说明 |
| --- | --- |
| `Jwt is not equal` | jwtSecret 不一致 |
| `clusterRole of the member cluster must be` | clusterRole 必须是 host 或 member |
| `unable validate kubesphere endpoint` | 成员集群平台 API 不可达 |
| `MUST not import the same cluster twice` | 已接入，不能重复导入 |
| `timeout` / `connection refused` / `dial tcp` | API 地址不可达 |
| 空 5xx / `Internal Server Error` | 内部错误（缺 clusterRole 或 jwt 不一致时常触发 panic） |

## 不变量

1. 提交的 `spec.connection.kubeconfig` 一定是 base64。
2. 客户端结构校验失败不发请求。
3. 服务端校验或创建失败不关闭对话框、不创建 Cluster 对象，错误必须出现在 `clusters:add-error`。

## 已知坑

- `primaryAction` 只带 `key`，点击经 `onAction` 回到页面；给它加 `onClick` 编译期不报错但运行时无反应（本页第一版就是这样）。
- 集群接入后不会立刻 Ready，列表要展示控制器给出的原因，否则用户以为接入失败。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03**：`request.js` 对 JSON 400 调用 `reject(error, response)`，对 text/plain 400 调用 `reject(response, error)`。老 store 若只读第二个参数，一半路径拿不到 `message`。不知道会怎样：页面只显示「校验失败。」，正文空白。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-04**：成员集群配置没有 `multicluster` 时，`validateMemberClusterConfiguration` 解引用空指针，校验接口 500 且正文为空。不知道会怎样：新 UI 若走 `error.retryable` 会显示「网络异常」。前端把空 5xx 映射为内部错误说明。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-05**：`validateMemberClusterConfiguration` 失败后缺 `return`，可能先写 400 再尝试 200。不知道会怎样：偶发「校验过了但创建失败」。前端对两次请求的失败都展示同一套错误条。

## 测试与可观测

- 单测：`formatClusterImportError` 映射 jwt / clusterRole / 空 5xx；对话框在 400 后显示 `clusters:add-error`。
- E2E：`TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01` 成功路径；`-03` 拦截 validation 400，断言对话框提示与未建对象。

## 后续改进

- 移除集群、更新 kubeconfig。
- 接入进度（等待 Ready 的轮询提示）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03`
