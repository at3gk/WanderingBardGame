# Art quality research — what moves stylized low-poly from competent to premium, and what fits this pipeline

Research notes, 2026-07-31. Question: what actually separates "competent"
stylized low-poly 3D from the press-frame quality of A Short Hike or
Spiritfarer, and which of those levers survive this game's constraints:
one painterly ShaderMaterial for every surface, the sky dome as the only
light authority, procedural-only assets (no image files), <5 MB bundle,
mid-range phones. The blind panels currently score ~5.5/10 against those
reference frames, with four named gaps: terrain-shadow presentation,
anchorless noon frames, ground cover reading as debris, and close-range
character craft. Every claim below carries its source and what kind of
source it is; where a primary source was unreachable, that is said
instead of papered over.

## Honest summary of what the evidence supports

The single most repeated finding across every case study is that the
premium look is not made of more detail — it is made of one *global
decision that everything obeys*, plus deliberate composition. A Short
Hike's whole style flows from rendering the world into a low-resolution
target, and its author says so in his own words: the filter came first
and dictated flat shading, no anti-aliasing, and soft outlines. Sable is
a line and a fog table. Monument Valley designs the *screen*, not the
world, and uses an orthographic camera because the art demands it.
Firewatch plans color per narrative beat with a color script and builds
its sky out of four artist-tuned gradients rather than physics. Journey
spent three years on the one surface that fills every frame. None of
these games got their look from post-processing stacks, texture
resolution, or polygon budgets — several explicitly ran *away* from all
three, and the mobile-hardware literature (tile-based GPU vendor guides,
three.js maintainer advice) says the expensive things on a phone are
precisely the things these games skipped: overdraw, alpha-blended
foliage, discard-heavy shaders, and full-screen passes.

The uncomfortable, useful conclusion for this project: the pipeline
already owns most of the machinery these games used (one shader, one
sky authority, fog, rim, world-space breakup). What it lacks is mostly
not technique but *authorship* — planned per-hour color scripts instead
of derived light, frames composed around anchors instead of pointed at
terrain, one hero surface finished to a higher standard than the rest —
plus two cheap mechanical unifiers (a global finishing pass, baked
vertex AO) that require no image assets and no second lighting model.

## Findings

### 1. A Short Hike — the unifier comes first, and everything obeys it

- The famous filter, in the author's words: "The pixellated look is
  achieved by rendering the world to a low-res RenderTexture," credited
  to rogueNoodle's gbcamera-for-unity as the learning resource. Adam
  Robinson-Yu's own #unitytips thread:
  https://threadreaderapp.com/thread/1113100182655262721.html (fetched;
  original: https://x.com/adamgryu/status/1113100182655262721).
- Why it is load-bearing, first-party (his PlayStation Blog post,
  fetched): "I was interested in trying to create a 3D game where the
  pixels are a core part of the aesthetic, the way retro 2D games often
  are" — and the filter *dictated the rest of the art direction*: "flat
  cohesive shading and no anti-aliasing," plus "a soft outline effect to
  objects to help them stand out, and stay readable with so few pixels."
  His rationale is the transferable part: "I feel like the low-resolution
  can help the world feel lush, and let your imagination fill in the
  details."
  https://blog.playstation.com/2021/08/05/crafting-a-tiny-open-world-a-look-behind-the-scenes-at-the-creation-of-a-short-hike/
- The rest of his recipe, same thread: terrain via triplanar mapping
  (Keijiro's implementation — "It uses the normal of the terrain to
  decide which texture gets shown"), splat edges *sharpened* by showing
  "only the splatmap channel with the highest value," shore foam by
  comparing water-pixel depth against the terrain behind it, and an
  ocean that is "just a plane that follows the player around" with
  world-space texture and vertex animation
  (https://x.com/adamgryu/status/1112783007566450691).
- The filter is player-adjustable (Options > Graphics > Pixel Size) —
  he shipped the unifier with an off switch
  (https://steamcommunity.com/app/1055540/discussions/0/1639792569850442961/).
- His GDC 2020 postmortem ("Crafting a Tiny Open World," 
  https://gdcvault.com/play/1026613/) remains video-only; no additional
  quotes are cited from it.

The lesson is not "pixelate." It is that a single full-frame treatment
every surface passes through *forgives asset-level crudeness and welds
an asset pile into a style* — exactly the failure mode ("asset pile
rather than illustration") DESIGN.md's one-lighting-model rule already
names. A Short Hike's characters are extremely simple meshes; the
filter is why nobody notices. That is the cheapest available answer to
"close-range character craft."

### 2. Sable — fog as the readability system, detail that fades before it lies

- Gregorios Kythreotis (creative director), on solving depth in a
  flat-shaded world with a layered system: lighting ("Having light and
  shadows helps players figure out where they sit on a surface"), fog —
  "really, really key" to mid-to-long-distance readability, tuned *per
  biome* and tied to the day-night cycle — and outlines used with
  "fading opacity," fading out with distance so detail never pops.
  Game Developer interview (fetched):
  https://www.gamedeveloper.com/marketing/how-shedworks-refined-the-art-of-sable-in-pursuit-of-readability
- The style was chosen because a two-person team needed something
  "quick to produce, quick to iterate on, and visually consistent" —
  constraint-driven, like everything else in this list. Same source.
- The surface treatment is deliberate emptiness: "objects are defined by
  thin black outlines, shapes are colored in soft tones, without any
  shading apart from the occasional dotting," and Kythreotis frames the
  emptiness as composition: "it reflects the relative emptiness of the
  desert, with some of the details — the landmarks important for
  orienting yourself — really standing out on purpose." Cook & Becker
  article (fetched):
  https://www.cookandbecker.com/en/article/170/sable-exploration-through-line-art.html
- The GDC 2022 talk ("The Art of 'Sable': Imperfection, Limitation and
  Worldbuilding," https://gdcvault.com/play/1027721/) is vault-gated;
  cited as a listing only.

Two direct transfers: fog is not weather, it is *the* mid-distance
composition tool and deserves per-biome, per-hour authored tables; and
detail that cannot survive distance should fade out before it degrades
— Sable fades its own signature line rather than let it alias. This
game's ground cover reading as debris at range is the exact failure
Sable's fading-opacity discipline exists to prevent.

### 3. Firewatch — the color script, and the artist-owned sky

- Jane Ng's GDC 2015 talk "The Art of Firewatch" (video:
  https://www.youtube.com/watch?v=ZYnS3kKTcGg, vault:
  https://www.gdcvault.com/play/1022295/; details here from Thumbsticks'
  contemporaneous summary, fetched:
  https://www.thumbsticks.com/gdc-2015-the-art-of-firewatch/):
  the world is "flat shapes with strong silhouettes and abstract
  internal details"; color is structural — "the colours are not just
  there to look beautiful. They really do drive the mood of the scene"
  — and a **color script** aligned to narrative moments keeps every
  scene's palette serving its beat. Detail density is a *language*:
  objects with more detail signal narrative importance. Her closing
  advice: "embrace your limitations."
- The sky, first-party (Campo Santo blog, graphics programmer Paolo
  Surricchio, fetched):
  https://blog.camposanto.com/post/112703721804/this-blog-post-is-an-in-detail-explanation-of-part
  Firewatch's sky is *not* physical scattering — "asking an artist to
  modify the Mie Scattering Factor… is just not intuitive." It is four
  artist-tuned components — a three-color gradient, a sun disc, a sun
  halo, a horizon halo — "simply added together at the end," with a
  visualizer for each layer. His principle: "Make the tool that works
  the best for the people who have to use it."

This is the strongest external validation of this pipeline's
sky-as-light-source architecture — Firewatch reached the same design —
and the strongest indictment of what the pipeline lacks: Firewatch's
hours are *authored* (a color script decides what noon is for), while
this game's noon is currently whatever the lighting math emits. The
panels' "anchorless noon" is a color-script gap before it is a shader
gap.

### 4. Monument Valley — compose the screen, not the world

- Ken Wong designs frame-first: "Each screen of the game is usually
  based on one puzzle or geometric idea," "everything you need to solve
  a puzzle is contained within a screen," palettes are "freeform
  tweaking as opposed to a formal plan," and the camera is subordinate
  to the art: "Most of the illusions in the game require an orthographic
  projection to work." Architizer interview (fetched):
  https://architizer.com/blog/practice/materials/an-interview-with-ken-wong-of-monument-valley/
- The GDC framing of the same idea — a game "in which every screen was
  a piece of art" — is the session description of his 2014 talk
  (https://gdcvault.com/play/1020878/, free video:
  https://archive.org/details/GDCEU2014Wong; the 2015 "Art of Monument
  Valley" talk is https://www.gdcvault.com/play/1022476 — both cited as
  listings, not transcripts).

Monument Valley is the proof that "premium" can be a *composition*
property rather than a rendering property: simple untextured geometry
scores as art because every frame is designed as one. The press frames
this game is judged against are exactly such composed frames. A camera
that guarantees an anchor (a signpost, a traveller, the bard, a tree)
in every framing is cheaper than any shader work and attacks the same
panel complaint.

### 5. Journey and Sky — one hero surface, and mobile humility

- Journey's sand: John Edwards' GDC 2013 talk "Sand Rendering in
  Journey" (https://gdcvault.com/play/1017742/, free:
  https://archive.org/details/GDC2013Edwards) — thatgamecompany spent
  three years refining and rewriting the sand tech, built a custom
  lighting model for the one material that fills nearly every frame,
  and studied real sand on an actual beach trip (Game Developer's video
  note, https://www.gamedeveloper.com/art/video-the-technology-behind-the-sand-in-i-journey-i-;
  Alan Zucconi's technical reconstruction of the shader is secondary
  but detailed: https://www.alanzucconi.com/2019/10/08/journey-sand-shader-1/).
  No direct quotes cited — the talk is video-only.
- Sky (thatgamecompany's mobile follow-up) is cited here mostly as an
  existence proof: its GDC sessions describe achieving IBL,
  self-shadowing, transparency and procedural fur "within the
  limitations imposed by mobile hardware" via a proprietary engine
  (session listings: https://gdcvault.com/play/1026903/ "Art of Sky";
  https://schedule.gdconf.com/session/glitter-fur-and-shadows-character-rendering-technology-of-sky-children-of-the-light/907475).
  The talks themselves were not reachable as transcripts; no technique
  claims are made from them beyond the listings.

Journey's lesson quantified: the surface that occupies the most pixels
deserves an order of magnitude more craft than anything else. In this
game that surface is the terrain — which is also where three of the
four named gaps live (shadow presentation, debris cover, and most noon
pixels). The current architecture spreads one shader evenly across
everything; the case study says spend unevenly.

### 6. Tunic — the fixed camera as craft multiplier (thinnest sourcing)

- Andrew Shouldice on why isometric: "The rigidness of the vertical
  lines and the regularity of the grid I like to look at a whole lot";
  environment artist Eric Billingsley on character readability at
  distance (the fox's "pointy nose and a big bushy tail. It reads
  really well") and on Ghibli-derived environment look. Game Developer
  interview (fetched):
  https://www.gamedeveloper.com/design/designing-content-for-no-one-an-interview-with-the-team-behind-tunic
- Honesty note: a rendering-focused Tunic talk was not reached. The
  GDC 2023 talk (https://gdcvault.com/play/1029384/) is about secrets,
  not art; a Steam "Talk Art in TUNIC" video post exists but its body
  would not fetch. Tunic's widely-described soft look (fog, bloom,
  shallow depth of field over flat-colored low poly) is therefore NOT
  cited to a primary source here and carries no quotes.

What Tunic still evidences through the reachable interview: a
constrained camera lets every asset be authored *for its one known
viewing angle* — silhouettes tuned for the distance they are actually
seen at. This game's per-mood camera framings (already built) make the
same authoring possible and mostly unexploited.

### 7. What is cheap and what is expensive on mobile WebGL

- Draw calls first, always: three.js maintainer Mugen87 — "2000 draw
  calls is still quite a lot. Ideally you have something like 20" — and
  his diagnostic: "if you lowering the resolution and see no performance
  improvement, then the application is not fragment shader bound"
  (i.e. shrink the canvas to tell fill-rate problems from CPU problems).
  Forum thread (fetched):
  https://discourse.threejs.org/t/performance-issue-due-to-fill-rate/9019
- Tile-based mobile GPUs (Arm's first-party Best Practices guide,
  https://developer.arm.com/documentation/101897/ and the Real-time 3D
  Art guide, https://developer.arm.com/documentation/102471/ — reached
  as search excerpts, not full fetches): keep fragments eligible for
  early-ZS by minimizing shader `discard`, alpha-to-coverage, and
  shader-written depth; "always disable blending… if an object is
  opaque"; split large translucent elements so opaque cores stay
  early-Z; on foliage, alpha-test sorts correctly but aliases while
  alpha-blend mis-sorts in motion — both cost, choose per case.
- Post-processing on phones: each pass is a full-screen read+write of
  the framebuffer — the standard mitigations are half-resolution effect
  buffers and merged passes (the pmndrs postprocessing library's core
  feature is merging effects into fewer fullscreen passes — library
  README, https://github.com/pmndrs/postprocessing, known first-hand,
  not fetched this session). Practitioner guidance converges on
  overdraw budgets near 1.2–1.5x on mobile (secondary:
  https://www.utsubo.com/blog/threejs-best-practices-100-tips).
- Relevant three.js capability: color-grade LUTs are supported in the
  official examples as a postprocessing pass over a 3D lookup texture
  (`webgl_postprocessing_3dlut`), and a `Data3DTexture` LUT can be
  *generated in code* — a graded look does not require shipping an
  image file. (Example listing known first-hand; not fetched.)

Read against this game: one fullscreen finishing pass at reduced
resolution is affordable (and can be net-*cheaper* than native-res
rendering, which is how A Short Hike shipped on Switch); an outline
pass, a bloom chain, or blended ground-cover overdraw are the things
that are not. The existing no-outline-pass rule is vendor-validated.

## Recommendations, ranked by fit

Each: what it is → which gap → mobile cost → constraint exception? →
size.

1. **Write the color script.** An authored palette keyframe table —
   per hour × biome, each with intended mood, intended value structure
   (where the darkest dark and lightest light live, what the eye should
   visit first), Firewatch-style. Noon gets designed *on purpose* (its
   classic answer: noon is the hour of color, not value — saturation
   and shadow hue carry what long shadows carry at dawn). Gap:
   anchorless noon, and it gives every future critique wave a spec to
   test against instead of a vibe. Cost: zero runtime — this is
   authorship inside the existing `palette.ts`/`sky.ts` machinery, plus
   tests pinning each keyframe's measured values. Exception: none.
   Size: one run.

2. **Anchor every framing.** A composition rule in the camera/staging
   layer: no framing ships without a near-field anchor (bard, signpost,
   cairn, tree, traveller) occupying a known screen region —
   Monument Valley's screen-first design applied to a walking game.
   The streamer already places telegraphs; the rig already has moods —
   this connects them. Gap: anchorless noon frames directly. Cost:
   zero. Exception: none. Size: one run, including a headless test that
   asserts an anchor silhouette in each mood's frame.

3. **Add the finishing pass: render-to-target at ~0.75–0.85 scale with
   a procedural grade.** One offscreen target, one composite: mild
   downscale (softens crude close-range geometry the way A Short
   Hike's filter forgives its meshes — tunable, not chunky-pixel), plus
   a code-generated 3D-LUT/grade curve that enforces the color script
   (lifted blacks toward sky hue, gentle saturation shaping — the
   painterly "varnish"). Gap: close-range character craft and overall
   premium finish. Cost: the one pattern the mobile literature blesses —
   fewer shaded fragments at native res can pay for the composite;
   must be A/B'd on a real phone, and antialias interplay needs care.
   Exception: **none if the LUT is generated** (a `Data3DTexture` built
   from the palette at boot is arithmetic, not an image asset; a
   hand-painted `.cube` file WOULD need the no-image-assets exception
   — not worth it while the grade can be expressed as code). It is also
   not a second lighting model: applied to every pixel equally, it
   *enforces* the one-model rule. Size: one to two runs.

4. **Spend unevenly: the terrain is the hero surface.** Journey's
   lesson pointed at the pixels this game actually shows. Three
   concrete moves: (a) present terrain self-shadow as few, broad,
   planned value masses (the color script says how dark and how warm)
   rather than emergent bands — this is ROADMAP task 144 restated with
   a target; (b) sharpen ground-material transitions A Short Hike-style
   (winner-take-all between grass/dirt/stone breakup rather than soft
   mixes — sharp edges broken by noise read as brushwork, soft mixes
   read as mud); (c) rebuild ground cover as *clustered patches that
   inherit the ground's base color* and fade out with distance
   (Sable's fading-opacity discipline) instead of independent scattered
   blades — scattered high-contrast instances at range are the debris
   reading. Gap: terrain-shadow presentation and debris cover. Cost:
   cheap to negative (fewer, larger, opaque cover instances = less
   overdraw). Exception: none. Size: an arc; (c) first.

5. **Bake vertex AO into procedural geometry.** At mesh-generation
   time, cast cheap hemisphere occlusion per vertex on props, the bard,
   and stop dressing; store it as a vertex attribute the painterly
   shader multiplies into its ambient term. Crevice darkening is the
   single strongest "someone crafted this" signal at close range, it is
   precomputed (zero per-frame cost beyond one attribute), and on
   procedural meshes it needs no images and no UVs — the Monument
   Valley/Townscaper school of contact-darkened vertex color, generated
   instead of painted. Gap: close-range character/prop craft, and
   grounding (props stop floating visually). Exception: none — it
   feeds the existing lighting model rather than adding one. Size: one
   run for props/actors; terrain chunks later if it earns it.

6. **Adopt the detail-density language.** Firewatch's rule, stated for
   this game: detail signals importance, so the bard, instruments,
   notation, and stop dressing own the polygon and breakup-noise
   budget; the world simplifies with distance from the player's
   attention, and fog tables get per-biome, per-hour authored values
   as part of the color script rather than one global near/far. Gap:
   overall hierarchy — the frame tells you where to look, which is
   most of what "press frame" means. Cost: zero to negative. Exception:
   none. Size: discipline plus one audit run.

Deliberately not recommended: a full-screen outline pass (design rule,
Arm-validated cost, and A Short Hike's outlines were per-object, not a
pass); bloom chains (the warm-light rule is better served by the grade
and by geometry like the hearth's embers); shipping image LUTs or
texture maps (the generated-LUT route makes the exception unnecessary);
and chasing Sky-style character tech (proprietary-engine territory;
the panels are not asking for fur).

## Findings from shipped work (appended by consolidation runs)

- 2026-08-06 (runs 95-103, the finishing pass + hour-key arc): three
  facts the note didn't predict. (1) A render-target pipeline moves
  ALPHA BLENDING into linear light (three applies no tone mapping to
  RT renders, so the display transform lands after compositing) —
  every hand-tuned alpha in the game shifts the day a post pipeline
  ships. The paper veil survived; the check belongs in any future
  post-work's verification list. (2) The generated-LUT grade this
  note recommended registered with blind judges on its first wave
  (colour became the top lens; "hued darks" praised) — but a LUT
  alone cannot fix "the sky is graded, the ground is not": the
  hour-relighting the panels actually wanted needed an albedo-side
  hue attraction with an hour schedule (landKey.ts), which is
  authorship the grade cannot express. (3) Aerial-perspective chroma
  has a ceiling the reference numbers didn't state: the distance must
  never out-saturate the foreground it sits behind — a fog step that
  measured reference-plausible in isolation (S 0.40) was read blind
  as "a fog bug" because the FOREGROUND at that hour sat lower.
  Relative, not absolute, saturation is the constraint.

- 2026-08-30 (runs 120-134, the wave 14-19 block, folded in by the run-135
  consolidation): the dominant lesson wasn't a rendering fact so much as a
  process one — a plausible-sounding blind-panel complaint is not evidence
  of its own cause, and three separate "obvious" levers were measured and
  REFUTED before anything got tuned. Wave 18's "clone-stamped foliage"
  blamed tree placement; the placement code already randomized rotation,
  scale and variant per instance, and the real cause was geometry-side
  (canopies with no asymmetry, fixed by run 128's lateral lean). Waves
  15-16's "unlit navy voids" at NPCs blamed albedo; a chroma boost moved
  0.63% of pixels and was reverted, because the value band in question was
  already inside the finishing pipeline's own chroma-crush regime. Wave
  19's "empty lower-left quadrant" looked like a camera or placement fault;
  a 9-position sweep across the rest of the same day's road showed the
  pattern is healthy everywhere else, and the one pinned frame is ordinary
  per-seed scatter variance. In all three cases the panel's symptom
  description was accurate and its attributed cause was wrong — a
  discipline this note under-weighted when it framed "recommendations,"
  which are more provisional than they read: verify against the actual
  rendering/placement code before spending a run on the fix a critique
  names. Separately, the same block found that once the engine-level
  lenses (colour, value) plateaued at 5+/6 on this rubric, the STUCK
  lenses were design-level ones — emotion (faceless protagonist, mannequin
  NPCs) and silhouette (one shape vocabulary per object class) — that no
  amount of lighting/grading work moves; those needed actual new geometry
  and posing (the deer, canopy asymmetry, the listening posture, the rock
  shape table), not tuning.

## Source access notes

Reached directly (fetched): adamgryu's effects thread (ThreadReader)
and his first-party PlayStation Blog post; the Game Developer Sable
readability interview and the Cook & Becker Sable article; the Campo
Santo sky blog post (Paolo Surricchio); Thumbsticks' detailed summary
of Jane Ng's GDC 2015 talk (the talk video itself is on YouTube/vault —
quotes here are from the summary, which attributes them directly); the
Architizer Ken Wong interview; the Game Developer Tunic team interview;
the three.js forum fill-rate thread with Mugen87's advice. Reached as
listings or search excerpts only: the GDC Vault pages for A Short
Hike's postmortem, Sable, Monument Valley (both talks), Journey's sand
talk, Tunic, and both Sky sessions (all video or gated — no quotes
cited from any of them); Arm's two best-practices guides (substantive
search excerpts; pages not individually fetched). Known first-hand but
not fetched this session, flagged inline: the pmndrs postprocessing
README and the three.js LUT example listing. Not found at all: any
primary Tunic rendering breakdown (its fog/bloom/DoF folklore is
therefore uncited and unused), and transcript-level access to Journey's
talk — its claims here stay at the level the reachable secondary
summaries support. Nothing in this file is quoted from a source that
was not reached.
