# LiDAR Scanning Models: Scan Once, Sell Infinitely

Reference guide for 3D capture strategy, trophy scanning workflows, operational tiers,
and business models relevant to the sailing-almanac virtual trophy room.

---

## 1. Highly Themed 3D Asset Packs

Game developers, VFX artists, and architectural visualization studios rarely have the
time to build everyday objects from scratch. They buy assets in bulk on platforms like
TurboSquid, CGTrader, and the Unreal Engine Marketplace.

- **Maritime & Racing Elements:** Scan high-wear dock textures, heavily used winches,
  cleats, rigging hardware, and specific fast-paced racing hulls.
- **Geometric & Mid-Century Modern:** Scan specific Usonian architectural details —
  breeze blocks, desert landscaping elements, or authentic mid-century furniture.

---

## 2. The "Refit Template" Model

Use Polycam to capture the empty interiors and deck layouts of ubiquitous, popular
vessels (like a standard Catalina 30 or a J/24) or widely owned RVs.

- Clean the scan into a lightweight, dimensionally accurate 3D model.
- Sell the digital twin online to owners of that specific boat or vehicle for refit
  planning.

---

## 3. The 3D-to-2D Print-on-Demand Engine

Instead of selling the 3D file, use the Polycam scan as proprietary raw material for
digital art and merchandise.

- Scan technical gear, historical artifacts, or interesting architectural geometry.
- Import into Blender and apply custom shaders (e.g., high-saturation, cut-paper effect).
- Render out unique 2D angles for print-on-demand storefronts.

---

## 4. B2B Automation & Processing Pipelines

**The Paralegal/Investigator Niche:** Build a micro-SaaS that ingests Polycam exports of
property damage, allows users to drop pins, and automatically generates a flat, formatted
PDF exhibit with Bates numbering.

---

## Yacht Club Preservation: Archives & "Keeper" Trophies

Yacht clubs have prestigious perpetual trophies locked in glass cases that winners never
get to take home. Two revenue structures apply here.

### The Contracted Service

- **Virtual Trophy Room:** Offer a flat-rate service to scan top prestigious trophies and
  deliver an embedded 3D viewer for the club website.
- **"Keeper Trophy" Upsell (Recurring Revenue):** Convert cleaned 3D meshes into 6-inch
  3D-printed resin replicas for annual banquets. Scan once; the club pays annually for
  physical prints.

### Layline Digital Integration

- **Hot-Linked Engravings:** A 3D model where clicking an engraved name links directly to
  the sailor's profile or race results.
- **Modern Banquet Experience:** Cast a rotating digital twin onto screens during banquets
  to highlight new names in real-time.

---

## The Technical Reality: Scanning Silver

Polycam/LiDAR struggles with reflective silver and brass.

**Solution:** Use vanishing 3D scanning spray (e.g., AESUB Blue). It applies a
micro-thin, matte white coating that sublimates (vanishes) within 2–4 hours, leaving no
residue — essential for historical artifacts.

**Workflow:**
1. Capture geometry via photogrammetry using the matte spray.
2. Re-apply a metallic silver shader in Blender post-capture.

---

## The Professional "Two-Pass" Reprojection Workflow

To keep dents and damage while achieving realistic metal textures:

1. **Pass One (Texture Capture):** Diffused lighting (light tent); capture photos of the
   natural, shiny, tarnished silver.
2. **Pass Two (Geometry Capture):** Apply AESUB vanishing spray; capture photos for
   geometry.
3. **Generate "Blank" Mesh:** Process Pass Two photos in photogrammetry software.
4. **Reprojection:** Align Pass One photos with the mesh to project real-world
   tarnish/patina pixels onto the clean geometry.
5. **Final Polish:** Plug the projected texture into a Principled BSDF material in Blender
   with high Metallic values.

---

## Operational Tiers

| Tier | Execution | Use Case |
| :--- | :--- | :--- |
| Mail-In | Centralized Studio | High-value, complex silver/brass |
| Heritage Kit | DIY (Pelican Case + SOP) | Routine updates (e.g., plaques) |
| Contractor | Bulk/Local hire | Mid-sized, volume-based trophy cases |
| White-Glove | On-site Residency | Premium/Flagship assets (binnacles, wheels) |

---

## Essential Tools for Consistency

### High-End Studio (Mail-In Tier)

- **Turntable:** Ortery PhotoCapture 360s — tethers to DSLR and computer; controls
  table and shutter simultaneously. Run the 36-shot shiny pass, spray with AESUB, click
  once to run the exact same 36-shot matte pass without touching the camera or table.
- **Stabilization:** Avoid ball heads (they sag under camera weight when locked).
  Use a **Geared Head** — interlocking brass/steel cogs, micrometric adjustment,
  physically cannot sag. Recommended: Manfrotto 410 Junior Geared Head.

### Contractor / Travel Kits

- **Turntable:** Orbit600 Smart 360° Professional — programmable degree-increments
  (5°–180°), 150 kg capacity, no computer tether required.
- **Stabilization:** Benro GD3WH 3-Way Geared Head — magnesium alloy (lighter for
  travel), independent triple-axis controls, same sag-free precision as the Manfrotto.

### Low-Cost DIY Kit (Heritage Kit Tier)

Designed for club social media managers and low-experience contractors. Removes all
photographer movement decisions.

- **Dual-handle smartphone cage:** Eliminates finger fatigue; prevents accidental screen
  taps; two-handed grip braces the camera frame against the body.
- **Manual Lazy Susan:** For small items, the user holds the phone still against their
  chest and spins the table slowly with one thumb. Tripod optional.
- **Blue painter's tape:** Visual landmarks on smooth or monochromatic surfaces.
- **Dry shampoo or aerosol baby powder:** Matte-finish alternative to AESUB for
  modern, non-antique hardware.
- **AESUB Blue spray:** Reserve for museum-grade silver and brass only.

---

## R&D / Trust-Building Strategy

1. **Trophy Shop Partnership:** Offer free 3D portfolios to local engravers to build
   skills on non-precious items.
2. **Antique Store "Ransom":** Practice reprojection on tarnished antiques.
3. **"Friendly" Yacht Club Audit:** Pilot at a small local club to solve logistical
   hiccups (key access, lighting).
4. **3D Print Test:** Print 1/4 scale replicas to verify engraving legibility.

---

## Conservator Protocol (When Visiting Clubs)

Your primary goal at the first visit is managing the club historian's anxiety, not
getting a perfect scan. These trophies are holy relics. Equipment and language that
signals "museum conservator" rather than "tech enthusiast" is the entire sale.

### Equipment Checklist

Bring all of these even for a casual visit — the visual cue changes everything.

- **White cotton or black nitrile gloves:** Never touch antique silver with bare hands.
  The oils on human skin are acidic and cause rapid tarnishing. Pulling out a fresh
  pair instantly signals professionalism.
- **Padded microfiber changing mat:** Lay this on the table before placing any trophy.
  Never set a historical object directly on hard wood or plastic.
- **The "sacrificial" trophy:** A cheap, highly polished silver-plated goblet or bowl
  from a thrift store. Use this for the live spray demo — they never watch AESUB hit
  their history first.
- **AESUB Safety Data Sheet (SDS):** Print it, highlight "Sublimating," "Pigment-Free,"
  and "Residue-Free."
- **iPad with a live 3D demo:** Pre-load a high-detail spinning 3D model in the Layline
  interface. Let the historian spin it with their own fingers. Show, don't tell.

### Talking Points

**Defusing the spray panic — the "Ice Cube" analogy:**
> "To capture the engraved names at millimeter accuracy, we use a museum-grade archival
> spray called AESUB. It uses sublimation — exactly like dry ice. It goes straight from
> solid to gas. We don't wipe it off, we don't wash it off. Within a few hours it
> completely vanishes, leaving the silver exactly as it was when we walked in."

**The live demo (ultimate trust closer):**
Pull out the thrift-store goblet and your gloves. Spray half of it in front of them.
Let them watch it turn matte white and dry in seconds. Then hand them the iPad:
> "See how this kills the glare? That's what allows our cameras to read the exact depth
> of every engraved name."

**The Digital Insurance Policy pitch:**
> "If the clubhouse ever suffers a fire or break-in, insurance money can buy a new
> silver bowl, but it can't buy back the specific dents, the exact font of the 1934
> engravings, or the character of the original. This scan is a sub-millimeter digital
> insurance policy. A silversmith can use this exact digital twin to recast the trophy
> identically."

**Connecting history to the active fleet:**
> "Right now, these names are locked behind glass. The sailors racing this weekend don't
> know whose names are on the 1974 Commodore's Cup. By digitizing this, we're bringing
> the history out of the lobby and putting it on the smartphones of the active racing
> fleet."

---

## Hobbyist & Adjacent Markets

The capture-once/sell-repeatedly infrastructure is asset-agnostic. The same kit and
central processing pipeline serves these secondary markets with no additional field work.

### Real Estate / As-Builts
Scan home and commercial room layouts with Polycam or Canvas: Room Capture. Export
ready-to-use CAD files (.DWG or .SKP) for architects, contractors, and interior designers.
A standard residential scan runs $150–$500 depending on size and whether you process the
CAD export yourself.

### E-commerce & Asset Marketplaces
Export .OBJ, .STL, or .GLTF files to Sketchfab, TurboSquid, or CGTrader. Simple objects
sell for $10–$50; custom business assets command higher premiums.

### High-End Sports Memorabilia — The "Virtual Vault"
Collectors of game-worn jerseys, signed equipment, and historic gear face a preservation
paradox: to protect a $50,000 item from UV degradation, it lives locked in a dark safe.

- **The Service:** Capture the exact scuff marks on a game-used bat or the specific
  grass stains on a jersey as a millimeter-accurate fingerprint for insurance and
  authentication.
- **The "Virtual Vault" Upsell:** A web-based 3D display the collector can show off on
  an iPad without touching the original. The scan also provides better condition proof
  than any 2D photo.

### Traditional Sculptors & Ceramicists — The Scaling Problem
Clay and wax sculptors need digital benefits but hate digital workflows. When a sculptor
gets commissioned to scale a 12-inch clay maquette up to a 6-foot bronze statue, doing
it by hand is a month of math and armature work.

- **The Service:** Send them the DIY kit to scan their 12-inch clay model.
- **B2B Upsell:** Scale the scan digitally, slice it into printable sections, and ship
  back a 6-foot foam or plastic armature the artist finishes with a thin clay layer.
- **B2C Upsell:** Print 100 small resin replicas for them to sell as limited-edition
  desktop pieces.

### Sneakerheads & Streetwear Archives
Rare sneakers ($2,000+ for original Air Jordans or limited collaborations) are ideal
scan targets: matte textures, lots of distinct visual landmarks, zero reflections.

- **The Service:** Scan before the shoe is sealed in an acrylic display case.
- **The Upsell:** Deliver AR files so the collector can project a 3D hologram of their
  exact shoe onto a table through their phone camera. Also offer full-color 3D-printed
  keychain replicas with the specific creases of their shoe.

### Vintage Car & Restomod Builders — Resurrection as a Service
Builders restoring 1960s Porsches, old Chris-Craft wooden boats, or custom motorcycles
routinely hit a wall: the plastic trim, dashboard bezels, or metal badges they need
haven't been manufactured in 50 years.

- **The Service:** The restorer uses the kit to scan a broken dashboard dial, a cracked
  tail-light housing, or a rusted-out hood ornament.
- **The Upsell:** Your processing team imports the scan into Blender or CAD, digitally
  repairs the cracks, mirrors the geometry if needed (left piece → right piece), and
  delivers a flawless .STL for CNC machining or industrial 3D printing.

### Common Thread
In every market above, the customer has a physical asset they are afraid to touch,
unable to duplicate, or need to lock away. The sale is not a "point cloud" — it is the
ability to interact with, scale, or permanently preserve their most prized possessions.

---

## Handheld Scanning Techniques

**App selection:** Use Photogrammetry (Photo Mode) or Object Capture — never raw LiDAR
point-cloud mode for archival objects. Point clouds require complex desktop software to
stitch and are inappropriate for contractor or DIY workflows.

| App | Best For | Notes |
| :--- | :--- | :--- |
| Polycam (Photo Mode) | Small trophy-scale items | Gold standard; AI background removal; processes on cloud |
| Scaniverse | Kayak-to-dinghy-hull scale | Free; processes on-device; fast; good for large paths |
| KIRI Engine | Small objects with complex undersides | Advanced object masking; handles held/flipped items |

### Technique by Object Size

**Small items (baseball to winch size):**
Examples: compasses, shackles, brass anchors, rigging blocks.
- Place on a flat, non-reflective surface.
- Move your body, not the object: shuffle feet in a slow 360° circle.
- Shoot 30–50 overlapping photos at three heights (low, eye-level, high looking down).
- Grip: hold phone with both hands pressed against chest/stomach to brace elbows.
- Alternative to circle walk: place item on a Lazy Susan, stand still, spin the table
  with your thumb — requires a plain background so the rotating environment doesn't
  confuse the stitching software.

**Large items (life jacket to kayak size):**
Examples: kayaks, outboard cowlings, steering wheels.
- Set up outside on a cloudy day, or in an evenly lit garage.
- **The Ninja Walk:** Bend knees slightly, roll feet heel-to-toe to absorb step shock.
  Keep the phone consistently 2–4 ft from the surface as you glide the perimeter.
- Ensure each photo overlaps the last by ~70%. Use continuous capture mode if available.

### Overcoming Shiny Surfaces (Non-Museum Items)

For non-antique nautical gear (glossy fiberglass, modern polished steel, clear plastic
compass domes), AESUB is overkill. Use these instead:

- **Cloudy-day scanning:** Overcast skies kill harsh sun glare on boat hulls naturally.
- **Dry shampoo or baby powder spray:** Creates a temporary matte finish identical to
  AESUB for non-precious objects. Wipes off completely with a damp towel afterward.
- **Blue painter's tape landmarks:** Smooth, single-colored surfaces (white outboard
  cowlings, varnished tillers) confuse stitching software because every angle looks
  identical. Stick a few pieces of tape with rough marker scribbles around the item to
  give the app distinct visual tracking points.
