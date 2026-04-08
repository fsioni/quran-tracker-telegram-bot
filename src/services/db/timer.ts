import { getConfig, setConfig } from "./config";
import type { TimerState } from "./types";

const TIMER_CONFIG_KEY = "timer_state";

export async function getTimerState(
  db: D1Database
): Promise<TimerState | null> {
  const raw = await getConfig(db, TIMER_CONFIG_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as TimerState;
  } catch {
    console.error("getTimerState: corrupted timer state, clearing");
    await db
      .prepare("DELETE FROM config WHERE key = ?")
      .bind(TIMER_CONFIG_KEY)
      .run();
    return null;
  }
}

export async function setTimerState(
  db: D1Database,
  state: TimerState
): Promise<void> {
  await setConfig(db, TIMER_CONFIG_KEY, JSON.stringify(state));
}

export async function clearTimerState(db: D1Database): Promise<void> {
  await db
    .prepare("DELETE FROM config WHERE key = ?")
    .bind(TIMER_CONFIG_KEY)
    .run();
}
