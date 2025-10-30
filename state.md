# 45° Timer Pane

- **Intent:** Mimic the optics of a tilted analog display so the fifth view feels like a physical countertop timer when the phone is laid flat.
- **Perspective:** Dial and typography are skewed to emphasize depth while keeping the circle within the viewport on iPhone screens.
- **Emphasis:** Larger, weightier numerals and heavier shading boost legibility under the angled perspective and reduce the sterile look of the standard views.
- **Interaction:** Controls stay aligned with the dial and share consistent sizing across devices so the experience translates cleanly between mobile and desktop.

## Notes: responsive sizing with clamp()

- CSS clamp(min, preferred, max) lets the browser pick a preferred value (often a viewport-based unit) but keep it within the min/max bounds. Example used in the codebase:

	- `font-size: clamp(96px, 22vw, 180px);`
		- If 22vw computes below 96px the result is 96px (min).
		- If 22vw is between 96px and 180px the result is 22vw (preferred).
		- If 22vw computes above 180px the result is 180px (max).

	- Practical effect: the readout scales fluidly with viewport width while never becoming unreadably small on phones or excessively large on large screens. For dial-accurate sizing consider deriving font-size from `--dial-size` (for example `font-size: calc(var(--dial-size) * 0.42)`), or use clamp around a dial-relative calc() so the typography always relates to the circle geometry rather than raw viewport dimensions.

## Notes: CSS transform, perspective and transform-origin

- Transforms are compositor-only visual transforms that do not affect layout. They are efficient for animations and perspective effects.

- Order matters: transform functions are applied left → right. `translateX(10px) rotate(30deg)` is different to `rotate(30deg) translateX(10px)`.

- Percent translate values (e.g. `translateY(-2%)`) are relative to the element's own box, not the viewport.

- 3D transforms: `rotateX()` / `rotateY()` operate in 3D and require a `perspective()` (either provided inline in `transform: perspective(...)` or via a parent with `perspective: <length>`). Smaller perspective values = stronger foreshortening.

- `transform-origin` sets the pivot point (e.g. `center bottom` anchors rotations to the element's bottom edge). Combining `transform-origin: center bottom` with a negative `rotateX()` makes the element appear to tip toward the viewer at the top while the bottom stays visually anchored.

- Common pattern used in the 45° pane: tilt the whole readout container with `rotateX()` and anchor it to the bottom, then use `scaleY()` to exaggerate the top half of the digits without changing glyph shapes. If you need pixel-accurate placement relative to the ring, compute font-size from `--dial-size` and account for `scaleY()` when measuring.

- Performance tips: prefer `transform` and `opacity` for animations (no reflow). Use `will-change: transform` sparingly to hint the compositor.

## 3D Test View (debug/demo)

- Purpose: a minimal, touch-friendly pane to validate which 3D transforms are honored by a particular browser (especially iOS Safari). It contains small labeled boxes that exercise:
	- parent `perspective` + `rotateX`
	- inline `perspective()` within `transform`
	- `translateZ` (requires perspective)
	- `preserve-3d` and `backface-visibility` via a simple flip card

- How to use: open the app on the device to test, swipe to the "3D Transform Test" view and observe whether each box tilts, translates along Z, or flips. On touch-only devices the flip can be toggled programmatically or via a small on-screen button (recommended for quick testing).

## Implementation notes & next steps

- The current implementation favors mobile-first rendering and attempts to keep the dial inside iPhone safe areas (uses `env(safe-area-inset-*)` and `100dvh` where appropriate).
- For dial-accurate typography (outer digits touching the ring) the most reliable approach is to derive the font-size from `--dial-size` instead of viewport units — that guarantees the typography and circle scale together.
- If you want, I can add a small touch toggle to the 3D test view to flip the preserve-3d card, and/or change the angled pane to compute font-size from `--dial-size` (I can patch `index.html` accordingly).
