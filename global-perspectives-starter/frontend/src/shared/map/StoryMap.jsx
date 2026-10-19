import { useState, lazy, Suspense } from 'react';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import RadarMap from '@/shared/map/RadarMap.jsx';
import '@/shared/map/mapKit.css';

// StoryMap — the map pane of every slide deck (story mode, the Studio deck, briefing mode): the
// console's 3D globe (lazy — deck.gl is heavy, code-split so it only loads with a deck) with a
// WebGL-less RadarMap fallback (same pattern as SituationHome.jsx's USE_3D check). Held still and
// centred on the story's country; no selection callbacks.
const SituationMap3D = lazy(() => import('@/shared/map/SituationMap3D.jsx'));

export const STORY_MAP_FALLBACK_HEIGHT = 460;

function canUse3D() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export default function StoryMap({ shading, storyFocusIso3, height, linkArcs = [] }) {
  const [use3D] = useState(() => canUse3D());
  const h = height || STORY_MAP_FALLBACK_HEIGHT;
  return (
    <div className="sm-mapwrap" style={{ height: h }}>
      {use3D ? (
        <Suspense fallback={<div className="sm-maploading" style={{ height: h }}><BootLoader variant="inline" className="gp-boot--tight" label="Loading map" text="Loading map" /></div>}>
          <SituationMap3D
            situations={[]} focusId={null} newIds={null} view="globe"
            onSelect={() => {}} height={h} width={null}
            shading={shading} linkArcs={linkArcs} storyFocusIso3={storyFocusIso3}
            onSelectCountry={() => {}} onHoverCountry={() => {}} onFocusCountry={() => {}} onLeaveCountry={() => {}}
            countryRisk={[]} onSelectCountryRisk={() => {}} onHoverCountryRisk={() => {}} onFocusCountryRisk={() => {}} onLeaveCountryRisk={() => {}}
          />
        </Suspense>
      ) : (
        <RadarMap
          situations={[]} focusId={null} newIds={null}
          onSelect={() => {}} onScan={() => {}} height={h}
          shading={shading} linkArcs={linkArcs} storyFocusIso3={storyFocusIso3}
          onSelectCountry={() => {}} onHoverCountry={() => {}} onFocusCountry={() => {}} onLeaveCountry={() => {}}
          countryRisk={[]} onSelectCountryRisk={() => {}} onHoverCountryRisk={() => {}} onFocusCountryRisk={() => {}} onLeaveCountryRisk={() => {}}
        />
      )}
    </div>
  );
}
