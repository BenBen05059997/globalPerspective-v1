import { useRef, useEffect, useCallback, useState } from 'react';
import { prepareWithSegments, layoutNextLine, layoutWithLines, walkLineRanges } from '@chenglou/pretext';

const BODY_FONT = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const BODY_LINE_HEIGHT = 26;
const HEADLINE_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const LABEL_FONT = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const SECTION_FONT = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const SMALL_FONT = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const MIN_SLOT_WIDTH = 40;
const ORB_H_PAD = 16;
const ORB_V_PAD = 4;
const GUTTER = 32;

const RISK_COLORS = {
  critical: [239, 68, 68],
  elevated: [249, 115, 22],
  moderate: [234, 179, 8],
  low: [34, 197, 94],
};

function carveSlots(base, blocked) {
  let slots = [base];
  for (const interval of blocked) {
    const next = [];
    for (const slot of slots) {
      if (interval.right <= slot.left || interval.left >= slot.right) {
        next.push(slot);
        continue;
      }
      if (interval.left > slot.left) next.push({ left: slot.left, right: interval.left });
      if (interval.right < slot.right) next.push({ left: interval.right, right: slot.right });
    }
    slots = next;
  }
  return slots.filter(s => s.right - s.left >= MIN_SLOT_WIDTH);
}

function circleInterval(cx, cy, r, bandTop, bandBottom) {
  const top = bandTop - ORB_V_PAD;
  const bottom = bandBottom + ORB_V_PAD;
  if (top >= cy + r || bottom <= cy - r) return null;
  const minDy = cy >= top && cy <= bottom ? 0 : cy < top ? top - cy : cy - bottom;
  if (minDy >= r) return null;
  const maxDx = Math.sqrt(r * r - minDy * minDy);
  return { left: cx - maxDx - ORB_H_PAD, right: cx + maxDx + ORB_H_PAD };
}

function layoutWithObstacles(prepared, startCursor, regionX, regionY, regionW, regionH, lineHeight, orbs) {
  let cursor = startCursor;
  let lineTop = regionY;
  const lines = [];

  while (lineTop + lineHeight <= regionY + regionH) {
    const bandTop = lineTop;
    const bandBottom = lineTop + lineHeight;
    const blocked = [];

    for (const orb of orbs) {
      const interval = circleInterval(orb.x, orb.y, orb.r, bandTop, bandBottom);
      if (interval) blocked.push(interval);
    }

    const slots = carveSlots({ left: regionX, right: regionX + regionW }, blocked);
    if (slots.length === 0) { lineTop += lineHeight; continue; }

    const sorted = [...slots].sort((a, b) => a.left - b.left);
    let exhausted = false;
    for (const slot of sorted) {
      const line = layoutNextLine(prepared, cursor, slot.right - slot.left);
      if (!line) { exhausted = true; break; }
      lines.push({ x: Math.round(slot.left), y: Math.round(lineTop), text: line.text, width: line.width });
      cursor = line.end;
    }
    if (exhausted) break;
    lineTop += lineHeight;
  }
  return { lines, cursor };
}

function fitHeadline(text, maxWidth, maxHeight) {
  let lo = 18, hi = 48, best = lo, bestLines = [];
  while (lo <= hi) {
    const size = Math.floor((lo + hi) / 2);
    const font = `700 ${size}px ${HEADLINE_FONT_FAMILY}`;
    const lineHeight = Math.round(size * 1.15);
    const prepared = prepareWithSegments(text, font);
    let breaksWord = false;
    walkLineRanges(prepared, maxWidth, line => { if (line.end.graphemeIndex !== 0) breaksWord = true; });
    const result = layoutWithLines(prepared, maxWidth, lineHeight);
    if (!breaksWord && result.height <= maxHeight) {
      best = size;
      bestLines = result.lines.map((l, i) => ({ x: 0, y: i * lineHeight, text: l.text, width: l.width }));
      lo = size + 1;
    } else {
      hi = size - 1;
    }
  }
  return { fontSize: best, lineHeight: Math.round(best * 1.15), lines: bestLines };
}

function buildBriefingText(type, data) {
  const sections = [];
  if (type === 'thread') {
    const { analysis } = data;
    if (analysis?.storyArc) sections.push({ label: 'HOW IT EVOLVED', text: analysis.storyArc });
    if (analysis?.trajectory) sections.push({ label: "WHAT'S NEXT", text: analysis.trajectory });
    if (analysis?.rootCauseChain) sections.push({ label: 'WHY IT HAPPENED', text: analysis.rootCauseChain });
    if (analysis?.watchQuestions?.length) {
      sections.push({ label: 'QUESTIONS TO WATCH', text: analysis.watchQuestions.map(q => `• ${q}`).join('\n') });
    }
  } else {
    const { intel } = data;
    if (intel?.bluf) sections.push({ label: 'BOTTOM LINE', text: intel.bluf });
    if (intel?.keyDevelopments?.length) {
      sections.push({
        label: 'KEY DEVELOPMENTS',
        text: intel.keyDevelopments.slice(0, 4).map(d => `${d.date || ''} — ${d.text || d}`).join('\n'),
      });
    }
    if (intel?.riskSignals?.length) {
      sections.push({ label: 'WHAT TO WATCH', text: intel.riskSignals.slice(0, 3).map(s => `⚡ ${s}`).join('\n') });
    }
  }
  return sections.map(s => `${s.label}\n\n${s.text}`).join('\n\n\n');
}

export default function BriefingCard({ type, thread, analysis, countryName, intel }) {
  const stageRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const linesRef = useRef([]);
  const headlineLinesRef = useRef([]);
  const [ready, setReady] = useState(false);

  const title = type === 'thread'
    ? (analysis?.threadTitle || thread?.latestTitle || 'Briefing')
    : `🌍 ${countryName || 'Country'}`;

  const label = type === 'thread' ? '📊 CONTINUING STORY BRIEFING' : '📊 INTELLIGENCE BRIEFING';
  const riskLevel = type === 'country' ? (intel?.riskLevel || '').toLowerCase() : '';
  const riskColor = RISK_COLORS[riskLevel] || RISK_COLORS.moderate;
  const subtitle = type === 'thread'
    ? `${thread?.articleCount || analysis?.entryCount || 0} articles · ${(thread?.trend || 'stable').charAt(0).toUpperCase() + (thread?.trend || 'stable').slice(1)}`
    : (intel?.headline || '');

  const briefingText = buildBriefingText(type, { analysis, intel });

  const initOrbs = useCallback((width, height) => {
    const color1 = type === 'country' ? riskColor : [100, 140, 255];
    const color2 = type === 'country' ? [100, 140, 255] : [232, 100, 130];
    return [
      { x: width * 0.7, y: height * 0.35, r: 55, vx: 18, vy: 12, color: color1, paused: false },
      { x: width * 0.25, y: height * 0.6, r: 42, vx: -14, vy: 18, color: color2, paused: false },
    ];
  }, [type, riskColor]);

  useEffect(() => {
    document.fonts.ready.then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !stageRef.current) return;
    const stage = stageRef.current;
    const rect = stage.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const orbs = initOrbs(w, h);
    stateRef.current = {
      orbs,
      drag: null,
      pointer: { x: -9999, y: -9999 },
      lastFrameTime: null,
    };

    const preparedBody = prepareWithSegments(briefingText, BODY_FONT);

    function render(now) {
      const st = stateRef.current;
      if (!st) return false;
      const stageRect = stage.getBoundingClientRect();
      const pw = stageRect.width;
      const ph = stageRect.height;
      const dt = st.lastFrameTime ? Math.min((now - st.lastFrameTime) / 1000, 0.05) : 0.016;
      let animating = false;

      for (const orb of st.orbs) {
        if (orb.paused || st.drag?.orbIndex === st.orbs.indexOf(orb)) continue;
        animating = true;
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
        if (orb.x - orb.r < 0) { orb.x = orb.r; orb.vx = Math.abs(orb.vx); }
        if (orb.x + orb.r > pw) { orb.x = pw - orb.r; orb.vx = -Math.abs(orb.vx); }
        if (orb.y - orb.r < GUTTER) { orb.y = orb.r + GUTTER; orb.vy = Math.abs(orb.vy); }
        if (orb.y + orb.r > ph - 20) { orb.y = ph - 20 - orb.r; orb.vy = -Math.abs(orb.vy); }
      }

      // Repulsion between orbs
      for (let i = 0; i < st.orbs.length; i++) {
        for (let j = i + 1; j < st.orbs.length; j++) {
          const a = st.orbs[i], b = st.orbs[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.r + b.r + 16;
          if (dist >= minDist || dist <= 0.1) continue;
          const force = (minDist - dist) * 0.6;
          const nx = dx / dist, ny = dy / dist;
          if (!a.paused) { a.vx -= nx * force * dt; a.vy -= ny * force * dt; }
          if (!b.paused) { b.vx += nx * force * dt; b.vy += ny * force * dt; }
        }
      }

      const headlineTop = GUTTER + 24;
      const headlineMaxW = pw - GUTTER * 2;
      const headline = fitHeadline(title, headlineMaxW, 80);
      const headlineH = headline.lines.length * headline.lineHeight;

      const bodyTop = headlineTop + headlineH + (subtitle ? 28 : 16) + 16;
      const bodyH = ph - bodyTop - 40;

      const { lines } = layoutWithObstacles(
        preparedBody,
        { segmentIndex: 0, graphemeIndex: 0 },
        GUTTER, bodyTop, pw - GUTTER * 2, bodyH,
        BODY_LINE_HEIGHT, st.orbs,
      );

      // Project headline
      const headlineEls = headlineLinesRef.current;
      while (headlineEls.length < headline.lines.length) {
        const el = document.createElement('span');
        el.className = 'bc-headline';
        el.style.cssText = 'position:absolute;white-space:pre;pointer-events:none;';
        stage.appendChild(el);
        headlineEls.push(el);
      }
      for (let i = 0; i < headlineEls.length; i++) {
        const el = headlineEls[i];
        if (i < headline.lines.length) {
          const l = headline.lines[i];
          el.style.display = '';
          el.style.left = `${GUTTER + l.x}px`;
          el.style.top = `${headlineTop + l.y}px`;
          el.style.font = `700 ${headline.fontSize}px ${HEADLINE_FONT_FAMILY}`;
          el.style.lineHeight = `${headline.lineHeight}px`;
          el.style.color = '#e8edf8';
          el.textContent = l.text;
        } else {
          el.style.display = 'none';
        }
      }

      // Project body lines
      const bodyEls = linesRef.current;
      while (bodyEls.length < lines.length) {
        const el = document.createElement('span');
        el.className = 'bc-line';
        el.style.cssText = 'position:absolute;white-space:pre;pointer-events:none;';
        stage.appendChild(el);
        bodyEls.push(el);
      }
      for (let i = 0; i < bodyEls.length; i++) {
        const el = bodyEls[i];
        if (i < lines.length) {
          const l = lines[i];
          el.style.display = '';
          el.style.left = `${l.x}px`;
          el.style.top = `${l.y}px`;
          el.style.font = BODY_FONT;
          el.style.lineHeight = `${BODY_LINE_HEIGHT}px`;
          const isSectionLabel = l.text === l.text.toUpperCase() && l.text.length > 3 && l.text.length < 30;
          el.style.color = isSectionLabel ? '#5b7aa8' : '#b8c8e0';
          el.style.fontWeight = isSectionLabel ? '700' : '400';
          el.style.fontSize = isSectionLabel ? '12px' : '16px';
          el.style.letterSpacing = isSectionLabel ? '1px' : '0';
          el.textContent = l.text;
        } else {
          el.style.display = 'none';
        }
      }

      // Project orbs
      const orbEls = stage.querySelectorAll('.bc-orb');
      for (let i = 0; i < st.orbs.length; i++) {
        const orb = st.orbs[i];
        let el = orbEls[i];
        if (!el) {
          el = document.createElement('div');
          el.className = 'bc-orb';
          el.style.cssText = 'position:absolute;border-radius:50%;cursor:grab;transition:opacity 0.3s;';
          stage.appendChild(el);
        }
        const [r, g, b] = orb.color;
        el.style.left = `${orb.x - orb.r}px`;
        el.style.top = `${orb.y - orb.r}px`;
        el.style.width = `${orb.r * 2}px`;
        el.style.height = `${orb.r * 2}px`;
        el.style.background = `radial-gradient(circle at 35% 35%, rgba(${r},${g},${b},0.35), rgba(${r},${g},${b},0.12) 55%, transparent 72%)`;
        el.style.boxShadow = `0 0 40px 10px rgba(${r},${g},${b},0.15)`;
        el.style.opacity = orb.paused ? '0.4' : '1';
      }

      st.lastFrameTime = animating ? now : null;
      return animating;
    }

    function loop(now) {
      const shouldContinue = render(now);
      rafRef.current = shouldContinue ? requestAnimationFrame(loop) : null;
      if (!shouldContinue) {
        // Still schedule one more in case of future events
        rafRef.current = requestAnimationFrame(loop);
      }
    }

    rafRef.current = requestAnimationFrame(loop);

    // Pointer events
    function onPointerDown(e) {
      const st = stateRef.current;
      if (!st) return;
      const rect = stage.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      for (let i = st.orbs.length - 1; i >= 0; i--) {
        const orb = st.orbs[i];
        const dx = px - orb.x, dy = py - orb.y;
        if (dx * dx + dy * dy <= orb.r * orb.r) {
          e.preventDefault();
          st.drag = { orbIndex: i, startPX: px, startPY: py, startOX: orb.x, startOY: orb.y };
          stage.setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    function onPointerMove(e) {
      const st = stateRef.current;
      if (!st?.drag) return;
      const rect = stage.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const orb = st.orbs[st.drag.orbIndex];
      orb.x = st.drag.startOX + (px - st.drag.startPX);
      orb.y = st.drag.startOY + (py - st.drag.startPY);
    }

    function onPointerUp(e) {
      const st = stateRef.current;
      if (!st?.drag) return;
      const rect = stage.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const dx = px - st.drag.startPX, dy = py - st.drag.startPY;
      if (dx * dx + dy * dy < 16) {
        st.orbs[st.drag.orbIndex].paused = !st.orbs[st.drag.orbIndex].paused;
      }
      st.drag = null;
    }

    stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      linesRef.current.forEach(el => el.remove());
      linesRef.current = [];
      headlineLinesRef.current.forEach(el => el.remove());
      headlineLinesRef.current = [];
      stage.querySelectorAll('.bc-orb').forEach(el => el.remove());
    };
  }, [ready, title, subtitle, briefingText, initOrbs]);

  const riskLabelText = riskLevel ? `⚠️ ${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk` : '';

  return (
    <div style={{ position: 'relative', marginTop: 16 }}>
      <div
        ref={stageRef}
        style={{
          position: 'relative',
          width: '100%',
          height: 600,
          background: '#0a0e1a',
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid #1e2a40',
          userSelect: 'text',
        }}
      >
        {ready && (
          <>
            <div style={{
              position: 'absolute', left: GUTTER, top: 12,
              font: LABEL_FONT, color: '#2563eb', letterSpacing: 2, textTransform: 'uppercase',
            }}>
              {label}
            </div>
            {riskLabelText && (
              <div style={{
                position: 'absolute', right: GUTTER, top: 12,
                font: SMALL_FONT,
                color: `rgb(${riskColor.join(',')})`,
              }}>
                {riskLabelText}
              </div>
            )}
            {subtitle && (
              <div style={{
                position: 'absolute', left: GUTTER,
                top: GUTTER + 24 + 60,
                font: SMALL_FONT, color: '#5b7aa8', maxWidth: '70%',
              }}>
                {subtitle}
              </div>
            )}
            <div style={{
              position: 'absolute', left: GUTTER, bottom: 16,
              font: '13px -apple-system, sans-serif', color: '#3d5070',
            }}>
              globalperspective.net · Powered by Pretext
            </div>
          </>
        )}
      </div>
      <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 8 }}>
        Drag the orbs — text reflows in real-time using <a href="https://github.com/chenglou/pretext" target="_blank" rel="noreferrer" style={{ color: '#7eb8f7' }}>Pretext</a> (zero DOM measurements).
        Click an orb to pause it.
      </p>
    </div>
  );
}
