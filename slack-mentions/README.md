# slack-mentions

Claude Code 插件：在侧边面板里处理 Slack 上 @ 你的消息和私聊。

- 每 30 秒检查最近 24 小时里 @ 你的消息和私聊，有新消息时发系统通知
- 你加入的频道里有人发 @here / @channel 时，显示成「全员」卡片（机器人公告不显示）
- 机器人或 App 直接 @ 你的消息（如发布单点名）显示成「机器人」卡片，没有正文的告警不显示
- 自动起草回复，可以改，点「发送」才会发出
- 回复里写 `@名字`，发送前自动转成真正的 Slack mention
- 「新消息」：按人名、邮箱或频道名搜索，直接发私聊或发到频道
- 消息里的链接可以直接点开，「在 Slack 中打开」跳到原消息

## 一句话安装

对 Claude Code 说：

> 按 https://github.com/gq-guo/ai-mix/tree/master/slack-mentions 的 README 安装 slack-mentions 插件

Agent 会按下面「安装步骤」执行。

## 前提

- Claude Code 桌面版或 CLI，版本要支持函数 hooks 插件（在 2.1.304 上验证过）
- 在 claude.ai 的 Settings → Connectors 里连接了 Slack 连接器

## 安装步骤（给 Agent 看）

1. 添加 marketplace 并安装到用户级：

   ```bash
   claude plugin marketplace add gq-guo/ai-mix
   ```

   ```bash
   claude plugin install slack-mentions@ai-mix --scope user
   ```

2. 找到 Slack 连接器在本机的名字：在当前会话的工具列表里找名为 `mcp__<server>__slack_search_public_and_private` 的工具，`<server>` 就是连接器名字（通常是一串 UUID）。找不到说明 Slack 连接器没连，停下来让用户先去 claude.ai 连接。

3. **只在用户使用自动模式（auto mode）时**做这一步，先征得用户同意：把下面 6 个只读工具加到 `~/.claude/settings.json` 的 `permissions.allow`，`<server>` 换成上一步的名字。不加的话，自动模式的权限检查会拦下插件的 Slack 调用。

   ```json
   "mcp__<server>__slack_search_public_and_private",
   "mcp__<server>__slack_read_thread",
   "mcp__<server>__slack_read_channel",
   "mcp__<server>__slack_read_user_profile",
   "mcp__<server>__slack_search_users",
   "mcp__<server>__slack_search_channels"
   ```

   不要把 `slack_send_message` 加进去：发消息必须由用户自己点按钮。

4. 让用户在已打开的会话里输入 `/reload-plugins`，新开的会话会自动加载。

## 使用

- **打开面板**：输入 `/slack-mentions`。第一次安装后会自动打开一次。
- **输入框上方的入口**：显示「Slack · N 条待回复」和「打开 / 收起」按钮。桌面版要在会话里提交过一次输入后才会出现。
- **回复**：卡片里的草稿可以直接改，点「发送」或回车发出。频道消息回复在 thread 里，私聊直接回复。发出后卡片自动消失。
- **重新拟稿 / 忽略**：忽略后同一条消息不再出现。
- **全员消息**：卡片标「全员」，不会自动拟稿。要回复就自己写，或点「拟稿」生成；不用回就点「忽略」。@here 和 @channel 每次轮询交替检查一种，所以最多晚 1 分钟出现。
- **机器人消息**：卡片标「机器人」，和全员消息一样不自动拟稿，点「拟稿」才生成。只显示直接 @ 你、并且有文字的；机器人私聊和机器人发的全员公告都不显示。
- **新消息**：面板右上角「新消息」→ 输入人名（`alice`）、邮箱（`alice.wang@company.com` 或 `alice.wang`）、频道名（`help-demo`、`#help-demo`）→ 选中 → 写内容 → 发送。
- **@ 人**：写 `@Alice`、`@alice.wang`（邮箱前缀最准）、`@here`。先在当前对话的参与人里找，再在整个 Slack 里找；有多个人重名时不会发送，会提示你改成邮箱前缀。
- **刷新 / 暂停**：手动检查一次，或暂停轮询。

### 按你的口吻拟稿（可选）

如果存在 `~/.claude/skills/slack-voice/SKILL.md`，拟稿时会按里面描述的说话风格写；没有就用简短、友好的默认语气。

## 多个会话

所有会话共用一份待回复列表，同一时间只有一个会话负责轮询和拟稿，其他会话只同步显示。负责轮询的会话关掉或连续失败约 100 秒后，其他会话会自动接管。

## 数据

- 待回复列表、已处理记录、轮询锁存在本机 `~/.claude/slack-mentions/`，不会上传到别处
- 读 Slack、发消息都通过你自己在 claude.ai 连接的 Slack 连接器，以你的身份进行
- 拟稿时会把消息和最近的对话记录发给 Claude 模型（Sonnet）

## 卸载

```bash
claude plugin uninstall slack-mentions@ai-mix
```

需要的话，再删掉 `~/.claude/slack-mentions/` 和第 3 步加的放行规则。
