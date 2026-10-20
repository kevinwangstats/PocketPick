# Minimalist UI & Styling Rules

PocketPick strictly adheres to a stark, ultra-minimalist, high-contrast monochrome design philosophy inspired by Dieter Rams, Swiss typography, and high-performance terminal tools.

---

### 1. Palette & Contrast

- **Allowed Primary Colors:**
  - Pure Black: `#000000` (`bg-black`, `text-black`)
  - Pure White: `#FFFFFF` (`bg-white`, `text-white`)
  - Neutral Zinc/Gray scale: `#18181B` (zinc-900), `#27272A` (zinc-800), `#71717A` (zinc-500), `#E4E4E7` (zinc-200), `#F4F4F5` (zinc-100).
- **Prohibited:**
  - Vibrant brand colors (red, blue, green, purple, yellow) as background or decorative fills. Red may only be used sparingly for destructive confirmations or critical security alerts.
  - Rainbow or saturated gradients (`bg-gradient-to-r`).
- **Contrast Standards:**
  - WCAG AAA contrast ratio (minimum 7:1) for all body text and interactive controls against their background.

---

### 2. Geometry & Depth

- **Zero Drop Shadows:**
  - Do not use `shadow-lg`, `shadow-md`, `elevation`, or iOS drop shadows. All surfaces are flat.
- **Sharp or Minimal Borders:**
  - Use `rounded-none` (0px) or `rounded-sm` (2px max).
  - Borders should be crisp, 1px solid high-contrast lines (`border border-zinc-800` or `border border-zinc-200`).
- **No Skeuomorphism or Translucent Blurs:**
  - Avoid blurred frosted-glass headers/tab bars (`backdrop-blur`).
  - Overlays should be solid pitch black (`#000000`) or crisp white.

---

### 3. Typography

- **System Fonts & Monospace:**
  - Use iOS native San Francisco font for titles and labels with tight kerning.
  - Use monospace (`font-mono`, `Courier`/`Menlo`) for:
    - Passphrase / key inputs
    - Hashes and file signatures
    - CSPRNG counter shuffle cycling
    - Quota metrics (e.g. `24 / 100`)
- **Hierarchy:**
  - Sharp distinction between uppercase micro-labels (`text-xs font-mono tracking-widest uppercase`) and prominent headers (`text-2xl font-bold tracking-tight`).

---

### 4. Interactive Feedback

- Rely on high-contrast inversion for active states (e.g., active button switches from black background / white text to white background / black text).
- Use physical tactile iOS haptics (`expo-haptics`) rather than bouncy spring physics animations.
