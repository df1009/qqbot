/**
 * QQBot CLI Onboarding Adapter
 */
import type { ResolvedQQBotAccount } from "./types.js";
import { listQQBotAccountIds, resolveQQBotAccount } from "./config.js";

const DEFAULT_ACCOUNT_ID = "default";

// 类型定义（从 moltbot 导入会有循环依赖问题）
interface MoltbotConfig {
  channels?: {
    qqbot?: QQBotChannelConfig;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface QQBotChannelConfig {
  enabled?: boolean;
  appId?: string;
  clientSecret?: string;
  clientSecretFile?: string;
  name?: string;
  accounts?: Record<string, {
    enabled?: boolean;
    appId?: string;
    clientSecret?: string;
    clientSecretFile?: string;
    name?: string;
  }>;
}

interface WizardPrompter {
  note: (message: string, title?: string) => Promise<void>;
  text: (options: {
    message: string;
    placeholder?: string;
    initialValue?: string;
    validate?: (value: string | undefined) => string | undefined;
  }) => Promise<string>;
  confirm: (options: {
    message: string;
    initialValue?: boolean;
  }) => Promise<boolean>;
  select: <T>(options: {
    message: string;
    options: Array<{ value: T; label: string; hint?: string }>;
    initialValue?: T;
  }) => Promise<T>;
}

interface ChannelOnboardingStatus {
  channel: string;
  configured: boolean;
  statusLines: string[];
  selectionHint?: string;
  quickstartScore?: number;
}

interface ChannelOnboardingStatusContext {
  cfg: MoltbotConfig;
  options?: unknown;
  accountOverrides: Partial<Record<string, string>>;
}

interface ChannelOnboardingConfigureContext {
  cfg: MoltbotConfig;
  runtime: unknown;
  prompter: WizardPrompter;
  options?: unknown;
  accountOverrides: Partial<Record<string, string>>;
  shouldPromptAccountIds: boolean;
  forceAllowFrom: boolean;
}

interface ChannelOnboardingResult {
  cfg: MoltbotConfig;
  accountId?: string;
}

interface ChannelOnboardingAdapter {
  channel: string;
  getStatus: (ctx: ChannelOnboardingStatusContext) => Promise<ChannelOnboardingStatus>;
  configure: (ctx: ChannelOnboardingConfigureContext) => Promise<ChannelOnboardingResult>;
  disable?: (cfg: MoltbotConfig) => MoltbotConfig;
}

/**
 * 显示 QQBot 配置帮助
 */
async function noteQQBotHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "1) 打开 QQ 开放平台: https://q.qq.com/",
      "2) 创建机器人应用，获取 AppID 和 ClientSecret",
      "3) 在「开发设置」中添加沙箱成员（测试阶段）",
      "4) 你也可以设置环境变量 QQBOT_APP_ID 和 QQBOT_CLIENT_SECRET",
      "",
      "文档: https://bot.q.qq.com/wiki/",
    ].join("\n"),
    "QQ Bot 配置",
  );
}

/**
 * 解析默认账户 ID
 */
function resolveDefaultQQBotAccountId(cfg: MoltbotConfig): string {
  const ids = listQQBotAccountIds(cfg);
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

/**
 * QQBot Onboarding Adapter
 */
export const qqbotOnboardingAdapter: ChannelOnboardingAdapter = {
  channel: "qqbot",

  getStatus: async ({ cfg }) => {
    const configured = listQQBotAccountIds(cfg).some((accountId) => {
      const account = resolveQQBotAccount(cfg, accountId);
      return Boolean(account.appId && account.clientSecret);
    });

    return {
      channel: "qqbot",
      configured,
      statusLines: [`QQ Bot: ${configured ? "已配置" : "需要 AppID 和 ClientSecret"}`],
      selectionHint: configured ? "已配置" : "支持 QQ 群聊和私聊",
      quickstartScore: configured ? 1 : 20,
    };
  },

  configure: async ({ cfg, prompter, accountOverrides, shouldPromptAccountIds }) => {
    const qqbotOverride = accountOverrides.qqbot?.trim();
    const defaultAccountId = resolveDefaultQQBotAccountId(cfg);
    let accountId = qqbotOverride ?? defaultAccountId;

    // 是否需要提示选择账户
    if (shouldPromptAccountIds && !qqbotOverride) {
      const existingIds = listQQBotAccountIds(cfg);
      if (existingIds.length > 1) {
        accountId = await prompter.select({
          message: "选择 QQBot 账户",
          options: existingIds.map((id) => ({
            value: id,
            label: id === DEFAULT_ACCOUNT_ID ? "默认账户" : id,
          })),
          initialValue: accountId,
        });
      }
    }

    let next = cfg;
    const resolvedAccount = resolveQQBotAccount(next, accountId);
    const accountConfigured = Boolean(resolvedAccount.appId && resolvedAccount.clientSecret);
    const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
    const envAppId = typeof process !== "undefined" ? process.env?.QQBOT_APP_ID?.trim() : undefined;
    const envSecret = typeof process !== "undefined" ? process.env?.QQBOT_CLIENT_SECRET?.trim() : undefined;
    const canUseEnv = allowEnv && Boolean(envAppId && envSecret);
    const hasConfigCredentials = Boolean(resolvedAccount.config.appId && resolvedAccount.config.clientSecret);

    let appId: string | null = null;
    let clientSecret: string | null = null;

    // 显示帮助
    if (!accountConfigured) {
      await noteQQBotHelp(prompter);
    }

    // 检测环境变量
    if (canUseEnv && !hasConfigCredentials) {
      const keepEnv = await prompter.confirm({
        message: "检测到环境变量 QQBOT_APP_ID 和 QQBOT_CLIENT_SECRET，是否使用？",
        initialValue: true,
      });
      if (keepEnv) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            qqbot: {
              ...next.channels?.qqbot,
              enabled: true,
            },
          },
        };
      } else {
        // 手动输入
        appId = String(
          await prompter.text({
            message: "请输入 QQ Bot AppID",
            placeholder: "例如: 102146862",
            initialValue: resolvedAccount.appId || undefined,
            validate: (value) => (value?.trim() ? undefined : "AppID 不能为空"),
          }),
        ).trim();
        clientSecret = String(
          await prompter.text({
            message: "请输入 QQ Bot ClientSecret",
            placeholder: "你的 ClientSecret",
            validate: (value) => (value?.trim() ? undefined : "ClientSecret 不能为空"),
          }),
        ).trim();
      }
    } else if (hasConfigCredentials) {
      // 已有配置
      const keep = await prompter.confirm({
        message: "QQ Bot 已配置，是否保留当前配置？",
        initialValue: true,
      });
      if (!keep) {
        appId = String(
          await prompter.text({
            message: "请输入 QQ Bot AppID",
            placeholder: "例如: 102146862",
            initialValue: resolvedAccount.appId || undefined,
            validate: (value) => (value?.trim() ? undefined : "AppID 不能为空"),
          }),
        ).trim();
        clientSecret = String(
          await prompter.text({
            message: "请输入 QQ Bot ClientSecret",
            placeholder: "你的 ClientSecret",
            validate: (value) => (value?.trim() ? undefined : "ClientSecret 不能为空"),
          }),
        ).trim();
      }
    } else {
      // 没有配置，需要输入
      appId = String(
        await prompter.text({
          message: "请输入 QQ Bot AppID",
          placeholder: "例如: 102146862",
          initialValue: resolvedAccount.appId || undefined,
          validate: (value) => (value?.trim() ? undefined : "AppID 不能为空"),
        }),
      ).trim();
      clientSecret = String(
        await prompter.text({
          message: "请输入 QQ Bot ClientSecret",
          placeholder: "你的 ClientSecret",
          validate: (value) => (value?.trim() ? undefined : "ClientSecret 不能为空"),
        }),
      ).trim();
    }

    // 应用配置
    if (appId && clientSecret) {
      if (accountId === DEFAULT_ACCOUNT_ID) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            qqbot: {
              ...next.channels?.qqbot,
              enabled: true,
              appId,
              clientSecret,
            },
          },
        };
      } else {
        next = {
          ...next,
          channels: {
            ...next.channels,
            qqbot: {
              ...next.channels?.qqbot,
              enabled: true,
              accounts: {
                ...(next.channels?.qqbot as QQBotChannelConfig)?.accounts,
                [accountId]: {
                  ...(next.channels?.qqbot as QQBotChannelConfig)?.accounts?.[accountId],
                  enabled: true,
                  appId,
                  clientSecret,
                },
              },
            },
          },
        };
      }
    }

    return { cfg: next, accountId };
  },

  disable: (cfg) => ({
    ...cfg,
    channels: {
      ...cfg.channels,
      qqbot: { ...cfg.channels?.qqbot, enabled: false },
    },
  }),
};
