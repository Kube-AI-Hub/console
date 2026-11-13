# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-04 负载详情 · 自动伸缩区块

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/spaces/deployments`
- **需求**: `prd/kube-frontend/app-workloads/detail.md`

## 产品功能

有 HPA 的部署在详情页显示自动伸缩区块（策略、副本范围、当前副本、触发指标）；没有 HPA 的不显示该区块。

### 关联需求

- `prd/kube-frontend/app-workloads/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-04** — 已知一个部署配置了自动伸缩（1–3 副本、CPU 30%），当打开其详情，则显示自动伸缩区块含策略名、副本范围与触发指标；已知另一个部署没有自动伸缩，则其详情不显示该区块。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail.md`](../../../../design/kube-frontend/app-workloads/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认对象细节并就地操作 (Priority: P1)

作为 **项目运维**，我希望 **在详情里看到属性与镜像并直接操作**，以便 **不必来回列表**。

**Independent Test**：打开任一部署详情，核对六项属性与镜像列表。

## 前置与配置

- 已登录，且在 host 集群有 HPA 的项目中
- 由夹具创建一个带 HPA 的部署（min=1, max=3, cpu 30%），用例结束无条件删除两者

## 测试步骤

1. 打开该部署的详情
2. 读取自动伸缩区块
3. 另开一个没有 HPA 的部署详情

## 期望结果

- 有 HPA 的部署显示区块，副本范围为 1 – 3，触发指标含 cpu 与 30%
- 没有 HPA 的部署不显示该区块

## 失败排查

- 区块不出现时看 hpaFor 的 scaleTargetRef 匹配（kind 需小写比较）
- 数值不对时看 toWorkloadAutoscaling 的字段读取

## 产品改版后如何更新自动化

- HPA 字段变化时改 api-client 的 toWorkloadAutoscaling
