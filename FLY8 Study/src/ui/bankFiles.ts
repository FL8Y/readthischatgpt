/** File I/O for question files (UI side). Native: expo-file-system + expo-sharing. Web: browser download / file input. */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type SaveOutcome = 'shared' | 'downloaded' | 'saved';

/** Saves text as a file and opens the share sheet (phone) or downloads it (browser). */
export async function saveTextFile(name: string, text: string): Promise<SaveOutcome> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return 'downloaded';
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(text);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Save or send your question file' });
    return 'shared';
  }
  return 'saved';
}

/** Lets the learner choose a .txt or .json file and returns its text, or null when cancelled. */
export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'application/json', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets.length) return null;
  const a = res.assets[0];
  const webFile = (a as { file?: Blob }).file;
  const text = Platform.OS === 'web' && webFile ? await webFile.text() : await new File(a.uri).text();
  return { name: a.name, text };
}
