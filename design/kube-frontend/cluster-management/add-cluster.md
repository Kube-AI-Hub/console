# 添加集群（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/add-cluster.md)

## 关联需求

- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-02`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-04`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-05`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-06`

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
| 页面 | `console` | `kube-frontend/apps/console-next/src/pages/cluster/AddClusterDialog.tsx` | 两段式表单、标签/供应商下拉、懒加载编辑器、名称预检、成功通知 |
| 页面 | `console` | `kube-frontend/apps/console-next/src/pages/cluster/MultiClusterListPage.tsx` | 主操作 SSAR 门控 |
| 状态 | `console` | `kube-frontend/packages/api-client/src/cluster.ts` | `group` 进 labels、`exists()`、四个标签、修正的供应商 |
| 状态 | `console` | `kube-frontend/packages/api-client/src/client.ts` | `RequestOptions.headers` |
| 组件 | `console` | `packages/ai-kit/src/utils/focusFirstInvalid.ts` | 校验失败滚到第一个出错字段（通用能力） |
| 组件 | `console` | `packages/ai-kit/src/primitives/FormField.tsx` | `fieldKey` → `data-field-key`，供滚动定位 |
| 文案 | `console` | `kube-frontend/packages/locales/src/index.ts` | `cluster.add.*` 新增键、`cluster.group.demo` |
| 接口 | `kube-server` | `pkg/kapis/cluster/v1alpha1/handler.go` | 不改；前端消化现有 JSON/纯文本 400 与 5xx |
| 接口 | `kube-server` | `pkg/kapis/cluster/v1alpha1/handler.go` 的 `generateAgentDeployment` | 代理接入清单的资源规格（`2Gi`/`100Mi`，见 `CON-…-01`）；单元测试 `TestGeranteAgentDeployment` 断言全文 |

## 对外契约

`POST /apis/cluster.kubesphere.io/v1alpha1/clusters`，body 为完整 Cluster 对象。

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01 — 代理接入清单由 apiserver 生成，资源规格固定

`GET /kapis/cluster.kubesphere.io/v1alpha1/clusters/<name>/agent/deployment` 返回 YAML
（`responseType: 'text'`），内容由 `kube-server/pkg/kapis/cluster/v1alpha1/handler.go` 的
`generateAgentDeployment` 拼装，前端只展示与复制，不参与生成。清单中
`Deployment/cluster-agent`（namespace `kubesphere-system`）的容器 `agent` 固定为：

| 资源 | limit | request |
| --- | --- | --- |
| `memory` | `2Gi` | `100Mi` |
| `cpu` | `1` | `100m` |

三个约束：

- **二进制单位**（`Gi`/`Mi`）。`G`/`M` 是十进制，`2G` 比 `2Gi` 少约 147MB，同一份清单里混用会让
  「源码写 2、Pod 显示 2Gi」在下一次排查时看起来像 bug。
- **limit 远高于稳态**。agent 稳态约 88Mi；2Gi 是 20 倍余量，不是按观测值调优的结果。
- **request 保持 100Mi**。request 是调度预留而非上限，调大只会让 agent 在繁忙节点上更难调度。

**为什么这条契约要写在需求里**：它是成员集群唯一会实际落地的资源声明，而它既不由安装清单
（`ks-installer` 只管 tower）决定，也不由读者在界面上调整——读者能做的只有「复制这段 YAML」。
把它当作实现细节，就会出现「升级平台后新接入的集群资源规格变了」却没有任何文档记录的情况。

## 设计目标与非目标

目标：把「接入一个集群」压缩成两个输入框。非目标：新建集群、编辑连接信息、移除集群。

## 关键约束

- kubeconfig 必须是 base64：直接发 YAML 会创建一个永远连不上的集群（老 console 同样编码）。
- 走 apis 而非 kapis：kapis 对该组写请求返回 400。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-ADD_CLUSTER-01 — 只做导入，不做 KubeKey 新建

**为什么**：新建要求主机清单、SSH 凭据与 kubekey 控制器，且失败会留下半装状态；导入是一次对象写入，是平台日常动作。

**被否方案**：照搬老 console 的双路径。代价是要迁 kubekey 整套表单与轮询，而本部署没有该控制器。

**何时重新考虑**：平台接入裸机自动化流程后。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-ADD_CLUSTER-02 — 提交前做结构校验，不解析 YAML

**为什么**：用户最常见的错误是「粘错了文档」。检查 `apiVersion` / `clusters` / `server` 三个标记即可拦住，且不会因 YAML 方言差异误判。

**被否方案**：引入 YAML 解析器做完整校验。代价是多一个依赖与一类误报，而服务端仍会最终裁定。

**何时重新考虑**：出现「结构正确但内容错误」的高频误用。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-06 — 失败时在对话框内展示服务端原因，并弹出通知

**为什么**：`/clusters/validation` 在**老 console 的部署**里由它自己的服务端返回 **text/plain**（Go `http.Error`），而**直接打 ks-apiserver** 时是 **kube Status JSON**——mlu370 实测（2026-11-17）：非法 kubeconfig → `400 {"kind":"Status","message":"invalid configuration: no configuration has been provided…","reason":"BadRequest"}`。两种形态都要映射，否则前端的错误条只认其中一种部署。新 UI 若把 5xx 一律显示成「网络异常」，jwtSecret / clusterRole 这类配置错误看起来像超时。老 console 的 `validate()` 还把 reject 回调参数顺序写反了一半路径，`err.message` 经常是空的，全局 `onunhandledrejection` 又包了一层 `t(message)`，页面上只剩「校验失败。」。读者需要的是对话框**顶部**留得住的说明（表单字段多时底部提示条会卷到 `max-h-[70vh]` 下面、被确认按钮挡住），外加一条**不自动关闭**的失败通知。

**被否方案**：只弹 toast、不写进表单。全屏添加向导和 Modal 都会挡住或盖住短时 toast，用户关掉通知后原因就没了。只改后端错误码、不改前端：部署周期更长，且已发出的 400 原文仍然可以被映射。

**何时重新考虑**：两种正文形态统一之后，映射表可以收成按 `reason` 分支。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-07 — 两段式表单，不做多步向导

**为什么**：老 console 的两步（基本信息 / 连接设置）是 `FullCreate` 向导骨架带来的，八个字段不需要分页；而分步之后「别名打错了要回去改」就变成两次翻页。同一对话框内分两个带标题的 `section` 保留了信息分组，又让所有字段随时可改。

**被否方案**：照搬两步向导。代价是自建步骤状态机、每步校验门控，以及「上一步里已填内容与当前步不一致」这类边界。

**何时重新考虑**：字段增长到一屏放不下（批量接入、按供应商展开不同字段）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-08 — 名称预检只提示，不拦截提交

**为什么**：预检是**提前告知**，不是授权判定。把它当门禁会制造「预检失败但服务端其实能建」的假阻塞（网络抖动、权限差异、端点缺失）。因此命中时在字段下方提示、改名后提示消失，提交照常发出，由服务端 409 裁决。

**被否方案**：命中即禁用提交按钮。一次预检失败就把表单锁死，读者无法自行恢复。

**何时重新考虑**：预检变成强一致且必达（与服务端共用同一个写锁）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-09 — kubeconfig 用懒加载编辑器

**为什么**：`YamlEditor` 是 188 KB gzip 的 CodeMirror。集群列表是平台首页之一，多数读者只看列表；静态引进对话框文件会让列表首屏也下载它。`React.lazy` + `@kube-ai-hub/ui/editor` 子路径与 `ConfigMapYamlDialog` 走同一条懒加载路径。

**被否方案**：继续用 `<textarea>`。没有语法高亮与括号匹配，几百行 kubeconfig 粘贴后难以核对，而这正是最容易出错的一步。

**何时重新考虑**：编辑器体积降到不影响首屏，或对话框改为独立路由。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-10 — agent 内存上限取 2Gi，不按观测值调优

**为什么**：`cluster-agent` 把所有成员集群请求复用在一到两条 SSH 连接上，链路上每次重传都会让
对应的 channel 缓冲多留一会儿。mlu370 → A100 实测（2026-11-18）：RTT 60ms、丢包 11–27%，同一
监控接口在 0.1s 与 31s 之间抖动，代理侧每分钟约 100 次 discovery 请求、峰值 600+。

旧值 `200M` 下容器被 **OOMKilled**（exit 137）。失败模式不是「某个面板慢」，而是整条隧道断开 →
`Cluster/<name>` 的 `Ready` 翻成 False → 所有集群域接口返回 `500 cluster <name> is not ready`，
直到 agent 重连。也就是说，用几十 MB 的余量去赌一个集群是否可达。

因此 limit 取稳态（~88Mi）的 20 倍：limit 只在真正使用时才占用节点内存，多留的余量不产生调度成本，
而一次 OOM 的代价是整个成员集群不可用。大集群（更多并发代理读）正是这条要保护的情况。

**被否方案**：
- **按观测峰值 × 2（约 512Mi）**。观测窗口只覆盖当时的负载；大集群并发上来后仍会重演，且这类
  故障只在生产规模下暴露，代价高。
- **调高 request 到 2Gi**。request 是调度预留，会把 agent 从繁忙节点上挤掉，反而更容易起不来。

**何时重新考虑**：agent 改为每请求一条独立连接（不再复用 SSH），单连接缓冲不再是瓶颈；或代理
流量被移到 sidecar / 独立组件。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-11 — 校验失败滚到第一个出错字段（用 ai-kit 的通用实现）

**为什么**：对话框正文在 `max-h-[70vh] overflow-y-auto` 里滚动，连接设置位于基本信息下方。只填了名称就点确认时，kubeconfig 的错误渲染在可视区之下（实测 443px），读者看到的是「按钮没反应」。这不是本页独有的问题：任何比容器高的表单都有同一种失败，所以实现放在 ai-kit。

**两层**，因为有的对话框知道哪个字段失败、有的不知道：

1. `focusFirstInvalidField`（`packages/ai-kit/src/utils/focusFirstInvalid.ts`）——提交路径。`ResourceForm` 与手写对话框共用。
2. `observeHiddenErrors`（`packages/ai-kit/src/utils/observeHiddenErrors.ts`）——渲染路径。挂在 `Modal` 的滚动体上，`MutationObserver` 观察 `[role="alert"]` 与 `[data-invalid="true"]`，把第一个不在可视区的错误滚入视野。覆盖全部 73 个对话框，包括手写校验的，不需要逐个改。

两条规则避免打扰：错误已在屏上不滚动；一次提交多个错误只滚第一个。空 `role="alert"` 占位不滚。

**被否方案**：每个对话框各写一份滚动逻辑。已经发生过：本页第一版把逻辑写在自己文件里，`ResourceForm` 里另有一份，两处的滚动位置与焦点目标不同。**逐个改 73 个对话框**也被否：改漏一个就少一处，而 Modal 层一次覆盖。

**何时重新考虑**：表单改为独立路由页（滚动容器变成页面本身）时，`block: 'center'` 仍适用，但 `focus()` 的 `preventScroll` 需要重新评估。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-10 — 主操作按 SSAR 门控

**为什么**：老 console 用账号规则里的 `clusters:create` 决定是否显示入口。新 UI 没有服务端注入的规则表，用 `SelfSubjectAccessReview` 问集群本身（与成员页同一写法），失败时 fail-open——权限检查坏掉不该收走一个本来允许的动作。

**被否方案**：不门控，让 403 在提交时暴露。读者填完整张表单才被告知没有权限，且失败提示看起来像产品错误。

**何时重新考虑**：SSAR 延迟影响首屏（当前是独立查询，不阻塞列表）。

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03 — 校验失败的可见契约

`POST /kapis/cluster.kubesphere.io/v1alpha1/clusters/validation` 失败时的正文有两种形态：老 console 的服务端是**纯文本**（Go `http.Error`），ks-apiserver 直连是 **kube Status JSON**。前端必须把这段原文（或映射后的句子）写进 `data-ai-id="clusters:add-error"`，不得替换成通用「网络异常」。已知原文（JSON 取 `message`）：

| 服务端原文片段 | 界面说明 |
| --- | --- |
| `Jwt is not equal` | jwtSecret 不一致 |
| `clusterRole of the member cluster must be` | clusterRole 必须是 host 或 member |
| `unable validate kubesphere endpoint` | 成员集群平台 API 不可达 |
| `MUST not import the same cluster twice` | 已接入，不能重复导入 |
| `timeout` / `connection refused` / `dial tcp` | API 地址不可达 |
| 空 5xx / `Internal Server Error` | 内部错误（缺 clusterRole 或 jwt 不一致时常触发 panic） |
| `invalid configuration: …` | kubeconfig 无法解析（kube Status JSON 的常见 400） |

## 不变量

1. 提交的 `spec.connection.kubeconfig` 一定是 base64。
2. 客户端结构校验失败不发请求。
3. 服务端校验或创建失败不关闭对话框、不创建 Cluster 对象，错误必须出现在 `clusters:add-error`。
4. 标签选「无」时对象上没有 `cluster.kubesphere.io/group` 键。
5. 名称预检失败不影响提交（提交由服务端裁决）。

## 已知坑

- `primaryAction` 只带 `key`，点击经 `onAction` 回到页面；给它加 `onClick` 编译期不报错但运行时无反应（本页第一版就是这样）。
- 集群接入后不会立刻 Ready，列表要展示控制器给出的原因，否则用户以为接入失败。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03**：`request.js` 对 JSON 400 调用 `reject(error, response)`，对 text/plain 400 调用 `reject(response, error)`。老 store 若只读第二个参数，一半路径拿不到 `message`。不知道会怎样：页面只显示「校验失败。」，正文空白。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-04**：成员集群配置没有 `multicluster` 时，`validateMemberClusterConfiguration` 解引用空指针，校验接口 500 且正文为空。不知道会怎样：新 UI 若走 `error.retryable` 会显示「网络异常」。前端把空 5xx 映射为内部错误说明。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-05**：`validateMemberClusterConfiguration` 失败后缺 `return`，可能先写 400 再尝试 200。不知道会怎样：偶发「校验过了但创建失败」。前端对两次请求的失败都展示同一套错误条。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-06**：Radix `Select` 拒绝 `value: ''` 的选项（它把空串保留给"未选择"）。标签下拉的「无」必须用哨兵值（本页用 `__none__`）再映射回 `''`；不知道会在渲染时直接抛错，整个对话框白屏。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-07**：`x-check-exist` 必须走 `RequestOptions.headers`，而客户端原先只支持 `contentType`。且它返回 **200 `{exist:false}`** 而不是 404——按状态码判断会把"名字可用"读成"查询失败"。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-08**：老 console 的供应商常量里 Azure 存的是 `Aure Kubernetes Service`（源码拼写错误）。新数据用修正后的 `Azure Kubernetes Service`，但既有对象保持原值——不要做数据迁移。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-09**：kubeconfig 控件是 CodeMirror，**没有 id**。按 `#ai-field-cluster-kubeconfig` 查找会落空，只有 `FormField` 的 `data-field-key` 能定位它；`focusFirstInvalidField` 因此先按 key 找、再按 id 找。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-10**：`scrollIntoView({ block: 'nearest' })` 会把贴着底边的字段滚到边上，它下方的错误行仍被裁掉。用 `'center'`。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-11**：`DialogPrimitive.Portal` 的内容在**后续 commit** 才挂载，`useEffect` 里 `bodyRef.current` 仍是 `null`。给 Modal 的滚动体挂 observer 必须用 callback ref（或 state），否则 observer 静默不存在。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-12**：测试里打桩 `scrollIntoView` 要打在 `HTMLElement.prototype` 上；应用测试的 `setup.ts` 已在该原型上定义空实现，打在 `Element.prototype` 上会被子类覆盖，看起来像产品没生效。

## 测试与可观测

- 单测：`formatClusterImportError` 映射 jwt / clusterRole / 空 5xx；`cluster-import.test.ts` 覆盖 group 标签、`exists()` 的路径与请求头、四个标签与七个供应商；`cluster-add-dialog.test.tsx` 覆盖两段结构、标签/供应商选项、代理模式隐藏编辑器、名称预检、JSON 400 映射；`client.test.ts` 覆盖自定义头与 Authorization 共存。
- E2E：`TC-…-ADD_CLUSTER-01` 成功路径（含标签与供应商回读）；`-03` 拦截 validation 400，断言对话框提示与未建对象；`-04` 预检命中；`-05` SSAR 拒绝时主操作禁用。

## 后续改进

- 移除集群、更新 kubeconfig。
- 接入进度（等待 Ready 的轮询提示）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-04`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-05`
