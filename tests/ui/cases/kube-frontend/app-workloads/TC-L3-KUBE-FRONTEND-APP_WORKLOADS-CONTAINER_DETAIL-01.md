# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01 容器详情 · 单个容器的配置与状态（按页签）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `container-detail`
- **入口**: `{BASE_URL}/kube-frontend/public/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/container-detail.md`

## 产品功能

从容器组详情点容器名进入容器详情：镜像/拉取策略/状态/重启/启动时间/命令，以及资源、环境变量、挂载卷、端口、探针五个区块。页面按四个页签组织，资源/挂载卷/端口/探针在默认「资源状态」页签内，环境变量在「环境变量」页签内；无内容显示说明。

### 关联需求

- `prd/kube-frontend/app-workloads/container-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01** — 已知容器组有容器，当从容器组详情点容器名进入容器详情，则显示名称、镜像、镜像拉取策略、状态、重启次数、启动时间、命令与参数，以及资源（请求/限制）、环境变量、挂载卷、端口与探针五个区块：资源、挂载卷、端口与探针在默认打开的「资源状态」页签内可见，环境变量在点开「环境变量」页签后可见；镜像与拉取策略等于该容器组对象中该容器的字段；区块无内容时显示说明而非空表；容器组不存在该容器时显示「这个容器不存在」。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/container-detail.md`](../../../../design/kube-frontend/app-workloads/container-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 单个容器为什么不正常 (Priority: P1)

作为 **项目成员**，我希望 **下钻到容器级别看它的配置与状态**，以便 **在容器组整体状态之外判断是镜像拉不到、探针失败还是资源不足**。

**Independent Test**：从容器组详情点容器名进入容器详情，核对其镜像、拉取策略、状态与该容器组对象一致。

## 前置与配置

- 已登录，且在 host 集群（mlu370）的 default 项目空间
- 项目中至少有一个带容器的容器组

## 测试步骤

1. 用 API 读一个容器组对象，取其第一个容器名与镜像
2. 打开容器组详情，点该容器名进入容器详情，等页面 ready
3. 核对容器详情的基本信息与容器组对象一致
4. 在默认「资源状态」页签内核对资源、挂载卷、端口、探针四个区块（有内容或空态说明）
5. 点「环境变量」页签，核对环境变量区块
6. 用不存在的容器名打开容器详情，核对提示

## 期望结果

- 容器详情可达且 ready，默认停在「资源状态」页签
- 镜像与拉取策略等于容器组对象中的字段
- 资源、挂载卷、端口、探针四个区块在「资源状态」页签内可见；环境变量区块在点开「环境变量」页签后可见
- 五个区块各自能区分「空」与「有内容」（空态有说明文字，不是空表）
- 容器不存在时显示明确提示

## 失败排查

- 容器链接点不动：容器组详情的容器区块只在 pods 下提供链接
- 页面 404：路由没重新生成（改完 $name.tsx 后要 vite build）
- 区块找不到：页签化后非选中面板不渲染，先点页签再断言
- 环境变量空白：valueFrom 只读 value，需要显示引用来源

## 产品改版后如何更新自动化

- 选择器见 pages/app_workloads.py 与 ContainerDetailPage.tsx；页签句柄 container-detail:tab-trigger:<key>
