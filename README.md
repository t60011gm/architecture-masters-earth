# GitHub 版：模型按需分段載入

7 個大型模型以分段保存。直接以 HTTP 服務 `dist/`，瀏覽器會在進入對應島嶼時依序下載分段、合併並驗證 SHA-256，再載入 3D 模型，不須手動還原。其他模型沿用單檔載入。請使用 HTTPS 或 localhost（瀏覽器的 SHA-256 驗證需要安全環境）。

本機啟動：`python3 -m http.server 8000 --directory dist`，再開啟 http://localhost:8000 。離開島嶼會取消尚未完成的下載；失敗可透過原有重試介面重試。分段不降低畫質，也不減少總下載量；合併需要額外記憶體，低記憶體裝置仍可能受限。

若需要原始單一 GLB，可選擇在根目錄執行 `python3 restore-large-files.py`。此腳本驗證長度與 SHA-256 後重建原檔。GitHub 版新增載入器，原正式網站與網址完全未更動。`backup-manifest.json` 記錄原始來源，`github-snapshot-manifest.json` 記錄此版本。

# 建築大師群島 · 六角地球

A standalone, buildless Three.js educational browser game. Rotate a hex-dominant Earth to discover 25 distinctive chibi architecture landmarks, then enter all 25 playable original-building islands, with 75 observation quests and 25 concept cards. No preview-only buildings remain. No backend, paid AI, account creation, or third-party analytics.

## 25-island expansion

- All 25 archived GLBs are original, byte-identical assets, about 199 MB total, loaded only when entering their individual island. The 33 original material/HDR files are deduplicated, about 20 MB total. Original 25 independent websites remain unchanged.
- Source-specific PBR profiles, world-metre texture mapping, original daylight/golden HDR sun extraction, and source-qualified night fixtures are integrated. No generic invented lights replace source fixtures. Serpentine 2002 and original Kobe Paper Church retain environment-only night with artificial lighting disabled. Gunma has no invented luminous grille and Bregenz has no invented ground-floor fixtures.
- Day, golden-hour, night, indoor-lamp toggle and quality controls preserve camera/player position. Low and mobile-auto cap PBR textures at 512 px, reduce active lights and omit shadows; high restores original texture dimensions. Dynamic re-decode closes old/stale bitmaps and does not reload the model.
- 13 newly validated interior areas supplement the original 3. Other stations remain exterior when geometry cannot support safe walking. Church of the Light's obscured cross is explicitly a conceptual explanation, not a fabricated see-through view. Olivetti distinguishes actual visible stone from the broader staircase concept.
- Three terrain topology corrections preserve every sourced building/master pin: ocean buffers around Japan and Taiwan, an open Bering Strait, and a connected Central American land bridge. Exaggerated topology is intentional on the coarse stylized globe.
- Publication remains private during verification; public access is enabled only after the complete release passes checks, as explicitly requested. Exact deployment/access receipts are kept separately from public static assets.

### Verification entry points

- `node tests.mjs`: all25 gameplay, save migration, quizzes, original links and route completion.
- `node qa/walkable-controls-tests.mjs`: actual World live-camera control, parallax, entry/exit and input regressions across75 stations.
- `node qa/expanded-observation-tests.mjs`: decoded geometry, floors, body clearance, actual feature rays and new navigation.
- `node qa/expanded-loading-tests.mjs`: single-island loading, cancellation races, retries, stale completions and resource release.
- `node --expose-gc test-original-assets.mjs` and `node --expose-gc test-lighting-lifecycle.mjs`: source hashes, PBR/fixture transforms, lighting ownership and texture quality races.
- `node globe-geometry-tests.mjs`, `node qa/globe-topology-tests.mjs`, `node qa/geography-tests.mjs`, `node qa/globe-view-tests.mjs`: sphere topology, corrected coast/strait/isthmus, immutable geographic pins, responsive scene integration.
- `python qa/verify-original-links.py`: anonymous HTTP verification of all25 original WebGPU pages.

CPU proofs and hosted fallback tests do not establish GPU appearance, lighting/transparency, hardware touch, Safari, or frame rate. The available cloud browser has no usable WebGL2/WebGPU backend. No photo or CPU raster substitutes for live eye-level observation.

## Play

Serve `dist/` over HTTP(S), then open `index.html` with JavaScript enabled. WebGL2 renders the globe and miniature meshes in real time. Unsupported browsers receive a clearly labeled **software 2D sphere projection**, using pre-rendered raster building illustrations. It is not real-time 3D. Original-model island thumbnails remain available in the playable fallback.

- Globe: drag to rotate; wheel or two-finger pinch to zoom. A single finger rotates on touchscreens. There is no planar translation.
- Use North America, Europe, and Japan controls to turn toward a region. Select a landmark and choose its focus button for a closer view. Reset returns to the global view.
- Keyboard after focusing the globe: arrow keys rotate, `+` / `−` zoom, `F` focuses the selected landmark, and `0` resets. The tilt button adjusts the globe viewing angle.
- Select any of the 25 buildings to enter its original-model exploration game. Every island prominently links to the verified original WebGPU website in a new tab.
- After landing, drag the island scene with a mouse or one finger to orbit yaw and pitch. Wheel or two-finger pinch zooms; R or the reset-camera button restores the overview without changing player position. Q/E rotates, [ / ] tilts, and plus/minus zooms.
- Click/tap terrain or a mission to walk; alternatively hold WASD, arrow keys, or touchscreen direction controls. W/S moves forward/back relative to the current camera; A/D strafes. Manual movement cancels the guided route, diagonal speed is normalized, and buildings/shoreline remain impassable.
- Input clears on dialogs, UI focus, window blur, visibility changes and island exit. Dragging never queues a destination. The explicit 2D fallback retains screen-relative walking and disables 3D camera controls.
- Meet the educational master character, then complete three observation quizzes. Space or the interaction button works when nearby.
- Collect stamps and concept cards in the passport. Progress uses only this origin's `architecture-islands-v1` localStorage key. Reset requires explicit confirmation.

## Live eye-level observation zones

All 75 observation points switch the existing live Three.js scene into a movable human-eye camera. No photograph, raster preview, different renderer, or fixed 3:2 gate is used for observation. Exterior entry keeps the player's exact ground position; the camera rises above the model if necessary, travels above that same player, then descends to eye level. Every live frame tracks that player's world position, floor, yaw, pitch and FOV.

- WASD, arrows and mobile direction controls move camera-relative at 1.5 source metres per second. Drag changes yaw and pitch; wheel and pinch change FOV without leaving the zone. Click a visible floor for a straight, collision-checked walk. Drag release never queues a walk.
- Exterior zones retain ordinary building collision and a conservative ground boundary inside the island's tree belt. A golden ground ring shows the observation range. Leaving it automatically restores the exact pre-entry overview yaw, pitch, distance and FOV, following the current player.
- Sixteen interior zones move both player and eye camera onto actual decoded GLB floors. Their connected safe floor cells are baked from horizontal support triangles plus full-body wall, glass, furniture and overhead clearance. Gold return patches are reachable within those grids. Walking into a patch returns both player and camera to the saved exterior entry and overview. Walls block movement; they do not turn into exits.
- Interior entry and exit deliberately use a short fade in the SAME live scene, rather than a fictitious camera flight through walls or an assertion that stairs/doors are fully traversable. The UI says this explicitly. The entire interior building is not unlocked. The player never continues walking invisibly outdoors.
- Esc, the return button, or R during live observation restores the saved overview. R outside an observation resets the ordinary overview. Trigger re-entry is suppressed until the player leaves the 2.6-unit rearm radius; acquisition uses 1.6 units. This avoids edge flicker and immediate re-entry after an interior return.
- Dialogs freeze camera transitions and movement. Blur, visibility changes, UI focus and pointer cancellation clear held inputs, not the live position. Island exit clears all transient state. The version-1 save key is preserved; all previous 03/04/05 answers and stamps remain valid, with additional island IDs and a defaulted time-of-day setting.
- Unsupported WebGL2 browsers clearly state that the 2D model thumbnail cannot supply real-time 3D eye-level walking, and never activate a fake first-person image overlay.

`dist/observation-camera.js` owns the reversible live state and camera travel. `dist/observation-navigation.js` contains reproducible geometry-derived safe zones. `qa/walkable-geometry-tests.mjs` and `qa/walkable-controls-tests.mjs` check support/collisions, actual World wiring, player/camera translation and parallax on the CPU. CPU tests and hosted fallback UI checks do not establish GPU pixels, hardware touch, Safari compatibility or frame rate.

## Geographic interpretation

The 25 work pins now use the **actual building site**, never the architect's practice city. Each sourced latitude/longitude projects directly to the globe. The nearest hex/pentagonal cell records grid membership only: the point is not moved to its cell centre or another country. Coarse continental edges and cell colours are illustrative, not national boundaries or survey geometry.

25 distinct original miniature meshes are retained. Buildings in the same nearest cell form a selectable cluster; the selected work's miniature is shown at that work's own pin. All constituent coordinates stay visible. Count badges and the directory expose every work. Collision-avoiding labels have visible leaders back to exact pins; only text moves on screen. None of this changes the geographic coordinates.

The atlas separately shows 21 shared-city **historical professional-base landmarks** for the 25 catalog identities. Base cities are sourced editorial career anchors, not present residence. Multi-base careers retain alternate-base context. Nationality/national affiliation is secondary biographical metadata, never inferred from birthplace and never used to place the work. Some city bases overlap an included work; others use original stylized human figurines. SANAA retains both named principals. These figurines are illustrations, not documentary likenesses.

Thirteen separately licensed photographic portraits appear in the master dossiers, with creator, source and license links. The original image files are unchanged and loaded only when their cards are opened. `dist/portrait-credits.json` preserves attribution. A fallback means no licensed image was verified in this pass, not that no such image exists.

Two catalog models refer to historical incarnations: the **2002 Ito/Balmond Serpentine Pavilion at London** and **1995 Paper Church at Kobe**. Their main pins explicitly identify original historical sites, not structures still standing there. Separate orange current-site pins identify the documented dismantling/reassembly at Beauvallon, France and Puli, Taiwan. The Kobe replacement membrane church is not substituted for the paper-church model. The London original pin is an approximately 100-metre historical-site anchor; the app discloses the uncertainty instead of claiming a surveyed footprint. Source and precision notes accompany every work.

Four empty-region markers refer only to areas omitted by these selected works. They do not imply absence of architectural culture or replace any catalog entry.

## Three kinds of line, kept separate

- Seven cyan dash-dot **work ↔ professional-base** lines indicate a work in a different country from its author's selected historical practice base. They are geographic authorship associations, not citizenship, migration or evidence of influence.
- `relationships.json` remains byte-for-byte unchanged: four sourced historical relationships (one teaching, three employment) and five separately labeled curatorial comparisons. Their endpoints now belong to the **masters' practice landmarks**, not the relocated work islands.
- Roads, ships, flights and same-city loops are only visual display modes for those nine relationship lines. They are not historical journeys, traffic services, navigable routes or a travel simulation. Route modes use the deliberately coarse globe, not transport-network GIS.

Separate building/master/association/current-site toggles, region counts, geographic dossiers and legends explain these distinctions. Nationality complexity does not silently add speculative nationality pins.

## Preserved scope and interpretation

All 25 existing standalone Sites and their overview remain unchanged. The game retains its catalog IDs, original tour URLs, playable gates, browser-local save schema, NPC conversations, quizzes, passport, and quality settings.

Original building GLB files were restored from the existing canonical Site repositories. `assets-manifest.json` records all 25 source project IDs, file sizes, and SHA-256; `asset-provenance.json` retains the original three-island provenance. GLB bytes are unmodified. The renderer hides old large landscape primitives and, for Savoye's shared wood material, filters distant tree-trunk triangles outside the building footprint. Building geometry remains the original source. Invented exploration islands, game-scale normalization, NPC appearances, and navigation are not historic reconstruction.

NPC dialogue is visibly labeled educational adaptation, never an authentic quote. Truus Schröder and Pierre Jeanneret collaborative roles are shown. Each playable island includes factual sources and original-model uncertainty notes. Ordinary overview navigation remains outdoors with a conservative expanded footprint. Sixteen bounded interior observation zones provide actual floor-supported walking via disclosed fade transitions. Island boundaries prevent walking into the ocean.

Movies are not bundled or autoplayed. The optional original-tour link opens the user's existing site in a new tab, where its 120-second film can be played on demand.

## Structure

- `dist/app.js`: interface, geographic and connection dossiers, tutorials, quizzes, progress, passport, and confirmation flows.
- `dist/engine.js`: scene coordination, original-model streaming, avatar, exploration controls, and fallback integration.
- `dist/globe-geometry.js`, `dist/globe-orbit.js`, `dist/globe-view.js`: spherical cells and geographic placement, globe rotation/zoom, and globe display.
- `dist/miniatures*.js`: individual procedural chibi architecture assets. These are toy-scaled visual interpretations, not measured reconstructions.
- `dist/core.js`: pure progress and collision/pathfinding logic.
- `dist/island-controls.js`: isolated camera bounds, gesture lifecycle, camera-relative movement and collision-safe walking.
- `dist/model-display.js`: documented landscape separation and display-only material changes.
- `dist/catalog.json`, `dist/quests.json`: 25-entry registry and sourced educational content.
- `dist/atlas.json`, `dist/relationships.json`: sourced geographic records, four historical connections, and five explicitly curatorial comparisons.
- `dist/vendor/`: locally hosted Three.js modules and license; no runtime CDN dependency.

`render-miniatures.mjs` exports projected exact-mesh triangles; `raster-miniatures.py` produces z-buffered PNGs for selection cards and the software fallback. These static images do not establish real-time GPU appearance.

## Verification and limits

`node tests.mjs` checks pure logic and asset/content integrity. `node verify-models.mjs` decodes all three original GLBs on the CPU and verifies the retained building extents. The latter uses a local `node_modules/three` link to `dist/vendor`; fake image bitmaps are used only in that CPU geometry check, not in the game.

See `qa/` for reports and explicit verification limitations. Earlier flat-atlas and map-orbit reports document their respective prior revisions, not automatic coverage of the new globe. The presence of a test command is not a claim that every check passed on this revision.

CPU geometry tests, software projection screenshots, and browser layout checks do not prove real GPU appearance, hardware compatibility, touch-device behavior, mobile Safari performance, or frame rate. The real-time WebGL path must be checked on a GPU-capable browser before making those claims.
