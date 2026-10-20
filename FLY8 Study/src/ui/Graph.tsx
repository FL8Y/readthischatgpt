import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import type { AppState } from '../core/types';
import { buildGraph } from '../core/vault';
import { Lesson } from './Lesson';
import { Btn, Card, Chip, ChoiceChips, Field, H, P, Pill } from './kit';
import { space, useTheme } from './theme';
import { GraphCanvas, type CanvasHandle } from './graph/GraphCanvas';
import { BundleChips, MapToolbar, Stepper } from './graph/GraphControls';
import { GraphOutline } from './graph/GraphOutline';
import { buildGraphModel, localSet, neighbourSet, searchMatches, visibleNodes } from './graph/model';
import { bundleColors } from './graph/palette';

/**
 * Mind map: an Obsidian-style live graph. Topics are nodes (size = links, ring = mastery), bundles
 * (folders) get a colour and a soft halo, unresolved [[links]] are faint ghost nodes. The outline
 * list stays as the accessible alternative.
 */
export function Graph({ state }: { state: AppState }) {
  const { colors, scheme, reduceMotion, type } = useTheme();
  const win = useWindowDimensions();
  const canvas = useRef<CanvasHandle>(null);
  const [mode, setMode] = useState<'map' | 'outline'>('map');
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState(-1);
  const [localOn, setLocalOn] = useState(false);
  const [depth, setDepth] = useState<1 | 2 | 3>(1);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [linkDistance, setLinkDistance] = useState(40);
  const [repel, setRepel] = useState(36);
  const [showPhysics, setShowPhysics] = useState(false);
  const [fitNonce, setFitNonce] = useState(0);

  const model = useMemo(() => buildGraphModel(state.topics, state.folders, state.events, Date.now()), [state.topics, state.folders, state.events]);
  const swatch = useMemo(() => bundleColors(model.groups.map((g) => g.id), scheme, colors.bg), [model.groups, scheme, colors.bg]);
  const names = useMemo(() => new Map(model.groups.map((g) => [g.id, g.name])), [model.groups]);
  const sel = selected >= 0 && selected < model.nodes.length ? selected : -1;
  const local = localOn && sel >= 0 ? localSet(model, sel, depth) : null;
  const localKey = local ? [...local].join(',') : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const vis = useMemo(() => visibleNodes(model, { hiddenGroups: hidden, local, showGhosts: true }), [model, hidden, localKey]);
  const neigh = useMemo(() => (sel >= 0 ? neighbourSet(model, sel) : null), [model, sel]);
  const matches = useMemo(() => new Set(searchMatches(model, query)), [model, query]);

  // after the visible set changes (local graph, focus) frame it again once the layout has had time to spread out
  useEffect(() => {
    if (!fitNonce) return;
    const a = setTimeout(() => canvas.current?.fit(), 120);
    const b = setTimeout(() => canvas.current?.fit(), 1100);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [fitNonce]);

  useEffect(() => {
    if (!matches.size) return;
    const first = [...matches].find((i) => vis.includes(i));
    if (first === undefined) return;
    const t = setTimeout(() => canvas.current?.centerOn(first), 250);
    return () => clearTimeout(t);
  }, [matches]); // eslint-disable-line react-hooks/exhaustive-deps

  if (open) return <Lesson state={state} topicId={open} onOpen={setOpen} onBack={() => setOpen(null)} />;
  if (!state.topics.length) return <P dim>Your map appears here once you add notes with [[links]].</P>;

  const toggle = (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <View style={{ flex: 1 }}>
        <Btn label={mode === 'map' ? 'Drawn map (showing)' : 'Drawn map'} kind={mode === 'map' ? 'primary' : 'ghost'} onPress={() => setMode('map')} />
      </View>
      <View style={{ flex: 1 }}>
        <Btn label={mode === 'outline' ? 'Outline (showing)' : 'Outline'} kind={mode === 'outline' ? 'primary' : 'ghost'} onPress={() => setMode('outline')} />
      </View>
    </View>
  );

  if (mode === 'outline') {
    return (
      <View style={{ gap: 14 }}>
        {toggle}
        <GraphOutline graph={buildGraph(state.topics)} onOpen={setOpen} />
      </View>
    );
  }

  const node = sel >= 0 ? model.nodes[sel] : null;
  const openNode = (i: number) => {
    const n = model.nodes[i];
    if (!n.ghost) setOpen(n.id);
  };
  const toggleGroup = (id: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const height = Math.max(340, Math.min(620, Math.round(win.height * 0.56)));
  const shown = vis.filter((i) => !model.nodes[i].ghost).length;

  return (
    <View style={{ gap: space.md }}>
      {toggle}
      <Field label="Search topics" value={query} onChangeText={(t) => { setQuery(t); if (t.trim()) setSelected(-1); }} placeholder="Type a topic name" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
      {query.trim() ? <P dim>{matches.size ? `${matches.size} match${matches.size === 1 ? '' : 'es'}: highlighted on the map.` : 'No topic matches that search.'}</P> : null}
      <BundleChips
        groups={model.groups}
        colors={swatch}
        hidden={hidden}
        onToggle={toggleGroup}
        onAll={() => setHidden(new Set())}
        onNone={() => setHidden(new Set(model.groups.map((g) => g.id)))}
      />
      <GraphCanvas
        ref={canvas}
        model={model}
        vis={vis}
        groupColors={swatch}
        groupNames={names}
        selected={sel}
        neigh={neigh}
        matches={matches}
        linkDistance={linkDistance}
        repel={repel}
        height={height}
        reduceMotion={reduceMotion}
        onSelect={setSelected}
        onOpen={openNode}
        onFocus={(i) => {
          setSelected(i);
          setLocalOn(true);
          setDepth(1);
          setFitNonce((n) => n + 1);
        }}
      />
      <MapToolbar
        onZoomIn={() => canvas.current?.zoomBy(1.4)}
        onZoomOut={() => canvas.current?.zoomBy(1 / 1.4)}
        onFit={() => canvas.current?.fit()}
        onReset={() => canvas.current?.reset()}
      />
      <Text style={[type('caption'), { color: colors.textDim }]}>
        {shown} topics shown. Drag to pan, pinch to zoom, drag a topic to move it. Tap a topic to highlight its links; tap it again (or use the button) to open it; double-tap to focus on it.
      </Text>

      {node ? (
        <Card tone="tinted">
          <H>{node.title}</H>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {node.ghost ? <Pill text="Missing note (a [[link]] with no topic yet)" color={colors.warning} /> : <Chip text={names.get(node.group) ?? 'Notes'} tone="accent" />}
            <Chip text={`${node.degree} link${node.degree === 1 ? '' : 's'}`} />
            {node.mastery !== null ? <Chip text={`Mastery ${Math.round(node.mastery * 100)}%`} tone="success" icon="ribbon-outline" /> : !node.ghost ? <Chip text="No quiz answers yet" /> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {!node.ghost ? (
              <View style={{ flex: 1 }}>
                <Btn label="Open lesson" onPress={() => openNode(sel)} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Btn label="Clear" kind="ghost" onPress={() => setSelected(-1)} />
            </View>
          </View>
        </Card>
      ) : null}

      <Card>
        <H>Graph view</H>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Btn
              label={localOn ? 'Local graph (on)' : 'Local graph'}
              kind={localOn ? 'primary' : 'ghost'}
              hint="Show only the selected topic and the topics around it"
              onPress={() => {
                setLocalOn((v) => !v);
                setFitNonce((n) => n + 1);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Btn label={showPhysics ? 'Hide physics' : 'Tune physics'} kind="ghost" onPress={() => setShowPhysics((v) => !v)} />
          </View>
        </View>
        {localOn ? (
          <>
            <P dim>{sel >= 0 ? 'How many links away from the selected topic to show:' : 'Select a topic first; until then the whole map is shown.'}</P>
            <ChoiceChips label="Depth" options={[1, 2, 3] as const} value={depth} onChange={(v) => { setDepth(v); setFitNonce((n) => n + 1); }} />
          </>
        ) : null}
        {showPhysics ? (
          <>
            <Stepper label="Link distance" value={linkDistance} step={10} min={20} max={120} onChange={setLinkDistance} />
            <Stepper label="Repel strength" value={repel} step={6} min={6} max={90} onChange={setRepel} />
          </>
        ) : null}
      </Card>

      <Card>
        <H>Key</H>
        <P dim>Each bundle (folder) has its own colour and a soft halo; the bundle chips above hide or show it. Bigger dot = more links. The arc around a dot shows mastery from your quiz answers. Dashed empty circles are links to notes you have not written yet.</P>
      </Card>
    </View>
  );
}
