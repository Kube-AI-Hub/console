# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-01 日志收集 · 三态与开关写入标签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `logging`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/logging`
- **需求**: `prd/kube-frontend/project-settings/logging.md`

## 产品功能

项目日志收集开关读写命名空间标签 logging.kubesphere.io/logsidecar-injection；缺失为未配置、disabled 为已关闭；关闭前有确认。

### 关联需求

- `prd/kube-frontend/project-settings/logging.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/logging.md`](../../../../prd/kube-frontend/project-settings/logging.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-01** — 已知项目命名空间上没有日志标签，当打开日志收集页，则状态显示「未配置」；开启开关后回读命名空间，`logging.kubesphere.io/logsidecar-injection` 标签等于 `enabled`，页面状态变为「已开启」。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-02** — 已知日志收集处于开启状态，当关闭开关，则先出现确认说明（含「容器组将重启」）；点取消标签不变；点确认后标签变为 `disabled`，页面状态变为「已关闭」。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/logging.md`](../../../../design/kube-frontend/project-settings/logging.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/logging.md`](../../../../prd/kube-frontend/project-settings/logging.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 开启本项目的日志收集 (Priority: P1)

作为 **项目管理员**，我希望 **一键开启日志收集**，以便 **不用改 YAML 就能让本项目的容器日志进入日志后端**。

**Independent Test**：在默认状态下开启开关，然后读取项目命名空间，核对标签为 `enabled`。

### US2 - 关闭前被明确告知代价 (Priority: P1)

作为 **项目管理员**，我希望 **关闭时先看到「边车会被移除、容器组会重启」的说明**，以便 **不会因为一个开关意外重启线上容器**。

**Independent Test**：关闭开关时出现确认区块，取消则标签不变；确认后标签变为 `disabled`。

### US3 - 知道从来没人配置过 (Priority: P2)

作为 **项目管理员**，我希望 **区分「从未配置」与「被关闭」**，以便 **判断这是默认状态还是有人主动关的**。

**Independent Test**：命名空间无该标签时显示「未配置」；标签为 `disabled` 时显示「已关闭」。

## 前置与配置

- 已登录，且对 default 项目有管理权限
- 记录命名空间原标签值，用例结束无条件还原

## 测试步骤

1. 读取命名空间，记下原标签值
2. 打开日志收集页，核对状态为未配置（或原值对应的状态）
3. 开启开关，回读命名空间，核对标签为 enabled
4. 再关闭开关，核对先出现确认区块
5. 点取消，核对标签仍为 enabled
6. 点确认，回读命名空间，核对标签为 disabled
7. 还原原标签

## 期望结果

- 标签缺失显示「未配置」，disabled 显示「已关闭」——两者不合并
- 开启后回读标签为 enabled（不是仅页面变化）
- 关闭有确认；取消不改标签；确认后为 disabled
- 写入的是 label 而不是 annotation

## 失败排查

- 页面显示已开启但项目无日志：确认写的是 label（annotation 注入器不读）
- 关闭后其它标签丢失：说明用了 PUT 而非 merge patch
- 状态一直「未配置」：确认读的是命名空间对象而不是项目信息接口

## 产品改版后如何更新自动化

- 选择器见 pages/project_settings.py；状态三态变化时同步更新
