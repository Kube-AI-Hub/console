# 多集群验证手册（A100：`host` + `xc`）

> 这份文档回答一个问题：**拿到一台多集群环境，怎样在半小时内确认新 UI 在成员集群上真的能用。**
> 所有命令都实测过，结论与耗时都来自真实运行。

## 1. 起栈（4 步）

```bash
# 1) 隧道：本机 18091 → A100 的 ks-console NodePort（30880）
ssh -N -L 18091:172.26.1.44:30880 a100

# 2) BFF 指向隧道（与 B200 的 8092 分开，避免互相干扰）
cd console/kube-frontend/server
BFF_PORT=8093 KS_API_URL=http://127.0.0.1:18091 ./node_modules/.bin/tsx src/dev.ts

# 3) 静态站
cd console/kube-frontend
node scripts/dev-static-server.mjs apps/console-next/dist 5179 http://127.0.0.1:8093

# 4) 冒烟：登录必须 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8093/api/session/login \
  -H 'content-type: application/json' -d '{"username":"admin","password":"P@88w0rd"}'
```

**坑**：`admin` 的密码含 `@`。走 ks-console 时必须用前端那套加密（BFF 已实现）；直连 ks-apiserver 才是明文。

## 2. 一条命令跑完基线

```bash
cd console/tests/ui
python3 tools/multicluster_sweep.py --env-file /tmp/a100.env \
  --baseline --clusters host,xc --namespace spaces --project spaces
```

`/tmp/a100.env` 只需两行：`KA_USERNAME=admin`、`KA_PASSWORD=…`。

实测输出（431 秒）：

```
OK   cluster  read: 72 visits, 60 ready, 12 empty, 0 error, 0 failed requests
OK   project  read: 34 visits, 20 ready, 14 empty, 0 error, 0 failed requests
OK   detail   read: 12 visits, 12 ok, 0 broken
OK   interact read: 6 lists, 6 interacted, 0 skipped, 0 broken
OK   write    host    : created=201 on_target=True  deleted=200 gone=True
OK   write    xc      : created=201 on_target=True on_host=False deleted=200 gone=True
baseline PASS in 431s
```

## 3. 每一段在证明什么

| 段 | 证明 | 失败通常意味着 |
| --- | --- | --- |
| `cluster read` | 36 个集群级页面 × 2 集群能渲染、无 4xx/5xx | 成员集群路径段位置错 |
| `project read` | 17 个项目级页面 × 2 集群 | 同上，或项目上下文丢失 |
| `detail read` | 每种对象各开一个详情页 | 详情/子资源路径错（如 `workloadPath`） |
| `interact` | 排序、搜索各触发一次真实请求 | 查询参数丢掉集群段 |
| `write` | 分组资源写**落在目标集群**、能删干净 | 写到了主集群（最严重） |

## 4. 已确认的能力边界（别当成 bug 再报一遍）

| 资源 | 成员集群读 | 成员集群写/删 |
| --- | --- | --- |
| core（configmaps、secrets、pods…） | ✅ 走 kapis 代理 | ❌ 控制台**明确拒绝**（core 组无成员形态） |
| 分组（ingresses、jobs、cronjobs…） | ✅ | ✅ 实测 201 / 200 |

## 5. 环境怪癖（遇到先重试，别改代码）

| 现象 | 处理 |
| --- | --- |
| `/api/session/login` 偶发 503，隧道根路径仍 200 | 重试 1–3 次；A100 的 ks-console 会抖动 |
| 某页 `503 configz`，几分钟后同一接口 200 | 基线对「整页失败且全是 5xx」会自动重载一次 |
| `session/me` 401 | 认证握手，已在采集时过滤 |

## 6. 单独跑某一段

```bash
--pages nodes,configmaps    # 只跑指定页面
--scope project             # 项目级页面
--details                   # 只跑详情页
--interactions              # 只跑排序/搜索
--write-check               # 只跑写入落点
--out /tmp/sweep.json       # 存 JSON 便于比对
```

## 7. 写操作的自证要求

任何写检查都必须：**唯一名字 → 在目标集群与 host 两边列举 → `finally` 删除 → 复核消失**。
只在一个集群上看列表会被乐观刷新骗过（历史事故：从 `xc` 创建的配置字典落到了 `host`）。
