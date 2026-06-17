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

- **Turntables:** Ortery PhotoCapture 360s (tethered) for studios; Orbit600 Smart
  (programmable degree-increments) for DIY kits.
- **Stabilization:** Avoid ball heads (they sag). Use Geared Heads (e.g., Manfrotto 410
  Junior, Benro GD3WH) for micrometric stability.
- **Field Kit:** Dual-handle smartphone cage (prevents shake), blue painter's tape (for
  landmarks), and AESUB spray.

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

- **Gear:** White cotton or black nitrile gloves, padded microfiber mat, AESUB Safety
  Data Sheet (SDS).
- **The "Ice Cube" Analogy:** Explain sublimation to the historian — it vanishes like dry
  ice.
- **Live Demo:** Spray a thrift-store goblet to prove safety before touching their
  artifacts.
- **Pitch:** Frame the scan as a "Digital Insurance Policy" for history that cannot be
  bought back if destroyed.

---

## General Scanning Markets

1. Real Estate/As-Builts: Floor plans for architects and contractors.
2. E-commerce: 3D models for online stores (e.g., Sketchfab).
3. Sports Memorabilia: "Virtual Vaults" for insurance or AR display.
4. Sculptors: Digital scaling for large-scale statue fabrication.
5. Sneakerheads: AR holographic archives.
6. Restomod/Automotive: Reverse engineering obsolete parts.

---

## Handheld Scanning Techniques

- **Small Items:** Shuffle feet in a circle; keep phone steady; use a Lazy Susan.
- **Large Items:** Use the "Ninja Walk" (bent knees, heel-to-toe); maintain constant
  2–4 ft distance.
- **Tips for Smoothness:** Use a dual-handle cage; scan on cloudy days (no glare); use
  dry shampoo spray for matte finish on shiny surfaces.
