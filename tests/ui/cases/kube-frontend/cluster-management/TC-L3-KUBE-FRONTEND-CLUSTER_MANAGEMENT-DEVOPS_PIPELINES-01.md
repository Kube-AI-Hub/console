# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01 DevOps 流水线列表 · 列、健康、服务端分页、搜索与类型筛选

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `devops-pipelines`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/devops`
- **需求**: `prd/kube-frontend/cluster-management/devops-projects.md`

## 产品功能

流水线页签的表格列、健康缺值不伪造、类型/分支数/合并请求数展示、服务端分页（page/limit/totalItems）、名称搜索、类型筛选、行操作入口与名称链接；测试用唯一前缀创建 12 条流水线并在 finally 删除。

### 关联需求

- `prd/kube-frontend/cluster-management/devops-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01** — Given 打开工程详情的流水线页签，When 列表加载完成，Then 表格列为 名称 / 健康状态 / 类型 / 分支数 / 合并请求数 / 操作，名称为进入流水线详情的链接，行操作依次为 运行 / 编辑 / 复制 / 删除；「共 N 条」等于接口 `totalItems`；每页条数可选 10 / 20 / 50（默认 10），上一页 / 下一页按页码禁用；名称搜索与类型筛选（全部 / 单分支 / 多分支）发出 `page/limit/name/type` 参数并把页码重置为 1，类型选「全部」时请求不带 type；无匹配显示「没有匹配的流水线。」，集合为空显示「该工程还没有流水线。」；读取失败显示失败原因与重试。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02** — Given 流水线列表有行，Then 健康列按 Jenkins weatherScore 分档：大于 80 显示「健康」、30 到 80 显示「亚健康」、小于等于 30 显示「异常」、缺值或非数字显示「无状态」，不得把缺值当成 100 显示「健康」；类型列单分支显示「单分支流水线」、多分支显示「多分支流水线」；分支数与合并请求数缺失或单分支分支数为 0 时显示 `-`；同步状态取注解 `pipeline.devops.kubesphere.io/syncstatus`，缺失显示 `-`。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/devops-projects.md`](../../../../design/kube-frontend/cluster-management/devops-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US6 - 浏览与筛选流水线 (Priority: P1)

作为 **DevOps 使用者**，我希望 **在流水线页签按名称搜索、按类型筛选、按页查看服务端分页的流水线，并看到健康、类型、分支数、合并请求数**，以便 **快速定位要操作的流水线**。

**Independent Test**：打开流水线页签，「共 N 条」与接口 totalItems 一致；切换每页条数 10 / 20 / 50、翻页、输入名称、选择类型筛选时，请求的 page / limit / name / type 随之变化，行数与页码正确；清空搜索与筛选回到全量；每行显示健康徽章、类型、分支数、合并请求数（缺值显示 -）与运行 / 编辑 / 复制 / 删除入口。

## 前置与配置

- 已登录且存在含命名空间的 DevOps 工程；不存在时 skip
- 用例用唯一前缀（pwspec-list-）创建 11 条单分支 + 1 条多分支流水线，finally 全部删除
- 不删除非本用例创建的流水线

## 测试步骤

1. 接口读目标工程的 pipelines?page=1&limit=10 取得 totalItems
2. 打开工程详情的流水线页签，等待表格或空态
3. 核对表头、每行健康/类型/分支数/合并请求数、行操作按钮与名称链接 href
4. 核对「共 N 条」与接口 totalItems 一致、每页条数默认 10、页码 1/2 与上一页/下一页禁用态
5. 选择每页 20、50 后核对请求 limit 与行数
6. 输入唯一前缀搜索，核对请求 name 与结果集；选择多分支类型，核对请求 type 与结果集；清空恢复
7. 点下一页核对 page=2 与剩余行数

## 期望结果

- 表头为 名称/健康状态/类型/分支数/合并请求数/更多操作
- 无 jenkins-metadata 注解的流水线健康显示「无状态」，不得显示「健康」
- 多分支行类型显示「多分支流水线」，单分支显示「单分支流水线」；不可用分支数/合并请求数显示 -
- 「共 N 条」等于接口 totalItems；默认每页 10 条；total 大于 10 时 1 页有 10 行且下一页可用，第 2 页剩余 total-10 行
- 搜索请求带 name=<前缀> 且结果均为该前缀对象；类型筛选请求带 type=multi-branch-pipeline；类型「全部」请求不带 type
- 每行提供 运行/编辑/复制/删除 四个 data-ai-id，名称链接指向 .../devops/<工程>/pipelines/<流水线>

## 失败排查

- 页签整页错误：见 Select 空字符串 value 的历史坑
- 总数对不上：可能并行用例创建了流水线，用接口 total 与页面同时刻对账而不是写死数字
- 搜索不生效：请求可能没带 name 或页码未重置为 1

## 产品改版后如何更新自动化

- 选择器：devops-detail:tab:pipelines、pipelines/pipelines-search/pipelines-type/pipelines-table/pipelines-total/pipelines-page-size/pipelines-page/pipelines-prev/pipelines-next/pipelines-empty/pipelines-error/pipelines-retry、行 data-ai-row、pipeline:<name>、pipeline-health:<name>、pipeline-run|edit|copy|delete:<name>
- 分页/筛选参数变化时同步 pages/devops_page.py 的 pipeline_list
