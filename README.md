# QQ Bot Channel Plugin for Moltbot

QQ 官方机器人 API 的 Moltbot 渠道插件，支持 C2C 私聊、群聊 @消息、频道消息。

## 功能特性

- **多场景支持**：C2C 单聊、QQ 群 @消息、频道公开消息、频道私信
- **自动重连**：WebSocket 断连后自动重连，支持 Session Resume
- **消息去重**：自动管理 `msg_seq`，支持对同一消息多次回复
- **系统提示词**：可配置自定义系统提示词注入到 AI 请求
- **错误提示**：AI 无响应时自动提示用户检查配置

## 安装

```bash
moltbot plugins install /path/to/qqbot --force
```

## 配置

### 1. 获取 QQ 机器人凭证

1. 访问 [QQ 开放平台](https://q.qq.com/)
2. 创建机器人应用
3. 获取 `AppID` 和 `AppSecret`（ClientSecret）

### 2. 配置 moltbot.yaml

```yaml
channels:
  qqbot:
    enabled: true
    appId: "你的AppID"
    clientSecret: "你的AppSecret"
    
    # 可选：自定义系统提示词
    systemPrompt: |
      你是一个友好的助手。
      请用简洁的语言回答问题。
```

### 3. 环境变量配置（可选）

也可以通过环境变量配置凭证：

```bash
export QQBOT_APP_ID="你的AppID"
export QQBOT_CLIENT_SECRET="你的AppSecret"
```

### 4. 多账户配置

```yaml
channels:
  qqbot:
    enabled: true
    # 默认账户
    appId: "默认AppID"
    clientSecret: "默认AppSecret"
    
    # 多账户
    accounts:
      bot2:
        appId: "第二个机器人AppID"
        clientSecret: "第二个机器人AppSecret"
        systemPrompt: "你是第二个机器人"
```

## 配置项说明

| 配置项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `appId` | string | 是 | QQ 机器人 AppID |
| `clientSecret` | string | 是* | AppSecret，与 `clientSecretFile` 二选一 |
| `clientSecretFile` | string | 是* | AppSecret 文件路径 |
| `enabled` | boolean | 否 | 是否启用，默认 `true` |
| `name` | string | 否 | 账户显示名称 |
| `systemPrompt` | string | 否 | 自定义系统提示词 |
| `dmPolicy` | string | 否 | 私信策略：`open`/`pairing`/`allowlist` |
| `allowFrom` | string[] | 否 | 允许的发送者列表（配合 `allowlist` 策略） |

## 支持的消息类型

| 事件类型 | 说明 | Intent |
|----------|------|--------|
| `C2C_MESSAGE_CREATE` | C2C 单聊消息 | `1 << 25` |
| `GROUP_AT_MESSAGE_CREATE` | 群聊 @机器人消息 | `1 << 25` |
| `AT_MESSAGE_CREATE` | 频道 @机器人消息 | `1 << 30` |
| `DIRECT_MESSAGE_CREATE` | 频道私信 | `1 << 12` |

## 使用

### 启动

```bash
moltbot gateway restart
```

### CLI 配置向导

```bash
moltbot onboard
# 选择 QQ Bot 进行交互式配置
```

## 注意事项

1. **消息回复限制**：QQ 官方 API 限制每条消息最多回复 5 次，超时 60 分钟
2. **URL 限制**：QQ 平台不允许消息中包含 URL，插件已内置提示词限制
3. **群消息**：需要在群内 @机器人 才能触发回复
4. **沙箱模式**：新创建的机器人默认在沙箱模式，需要添加测试用户

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run build

# 监听模式
npm run dev
```

## 文件结构

```
qqbot/
├── index.ts          # 入口文件
├── src/
│   ├── api.ts        # QQ Bot API 封装
│   ├── channel.ts    # Channel Plugin 定义
│   ├── config.ts     # 配置解析
│   ├── gateway.ts    # WebSocket 网关
│   ├── onboarding.ts # CLI 配置向导
│   ├── outbound.ts   # 出站消息处理
│   ├── runtime.ts    # 运行时状态
│   └── types.ts      # 类型定义
├── package.json
└── tsconfig.json
```

## 相关链接

- [QQ 机器人官方文档](https://bot.q.qq.com/wiki/)
- [QQ 开放平台](https://q.qq.com/)
- [API v2 文档](https://bot.q.qq.com/wiki/develop/api-v2/)

## License

MIT
