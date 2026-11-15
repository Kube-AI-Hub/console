# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05 灰度发布 · 调整流量（权重/接管/蓝绿切换）写回与回读一致

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `gray-release`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/grayrelease`
- **需求**: `prd/kube-frontend/app-workloads/gray-release.md`

## 产品功能

调整流量弹窗按发布模式提供不同控件：按权重分流可改 0-100（100 时 governor=新版本、0 时=参考版本、其余为空）；按内容分流提供保持规则/新版本接管/参考版本接管；蓝绿提供两版本单选并写 100/0；镜像不提供入口。非法输入不产生写请求，保存失败保留输入。

### 关联需求

- `prd/kube-frontend/app-workloads/gray-release.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05** — 已知一个按权重分流的 Canary 详情（新版本 20%），当点「调整流量」把新版本比例改为 35 并确认，则 API 回读两条路由权重为 65/35 且 `spec.governor` 为空、页面提示已更新且版本卡片权重变为 35%；改为 100 时回读 `spec.governor` 等于新版本、改为 0 时等于参考版本；按内容分流的 Canary 打开同一入口时提供「保持按匹配规则分流 / 新版本接管 / 参考版本接管」三个选项并写回 `spec.governor`；Bluegreen 打开时提供两版本单选，选新版本后回读权重 0/100 且 governor 为新版本；Mirror 不提供调整流量入口；非 0–100 整数被就地拒绝且不产生写请求；保存失败时弹窗保留输入并显示服务端原因。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/gray-release.md`](../../../../design/kube-frontend/app-workloads/gray-release.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 调整流量比例，并能暂停/恢复一次发布 (Priority: P1)

作为 **项目运维**，我希望 **在详情里把新版本流量调到指定比例、把某个版本接管为 100%，并在需要时暂停发布（流量全部回到参考版本）后再恢复原来的比例**，以便 **按发布节奏逐步放量、出问题时立刻回退且不丢失原配置**。

**Independent Test**：在流量 20% 的 Canary 详情里调整到 35，保存后 API 回读权重为 65/35 且 `spec.governor` 为空；点「暂停发布」后回读 `spec.governor` 等于参考版本且权重不变；点「恢复发布」后 `spec.governor` 为空、权重仍是 65/35。

## 前置与配置

- 已登录，host 集群 default 项目，servicemesh 可读写
- 用例创建：按权重 Canary（80/20）、按内容 Canary、Bluegreen、Mirror 各一条
- 用例对象使用 tc-e2e-gray- 前缀，finally 删除

## 测试步骤

1. 打开按权重 Canary 详情，点「调整流量」，把新版本比例改为 35 并确认，轮询回读权重与 governor
2. 把比例改为 100 后回读 governor；改为 0 后回读 governor
3. 输入 150，断言提交被拒且对象未被修改
4. 打开按内容 Canary 详情，选「新版本接管全部流量」并确认，回读 governor
5. 打开 Bluegreen 详情，选择新版本并确认，回读权重 0/100 与 governor
6. 打开 Mirror 详情，断言没有「调整流量」入口

## 期望结果

- 35 保存后回读两条路由权重为 65/35、spec.governor 为空，页面版本卡片显示 35% 并有已更新提示
- 100 保存后 spec.governor 等于新版本；0 保存后等于参考版本
- 150 时页面就地提示范围错误且对象权重与 governor 不变
- 内容模式选择新版本接管后 spec.governor 等于新版本，匹配规则保持不变
- Bluegreen 选择新版本后权重为 0/100 且 spec.governor 为新版本
- Mirror 详情没有 grayrelease-detail:edit-traffic 入口

## 失败排查

- 回读权重不变：PUT 是否带 resourceVersion；对象是否已被控制器改写
- governor 与权重不一致：检查 withTrafficWeight 的 0/100/中间值分支
- 弹窗确认按钮不可点：输入是否被解析为整数、是否越界

## 产品改版后如何更新自动化

- 写入函数见 packages/api-client/src/servicemesh.ts 的 withTrafficWeight/withGovernor/withBluegreenVersion
