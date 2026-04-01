import { useRef, useEffect, useCallback } from 'react';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

const CARD_W = 800;
const PADDING = 40;
const CONTENT_W = CARD_W - PADDING * 2;
const BG = '#0a0e1a';
const TEXT_PRIMARY = '#e8edf8';
const TEXT_SECONDARY = '#b8c8e0';
const TEXT_MUTED = '#5b7aa8';
const ACCENT = '#2563eb';
const BORDER = '#1e2a40';
const RISK_COLORS = { critical: '#ef4444', elevated: '#f97316', moderate: '#eab308', low: '#22c55e' };

const FONT_TITLE = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FONT_BODY = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FONT_LABEL = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FONT_SMALL = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FONT_FOOTER = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const LINE_HEIGHT_TITLE = 32;
const LINE_HEIGHT_BODY = 24;
const LINE_HEIGHT_SMALL = 20;

function drawWrappedText(ctx, text, font, lineHeight, maxWidth, x, y, color) {
  if (!text) return y;
  const prepared = prepareWithSegments(text, font);
  const result = layoutWithLines(prepared, maxWidth, lineHeight);
  ctx.font = font;
  ctx.fillStyle = color;
  for (const line of result.lines) {
    y += lineHeight;
    ctx.fillText(line.text, x, y);
  }
  return y;
}

function drawLabel(ctx, text, x, y) {
  ctx.font = FONT_LABEL;
  ctx.fillStyle = ACCENT;
  ctx.letterSpacing = '2px';
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.letterSpacing = '0px';
  return y;
}

function drawDivider(ctx, x, y, width) {
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  return y + 16;
}

function renderThreadCard(canvas, thread, analysis) {
  const ctx = canvas.getContext('2d');
  const title = analysis?.threadTitle || thread?.latestTitle || 'Thread Briefing';
  const storyArc = analysis?.storyArc || '';
  const trajectory = analysis?.trajectory || '';
  const watchQuestions = analysis?.watchQuestions || [];
  const articleCount = thread?.articleCount || analysis?.entryCount || 0;
  const trend = thread?.trend || 'stable';

  const prepTitle = prepareWithSegments(title, FONT_TITLE);
  const titleResult = layoutWithLines(prepTitle, CONTENT_W, LINE_HEIGHT_TITLE);
  const prepArc = storyArc ? prepareWithSegments(storyArc.slice(0, 300), FONT_BODY) : null;
  const arcResult = prepArc ? layoutWithLines(prepArc, CONTENT_W, LINE_HEIGHT_BODY) : null;
  const prepTraj = trajectory ? prepareWithSegments(trajectory.slice(0, 200), FONT_BODY) : null;
  const trajResult = prepTraj ? layoutWithLines(prepTraj, CONTENT_W, LINE_HEIGHT_BODY) : null;

  let totalH = PADDING;
  totalH += 20;
  totalH += 16;
  totalH += titleResult.height + 8;
  totalH += LINE_HEIGHT_SMALL + 24;
  if (arcResult) totalH += 20 + LINE_HEIGHT_SMALL + 8 + arcResult.height + 16;
  if (trajResult) totalH += 20 + LINE_HEIGHT_SMALL + 8 + trajResult.height + 16;
  if (watchQuestions.length > 0) totalH += 20 + LINE_HEIGHT_SMALL + 8 + watchQuestions.slice(0, 2).length * LINE_HEIGHT_SMALL + 16;
  totalH += 16;
  totalH += LINE_HEIGHT_SMALL + PADDING;

  canvas.width = CARD_W;
  canvas.height = totalH;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, totalH);

  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, CARD_W - 1, totalH - 1);

  let y = PADDING;

  y = drawLabel(ctx, '📊 Continuing Story Briefing', PADDING, y + 14);
  y += 20;

  y = drawWrappedText(ctx, title, FONT_TITLE, LINE_HEIGHT_TITLE, CONTENT_W, PADDING, y, TEXT_PRIMARY);
  y += 8;

  ctx.font = FONT_SMALL;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText(`${articleCount} articles · ${trend.charAt(0).toUpperCase() + trend.slice(1)}`, PADDING, y + LINE_HEIGHT_SMALL);
  y += LINE_HEIGHT_SMALL + 24;

  if (storyArc) {
    y = drawDivider(ctx, PADDING, y, CONTENT_W);
    ctx.font = FONT_LABEL;
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText('HOW IT EVOLVED', PADDING, y + 14);
    y += LINE_HEIGHT_SMALL + 8;
    y = drawWrappedText(ctx, storyArc.slice(0, 300) + (storyArc.length > 300 ? '...' : ''), FONT_BODY, LINE_HEIGHT_BODY, CONTENT_W, PADDING, y, TEXT_SECONDARY);
    y += 16;
  }

  if (trajectory) {
    y = drawDivider(ctx, PADDING, y, CONTENT_W);
    ctx.font = FONT_LABEL;
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText("WHAT'S NEXT", PADDING, y + 14);
    y += LINE_HEIGHT_SMALL + 8;
    y = drawWrappedText(ctx, trajectory.slice(0, 200) + (trajectory.length > 200 ? '...' : ''), FONT_BODY, LINE_HEIGHT_BODY, CONTENT_W, PADDING, y, TEXT_SECONDARY);
    y += 16;
  }

  if (watchQuestions.length > 0) {
    y = drawDivider(ctx, PADDING, y, CONTENT_W);
    ctx.font = FONT_LABEL;
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText('QUESTIONS TO WATCH', PADDING, y + 14);
    y += LINE_HEIGHT_SMALL + 8;
    ctx.font = FONT_SMALL;
    ctx.fillStyle = TEXT_SECONDARY;
    for (const q of watchQuestions.slice(0, 2)) {
      ctx.fillText(`• ${q}`, PADDING, y + LINE_HEIGHT_SMALL);
      y += LINE_HEIGHT_SMALL;
    }
    y += 16;
  }

  y = drawDivider(ctx, PADDING, y, CONTENT_W);
  ctx.font = FONT_FOOTER;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText('globalperspective.net', PADDING, y + LINE_HEIGHT_SMALL);

  return canvas;
}

function renderCountryCard(canvas, countryName, intel) {
  const ctx = canvas.getContext('2d');
  const riskLevel = (intel?.riskLevel || '').toLowerCase();
  const headline = intel?.headline || '';
  const bluf = intel?.bluf || '';
  const keyDevs = intel?.keyDevelopments || [];
  const riskSignals = intel?.riskSignals || [];

  const riskLabel = riskLevel ? `${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk` : '';
  const titleText = `🌍 ${countryName}`;

  const prepTitle = prepareWithSegments(titleText, FONT_TITLE);
  const titleResult = layoutWithLines(prepTitle, CONTENT_W, LINE_HEIGHT_TITLE);
  const prepBluf = bluf ? prepareWithSegments(bluf.slice(0, 350), FONT_BODY) : null;
  const blufResult = prepBluf ? layoutWithLines(prepBluf, CONTENT_W, LINE_HEIGHT_BODY) : null;

  let totalH = PADDING;
  totalH += 20;
  totalH += 16;
  totalH += titleResult.height + 8;
  if (riskLabel) totalH += LINE_HEIGHT_SMALL + 8;
  if (headline) totalH += LINE_HEIGHT_BODY + 24;
  if (blufResult) totalH += 20 + LINE_HEIGHT_SMALL + 8 + blufResult.height + 16;
  if (keyDevs.length > 0) totalH += 20 + LINE_HEIGHT_SMALL + 8 + keyDevs.slice(0, 3).length * LINE_HEIGHT_SMALL + 16;
  if (riskSignals.length > 0) totalH += 20 + LINE_HEIGHT_SMALL + 8 + riskSignals.slice(0, 3).length * LINE_HEIGHT_SMALL + 16;
  totalH += 16;
  totalH += LINE_HEIGHT_SMALL + PADDING;

  canvas.width = CARD_W;
  canvas.height = totalH;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, totalH);

  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, CARD_W - 1, totalH - 1);

  let y = PADDING;

  y = drawLabel(ctx, '📊 Intelligence Briefing', PADDING, y + 14);
  y += 20;

  y = drawWrappedText(ctx, titleText, FONT_TITLE, LINE_HEIGHT_TITLE, CONTENT_W, PADDING, y, TEXT_PRIMARY);
  y += 8;

  if (riskLabel) {
    const riskColor = RISK_COLORS[riskLevel] || '#eab308';
    ctx.font = FONT_SMALL;
    ctx.fillStyle = riskColor;
    ctx.fillText(`⚠️ ${riskLabel}`, PADDING, y + LINE_HEIGHT_SMALL);
    y += LINE_HEIGHT_SMALL + 8;
  }

  if (headline) {
    ctx.font = FONT_BODY;
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.fillText(headline.slice(0, 80), PADDING, y + LINE_HEIGHT_BODY);
    y += LINE_HEIGHT_BODY + 24;
  }

  if (bluf) {
    y = drawDivider(ctx, PADDING, y, CONTENT_W);
    ctx.font = FONT_LABEL;
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText('BOTTOM LINE', PADDING, y + 14);
    y += LINE_HEIGHT_SMALL + 8;
    y = drawWrappedText(ctx, bluf.slice(0, 350) + (bluf.length > 350 ? '...' : ''), FONT_BODY, LINE_HEIGHT_BODY, CONTENT_W, PADDING, y, TEXT_SECONDARY);
    y += 16;
  }

  if (keyDevs.length > 0) {
    y = drawDivider(ctx, PADDING, y, CONTENT_W);
    ctx.font = FONT_LABEL;
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText('KEY DEVELOPMENTS', PADDING, y + 14);
    y += LINE_HEIGHT_SMALL + 8;
    ctx.font = FONT_SMALL;
    ctx.fillStyle = TEXT_SECONDARY;
    for (const d of keyDevs.slice(0, 3)) {
      const text = `${d.date || ''} ${d.text || d}`;
      ctx.fillText(text.slice(0, 80), PADDING, y + LINE_HEIGHT_SMALL);
      y += LINE_HEIGHT_SMALL;
    }
    y += 16;
  }

  if (riskSignals.length > 0) {
    y = drawDivider(ctx, PADDING, y, CONTENT_W);
    ctx.font = FONT_LABEL;
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText('WHAT TO WATCH', PADDING, y + 14);
    y += LINE_HEIGHT_SMALL + 8;
    ctx.font = FONT_SMALL;
    ctx.fillStyle = TEXT_SECONDARY;
    for (const s of riskSignals.slice(0, 3)) {
      ctx.fillText(`⚡ ${s.slice(0, 70)}`, PADDING, y + LINE_HEIGHT_SMALL);
      y += LINE_HEIGHT_SMALL;
    }
    y += 16;
  }

  y = drawDivider(ctx, PADDING, y, CONTENT_W);
  ctx.font = FONT_FOOTER;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText('globalperspective.net', PADDING, y + LINE_HEIGHT_SMALL);

  return canvas;
}

export default function BriefingCard({ type, thread, analysis, countryName, intel }) {
  const canvasRef = useRef(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (type === 'thread') {
      renderThreadCard(canvas, thread, analysis);
    } else if (type === 'country') {
      renderCountryCard(canvas, countryName, intel);
    }
  }, [type, thread, analysis, countryName, intel]);

  useEffect(() => {
    document.fonts.ready.then(render);
  }, [render]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    const name = type === 'thread'
      ? `briefing-${(thread?.threadId || 'thread').slice(0, 30)}.png`
      : `briefing-${(countryName || 'country').replace(/\s+/g, '-').toLowerCase()}.png`;
    link.download = name;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div style={{ marginTop: 16 }}>
      <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 800, borderRadius: 8 }} />
      <button
        onClick={handleDownload}
        style={{
          marginTop: 8, padding: '6px 14px', borderRadius: 6,
          background: '#2563eb', color: '#fff', border: 'none',
          fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
        }}
      >
        📥 Download briefing image
      </button>
    </div>
  );
}
