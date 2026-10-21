import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeStudied } from './studied';

const KEY = 'nursing-study-app/studied/v1';

export async function loadStudied(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? normalizeStudied(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export async function saveStudied(studied: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(studied));
  } catch {
    // progress is a convenience; never crash the reader
  }
}
