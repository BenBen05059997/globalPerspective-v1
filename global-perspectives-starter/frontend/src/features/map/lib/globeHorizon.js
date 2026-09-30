// globeHorizon — a deck.gl layer extension that hides a pixel-space sprite whenever its ANCHOR is
// beyond the visible hemisphere. A billboard is offset in screen space, so a badge up-right of a
// marker near the limb can poke out past the sphere's silhouette (the depth test only sees the
// hidden anchor's depth), showing a sprite with no marker. The rule runs in the vertex shader on
// the anchor's globe-space position, so it follows the camera every frame with no layer rebuild:
// visible iff the anchor faces the camera, dot(p, cam - p) > 0 (p = position from the globe centre).
import { LayerExtension } from '@deck.gl/core';

// Two tests, both per instance, in the vertex shader (follow the camera every frame):
//  1. the anchor faces the camera: dot(p, cam - p) > 0 (p = position from the globe centre);
//  2. the sprite's CENTRE (anchor + its pixel offset) is inside the globe's silhouette. Near the
//     limb a badge up-right of a marker that is itself still on the sphere can land in empty space
//     outside the disc; that is a sprite with no marker, so it is hidden. The silhouette radius is
//     measured by projecting the sphere's tangent (limb) point, so it is exact for this camera.
export const HORIZON_GLSL = `
{
  vec3 gp = geometry.position.xyz;
  vec3 cam = project.cameraPosition;
  bool hide = dot(gp, cam - gp) <= 0.0;
  if (!hide) {
    float D = length(cam);
    float R = 256.0;
    vec3 ax = cam / D;
    vec3 ref = abs(ax.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 ux = normalize(cross(ax, ref));
    float kk = R / D;
    vec3 limb = R * (kk * ax + sqrt(max(1.0 - kk * kk, 0.0)) * ux);
    vec4 cl = project_common_position_to_clipspace(vec4(limb, 1.0));
    vec4 c0 = project_common_position_to_clipspace(vec4(0.0, 0.0, 0.0, 1.0));
    vec2 vs = project.viewportSize;
    vec2 n0 = c0.xy / c0.w;
    float rl = length((cl.xy / cl.w - n0) * vs);
    vec2 off = project_pixel_size_to_clipspace(vec2(instancePixelOffset.x, -instancePixelOffset.y));
    vec4 ac = project_common_position_to_clipspace(vec4(gp, 1.0));
    vec2 sc = (ac.xy + off) / ac.w;
    hide = length((sc - n0) * vs) > rl - 1.0;
  }
  if (hide) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); }
}`;

export class GlobeHorizon extends LayerExtension {
  getShaders() {
    return { inject: { 'vs:#main-end': HORIZON_GLSL } };
  }
}
GlobeHorizon.extensionName = 'GlobeHorizon';
export const GLOBE_HORIZON = [new GlobeHorizon()];
