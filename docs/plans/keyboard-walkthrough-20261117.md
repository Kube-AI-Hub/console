# 键盘走查：Tab 顺序、焦点环、弹层焦点归属（2026-11-17）

能力矩阵里「键盘可达与弹层归属」一行原先写着「静态检查，tab 顺序/焦点环/朗读顺序仍需浏览器走查」。本轮补了这项走查。

## 1. Tab 顺序（项目配置字典页，12 次 Tab）

```
1  A       跳到主要内容          ring=True
2  BUTTON  shell:platform-switch  ring=True
3  BUTTON  global-nav:platform    ring=True
4  A       global-nav:appStore    ring=True
5  A       global-nav:workbench   ring=True
6  BUTTON  shell:locale-switch    ring=True
7  BUTTON  切换深浅色主题          ring=True
8  BUTTON  shell:user-menu        ring=True
9  A       项目概览                ring=True
10 A       配置                    ring=True
11 A       工作负载                ring=True
12 A       DevOps 工具             ring=True
```

顺序合理：**跳过导航链接在最前**，然后顶部平台/全局导航/语言/主题/用户菜单，再到侧栏。**12 个元素全部有可见焦点环**。

## 2. 弹层焦点归属（创建配置字典）

| 检查 | 结果 |
| --- | --- |
| 打开后焦点落点 | `configmaps:field-name`（第一个输入框，在弹层内） |
| Tab 是否逃出弹层 | 连续 10 次 Tab 全在弹层内（焦点陷阱生效） |
| Esc 是否关闭 | 关闭 |
| **关闭后焦点归属** | **修复前 `<body>`；修复后回到 `configmaps:create`（触发按钮）** |

## 3. 修复：关闭弹层把焦点还给触发按钮

`packages/ai-kit/src/primitives/Feedback.tsx` 的 `Modal` 用 Radix，但弹层由页面用 `open` 控制、没有 Radix `Trigger`，
所以 Radix 找不到可归还的元素，焦点落回 `<body>`——读者在列表里的位置丢了。

改法：打开时记住 `document.activeElement`，在 `onCloseAutoFocus` 里 `preventDefault()` 并把它 `focus()` 回来
（元素已卸载则跳过）。**一处改动，所有弹层受益。**

## 4. 验证

| 项 | 结果 |
| --- | --- |
| 关闭后焦点 | `configmaps:create`（修复前 `<body>`） |
| 契约套件 | **18 文件 / 1499 passed** |
| api-client | **419 passed** |
| `tsc` | 0 错误 |
| `vite build` | ✓ |

## 5. 可重跑：`--keyboard`

```bash
python3 tools/multicluster_sweep.py --env-file /tmp/a100.env --app http://localhost:5182 \
  --bff http://127.0.0.1:8093 --keyboard --clusters host,xc --project spaces
```

对配置字典、部署、节点三个页面各走 10 个 Tab，检查「第一个停靠点是跳过导航」与「每个停靠点都有可见焦点环」。
**深色与浅色主题各走一遍**（浅色下的焦点环可见性正是截图走查容易漏掉的）。`xc` 实测：

```
OK dark  xc configmaps / deployments / nodes   stops=10 no_ring=0 first=跳到主要内容
OK light xc configmaps / deployments / nodes   stops=10 no_ring=0 first=跳到主要内容
```

每一遍之前都会重新注入会话：一次 401 会让应用登出，之后走的其实是登录页（登录页也有输入框，但没有跳过导航）。

`host` 这一遍本轮没跑完——A100 登录连续 503，preflight 打印 `NOT RUN` 并以退出码 2 结束（这正是它该做的）。

旧记录（单主题、两集群）：

```
OK host configmaps / deployments / nodes   stops=10 no_ring=0 first=跳到主要内容
OK xc   configmaps / deployments / nodes   stops=10 no_ring=0 first=跳到主要内容
```

## 6. 焦点环的**渲染层**对比度（本轮补上）

之前只断言「有可见的 outline/box-shadow」。现在每个停靠点还会：

1. 取元素**及其上两级祖先**的 `outline`、`box-shadow`、`border` 颜色（组件常把环画在外层包装上，内层 `<input>` 主动 `outline-none`）；
2. 向上找第一个不透明的背景色；
3. 用 WCAG 公式算最高一档指示色对该背景的对比度，**低于 3:1 判为不达标**（SC 1.4.11）。

在**登录页**（不需要集群）冒烟验证过：

| 停靠点 | 指示色来源 | 对比度 |
| --- | --- | --- |
| 用户名输入框 | 聚焦态边框 `border-ai-accent`（环是 25% 透明，只有 2.0:1，但边框够） | **3.59** |
| 显示密码按钮 | 环 | **5.36** |
| 登录按钮 | 环 | **4.24** |

**发现**：输入框的环是 `ring-ai-accent/25`，单独看只有 2.0:1；靠 `focus-visible:border-ai-accent` 这个第二指示才达标。
只测环会误判为缺陷，只测边框会漏掉按钮类控件——**两者都要测，取最高的一档**。

## 7. 集群不可用时也能跑：`--keyboard-local`

登录页不需要会话，却覆盖了输入框、按钮两类控件与全部焦点样式。所以另有一条只走登录页的模式：

```bash
python3 tools/multicluster_sweep.py --env-file <env> --app http://localhost:5182 --keyboard-local
```

```
OK dark  login  stops=8 no_ring=0 weak=0 worst=3.52
OK light login  stops=8 no_ring=0 weak=0 worst=17.12
```

两个环境同时不可达时，这条命令仍能给出可访问性结论。

### 两个必须过滤的噪声

| 现象 | 原因 | 处置 |
| --- | --- | --- |
| `SecurityError: localStorage denied` | 未先打开应用页就去写主题，页面还是 `about:blank` | 先落到目标页再写存储 |
| 两个停靠点「没有焦点指示」 | Tab 越过最后一个控件后焦点停在 `<body>` | 过滤 `BODY`/`HTML`（那是循环结束，不是控件缺指示） |

## 8. 未覆盖

- **焦点环的对比度数值**没有测量（只断言「有可见的 outline/box-shadow」）；
- `host` 的双主题遍待 A100 恢复后补跑。

朗读顺序（屏幕阅读器）与焦点环在**浅色主题**下的对比度未走查；弹层的焦点归属只在配置字典的创建弹层验过。
