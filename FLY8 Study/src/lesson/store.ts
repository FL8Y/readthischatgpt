import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lesson } from './types';

export const LESSON_KEY = 'nursing-study-app/lessons/v1';
const KEY = LESSON_KEY;

/** Pure: tolerate corrupt storage by returning an empty map. */
export function parseLessonMap(raw: string | null): Record<string, Lesson> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, Lesson>) : {};
  } catch {
    return {};
  }
}

export async function loadLessons(): Promise<Record<string, Lesson>> {
  try {
    return parseLessonMap(await AsyncStorage.getItem(KEY));
  } catch {
    return {};
  }
}

export async function loadLesson(topicId: string): Promise<Lesson | undefined> {
  return (await loadLessons())[topicId];
}

export async function saveLesson(lesson: Lesson): Promise<void> {
  const all = await loadLessons();
  all[lesson.topicId] = lesson;
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}
