# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-03 单卡详情 · 监控和关联资源

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `gpu`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/gpus`
- **需求**: `prd/kube-frontend/cluster-management/gpu.md`

## 产品功能

单卡指标与关联任务具有准确的身份和单位。

### 关联需求

- `prd/kube-frontend/cluster-management/gpu.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/gpu.md`](../../../../prd/kube-frontend/cluster-management/gpu.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-03** — 单卡详情使用共享页签，概览、容器组、监控与所属节点事件按需加载。容器组由服务端同时按 gpuUuid 与 nodeName 过滤，支持搜索和分页；节点事件标明不是显卡专属事件。监控以节点及 GPU UUID 请求 1h/6h/24h 的利用率、显存、分配率、功率和温度，显存 bytes 换算 GiB，百分比保持后端百分数，功率 W、温度 C。零值仍绘图，缺采样为未知，不补零；失败提供重试。列表显存仍为 MiB 换算 GiB，零总量显示 `-`。1024/1280/1600 下内容不撑宽页面。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/gpu.md`](../../../../design/kube-frontend/cluster-management/gpu.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/gpu.md`](../../../../prd/kube-frontend/cluster-management/gpu.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 点进单卡看到它的详细属性

作为 **集群运维**，我希望 **点一张卡看到它的节点、序号、UUID、型号、厂商、显存与用量**，以便 **在列表只给出状态结论时继续下钻**。

**Independent Test**：从列表点某个显卡 ID 进入 `/clusters/host/gpus/<uuid>`，详情页的显卡 ID 与被点行一致，节点、序号、型号、厂商、显存与状态可读。

### US3 - 快速定位显卡并继续排障

作为 **集群运维**，我希望 **按 UUID、节点、节点标签、厂商、型号及健康状态定位卡，再查看监控和关联容器组**，以便 **不用在全量设备里逐行查找，也不把同节点的其他任务误作此卡任务**。

**Independent Test**：组合筛选和分页不改变顶部总览；从卡详情进入监控、容器组及事件页签，核对 UUID 过滤、指标单位与节点事件范围。

## 前置与配置

- B200 的单卡监控存在历史采样

## 测试步骤

1. 打开单卡监控，捕获同次响应核对利用率、显存、分配率、功率和温度
2. 切换时间范围，核对请求仍携带目标 GPU UUID
3. 打开容器组，核对 gpuUuid/nodeName 过滤与 API 结果
4. 打开事件页签，核对 Node 类型和所属节点范围
5. 在三档视口截图，并模拟监控失败后重试

## 期望结果

- 监控显存 bytes 正确换算 GiB，零值与缺失值不混淆
- 容器组仅属于目标卡，事件明确为所属节点范围
- 页签按需读取，失败可恢复，无设备写入

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
