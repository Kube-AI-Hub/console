# console-next E2E

## 环境

以 **B200（`https://console-dev.brightaitoken.ai`，启用多集群）为参考环境**。A100 的接口慢 30-100 倍
（实测同一列表 A100 25 秒、B200 0.7 秒），且缺 `kube-frontend-demo` 等项目，跑整套会大量超时与误报。

```
# 1) 隧道：console 与 BFF 上游
ssh -N -L 18088:172.16.10.20:30880 sgb000

# 2) BFF 指向 B200
cd kube-frontend/server && BFF_PORT=8092 KS_API_URL=http://127.0.0.1:18088 ./node_modules/.bin/tsx src/dev.ts

# 3) 前端
cd kube-frontend && node scripts/dev-static-server.mjs apps/console-next/dist 5178 http://127.0.0.1:8092
```

`.env` 里的 `KA_APP_URL` 指向 5178、`KA_PASSWORD` 为 B200 的 admin 口令。

## 跑法

| 场景 | 命令 | 耗时 |
| --- | --- | --- |
| 快速反馈（改完一页就跑） | `pytest tests/kube-frontend/<模块> -n 4` | 20–45 秒 |
| 全量 | `pytest tests/kube-frontend -n 4` | ~4 分钟 |
| 最终关卡（提交前） | `pytest tests/kube-frontend`（串行） | ~15 分钟 |

**为什么要有并发**：145 个用例串行 14 分半，几乎全部是「每个用例重新打开一次单页应用」的固定成本
（每个约 5.4 秒），不是接口等待。`-n 4` 把 3 个模块 42 个用例从约 4 分钟压到 1 分钟。

**并发的前提**：用例之间不能共享可变对象。为此：

- 夹具创建的对象名带**每次运行唯一的前缀**（`pw<6 位>`），并发时不会互相删除；
- 需要「已存在的对象」的用例，用**夹具返回的真实名字**，不要写死字面量；
- 要操作某一行的用例，**自己创建再按名搜索**，不要取「第一行的名字」——并发时那一行随时可能消失。

串行跑仍然保留为最终关卡：少数用例依赖集群整体状态（列表总量、排序首页），并发下偶发失败，
串行是判定「是否真的坏了」的基准。

## 环境相关的跳过

以下情况用例会**如实跳过并说明原因**，不是失败：

- B200 没有 metrics-server：节点/项目用量列降级为 `-`
- 告警模块未安装：策略开关无数据可验证
- 集群缺少某个资源（网络策略、快照 CRD 等）
