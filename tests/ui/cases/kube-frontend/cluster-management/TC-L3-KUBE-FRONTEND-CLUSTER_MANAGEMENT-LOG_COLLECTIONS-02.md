# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02 集群日志收集 · 三页签与收集项详情（只读）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `log-collections`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/log-collections`
- **需求**: `prd/kube-frontend/cluster-management/log-collections.md`

## 产品功能

日志收集页的容器日志 / 事件 / 审计三个分类页签，页签内展示该分类的收集项与采集输入；收集项名称打开只读详情（属性、匹配与过滤摘要、原始 YAML）。

### 关联需求

- `prd/kube-frontend/cluster-management/log-collections.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/log-collections.md`](../../../../prd/kube-frontend/cluster-management/log-collections.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02** — 已知日志组件为三类日志配置了接收器，当打开集群日志收集页并切换页签，则「容器日志 / 事件 / 审计」三个页签都可见且可切换；每个页签渲染该分类的收集项（名称、状态、匹配规则摘要、类型、创建时间）与采集输入，没有该分类对象时给出明确空态；点第一个收集项名称打开只读详情，显示属性、匹配与过滤摘要以及该对象的只读 YAML；全程不出现任何写操作。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/log-collections.md`](../../../../design/kube-frontend/cluster-management/log-collections.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/log-collections.md`](../../../../prd/kube-frontend/cluster-management/log-collections.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 按分类找到接收器并看懂它的匹配规则 (Priority: P2)

作为 **集群管理员**，我希望 **按容器日志 / 事件 / 审计分类查看接收器，并点开某个看到它的匹配规则与原始 YAML**，以便 **判断「这类日志到底写去哪、哪些源被匹配」而不必去翻 CR**。

**Independent Test**：打开日志收集页，依次切到三个页签，每个页签都渲染收集项表头（或该分类的空态）；点第一个收集项名称，详情里能看到属性、匹配规则与只读 YAML。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 日志组件 CR 可读（某分类没有输出时该页签显示空态，用例仍通过）

## 测试步骤

1. 用 API 读 outputs，并按 logging.kubesphere.io/component 标签分组统计每类条数
2. 打开集群日志收集页，核对三个页签都可见
3. 依次切到三个页签，核对每类渲染收集项表头（或该分类空态）
4. 有收集项时核对可见行数等于该分类 CR 条数
5. 点首个可见收集项的名称，核对详情与只读 YAML，并核对没有写操作
6. 关闭详情，切回页签

## 期望结果

- cluster-log-collections:tab:{logging,events,auditing} 三个句柄都可见且可切换
- 每个页签的内容区可见，且包含收集项表头与该分类的采集输入区
- 该分类没有输出时显示「该分类没有收集项」空态
- {'详情里 YAML 以只读 pre 呈现（无 textarea/contenteditable），内容含 apiVersion 与 kind': 'Output'}
- 详情内没有保存/创建/删除等写操作

## 失败排查

- 页签缺失：页面没有用 Tabs 或句柄没写到 trigger 上
- 切换后内容为空：面板被卸载或 hidden 判断写反
- 行数不等于分类条数：component 标签没参与过滤（把所有输出都塞进每个页签）
- YAML 不可见：详情用了异步请求但对象没取回；本页详情复用列表已读到的对象

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 @/pages/cluster/ClusterLogCollectionsPage.tsx；行句柄 data-ai-row=<输出名>，详情 YAML 句柄 cluster-log-collections:yaml
