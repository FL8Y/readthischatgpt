import visualsJson from '../../data/presets/visuals.json';

export interface PresetVisual {
  noteId: string;
  /** One plain sentence saying what the diagram shows. */
  caption: string;
  /** Schematic SVG in the safe subset that src/visual/svg.ts accepts. */
  svg: string;
}

const ALL = visualsJson as PresetVisual[];
const BY_NOTE = new Map(ALL.map((v) => [v.noteId, v]));

/** The bundled diagram for a preset note id (the id inside the topic id `preset-<id>`), if any. */
export const visualForNote = (noteId: string): PresetVisual | undefined => BY_NOTE.get(noteId);
export const PRESET_VISUALS: PresetVisual[] = ALL;
