# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-01 集群显卡 · 列表健康比例与单卡详情

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `gpu`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/gpus`
- **需求**: `prd/kube-frontend/cluster-management/gpu.md`

## 产品功能

集群显卡列表（节点/序号/显卡 ID/状态/型号/显存/厂商 + 服务端汇总的健康比例）与单卡详情（节点/序号/型号/厂商/显存/健康）。

### 关联需求

- `prd/kube-frontend/cluster-management/gpu.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/gpu.md`](../../../../prd/kube-frontend/cluster-management/gpu.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-01** — 已知集群有 GPU 节点，当打开集群显卡列表，则每张物理卡一行（节点 / 序号 / 显卡 ID / 状态 / 型号 / 显存（已用 / 总量）/ 厂商），行数等于接口 items 数、健康行数等于 `health:true` 的计数，顶部显示服务端汇总的健康比例；点某一行的显卡 ID 进入单卡详情，详情页的显卡 ID 与该行一致，节点 / 序号 / 型号 / 厂商 / 显存 / 健康状态可读；该 UUID 已不存在时显示明确提示而不是空白页。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/gpu.md`](../../../../design/kube-frontend/cluster-management/gpu.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/gpu.md`](../../../../prd/kube-frontend/cluster-management/gpu.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 集群运维按节点核对每张卡的健康状态

作为 **集群运维**，我希望 **在集群显卡列表里按节点核对每张卡的状态**，以便 **判断某台机器是否还能继续接收 GPU 任务**。

**Independent Test**：打开 `/clusters/host/gpus`，表格行数等于 `GET /kapis/gpu.kubesphere.io/v1alpha1/gpus` 的 items 数，健康行数等于 `health:true` 的条数，顶部健康比例与 `/gpus/stats` 一致。

### US2 - 点进单卡看到它的详细属性

作为 **集群运维**，我希望 **点一张卡看到它的节点、序号、UUID、型号、厂商、显存与用量**，以便 **在列表只给出状态结论时继续下钻**。

**Independent Test**：从列表点某个显卡 ID 进入 `/clusters/host/gpus/<uuid>`，详情页的显卡 ID 与被点行一致，节点、序号、型号、厂商、显存与状态可读。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群至少有一个 GPU 节点（HAMi device plugin 在跑），否则用例 skip

## 测试步骤

1. 用 API 读 GET /kapis/gpu.kubesphere.io/v1alpha1/gpus?limit=-1，记下 items 数、health:true 条数与每张卡的 UUID
2. 读 GET /gpus/stats，记下 total / healthy
3. 打开 /kube-frontend/clusters/<cluster>/gpus，等页面 ready
4. 核对行数 = items 数，且每行状态与对应 UUID 的 health 一致，健康行数 = health:true 条数
5. 核对顶部健康比例的 data-ai-total / data-ai-healthy 与 stats 一致
6. 点第一行的显卡 ID 进入详情，核对详情 UUID 与所点行一致，节点/序号/型号/厂商/显存在页面上可读
7. 打开一个不存在的 UUID，核对显示「这张显卡不存在」

## 期望结果

- 列表行数等于接口 items 数，健康行数等于 health:true 计数
- 顶部比例来自 /gpus/stats（data-ai-total / data-ai-healthy 与接口一致）
- 详情页 UUID 与所点行一致，字段与接口 item 一致
- 不存在的 UUID 显示明确提示而不是空白页

## 失败排查

- 行数少：列表请求漏了 limit=-1，接口默认分页只回 10 条
- 一直 loading：GPU 接口 404/500（扩展未注册）或页面仍是旧包（改完要 vite build）
- 状态全绿但机器实际摘了卡：gpu-agent 的汇总问题（见 design 已知坑），不是页面
- 详情 404：路由未重新生成（新增 routes 后要 vite build）

## 产品改版后如何更新自动化

- 选择器见 GpusPage.tsx / GpuDetailPage.tsx：cluster-gpus:surface / cluster-gpus:health / cluster-gpus:row:<uuid> / gpu-detail:surface / gpu-detail:uuid
