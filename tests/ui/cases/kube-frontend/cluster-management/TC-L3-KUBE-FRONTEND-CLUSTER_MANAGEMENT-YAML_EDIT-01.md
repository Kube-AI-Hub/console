# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01 编辑 YAML · 存储类型改注解，四类详情页都有入口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `yaml-edit`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/storageclasses`
- **需求**: `prd/kube-frontend/cluster-management/yaml-edit.md`

## 产品功能

节点、持久卷、存储类型与网络策略的详情页各提供「编辑 YAML」；在存储类型详情里上传一份带新注解的 YAML 并保存后，回读对象确认注解存在、名称未变；非法 YAML 不能提交。

### 关联需求

- `prd/kube-frontend/cluster-management/yaml-edit.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/yaml-edit.md`](../../../../prd/kube-frontend/cluster-management/yaml-edit.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01** — 已知节点、持久卷、存储类型与网络策略的详情页各有「编辑 YAML」入口；当在存储类型详情里打开该弹窗、修改一处注解并保存，则对象被更新（回读注解一致、名称不可修改）；当编辑后的 YAML 不能解析或名称被改，则提交被拦下并提示；服务端拒绝或资源版本冲突时弹窗保持打开并显示错误。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/yaml-edit.md`](../../../../design/kube-frontend/cluster-management/yaml-edit.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/yaml-edit.md`](../../../../prd/kube-frontend/cluster-management/yaml-edit.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在只读详情页上改一处 YAML (Priority: P1)

作为 **集群管理员**，我希望 **在持久卷/存储类型/节点/网络策略的详情页直接编辑 YAML 并保存**，以便 **改列表没暴露的字段时不必依赖 kubectl 与 kubeconfig**。

**Independent Test**：打开一个存储类型详情，点「编辑 YAML」，给对象加一个注解并保存，回读对象确认注解存在且名称未变。

## 前置与配置

- 由用例的 fixture 创建一个 tc-e2e- 前缀的存储类型与网络策略，用例结束后无条件删除
- 已登录，且在 host 集群

## 测试步骤

1. 打开节点/持久卷/存储类型/网络策略的详情，确认各有「编辑 YAML」
2. 在存储类型详情打开编辑 YAML，确认初始文档包含对象名
3. 上传一份只改注解的 YAML，保存并回读对象
4. 重新打开编辑 YAML，上传非法 YAML，读取保存按钮状态

## 期望结果

- 四类详情页的编辑 YAML 入口可见（持久卷列表为空时该项跳过并在断言中注明）
- 初始文档包含 metadata.name
- 保存后回读 metadata.annotations 含新注解，metadata.name 不变
- 非法 YAML 时保存按钮禁用

## 失败排查

- 保存 404 时检查写路径是否为 /apis/storage.k8s.io/v1/storageclasses
- 列表为空时先确认该集群确实没有对应对象，不要伪造通过

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts 的 resource.action.editYaml
- 弹窗结构变化时改本用例的 data-ai-id 选择器
