import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TutorMessage } from './prompt';

export const TUTOR_KEY = 'nursing-study-app/tutor/v1';
export const MAX_SAVED_MESSAGES = 100;

export interface TutorChat {
  topicId?: string;
  messages: TutorMessage[];
}

/** Defensive parse: bad shapes are dropped, the list is capped to the newest messages. */
export function parseChat(raw: string | null): TutorChat {
  try {
    const o = raw ? JSON.parse(raw) : null;
    if (o && Array.isArray(o.messages)) {
      const messages = (o.messages as any[])
        .filter(
          (m) => m && typeof m.id === 'string' && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && typeof m.at === 'number',
        )
        .slice(-MAX_SAVED_MESSAGES);
      return { topicId: typeof o.topicId === 'string' ? o.topicId : undefined, messages };
    }
  } catch {
    // corrupt save: start with an empty chat
  }
  return { messages: [] };
}

export async function loadChat(): Promise<TutorChat> {
  try {
    return parseChat(await AsyncStorage.getItem(TUTOR_KEY));
  } catch {
    return { messages: [] };
  }
}

export async function saveChat(chat: TutorChat): Promise<void> {
  await AsyncStorage.setItem(TUTOR_KEY, JSON.stringify({ ...chat, messages: chat.messages.slice(-MAX_SAVED_MESSAGES) }));
}
