# 集群可见性 · 企业空间授权（补齐「按空间授权」）

> 关闭 `ClusterVisibilityPage` 里「租户(企业空间)授权列表暂未迁移」的登记。日期 2026-11-16。
> 规格：prd|design/kube-frontend/cluster-management/visibility.md（AC-VISIBILITY-03、DEC-03/04、GOT-03）。

## 1. 旧能力与归宿

| 旧能力 | 归宿 | AC / 用例 |
| --- | --- | --- |
| 公开/私有切换（写集群标签） | 已交付（本次回归） | AC-VISIBILITY-01；TC-VISIBILITY-01 |
| 私有集群下逐个企业空间授权/取消 | **补齐**：列出所有企业空间与授权状态，勾选即对 `workspaces/<name>` 发 JSON Patch | AC-VISIBILITY-03；TC-VISIBILITY-03 |
| 按标签选择集群的空间 | **补齐**：显示「按标签选择集群 / 已按标签覆盖（无需逐条授权）」，不提供开关 | 同上 |
| 公开集群下的授权 | **补齐**：整块只读并说明「公开时所有空间都能使用它」 | 同上 |

## 2. 数据契约（实测）

| 动作 | 请求 | 说明 |
| --- | --- | --- |
| 读授权 | `GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces?limit=-1` | 取每个空间 `spec.placement.clusters`；`clusterSelector` 存在表示按标签覆盖 |
| 授权 | `PATCH …/workspaces/<name>`，`application/json-patch+json` | `{"op":"add","path":"/spec/placement/clusters/-","value":{"name":"host"}}` |
| 取消 | 同上 | `{"op":"remove","path":"/spec/placement/clusters/<index>","value":{"name":"host"}}` |

**关键实测**：这个聚合 API **要求每个 op 都带 `value`**，即便 `remove` 不需要它——不带会返回 500
「operation, missing value field」。`replace` 操作被直接拒绝（400「not support operation type」），
merge patch 也被拒绝（500「cannot unmarshal object into Go value of type jsonpatch.Patch」）。
即：只有 json-patch 的 `add`/`remove`（带 value）可用。

## 3. 实测（B200 host，admin）

| 企业空间 | placement | 页面呈现 |
| --- | --- | --- |
| `public` | `clusters: [{name: host}]` | 已授权（勾选），取消后回读移除、再勾选恢复 |
| `system-workspace` | `clusterSelector: {}` | 「按标签选择集群 / 已按标签覆盖」，无开关 |

用例做了真实的往返：取消 → 回读确认移除 → 重新勾选 → 回读确认恢复，`finally` 里兜底恢复。

## 4. 验证与证据

| 维度 | 状态 | 证据 |
| --- | --- | --- |
| 旧能力覆盖 | 通过 | 上表四项；授权列表从「未迁移」变为已交付 |
| 数据语义 | 通过 | 用例以 API 回读为准，不只看复选框状态 |
| 交互 | 通过 | 勾选/取消均为受控组件，切换后等回读；按标签空间无开关 |
| 视觉与主题 | 通过（人工） | `/tmp/cv-workspaces-{dark-violet-{1024,1280,1600},light-violet-1280,light-green-1280}.png`、`-en-1280`；五档 overflow=0 |
| 静态/类型/构建/测试 | 通过 | scoped 门禁 0/0；console-next tsc 0；vite build ✓；契约套件 1452 passed；新用例 passed（11.63s） |
| 未验收 | — | 部署环境、member 集群、全站串行 E2E |

## 5. 过程中的两个坑

1. **Playwright 的 `uncheck()` 断言同步状态**：受控复选框在请求落地前不会变，`uncheck()` 会报「Clicking the checkbox did not change its state」。用例改用 `click()` 再等 API 回读。
2. **探针把数据写脏了**：手工试 `remove` 时先失败后成功，`public` 空间出现重复的 `host` 条目；已按索引删除重复项恢复为单条。写入类探针必须先记录初值再复原。
