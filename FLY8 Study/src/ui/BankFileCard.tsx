import React, { useState } from 'react';
import { Text } from 'react-native';
import type { BankItem } from '../bank/schema';
import { encodeBank, exportFileName, itemsForExport, type ExportScope } from '../bank/exportBank';
import { importBank, type ImportResult } from '../bank/importBank';
import { pickTextFile, saveTextFile } from './bankFiles';
import { Btn, Card, H } from './kit';
import { Label, Pick } from './GeneratorControls';
import { space, useTheme } from './theme';

const SCOPES: { id: ExportScope; label: string }[] = [
  { id: 'all', label: 'The whole bank' },
  { id: 'mine', label: 'Only my saved questions' },
  { id: 'topics', label: 'The ticked topics' },
  { id: 'generated', label: 'New from this generator' },
];

export interface BankFileCardProps {
  all: readonly BankItem[];
  mine: readonly BankItem[];
  topics: readonly string[];
  generated: readonly BankItem[];
  onImported: (r: ImportResult) => void;
}

/** Export a set of questions to a compact .txt file, or import one (.txt or .json). */
export function BankFileCard({ all, mine, topics, generated, onImported }: BankFileCardProps) {
  const { colors, type } = useTheme();
  const [scope, setScope] = useState<ExportScope>('mine');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const count = itemsForExport(scope, { all, mine, topics, generated }).length;

  const doExport = async () => {
    setBusy(true);
    try {
      const items = itemsForExport(scope, { all, mine, topics, generated });
      if (!items.length) return setNote('Nothing to export for that choice.');
      const text = encodeBank(items);
      const out = await saveTextFile(exportFileName(items.length), text);
      setNote(`${items.length} question(s), ${Math.max(1, Math.round(text.length / 1024))} KB. ${out === 'downloaded' ? 'Downloaded.' : out === 'shared' ? 'Choose where to save or send it.' : 'Saved in the app cache.'}`);
    } catch (e) {
      setNote(e instanceof Error ? `Could not export: ${e.message}` : 'Could not export.');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const f = await pickTextFile();
      if (!f) return;
      const r = importBank(f.text, { existing: all });
      onImported(r);
      setNote(`${f.name}: ${r.valid.length} usable, ${r.rejected.length} not usable.`);
    } catch (e) {
      setNote(e instanceof Error ? `Could not read the file: ${e.message}` : 'Could not read the file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <H>Question files</H>
      <Label>Export</Label>
      {SCOPES.map((s) => <Pick key={s.id} on={scope === s.id} label={s.label} onPress={() => setScope(s.id)} />)}
      <Btn label={`Export ${count} question(s) to a file`} onPress={() => void doExport()} disabled={busy || count === 0} />
      <Label>Import</Label>
      <Btn label="Import from a .txt or .json file" kind="ghost" onPress={() => void doImport()} disabled={busy} />
      {note ? <Text accessibilityLiveRegion="polite" style={[type('caption'), { color: colors.textDim, marginTop: space.xs }]}>{note}</Text> : null}
    </Card>
  );
}
