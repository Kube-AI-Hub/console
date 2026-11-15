# TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-05 设置 vGPU 模式 · 子集群请求带 cluster 且失败展示详情

- **用例 ID**: `TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-05`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `vgpu-mode` `switch`
- **入口**: `{BASE_URL}/clusters/xc/nodes`
- **需求**: `prd/cluster-gpu/vgpu-mode/switch.md`

## 产品功能

子集群节点页提交 vGPU 模式时请求带 cluster=xc；失败提示为已翻译的「更新失败」加上接口 message。

### 关联需求

- `prd/cluster-gpu/vgpu-mode/switch.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/vgpu-mode/switch.md`](../../../../prd/cluster-gpu/vgpu-mode/switch.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-05** — Given 当前页面是子集群 `/clusters/xc/nodes` 且节点 `node201-xpu` 只存在于该子集群，When 提交 vGPU 模式，Then 请求 query 含 `cluster=xc`，写到子集群 Node 而不是 host；失败时提示文案为已翻译的「更新失败」加上接口 `message`，而不是裸的 `UPDATE_FAILED`。

### 关联设计

- 技术方案 [`design/cluster-gpu/vgpu-mode/switch.md`](../../../../design/cluster-gpu/vgpu-mode/switch.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/vgpu-mode/switch.md`](../../../../prd/cluster-gpu/vgpu-mode/switch.md)，与用例的 `story` 对应；改需求即改这里。

### US5 - 作为集群运维，在子集群节点列表上设置 vGPU 模式


**Independent Test**：打开 `/clusters/xc/nodes`，对 `node201-xpu` 选 `hami-core` 后确定。请求是 `PUT /kapis/gpu.kubesphere.io/v1alpha1/device-plugins/gpu/mode?nodeName=node201-xpu&cluster=xc`，成功提示；若失败，提示为「更新失败：」加上接口返回的 `message`。

## 前置与配置

- 已登录
- 存在成员集群 xc，且页面 /clusters/xc/nodes 能列出 GPU 节点

## 测试步骤

1. 打开 {BASE_URL}/clusters/xc/nodes
2. 拦截 PUT /kapis/gpu.kubesphere.io/v1alpha1/device-plugins/gpu/mode，记录 URL，返回 404 且 body 含 error 与 message
3. 对 GPU 节点打开设置 vGPU 模式并确定

## 期望结果

- 拦截到的 URL query 含 cluster=xc 与 nodeName
- URL 不含 /kapis/clusters/xc/
- toast 含「更新失败」以及接口 message，不含字面量 UPDATE_FAILED

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 接口改走 /kapis/clusters/<id>/ 路径时代理会丢掉 host handler，本用例必须失败
