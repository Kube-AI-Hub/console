# 设置 vGPU 模式（L3）

[子模块需求](./_index.md)

## 概述

节点列表的行操作「设置vGPU模式」。运维选模式（`default` / `hami-core` / `mig`）与该模式的参数（切分数、显存倍率、算力倍率），提交后由 gpu-agent 落地。对话框是这条链路的**唯一人工入口**。

## 用户故事

### US1 - 作为集群运维，把节点切成 hami-core 并设置切分数

**Independent Test**：对 `sagesuite-demo` 选 `hami-core`、切分数 10、显存与算力倍率 1，提交后成功提示；节点列表模式列先显示「切换中：hami-core」，再显示 `hami-core`。

### US2 - 作为集群运维，切到 MIG 前看到破坏性提示

**Independent Test**：选 `mig` 后对话框出现「会销毁该节点上现有的 MIG 实例」的警告文字。

### US3 - 作为集群运维，把昆仑芯节点切到独占

**Independent Test**：厂商为 `kunlunxin` 时可选 `default`，没有切分数输入。提交体是 `mode=default` 且 `params` 为 `{}`。

### US4 - 作为集群运维，把昆仑芯节点切到 hami-core

**Independent Test**：选 `hami-core` 后仍没有切分数、显存倍率、算力倍率。提交体是 `mode=hami-core` 且 `params` 为 `{}`。说明文字包含 `kunlunxin.com/vxpu`。

### US5 - 作为集群运维，在子集群节点列表上设置 vGPU 模式

**Independent Test**：打开 `/clusters/xc/nodes`，对 `node201-xpu` 选 `hami-core` 后确定。请求是 `PUT /kapis/gpu.kubesphere.io/v1alpha1/device-plugins/gpu/mode?nodeName=node201-xpu&cluster=xc`，成功提示；若失败，提示为「更新失败：」加上接口返回的 `message`。

## 验收场景

- **AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01** — Given 节点当前是 `default`，When 在对话框选 `hami-core` 并把切分数填成 10 后确定，Then 请求体里 `mode=hami-core`、`params.devicesplitcount=10`，成功后列表模式列先变「切换中」再变 `hami-core`。
- **AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02** — Given 节点当前是 `hami-core`，When 选 `default` 后确定，Then 请求体里 `mode=default` 且 `params` 为空对象，切换完成后 `vgpu` 标签为 `off`。
- **AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-03** — Given 节点厂商是 `kunlunxin` 且当前为 `hami-core`，When 选 `default` 后确定，Then 请求体是 `{mode: default, params: {}}`，对话框没有切分数输入。
- **AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-04** — Given 节点厂商是 `kunlunxin` 且当前为 `default`，When 选 `hami-core` 后确定，Then 请求体是 `{mode: hami-core, params: {}}`，说明文字写明资源名 `kunlunxin.com/vxpu` 与 `kunlunxin.com/vxpu-memory`。
- **AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-05** — Given 当前页面是子集群 `/clusters/xc/nodes` 且节点 `node201-xpu` 只存在于该子集群，When 提交 vGPU 模式，Then 请求 query 含 `cluster=xc`，写到子集群 Node 而不是 host；失败时提示文案为已翻译的「更新失败」加上接口 `message`，而不是裸的 `UPDATE_FAILED`。

## 设计目标

- **对话框只提交意图，不提交实现。** 请求体只有 `{mode, params}`，gpu-agent 决定改哪些 label / ConfigMap、重启哪些 Pod。这样 HAMi 调整落地方式时页面不用改。
- **参数默认值来自服务端的当前状态，而不是硬编码。** 打开对话框时用 `node-gpu-info` 里的 `virtualCardMode` 与 `gpuModeParams` 回填；只有当前没有该参数时才用配置表的默认值。否则运维每次打开都看到「10」，会误以为节点已经是 10。

## 约束与边界

- 请求走 `PUT /kapis/gpu.kubesphere.io/v1alpha1/device-plugins/gpu/mode?nodeName=<node>&cluster=<cluster>`，body `{"mode": "...", "params": {"devicesplitcount": "10"}}`。`params` 的值必须是**字符串**（后端按字符串存进 `gpu-mode-desired` 注解）。`cluster` 是当前页面的集群名；不要写成 `/kapis/clusters/<cluster>/gpu.kubesphere.io/...`（那条路径会被代理到子集群自己的 ks-apiserver）。
- 参数键固定为 `devicesplitcount` / `devicememoryscaling` / `devicecorescaling`，与 `hami-device-plugin` ConfigMap 的 `nodeconfig` 字段同名——中间不做改名，否则 gpu-agent 要维护映射表。
- `nvidia` 与 `cambricon`、`kunlunxin` 都有 `modeOptions`。昆仑芯只有 `default` 与 `hami-core`，参数为空。未配置的厂商对话框只显示「不支持」。
- 提交后不等待结果就关闭对话框；结果通过节点列表的模式列观察。

## UI 交互设计

| 元素 | 默认值 | 校验 |
| --- | --- | --- |
| 模式下拉 | `node-gpu-info.virtualCardMode`，缺省 `default` | 必填 |
| 切分数 | `gpuModeParams.devicesplitcount`，缺省 10 | 数字，≥ 1 |
| 显存倍率 | `gpuModeParams.devicememoryscaling`，缺省 1 | 数字，> 0 |
| 算力倍率 | `gpuModeParams.devicecorescaling`，缺省 1 | 数字，> 0 |
| 确定 | — | 提交中禁用，防重复提交 |
| 取消 | — | 关闭，不发请求 |

切换模式的说明文字随模式变化：`default` 说明「整卡分配，使用 nvidia.com/gpu」；`hami-core` 说明「软件虚拟化，一张卡可切给多个任务，显存与算力隔离有限」；`mig` 说明「物理虚拟化，算力与显存严格隔离，切换会销毁现有 MIG 实例」。

## 文案与校验

| 字段 | 形态 | 说明 |
| --- | --- | --- |
| `mode` | 下拉 | `default` / `hami-core` / `mig` |
| `params.devicesplitcount` | 数字输入 | 一张卡最多切给几个任务；`hami-core` 下决定 `nvidia.com/vgpu` 总量 |
| `params.devicememoryscaling` | 数字输入 | 上报显存倍率；> 1 时允许超卖 |
| `params.devicecorescaling` | 数字输入 | 上报算力倍率 |

空值不提交（`params` 里省略该键），由 gpu-agent 用 ConfigMap 里已有的值或 chart 默认值。

## 边界情况

| 情况 | 对外行为 |
| --- | --- |
| 节点没有 GPU | 行操作不出现 |
| 厂商不支持 | 对话框只显示警告，无确定按钮 |
| 无 `nodes:edit` 权限 | 行操作不出现（菜单按 `authAction` 控制） |
| 提交返回 404（节点不存在） | 提示「更新失败：」加上接口 `message`，对话框保留 |
| 提交返回 500 | 提示「更新失败：」加上接口 `message`，对话框保留，可重试 |
| 子集群节点 | 请求带 `cluster=<id>`，由 host ks-apiserver 用该集群 kubeconfig 写 Node |
| 切换进行中再次打开对话框 | 允许打开（展示当前模式），提交会由后端拒绝并提示 |
| 切分数填 0 或负数 | 前端拦截，提示「必须大于 0」 |

## 功能需求

- **FR-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01**：系统必须在对话框打开时用节点当前模式与参数回填。
- **FR-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02**：系统必须把 `params` 的值序列化成字符串再提交。
- **FR-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-05**：系统必须把当前页面的集群名作为 `cluster` query 交给 host 上的 GPU 模式接口，并在失败时展示已翻译的「更新失败」与接口详情。

## 成功标准

- **SC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01**：提交一次切换后，`hami.io/gpu-mode-desired` 注解在 5 秒内出现，且 `mode` 与提交值一致。
- **SC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-05**：在 `/clusters/xc/nodes` 提交后，子集群 Node 上出现 `hami.io/gpu-mode-desired`，host 节点注解不变；失败 toast 含「更新失败」且含后端 `message`。

## 明确不做

- 不在对话框里展示切换进度条（进度由节点列表的模式列表达）。
- 不做「仅预览」或 dry-run。
- 不允许在一次提交里改多台节点。

## 假设

- `GET /kapis/gpu.kubesphere.io/v1alpha1/gpus?conditions=nodeName=<node>` 返回的 `nodeInfo` 含 `virtualCardMode` 与 `gpuModeParams`。
- gpu-agent 在 5 分钟内处理 `gpu-mode-desired`（它 watch 该注解）。

## 验收用例

- L3：`TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01`、`TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02`、`TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-03`、`TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-04`、`TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-05`
