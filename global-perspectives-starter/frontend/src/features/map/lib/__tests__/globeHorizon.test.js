import { describe, it, expect } from 'vitest';
import { GlobeHorizon, HORIZON_GLSL, GLOBE_HORIZON } from '@/features/map/lib/globeHorizon.js';

describe('GlobeHorizon', () => {
  it('injects a camera-facing test at the end of the vertex shader (no layer rebuild per frame)', () => {
    const { inject } = new GlobeHorizon().getShaders();
    expect(inject['vs:#main-end']).toBe(HORIZON_GLSL);
    expect(HORIZON_GLSL).toContain('project.cameraPosition');
    expect(HORIZON_GLSL).toContain('geometry.position');
    expect(HORIZON_GLSL).toContain('instancePixelOffset'); // the sprite centre, not just its anchor, must be on the disc
    expect(GLOBE_HORIZON).toHaveLength(1);
  });
});
