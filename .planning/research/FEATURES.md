# Feature Research

**Domain:** Anime/Otaku-Themed Desktop UI/UX Design Overhaul
**Researched:** 2026-03-28
**Confidence:** MEDIUM-HIGH (visual patterns: HIGH via Figma/Dribbble/live sites; competitor analysis: MEDIUM via feature inspection; specific CSS values: HIGH via cybercore/cyberpunk frameworks)

---

## Context

This research addresses "What design/UX features does a best-in-class anime-themed news aggregator desktop app need?" OtakuPulse v1.0 ships with a Material Design 3 dark theme using purple accent (`#bd9dff`) as its base. The v2.0 overhaul replaces this with a fully otaku-culture visual identity. The app already has all functional features (5 Wings: Discover, Library, Saved, Schedule, Profile; AI summaries, deep dive, hybrid search; keyboard shortcuts, onboarding, WIP motion system). This milestone is design/UX only — no new backend features.

**Competitive reference apps analyzed:** AniList (anilist.co), MyAnimeList, Crunchyroll, Taiga (desktop), Anime News Network, Dribbble anime app shots, Heisei/Y2K design trend reports (2025–2026).

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in an anime-themed app. Missing these makes the product feel generic or half-finished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Dark-only theme with deep backgrounds** | Every serious anime app uses dark mode; bright backgrounds feel wrong for late-night binge sessions | LOW | Already exists — but surface tokens need deeper values: `#0a0a0f` void black vs current `#0e0e13`. Reinforce the "dark pit" foundation before layering neon |
| **Cover-art-forward card layout** | AniList, Crunchyroll, MAL all lead with anime/manga cover art as the visual anchor; text-only cards feel like a forum | MEDIUM | Existing `DiscoverCard` has thumbnails but no dominant cover-art mode. Need a "poster ratio" (2:3) card variant alongside the current landscape thumbnail |
| **Genre/content-type badge system** | Users expect colored semantic badges: Anime, Manga, Game, PC — with distinct colors not just text labels | LOW | Current badges exist but use generic colors. Map each Wing's content type to a distinct hue: anime=purple, manga=pink, game=cyan, PC/news=yellow |
| **Hover state with depth feedback** | Desktop app users expect visual depth on hover (scale, shadow lift, or glow) — flat hover overlays feel like a web app | LOW | Current hover uses `--surface-hover` flat overlay only. Add `transform: translateY(-2px)` + shadow lift on card hover |
| **Section headers with cultural markers** | AniList uses section dividers with bold typography + subtle decorative lines; bare section headings feel unbranded | LOW | Add decorative left-border accent lines and uppercase spaced labels to all section headers |
| **Navigation icons with anime-aware iconography** | Lucide/Heroicons generics (house, bookmark, clock) feel off for an otaku app; anime-aware metaphors matter | MEDIUM | Replace generic sidebar icons with icons that map to otaku culture: sword/play for Discover, shelf for Library, calendar for Schedule. Still use vector icons but choose semantically fitting ones |
| **Color-coded status indicators** | Airing, Completed, Upcoming, Hiatus — all anime apps color-code these; monochrome status is invisible | LOW | Add semantic status dot/badge colors: airing=green glow, upcoming=cyan, completed=muted, hiatus=amber |
| **Readable typography hierarchy at 13–15px** | Desktop anime apps ship at small type sizes (content density) but maintain clear hierarchy; muddy hierarchy exhausts users | LOW | Existing scale (10–18px) is correct. Need sharper weight contrast: title=600, body=400, meta=300 muted |
| **Persistent Wing navigation** | AniList, Taiga, Crunchyroll all have always-visible primary navigation; collapsing it kills discoverability | LOW | Current AppShell has sidebar — keep it visible. What's missing is active-state identity (the selected Wing should feel "lit up", not just highlighted) |
| **Smooth tab and panel transitions** | Motion is expected at the app shell level in 2026 — sudden content replacement without transition feels broken | MEDIUM | WIP motion system exists but is not integrated. Connecting `AnimatePresence` to Wing switches and tab changes is mandatory table stakes |

### Differentiators (Competitive Advantage)

Features that set OtakuPulse apart from AniList, Taiga, or generic news aggregators. These justify the "otaku-powered" brand promise.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Neon glow accent system** | Glowing borders/text on active elements visually communicates "alive" — no competitor desktop app does this natively | MEDIUM | Add CSS glow variables: `--glow-primary: 0 0 8px rgba(189,157,255,0.6), 0 0 20px rgba(189,157,255,0.25)`. Apply to active nav items, focused inputs, CTA buttons. Use sparingly (60-30-10 rule) |
| **Heisei/Y2K retro visual motifs as decoration** | Japanese Heisei retro (PC-98 dithering, neon kanji, pager/flip-phone graphics) is the defining 2026 aesthetic for otaku culture; no anime news app uses it yet | HIGH | Add decorative corner brackets, scan-line texture overlays (CSS only, `::after` pseudo-element), subtle pixel/dot-grid backgrounds on hero areas. Pure CSS — no image assets required |
| **Content-type color language throughout** | AniList uses one blue accent everywhere; OtakuPulse can use distinct accent colors per content category, making content scannable at a glance | LOW | Introduce `--anime-accent: #bd9dff` (purple), `--manga-accent: #ff97b2` (pink), `--game-accent: #4dd9e0` (cyan), `--news-accent: #ffd166` (amber). Apply to card left-border, badge, and header decorations |
| **Glassmorphism panel layer** | Side panels, modals, and DeepDive panels layered over content using frosted glass creates depth that flat competitors lack | MEDIUM | `backdrop-filter: blur(12px)` + `background: rgba(25,25,31,0.85)` on DeepDive panel, onboarding wizard, and toast stack. Already has `--surface-glass` token — needs activation |
| **Cinematic article reader typography** | Long-form article reading in desktop apps is usually an afterthought; manga-panel-inspired column layout with large initial caps and generous leading creates a premium reading mode | HIGH | ArticleBody needs: max-width 680px centered column, `line-height: 1.8`, first-letter drop cap with accent color, section-break decorators (horizontal rule with center diamond motif) |
| **Scroll-triggered reveal animations for feed** | News feed content popping in with staggered fade-up (not jarring, ~150ms stagger) makes content discovery feel curated rather than dumped | MEDIUM | Use `motion.div` with `initial={{ opacity: 0, y: 16 }}` + `animate` variants. Already have motion variants in `src/lib/motion-variants.ts` — extend and apply to DiscoverCard and ArticleList items |
| **AI badge visual identity** | AI-generated content (summaries, deep dives) needs a distinct visual treatment — a glowing "AI" chip on cards where AI has processed the content | LOW | Add `--ai-chip` micro-badge: small pill with gradient `--primary` to `--secondary` (purple→blue), uppercase "AI" label. Show on DiscoverCard when summary is cached |
| **Schedule Wing with broadcast-calendar aesthetic** | Taiga's schedule view is text-heavy list; a visual airing grid (day columns, time rows, cover art thumbnails) with countdown timers reads like an otaku TV guide | HIGH | Significant layout work for ScheduleWing. Day-by-day columns with show cover art thumbnails and "Airing in Xh" countdowns. Existing schedule data supports this — it's a layout overhaul |
| **Command palette with anime-aware shortcuts** | Power users in 2026 expect Cmd+K-style command palette for navigation, search, and actions. No anime desktop app has this. It's a genuine differentiator | MEDIUM | Extend existing `useKeyboardShortcuts` into a modal command palette. Keyboard store already exists. Display available commands with otaku-category grouping |
| **Animated empty states** | Generic "No results" text vs. an animated chibi/mascot placeholder communicates brand personality. AniList uses this; Taiga doesn't | MEDIUM | CSS/SVG animated empty state illustrations for each Wing. Avoid character IP — use abstract otaku-culture shapes (sakura petals, pixel stars, manga speed-lines in CSS) |
| **Personalized "For You" visual header** | Discover Wing hero section showing user's top genre/tag with a dynamically colored gradient accent (based on their preferences) makes the app feel tuned to them | HIGH | Requires reading profile preferences from store and mapping to a gradient. Needs design-system expansion for dynamic gradient tokens |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full neon-on-black maximum contrast scheme** | "More anime-looking" — users see neon text on pure black in anime fan sites | Pure `#ffffff` text on `#000000` with neon causes eye strain in extended use; WCAG requires 4.5:1 contrast minimum for body text, not maximum | Use deep charcoal surfaces (`#0a0a0f`) not pure black; neon applies only to accents (10% rule), never body text |
| **Animated background (particle effects, flowing gradients)** | Looks impressive in screenshots; feels immersive | Constant GPU animation tanks battery and CPU on laptops; distracts from content during reading; users disable it or uninstall | Use `@media (prefers-reduced-motion)` and make any background animation opt-in, static by default. Static gradient textures achieve same aesthetic |
| **Character/waifu artwork as decorative elements** | Adds otaku personality | Copyright and licensing minefield; visual clutter competes with actual content thumbnails; culturally specific tastes polarize users | Use abstract anime-inspired geometric shapes, speed lines, and screen-tone dot patterns (CSS-only, no IP) |
| **Light mode toggle** | Users request it for daytime use | OtakuPulse is explicitly dark-only by design; building a light mode means every CSS token needs a second value, doubling design maintenance | If light mode becomes a real demand: document-it as a v3+ milestone; do not implement in v2.0 |
| **Custom cursor overlays** | Japanese web design tradition; feels immersive | On Tauri/Chromium, custom CSS cursors have pixel-perfect rendering issues on high-DPI Windows displays; adds maintenance surface | Skip custom cursors; invest the effort in hover animations instead (same immersive feel, zero rendering bugs) |
| **Parallax scrolling in article reader** | Cinematic depth effect | Performance degrades on lower-end machines; causes vestibular motion sickness for some users; `prefers-reduced-motion` must disable it anyway | Subtle entry animations (single direction translate) at scroll threshold are safer and WCAG-compliant |
| **Auto-playing video/GIF previews on card hover** | Anime apps traditionally use animated preview clips | No video/GIF data in current RSS/AniList schema; implementing it requires new backend work; autoplay video is explicitly forbidden in Tauri's default CSP | If cover art animations are wanted: use CSS `@keyframes` shimmer on the card skeleton instead |
| **Per-Wing custom themes (user-selectable)** | Personalization feels premium | Multiplies CSS token surface by N themes; significantly increases QA burden; color management complexity in design system | Offer one excellent dark theme with per-content-type accent color variation (built into the design system already) |
| **Manga panel layout for news feed** | Visually distinctive; uniquely anime | True manga panel layout (irregular polygon columns) requires absolute positioning and breaks virtual scrolling; unreadable for long feeds | Use manga-inspired decorative elements (corner brackets, scan-line textures) applied to standard grid cards |
| **Real-time "now airing" live ticker** | Dramatic and exciting for schedule watchers | Requires WebSocket or 1-second polling; current architecture is scheduler-based batch polling; adds battery-draining background process | Show countdown timers that update client-side from a cached "next airing" timestamp — no extra network calls |

---

## Feature Dependencies

```
Neon glow accent system
  └──requires──> CSS variable extension (--glow-primary, --glow-secondary added to globals.css)
  └──requires──> Dark surface deepening (#0a0a0f void tone as foundation)

Content-type color language
  └──requires──> Four accent CSS variables (--anime-accent, --manga-accent, --game-accent, --news-accent)
  └──enables──> Genre badge differentiation
  └──enables──> Per-content-type card left-border accent

Glassmorphism panels
  └──requires──> backdrop-filter CSS support (Chromium-based Tauri: YES, confirmed)
  └──requires──> Dark surface deepening (glass only reads over sufficiently dark backgrounds)

Scroll-triggered reveal animations
  └──requires──> Motion system WIP hooks integration (useMotionConfig.ts already exists)
  └──conflicts──> prefers-reduced-motion (must respect; gate with useMotionConfig)

Cinematic article reader
  └──requires──> ArticleBody.tsx layout overhaul
  └──enhances──> Glassmorphism panels (reader panel uses glass treatment)

Command palette
  └──requires──> Keyboard store (useKeyboardStore.ts already exists)
  └──enhances──> Existing keyboard shortcut system

Schedule Wing calendar view
  └──requires──> ScheduleWing.tsx + AiringCard.tsx layout overhaul
  └──requires──> Existing airing data schema (already available from AniList)

Heisei/Y2K retro motifs
  └──requires──> CSS design decisions for decorative elements (no JS/asset dependencies)
  └──enhances──> Section headers (brackets, scan-line textures applied there)

Personalized gradient header
  └──requires──> Profile Wing preferences data (already in useDiscoverStore)
  └──requires──> Dynamic CSS variable injection (Tailwind v4 supports this via CSS)
```

### Dependency Notes

- **Dark surface deepening is foundational:** Neon glow, glassmorphism, and Heisei textures all look better over deeper (near-black) backgrounds. Do this first before adding decorative layers.
- **Motion system integration must come before scroll-triggered reveals:** `useMotionConfig.ts` and `motion-variants.ts` already exist as WIP. Wire them into AppShell and DiscoverCard first.
- **Content-type color language unlocks multiple downstream features:** Genre badges, card accents, section headers all derive from the four accent tokens. Define tokens first, then apply everywhere.
- **Glassmorphism conflicts with heavily-patterned backgrounds:** If Heisei scan-line textures are applied to surface backgrounds, glass panels lose readability. Apply textures only to decorative zones (hero areas, section headers) not to the main content surface.

---

## MVP Definition

This is a design overhaul of an existing app (not a new product), so "MVP" means the minimum changes that transform the visual identity without breaking the existing UX.

### Phase 1: Foundation — Design System Rebuild

Minimum changes that establish the new visual identity consistently.

- [ ] **Deep dark surface tokens** — Shift `--surface` toward `#0a0a0f` void black; update all surface-container chain; retire legacy aliases — *foundational: everything else layers on top*
- [ ] **Neon glow variable system** — Add `--glow-primary`, `--glow-secondary` CSS variables; apply to active nav items and CTA buttons — *makes the app feel "alive"*
- [ ] **Content-type accent palette** — Four new accent tokens (anime/manga/game/news); apply to badges and card left-borders — *makes content scannable without reading labels*
- [ ] **Typography hierarchy sharpening** — Increase weight contrast between title (600), body (400), meta (300 muted); ensure `--on-surface-variant` reads clearly at 11px — *readability before decoration*
- [ ] **Hover depth feedback** — Add `translateY(-2px)` + shadow lift to DiscoverCard, AiringCard, ArticleList row — *desktop-class interaction feel*

### Phase 2: Component Overhaul

Apply the new design language to all UI components.

- [ ] **Cover-art-forward card variant** — Poster-ratio (2:3) thumbnail mode for DiscoverCard; gradient overlay for text legibility over art — *visually dominant; competitor parity*
- [ ] **Genre/status badge redesign** — Colored semantic badges with content-type accent colors; airing/upcoming/completed status dots with glow — *information density without text*
- [ ] **Navigation active state** — "Lit up" sidebar nav: active Wing gets accent glow + left border strip; icons sized up — *clearly communicates current location*
- [ ] **Section header decoration** — Left-border accent line + uppercase spaced label style on all section headers — *establishes brand rhythm*
- [ ] **Glassmorphism on overlay panels** — Apply `backdrop-filter: blur(12px)` to DeepDive panel, modal overlays, toast stack — *depth and premium feel*

### Phase 3: Motion and Polish

Integrate WIP motion system; add Heisei decorative touches.

- [ ] **Wing transition animation** — Connect `AnimatePresence` to Wing switches; 200ms fade-slide — *eliminates the jarring "snap" between sections*
- [ ] **Feed stagger reveals** — Apply `motion.div` with staggered `y: 16 → 0` + opacity fade to DiscoverCard list; 80ms stagger between cards — *curated feed feel*
- [ ] **Heisei decorative touches** — CSS-only corner bracket motifs on hero/featured cards; scan-line `::after` texture on section headers — *distinctively otaku; zero asset dependencies*
- [ ] **AI badge chip** — `AI` pill badge on cards with cached summaries; purple-blue gradient — *communicates AI value prop at a glance*

### Deferred (Post v2.0)

- [ ] **Cinematic article reader** — Drop caps, column layout, section decorators — high value but high complexity; ship Phase 1–3 first
- [ ] **Schedule Wing calendar grid** — Day-column airing guide with countdown timers — requires significant ScheduleWing.tsx restructure
- [ ] **Command palette** — Cmd+K launcher with category grouping — standalone feature; doesn't block Phase 1–3
- [ ] **Personalized gradient header** — Dynamic CSS injection based on user taste profile — needs design system stability first
- [ ] **Animated empty states** — CSS/SVG mascot placeholders — nice-to-have; prioritize functional states first

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Deep dark surface tokens | HIGH | LOW | P1 |
| Neon glow variable system | HIGH | LOW | P1 |
| Content-type accent palette | HIGH | LOW | P1 |
| Typography hierarchy sharpening | HIGH | LOW | P1 |
| Hover depth feedback | HIGH | LOW | P1 |
| Cover-art-forward card variant | HIGH | MEDIUM | P1 |
| Navigation active state overhaul | HIGH | LOW | P1 |
| Genre/status badge redesign | HIGH | LOW | P1 |
| Section header decoration | MEDIUM | LOW | P1 |
| Glassmorphism panels | HIGH | MEDIUM | P2 |
| Wing transition animations | HIGH | MEDIUM | P2 |
| Feed stagger reveals | MEDIUM | LOW | P2 |
| Heisei decorative touches | MEDIUM | LOW | P2 |
| AI badge chip | MEDIUM | LOW | P2 |
| Cinematic article reader | HIGH | HIGH | P3 |
| Schedule Wing calendar grid | HIGH | HIGH | P3 |
| Command palette | MEDIUM | MEDIUM | P3 |
| Personalized gradient header | MEDIUM | HIGH | P3 |
| Animated empty states | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for Phase 1/2 — establishes visual identity
- P2: Must have for Phase 3 — adds motion and polish
- P3: Post-v2.0 milestone consideration

---

## Competitor Feature Analysis

| Design Feature | AniList | Crunchyroll | Taiga (Desktop) | OtakuPulse v2.0 Approach |
|----------------|---------|-------------|-----------------|--------------------------|
| **Dark theme depth** | Deep navy surfaces (`#13161d`) | Black-dominant (`#141519`) | Flat gray (outdated) | Deep void surfaces (`#0a0a0f`) + dark containers |
| **Cover art prominence** | Dominant — 2:3 poster ratio cards | Full-bleed thumbnails | Small inline thumbnails | Poster-ratio variant + landscape hybrid; configurable |
| **Accent color usage** | Single blue accent across all content | Orange-red brand accent only | Single purple accent | Four accent colors (per content-type) + neon glow on active |
| **Hover depth feedback** | Scale + shadow lift | Slight scale on cards | Flat overlay only | TranslateY + shadow + optional glow on interactive |
| **Genre badges** | Color-coded genre tags | Genre text labels only | No badges | Color-coded with content-type accent + glow dot |
| **Motion/animation** | Page transitions, skeleton loading | Smooth page transitions | Minimal/none | AnimatePresence wing transitions + stagger feed reveals |
| **Navigation style** | Icon + label sidebar | Top navigation bar | Tabbed top bar | Icon + label sidebar, active = lit accent state |
| **AI/smart features visual** | None (no AI) | None (no AI) | None | AI badge chip on processed cards; DeepDive glassmorphism panel |
| **Cultural identity** | Clean/minimal; no cultural motifs | Corporate anime brand | Windows-native; dated | Heisei retro motifs (corner brackets, scan lines); neon accent language |
| **Accessibility** | WCAG AA contrast on text | Good contrast, poor focus | Poor (dated app) | WCAG AA minimum; neon only on accents never body text; prefers-reduced-motion gated |
| **Empty states** | Illustrated chibi mascot | Animated/illustrated | None | CSS/SVG abstract anime shapes (no character IP) |
| **Schedule/airing view** | Season calendar with grid | Episode schedule list | Media list with airing indicator | Phase 3: Day-column calendar grid with countdown |

---

## Domain-Specific Patterns to Adopt

These patterns are specific to the anime/otaku visual language and are not covered by generic UI guidelines:

**Neon accent hierarchy (60-30-10 rule applied to otaku):**
- 60% — deep dark surfaces (void black base)
- 30% — muted content surfaces (card backgrounds, panel fills)
- 10% — neon accents (glow borders, active states, CTA buttons, AI chips)
- Exceeding 10% neon creates visual fatigue and negates the "glow pop" effect

**Scan-line texture (Heisei retro, CSS-only):**
```css
/* Applied via ::after on section headers / hero zones */
background-image: repeating-linear-gradient(
  0deg,
  transparent,
  transparent 2px,
  rgba(255,255,255,0.015) 2px,
  rgba(255,255,255,0.015) 4px
);
```

**Corner bracket decoration (manga panel motif):**
```css
/* ::before / ::after on featured cards */
content: "";
border-top: 2px solid var(--primary);
border-left: 2px solid var(--primary);
width: 12px; height: 12px;
position: absolute; top: 8px; left: 8px;
```

**Glow variable pattern (cyberpunk-derived):**
```css
--glow-primary: 0 0 8px rgba(189,157,255,0.6), 0 0 24px rgba(189,157,255,0.2);
--glow-cyan: 0 0 8px rgba(77,217,224,0.6), 0 0 24px rgba(77,217,224,0.2);
--glow-subtle: 0 0 4px rgba(189,157,255,0.3); /* for always-on micro-glow */
```

**Content-type accent mapping:**
- Anime → `--anime-accent: #bd9dff` (existing `--primary`; purple)
- Manga → `--manga-accent: #ff97b2` (existing `--tertiary`; pink)
- Game → `--game-accent: #4dd9e0` (new; teal-cyan)
- PC/News → `--news-accent: #ffd166` (new; warm amber)

**Status indicator dots:**
- Airing → `#4ade80` + `--glow-cyan` at 50% opacity (pulsing green dot)
- Upcoming → `#4dd9e0` (cyan static dot)
- Completed → `#acaab1` (muted gray; no glow)
- Hiatus → `#ffd166` (amber; no glow)

---

## Sources

| Source | Type | Confidence | Notes |
|--------|------|------------|-------|
| AniList.co live site (inspected CSS, card patterns, nav) | Competitor analysis | HIGH | Deep navy surfaces, blue accent, poster ratio cards |
| CyberCore CSS framework (dev.to/sebyx07, Jan 2026) | Technical reference | HIGH | Specific CSS variable patterns for glow effects |
| "Aesthetics in the AI era: Visual Trends 2026" (aigoodies.beehiiv.com, Nov 2025) | Design trends | HIGH | Heisei retro, PC-98, Y2K futurism confirmed as 2026 dominant aesthetic |
| "Web Design Trends 2025: Insights from Japan" (netwise.jp, Jul 2025) | Japanese design | MEDIUM | Bento layouts, Y2K gradients, pixel fonts confirmed |
| Graphic Design Trends 2026 (elements.envato.com, Feb 2026) | Design trends | MEDIUM | Retro-futurism, neon accents, chrome textures |
| Taiga desktop app (taiga.moe + GitHub) | Competitor analysis | HIGH | Flat gray UI, minimal visual identity — confirms the gap OtakuPulse can fill |
| Glass UI / glassmorphism best practices (ui.glass, wpdean.com) | Technical reference | HIGH | backdrop-filter pattern; "complementary not dominant" usage rule |
| Anime news aggregator feature survey (MAL forum, Reddit r/anime) | Community research | MEDIUM | Genre filtering, source tagging, spoiler shield are user-requested features |
| OtakuPulse design.md (project codebase) | Project reference | HIGH | Current token values, existing surface/accent system |
| Dark mode accessibility guide (accessibilitychecker.org, Jan 2026) | A11y reference | HIGH | WCAG AA 4.5:1 minimum; neon-as-accent-only rule confirmed |
| Heisei Retro aesthetic documentation (aesthetics.fandom.com, tamagodaruma.com) | Cultural research | MEDIUM | PC-98, neon kanji, pager graphics confirmed as 2026 trend |
| Motion UI trends 2026 (lomatechnology.com) | Design trends | MEDIUM | Micro-interactions as baseline expectation; prefers-reduced-motion mandatory |

---

*Feature research for: OtakuPulse v2.0 Anime/Otaku-Rich Design Overhaul*
*Researched: 2026-03-28*
