import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { ForceSim, type SimNode } from '../../visual/forceLayout';
import type { GraphModel } from './model';
import { buildScene, fitCam, hitTest, type Cam } from './scene';
import { useTheme } from '../theme';

export interface CanvasHandle {
  fit: () => void;
  reset: () => void;
  centerOn: (modelIndex: number, zoom?: number) => void;
  zoomBy: (factor: number) => void;
}

export interface CanvasProps {
  model: GraphModel;
  /** Model indexes to simulate and draw. Pass a stable (memoised) array. */
  vis: number[];
  groupColors: Map<string, string>;
  groupNames: Map<string, string>;
  selected: number;
  neigh: ReadonlySet<number> | null;
  matches: ReadonlySet<number>;
  linkDistance: number;
  repel: number;
  height: number;
  reduceMotion: boolean;
  onSelect: (modelIndex: number) => void;
  onOpen: (modelIndex: number) => void;
  onFocus: (modelIndex: number) => void;
}

const K_MIN = 0.03;
const K_MAX = 8;
const clampK = (k: number) => Math.max(K_MIN, Math.min(K_MAX, k));
const HALO = 20;
const FONT = 'Helvetica, Arial, sans-serif';

/** Live force-directed canvas. One <Svg> with a constant, small number of <Path>s so a full library stays smooth. */
export const GraphCanvas = forwardRef<CanvasHandle, CanvasProps>(function GraphCanvas(props, ref) {
  const { colors, scheme } = useTheme();
  const { model, vis, reduceMotion } = props;
  const [size, setSize] = useState({ w: 0, h: props.height });
  const [, setTick] = useState(0);
  const [nonce, setNonce] = useState(0);
  const cache = useRef(new Map<string, [number, number]>());
  const cam = useRef<Cam>({ x: 0, y: 0, k: 1 });
  const target = useRef<Cam | null>(null);
  const vel = useRef({ x: 0, y: 0 });
  const raf = useRef(0);
  const needFit = useRef(true);
  /** While the layout is still settling the camera keeps framing everything, until the user touches the map. */
  const autoFit = useRef(true);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const live = useRef({ props, built: null as unknown as Built });
  live.current.props = props;

  interface Built { sim: ForceSim; rank: Int32Array; slot: Map<number, number>; vis: number[] }
  const built = useMemo<Built>(() => {
    const slot = new Map<number, number>();
    vis.forEach((mi, s) => slot.set(mi, s));
    const gIndex = new Map<string, number>();
    const start = new Map<number, [number, number]>();
    vis.forEach((mi) => {
      const c = cache.current.get(model.nodes[mi].id);
      if (c) start.set(mi, c);
    });
    const nodes: SimNode[] = vis.map((mi, s) => {
      const n = model.nodes[mi];
      if (!gIndex.has(n.group)) gIndex.set(n.group, gIndex.size);
      let p = start.get(mi);
      if (!p) {
        // new node: appear next to an already placed neighbour
        const nb = model.adj[mi].find((j) => start.has(j));
        if (nb !== undefined) {
          const q = start.get(nb) as [number, number];
          p = [q[0] + Math.cos(s * 2.4) * 12, q[1] + Math.sin(s * 2.4) * 12];
        }
      }
      return { id: n.id, group: gIndex.get(n.group) as number, x: p?.[0], y: p?.[1] };
    });
    const edges: [string, string][] = [];
    for (const [a, b] of model.edges) if (slot.has(a) && slot.has(b)) edges.push([model.nodes[a].id, model.nodes[b].id]);
    const p = live.current.props;
    const sim = new ForceSim(nodes, edges, { linkDistance: p.linkDistance, repel: p.repel });
    if (start.size === vis.length && vis.length) sim.alpha = 0.3; // resumed layout: only a gentle settle
    sim.run(reduceMotion ? 500 : vis.length > 250 ? 90 : 0); // big graphs start already structured
    const order = vis.map((_, s) => s).sort((a, b) => model.nodes[vis[b]].degree - model.nodes[vis[a]].degree);
    const rank = new Int32Array(vis.length);
    order.forEach((s, r) => (rank[s] = r));
    needFit.current = needFit.current || start.size === 0;
    autoFit.current = start.size < vis.length;
    return { sim, rank, slot, vis };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, vis, nonce, reduceMotion]);
  live.current.built = built;

  const saveCache = () => {
    const { sim } = live.current.built;
    sim.ids.forEach((id, i) => cache.current.set(id, [sim.x[i], sim.y[i]]));
  };

  const applyFit = () => {
    const { sim } = live.current.built;
    const { w, h } = sizeRef.current;
    if (!w || !sim.n) return;
    const next = fitCam(sim.bounds(), w, h);
    autoFit.current = false;
    if (reduceMotion) {
      cam.current = next;
      target.current = null;
    } else target.current = next;
    request();
  };

  const frame = () => {
    raf.current = 0;
    const { sim } = live.current.built;
    let busy = false;
    if (!sim.settled) {
      const steps = sim.n > 400 ? 1 : 2;
      for (let i = 0; i < steps; i++) sim.step();
      if (sim.ticks > 1600) sim.alpha = 0;
      busy = !sim.settled;
      if (sim.ticks % 6 === 0 || sim.settled) saveCache();
    }
    if (autoFit.current && !reduceMotion && (sim.ticks % 8 === 0 || sim.settled) && sizeRef.current.w) {
      target.current = fitCam(sim.bounds(), sizeRef.current.w, sizeRef.current.h);
      if (sim.settled) autoFit.current = false;
    }
    const t = target.current;
    if (t) {
      const c = cam.current;
      const e = 0.2;
      c.x += (t.x - c.x) * e;
      c.y += (t.y - c.y) * e;
      c.k += (t.k - c.k) * e;
      if (Math.abs(t.x - c.x) < 0.4 && Math.abs(t.y - c.y) < 0.4 && Math.abs(t.k - c.k) < 0.002 * c.k) {
        cam.current = { ...t };
        target.current = null;
      } else busy = true;
    }
    const v = vel.current;
    if (Math.abs(v.x) > 0.15 || Math.abs(v.y) > 0.15) {
      cam.current.x += v.x;
      cam.current.y += v.y;
      v.x *= 0.92;
      v.y *= 0.92;
      busy = true;
    } else {
      v.x = 0;
      v.y = 0;
    }
    setTick((n) => (n + 1) % 1e9);
    if (busy) raf.current = requestAnimationFrame(frame);
  };
  const request = () => {
    if (!raf.current) raf.current = requestAnimationFrame(frame);
  };
  const requestRef = useRef(request);
  requestRef.current = request;

  // new simulation: start animating (or just draw once when motion is reduced)
  useEffect(() => {
    if (needFit.current && sizeRef.current.w) {
      needFit.current = false;
      const next = fitCam(built.sim.bounds(), sizeRef.current.w, sizeRef.current.h);
      cam.current = next;
      target.current = null;
    }
    requestRef.current();
  }, [built]);

  useEffect(() => {
    built.sim.setOptions({ linkDistance: props.linkDistance, repel: props.repel });
    if (reduceMotion) built.sim.reheat(0.7), built.sim.run(300);
    else built.sim.reheat(0.7);
    requestRef.current();
  }, [props.linkDistance, props.repel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
  }, []);

  useImperativeHandle(ref, () => ({
    fit: () => applyFit(),
    reset: () => {
      cache.current.clear();
      needFit.current = true;
      setNonce((n) => n + 1);
    },
    centerOn: (mi, zoom) => {
      const { sim, slot } = live.current.built;
      const s = slot.get(mi);
      const { w, h } = sizeRef.current;
      if (s === undefined || !w) return;
      autoFit.current = false;
      const k = clampK(zoom ?? Math.max(cam.current.k, 1.3));
      const next = { k, x: w / 2 - sim.x[s] * k, y: h / 2 - sim.y[s] * k };
      if (reduceMotion) cam.current = next;
      else target.current = next;
      requestRef.current();
    },
    zoomBy: (factor) => {
      const { w, h } = sizeRef.current;
      autoFit.current = false;
      const c = target.current ?? cam.current;
      const k = clampK(c.k * factor);
      const wx = (w / 2 - c.x) / c.k;
      const wy = (h / 2 - c.y) / c.k;
      const next = { k, x: w / 2 - wx * k, y: h / 2 - wy * k };
      if (reduceMotion) cam.current = next;
      else target.current = next;
      requestRef.current();
    },
  }));

  // ---- gestures ----
  const g = useRef({ start: { x: 0, y: 0, k: 1 }, lx: 0, ly: 0, t0: 0, moved: false, drag: -1, pinching: false, pinch0: { d: 1, k: 1, wx: 0, wy: 0 }, lastTap: { t: 0, mi: -2 } });
  const toWorld = (lx: number, ly: number) => ({ x: (lx - cam.current.x) / cam.current.k, y: (ly - cam.current.y) / cam.current.k });
  const pts = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches as unknown as { locationX?: number; locationY?: number }[];
    return t.map((p) => ({ x: p.locationX ?? sizeRef.current.w / 2, y: p.locationY ?? sizeRef.current.h / 2 }));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const s = g.current;
        const { sim, vis: v } = live.current.built;
        const p = pts(e);
        target.current = null;
        autoFit.current = false;
        vel.current = { x: 0, y: 0 };
        s.start = { ...cam.current };
        s.lx = p[0].x;
        s.ly = p[0].y;
        s.t0 = Date.now();
        s.moved = false;
        s.pinching = false;
        const w = toWorld(s.lx, s.ly);
        s.drag = hitTest(sim, v, live.current.props.model, w.x, w.y, 14 / cam.current.k, cam.current.k);
      },
      onPanResponderMove: (e, gs) => {
        const s = g.current;
        const { sim } = live.current.built;
        const p = pts(e);
        if (p.length >= 2) {
          const d = Math.max(10, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y));
          const mx = (p[0].x + p[1].x) / 2;
          const my = (p[0].y + p[1].y) / 2;
          if (!s.pinching) {
            const w = toWorld(mx, my);
            s.pinching = true;
            s.moved = true;
            s.drag = -1;
            s.pinch0 = { d, k: cam.current.k, wx: w.x, wy: w.y };
          }
          const k = clampK((s.pinch0.k * d) / s.pinch0.d);
          cam.current = { k, x: mx - s.pinch0.wx * k, y: my - s.pinch0.wy * k };
          requestRef.current();
          return;
        }
        if (s.pinching) return;
        if (!s.moved && Math.hypot(gs.dx, gs.dy) < 6) return;
        s.moved = true;
        if (s.drag >= 0) {
          const w = toWorld(s.lx + gs.dx, s.ly + gs.dy);
          sim.pin(s.drag, w.x, w.y);
          sim.reheat(0.35);
          if (live.current.props.reduceMotion) sim.run(40);
        } else {
          cam.current = { k: s.start.k, x: s.start.x + gs.dx, y: s.start.y + gs.dy };
        }
        requestRef.current();
      },
      onPanResponderRelease: (_e, gs) => {
        const s = g.current;
        const pr = live.current.props;
        const { vis: v } = live.current.built;
        if (s.pinching) {
          s.pinching = false;
          return;
        }
        if (s.moved) {
          if (s.drag < 0 && !pr.reduceMotion) {
            vel.current = { x: gs.vx * 16, y: gs.vy * 16 };
            requestRef.current();
          }
          return;
        }
        if (Date.now() - s.t0 > 600) return; // long press: ignore
        const mi = s.drag >= 0 ? v[s.drag] : -1;
        const now = Date.now();
        if (mi >= 0) {
          if (now - s.lastTap.t < 320 && s.lastTap.mi === mi) {
            s.lastTap = { t: 0, mi: -2 };
            pr.onFocus(mi);
          } else {
            s.lastTap = { t: now, mi };
            if (mi === pr.selected && !pr.model.nodes[mi].ghost) pr.onOpen(mi);
            else pr.onSelect(mi);
          }
        } else {
          if (now - s.lastTap.t < 320 && s.lastTap.mi === -1) {
            s.lastTap = { t: 0, mi: -2 };
            applyFitRef.current();
          } else {
            s.lastTap = { t: now, mi: -1 };
            pr.onSelect(-1);
          }
        }
      },
    }),
  ).current;
  const applyFitRef = useRef(applyFit);
  applyFitRef.current = applyFit;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width === sizeRef.current.w && height === sizeRef.current.h) return;
    const first = sizeRef.current.w === 0;
    sizeRef.current = { w: width, h: height };
    setSize({ w: width, h: height });
    if (first || needFit.current) {
      needFit.current = false;
      cam.current = fitCam(live.current.built.sim.bounds(), width, height);
      target.current = null;
    }
    requestRef.current();
  };

  const c = cam.current;
  const scene = buildScene({
    model,
    vis,
    sim: built.sim,
    rank: built.rank,
    cam: c,
    w: size.w,
    h: size.h,
    selected: props.selected,
    neigh: props.neigh,
    matches: props.matches,
    colorOf: (grp) => props.groupColors.get(grp) ?? colors.accent,
    groupName: (grp) => props.groupNames.get(grp) ?? 'Notes',
  });
  const k = c.k;
  const dark = scheme === 'dark';
  const line = colors.textDim;
  const dense = built.sim.edges.length / 2 > 1200 ? 0.5 : 1; // thin the hairball on big libraries

  return (
    <View
      onLayout={onLayout}
      style={{ height: props.height, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}
      accessibilityLabel="Interactive mind map. Drag to pan, pinch to zoom, tap a topic to select it. Use the Outline view for a list."
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={size.w} height={size.h}>
          <G transform={`translate(${c.x} ${c.y}) scale(${k})`}>
            {scene.halos.map((hl) => (
              <Path key={`h${hl.key}`} d={hl.d} fill={hl.color} fillOpacity={dark ? 0.12 : 0.1} stroke={hl.color} strokeOpacity={dark ? 0.12 : 0.1} strokeWidth={HALO * 2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {scene.edges.dim ? <Path d={scene.edges.dim} stroke={line} strokeOpacity={0.1} strokeWidth={Math.max(0.5, 1 / k)} fill="none" /> : null}
            {scene.edges.normal ? <Path d={scene.edges.normal} stroke={line} strokeOpacity={(dark ? 0.45 : 0.5) * dense} strokeWidth={Math.max(0.5, 1.1 / k)} fill="none" /> : null}
            {scene.edges.hi ? <Path d={scene.edges.hi} stroke={colors.accentText} strokeOpacity={0.95} strokeWidth={Math.max(1, 2 / k)} fill="none" /> : null}
            {scene.ghost.dim ? <Path d={scene.ghost.dim} fill="none" stroke={line} strokeOpacity={0.12} strokeWidth={Math.max(0.5, 1 / k)} strokeDasharray="2 2" /> : null}
            {scene.ghost.bright ? <Path d={scene.ghost.bright} fill="none" stroke={line} strokeOpacity={0.6} strokeWidth={Math.max(0.5, 1 / k)} strokeDasharray="2 2" /> : null}
            {scene.buckets.map((b) => (
              <React.Fragment key={`b${b.key}`}>
                {b.dim ? <Path d={b.dim} fill={b.color} fillOpacity={0.16} /> : null}
                {b.body ? <Path d={b.body} fill={b.color} fillOpacity={0.95} stroke={colors.surface} strokeWidth={Math.max(0.4, 0.8 / k)} /> : null}
                {b.track ? <Path d={b.track} fill="none" stroke={line} strokeOpacity={0.3} strokeWidth={1.4} /> : null}
                {b.arc ? <Path d={b.arc} fill="none" stroke={colors.text} strokeWidth={1.8} strokeLinecap="round" /> : null}
              </React.Fragment>
            ))}
            {scene.marks.map((m) => (
              <Circle key={m.key} cx={m.x} cy={m.y} r={m.r} fill="none" stroke={m.kind === 'sel' ? colors.accentText : colors.warning} strokeWidth={Math.max(1.2, 2.2 / k)} />
            ))}
            {scene.clusterLabels.map((l) => (
              <SvgText key={`c${l.key}`} x={l.x} y={l.y} fill={l.color} fillOpacity={0.9} fontSize={12 / k} fontWeight="bold" fontFamily={FONT} textAnchor="middle">
                {l.text}
              </SvgText>
            ))}
            {scene.labels.map((l) => (
              <SvgText key={l.key} x={l.x} y={l.y} fill={l.kind === 'match' ? colors.warning : colors.text} fontFamily={FONT} fontSize={(l.kind === 'sel' ? 13 : 11) / k} fontWeight={l.kind === 'node' ? 'normal' : 'bold'} textAnchor="middle">
                {l.text}
              </SvgText>
            ))}
          </G>
        </Svg>
      </View>
      <View {...pan.panHandlers} style={StyleSheet.absoluteFill} />
    </View>
  );
});
