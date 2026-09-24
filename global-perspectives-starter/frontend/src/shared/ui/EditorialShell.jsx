// EditorialShell — 3-col layout shell: left-rail / center / right-rail.
// Usage:
//   <EditorialShell
//     strip={<StatusStrip ... />}
//     left={<LeftRail>...</LeftRail>}
//     right={<RightRail>...</RightRail>}
//   >
//     {/* center content */}
//   </EditorialShell>
//
// Collapses to 1-col on mobile (left rail hidden by default on mobile).

export default function EditorialShell({ strip, left, right, children, className = '' }) {
  return (
    <div className={`es-shell ${className}`}>
      {strip && <div className="es-strip">{strip}</div>}
      <div className="es-body">
        {left && <aside className="es-left">{left}</aside>}
        <main className="es-center">{children}</main>
        {right && <aside className="es-right">{right}</aside>}
      </div>
    </div>
  );
}
