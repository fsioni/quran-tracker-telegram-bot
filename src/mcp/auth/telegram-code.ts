import type { Locale } from "../../locales/types";

export async function sendTelegramCode(
  botToken: string,
  chatId: string,
  code: string,
  t: Locale
): Promise<boolean> {
  const text = t.mcpTelegramCode(code);
  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!r.ok) {
    console.error(`Telegram sendMessage HTTP ${r.status}`);
    return false;
  }
  return true;
}
