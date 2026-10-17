import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Polyline, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import { sanitizeSvg, type SvgNode } from './svg';

const camel = (k: string) => k.replace(/-([a-z])/g, (_m, ch: string) => ch.toUpperCase());

const PARTS: Record<string, React.ComponentType<any>> = {
  g: G, rect: Rect, circle: Circle, ellipse: Ellipse, line: Line, polyline: Polyline,
  polygon: Polygon, path: Path, text: SvgText, tspan: TSpan,
};

function draw(node: SvgNode, key: string): React.ReactNode {
  const Part = PARTS[node.tag];
  if (!Part) return null;
  const props: Record<string, string> = {};
  for (const [k, v] of Object.entries(node.attrs)) props[camel(k)] = v;
  const kids = node.children.map((ch, i) => draw(ch, `${key}.${i}`));
  return (
    <Part key={key} {...props}>
      {node.text ?? null}
      {kids}
    </Part>
  );
}

/** Draws already-validated AI SVG. Returns null when the markup does not pass the sanitizer. */
export function SvgView({ code, label, natural }: { code: string; label: string; natural?: boolean }) {
  const res = sanitizeSvg(code);
  if (!res.ok) return null;
  // natural: size the box from the drawing's own viewBox (preset diagrams are 360 wide and vary in height).
  const [, , vw, vh] = res.viewBox.split(/[\s,]+/).map(Number);
  const ratio = natural && vw > 0 && vh > 0 ? vw / vh : 1.4;
  return (
    <View style={{ backgroundColor: natural ? '#ffffff' : '#f2f4f8', borderRadius: 12, overflow: 'hidden', aspectRatio: ratio }}>
      <Svg width="100%" height="100%" viewBox={res.viewBox} accessibilityLabel={label}>
        {res.root.children.map((ch, i) => draw(ch, String(i)))}
      </Svg>
    </View>
  );
}
