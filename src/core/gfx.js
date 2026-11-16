// v3 rendering setup shared by the game and preview.html: HDR sky lighting, PBR, cascaded sun shadows, height fog with a
// hazy horizon, and one merged post chain (pmndrs postprocessing: N8AO ambient occlusion → bloom + ACES tone mapping → SMAA).
// Quality can be switched at runtime; night mode is optional.
//
// Two global shader-chunk patches are installed on first use (they apply to every built-in material, so no per-material setup
// and no clash with materials that have their own onBeforeCompile):
//  • lights_fragment_begin — every DirectionalLight in the scene is treated as ONE sun: light 0 does the lighting and each
//    light's shadow map is one cascade; a fragment uses the first (finest) cascade that contains it.
//  • fog_* — exponential-squared distance fog whose density falls off with height (clear when looking down from above, hazy
//    along the ground), slightly brightened towards the sun.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { nightLights, nightState } from './mats.js';

// cascades: half-extent (m) of each sun shadow box, finest first; every: re-render that cascade every N frames
export const QUALITY = {
  high: { label: '高', dpr: 1.5, shadow: 2048, cascades: [42, 150, 560], every: [1, 2, 24], ao: true, bloom: true, msaa: 0 },
  medium: { label: '中', dpr: 1.25, shadow: 2048, cascades: [55, 260], every: [1, 3], ao: false, bloom: true, msaa: 4 },
  low: { label: '低', dpr: 1, shadow: 1024, cascades: [45, 220], every: [1, 30], ao: false, bloom: false, msaa: 0 },
};
// sun vs sky: the HDR sky alone lit shaded ground almost as brightly as sunlit ground, which made everything look flat
const DAY = { env: 0.5, bg: 1, sun: 4.6, sunCol: 0xfff0d8, fog: 0xc3d3e3, exposure: 0.8, bloom: 0.35, bloomT: 0.9, bounce: 1.5 };
const NIGHT = { env: 0.07, bg: 0.035, sun: 0.22, sunCol: 0x8fa8ff, fog: 0x0b1018, exposure: 1.05, bloom: 1.5, bloomT: 0.42, bounce: 0.04 };
const SUN_DIR = new THREE.Vector3(-0.42, 0.72, 0.52).normalize();
const FOG_FALLOFF = 1 / 90;       // fog density halves every ~60 m of height

let patched = false;
function patchChunks() {
  if (patched) return; patched = true;
  const C = THREE.ShaderChunk, a = C.lights_fragment_begin.indexOf('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )'), b = C.lights_fragment_begin.indexOf('#if ( NUM_RECT_AREA_LIGHTS > 0 )');
  const DEBUG_CSM = typeof location !== 'undefined' && /csmdebug/.test(location.search) ? '\t\tdirectLight.color *= csmIdx == 0 ? vec3( 1.0, 0.4, 0.4 ) : csmIdx == 1 ? vec3( 0.4, 1.0, 0.4 ) : csmIdx == 2 ? vec3( 0.4, 0.4, 1.0 ) : vec3( 1.0 );\n' : '';
  if (a < 0 || b < a) { console.warn('gfx: unexpected lights_fragment_begin, cascaded shadows disabled'); return; }
  C.lights_fragment_begin = C.lights_fragment_begin.slice(0, a) + /* glsl */`
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight = directionalLights[ 0 ];
	getDirectionalLightInfo( directionalLight, directLight );
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	{
		DirectionalLightShadow directionalLightShadow;
		float csmShadow = 1.0; bool csmDone = false; vec3 csmC; int csmIdx = -1;
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			csmC = vDirectionalShadowCoord[ i ].xyz / vDirectionalShadowCoord[ i ].w;
			if ( ! csmDone && csmC.x > 0.025 && csmC.x < 0.975 && csmC.y > 0.025 && csmC.y < 0.975 && csmC.z < 1.0 ) {
				csmDone = true; csmIdx = UNROLLED_LOOP_INDEX;
				directionalLightShadow = directionalLightShadows[ i ];
				csmShadow = getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] );
				#if UNROLLED_LOOP_INDEX == NUM_DIR_LIGHT_SHADOWS - 1
				csmShadow = mix( csmShadow, 1.0, smoothstep( 0.36, 0.47, max( abs( csmC.x - 0.5 ), abs( csmC.y - 0.5 ) ) ) );
				#endif
			}
		}
		#pragma unroll_loop_end
		directLight.color *= ( directLight.visible && receiveShadow ) ? csmShadow : 1.0;
${DEBUG_CSM}	}
	#endif
	RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
` + C.lights_fragment_begin.slice(b);
  // a mirror-like surface catching the sun can exceed the half-float range; one Inf pixel turns into NaN in the bloom blur and blacks out the frame
  C.tonemapping_fragment = 'gl_FragColor.rgb = min( gl_FragColor.rgb, vec3( 120.0 ) );\n' + C.tonemapping_fragment;
  C.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying vec3 vFogVec;\n#endif';
  C.fog_vertex = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvFogVec = mvPosition.xyz * mat3( viewMatrix );\n#endif';   // world-space vector camera → vertex
  C.fog_pars_fragment = '#ifdef USE_FOG\n\tuniform vec3 fogColor;\n\tvarying float vFogDepth;\n\tvarying vec3 vFogVec;\n\t#ifdef FOG_EXP2\n\t\tuniform float fogDensity;\n\t#else\n\t\tuniform float fogNear;\n\t\tuniform float fogFar;\n\t#endif\n#endif';
  C.fog_fragment = /* glsl */`
#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogDist = length( vFogVec ), fogK = ${FOG_FALLOFF.toFixed(6)} * vFogVec.y;
		float fogInt = abs( fogK ) > 0.002 ? ( 1.0 - exp( - fogK ) ) / fogK : 1.0 - 0.5 * fogK;
		float fogTau = fogDensity * fogDensity * fogDist * fogDist * exp( - ${FOG_FALLOFF.toFixed(6)} * max( cameraPosition.y, 0.0 ) ) * fogInt;
		float fogFactor = 1.0 - exp( - fogTau );
		float fogSun = pow( max( dot( vFogVec / max( fogDist, 0.001 ), vec3( ${SUN_DIR.x.toFixed(4)}, ${SUN_DIR.y.toFixed(4)}, ${SUN_DIR.z.toFixed(4)} ) ), 0.0 ), 5.0 );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor * ( 1.0 + 0.45 * fogSun ), fogFactor );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
	#endif
#endif`;
}

/** hazy band around the horizon: hides the hard edge between the fogged city and the HDR sky backdrop */
function horizonHaze(fog) {
  const g = new THREE.SphereGeometry(1, 48, 24);
  const m = new THREE.ShaderMaterial({
    uniforms: { fogColor: { value: fog.color } }, transparent: true, depthWrite: false, depthTest: true, side: THREE.BackSide, fog: false,
    vertexShader: 'varying vec3 vDir;\nvoid main() { vDir = position; vec4 p = projectionMatrix * vec4( mat3( viewMatrix ) * position, 1.0 ); gl_Position = p.xyww; }',
    fragmentShader: /* glsl */`uniform vec3 fogColor; varying vec3 vDir;
void main() {
	vec3 d = normalize( vDir );
	float a = 1.0 - smoothstep( -0.01, 0.11, d.y ); a *= a;
	float s = pow( max( dot( d, vec3( ${SUN_DIR.x.toFixed(4)}, ${SUN_DIR.y.toFixed(4)}, ${SUN_DIR.z.toFixed(4)} ) ), 0.0 ), 5.0 );
	gl_FragColor = vec4( fogColor * ( 1.0 + 0.45 * s ), a );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = -1e6; mesh.matrixAutoUpdate = false; mesh.name = 'horizonHaze';
  return mesh;
}

/**
 * opts: { container, quality:'high'|'medium'|'low', fov, near, far, fogDensity, preserveDrawingBuffer }
 * Returns { renderer, scene, camera, sun, render(), resize(), setQuality(q), setNight(on), followSun(x,y,z), fitShadow(center,R), quality, night }.
 */
export async function createGfx(opts = {}) {
  patchChunks();
  const container = opts.container || document.body;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserveDrawingBuffer });
  renderer.toneMappingExposure = DAY.exposure;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 55, 1, opts.near ?? 0.5, opts.far ?? 7000);

  const hdr = await new RGBELoader().loadAsync(new URL('../../assets/hdri/sky_day_2k.hdr', import.meta.url).href);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = hdr; scene.environment = hdr; scene.environmentIntensity = DAY.env;
  scene.fog = new THREE.FogExp2(DAY.fog, opts.fogDensity ?? 0.00045);
  scene.add(horizonHaze(scene.fog));
  // light bounced up from sunlit ground: without it walls in shade are lit by the blue sky only and turn dark navy
  const bounce = new THREE.HemisphereLight(0x000000, 0xb8a58c, DAY.bounce); scene.add(bounce);

  const gfx = { renderer, scene, camera, sun: null, quality: null, night: false, composer: null, SUN_DIR, cascades: [] };
  let bloom = null, frame = 0, fit = null;

  // ── cascaded sun ──
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_DIR).normalize(), up = new THREE.Vector3().crossVectors(SUN_DIR, right).normalize();
  const v = new THREE.Vector3(), fwd = new THREE.Vector3();
  function buildSun(q) {
    for (const c of gfx.cascades) { scene.remove(c.light, c.light.target); c.light.shadow.dispose(); c.light.dispose(); }
    const p = gfx.night ? NIGHT : DAY;
    gfx.cascades = q.cascades.map((half, k) => {
      const light = new THREE.DirectionalLight(p.sunCol, p.sun); light.castShadow = true; light.shadow.mapSize.set(q.shadow, q.shadow); light.shadow.autoUpdate = false;
      scene.add(light, light.target);
      return { light, base: half, half: 0, every: q.every[k], key: '' };
    });
    gfx.sun = gfx.cascades[0].light;
  }
  function sizeCascade(c, half) {
    if (c.half === half) return; c.half = half;
    const cam = c.light.shadow.camera, texel = 2 * half / c.light.shadow.mapSize.x;
    Object.assign(cam, { left: -half, right: half, top: half, bottom: -half, near: 10, far: 1900 + half * 2 }); cam.updateProjectionMatrix();
    c.light.shadow.bias = -0.00012 - texel * 0.00035; c.light.shadow.normalBias = 0.05 + texel * 1.6; c.light.shadow.radius = 1.4;
  }
  /** centre a cascade on (x,y,z), snapped to `snap` metres in light space; with onlyIfMoved the light stays put unless the snapped centre changed */
  function placeCascade(c, x, y, z, snap, onlyIfMoved) {
    v.set(x, y, z); const a = Math.round(v.dot(right) / snap) * snap, b = Math.round(v.dot(up) / snap) * snap, d = v.dot(SUN_DIR), key = a + ',' + b + ',' + c.half;
    if (key === c.key && onlyIfMoved) return false;
    const moved = key !== c.key; c.key = key;
    c.light.target.position.set(0, 0, 0).addScaledVector(right, a).addScaledVector(up, b).addScaledVector(SUN_DIR, d);
    c.light.position.copy(c.light.target.position).addScaledVector(SUN_DIR, 900 + c.half);
    c.light.target.updateMatrixWorld(); c.light.updateMatrixWorld();
    return moved;
  }
  /** fit the cascades around the camera (call once per frame; x,y,z = point of interest, used when the camera looks far away) */
  gfx.followSun = (x, y, z) => {
    if (fit) return;
    frame++;
    camera.getWorldDirection(fwd); const cy = camera.position.y, hl = Math.hypot(fwd.x, fwd.z) || 1e-6;
    // where the view axis meets the ground (horizontal distance from the camera); high cameras look at far ground → larger, farther boxes
    const hit = fwd.y < -0.02 ? Math.min(cy / -fwd.y * hl, 2500) : 2500, last = gfx.cascades.length - 1;
    const scale = Math.min(Math.pow(1.5, Math.max(0, Math.round(Math.log(Math.max(cy, 1) / 28) / Math.log(1.5)))), 1500 / QUALITY[gfx.quality].cascades[last]);
    gfx.cascades.forEach((c, k) => {
      const half = c.base * scale, slow = c.every > 4, resized = c.half !== half, due = resized || (frame + k) % c.every === 0;
      if (!slow && !due) return;
      if (resized) sizeCascade(c, half);
      // fast cascades glide in shadow-texel steps; slow ones jump a quarter of their size and are re-rendered only then (or when due)
      const off = Math.min(hit, half * (cy > 60 ? 0.9 : 0.55));
      const moved = placeCascade(c, camera.position.x + fwd.x / hl * off, 0, camera.position.z + fwd.z / hl * off, slow ? half / 4 : 2 * half / c.light.shadow.mapSize.x, slow && !due);
      if (moved || due) c.light.shadow.needsUpdate = true;
    });
  };
  /** static shadow boxes around a model (preview pages): the cascades stop following the camera */
  gfx.fitShadow = (center, R) => {
    fit = { center: center.clone(), R };
    gfx.cascades.forEach((c, k, all) => { c.every = 1; sizeCascade(c, R * (all.length === 1 ? 1 : [0.4, 1, 2.5][k + 3 - all.length])); c.key = ''; placeCascade(c, center.x, center.y, center.z, 0.001, false); c.light.shadow.autoUpdate = true; });
  };

  function build() {
    const q = QUALITY[gfx.quality], w = innerWidth, h = innerHeight;   // every page that uses this is full-window
    renderer.setPixelRatio(Math.min(devicePixelRatio, q.dpr)); renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (gfx.cascades.length !== q.cascades.length || gfx.sun.shadow.mapSize.x !== q.shadow || gfx.cascades.some((c, k) => c.base !== q.cascades[k])) { buildSun(q); if (fit) gfx.fitShadow(fit.center, fit.R); }
    if (gfx.composer) { gfx.composer.dispose(); gfx.composer = null; } bloom = null;
    const post = q.ao || q.bloom;
    renderer.toneMapping = post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;   // with the composer, tone mapping is the last effect
    if (!post) return;
    const composer = gfx.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: q.msaa });
    composer.addPass(new RenderPass(scene, camera));
    if (q.ao) {
      // N8AO works from the depth buffer alone (no second geometry pass); computed at half resolution, upsampled depth-aware
      const ao = gfx.ao = new N8AOPostPass(scene, camera, w, h);
      Object.assign(ao.configuration, { aoRadius: 2.2, distanceFalloff: 1, intensity: 2.6, halfRes: true, depthAwareUpsampling: true, transparencyAware: false, color: new THREE.Color(0x0b0d12) });
      ao.setQualityMode('Medium');
      composer.addPass(ao);
    }
    const p = gfx.night ? NIGHT : DAY, fx = [];
    if (q.bloom) fx.push(bloom = new BloomEffect({ mipmapBlur: true, radius: 0.72, luminanceThreshold: p.bloomT, luminanceSmoothing: 0.25, intensity: p.bloom }));
    fx.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }), new VignetteEffect({ offset: 0.32, darkness: 0.42 }));
    composer.addPass(new EffectPass(camera, ...fx));
    if (!q.msaa) composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
    composer.setSize(w, h);
  }
  gfx.setQuality = (q) => { if (!QUALITY[q]) q = 'high'; gfx.quality = q; build(); };
  gfx.resize = build;
  gfx.render = () => { if (gfx.composer) gfx.composer.render(); else renderer.render(scene, camera); };
  gfx.setNight = (on) => {
    gfx.night = nightState.on = !!on; const p = on ? NIGHT : DAY;
    scene.environmentIntensity = p.env; scene.backgroundIntensity = p.bg; scene.fog.color.setHex(p.fog); renderer.toneMappingExposure = p.exposure;
    for (const c of gfx.cascades) { c.light.intensity = p.sun; c.light.color.setHex(p.sunCol); } bounce.intensity = p.bounce;
    if (bloom) { bloom.intensity = p.bloom; bloom.luminanceMaterial.threshold = p.bloomT; }
    for (const l of nightLights) l.material.emissiveIntensity = on ? l.night : l.day;
  };
  gfx.quality = QUALITY[opts.quality] ? opts.quality : 'high';
  buildSun(QUALITY[gfx.quality]);
  build();
  gfx.followSun(0, 0, 0);
  addEventListener('resize', build);
  return gfx;
}
