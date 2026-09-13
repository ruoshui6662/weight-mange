# M3-024 今日热量与宏量营养卡 Design QA

- source visual truth path: `C:/Users/admin/AppData/Local/Temp/codex-clipboard-51ac2cf3-7497-4f14-83bd-9365ff2bf81d.jpg`
- implementation screenshot path: `D:/AI编程/体重管理/design-qa-assets/m3-024-desktop-card-final.png`
- responsive evidence path: `D:/AI编程/体重管理/design-qa-assets/m3-024-mobile-390.png`
- combined comparison path: `D:/AI编程/体重管理/design-qa-assets/m3-024-comparison-final.png`
- viewport: desktop browser CSS viewport `1375 × 1216`; responsive regression viewport `390 × 844`
- pixels and normalization: source `1080 × 843`; full browser capture `1360 × 1203`; desktop card crop `760 × 482` from a measured `768 × 486` CSS-pixel card; mobile full-page capture `390 × 2471` at device scale 1. The combined comparison scales both card regions to similar visual height and does not judge browser chrome.
- state: authenticated empty day, 0 kcal intake, 1800 kcal target, no macro targets

## Full-view comparison evidence

The combined comparison confirms the requested information architecture: one heat summary card, a three-part energy row with the remaining value centered in a ring, and one three-column macro strip inside the same card. The former three detached macro cards no longer appear. The product uses “今日目标” in the right column instead of the reference's “运动消耗”, because the current Dashboard contract has a goal but no exercise-consumption field.

The 390px capture shows carbohydrates, protein, and fat on one horizontal row inside the heat card. Automated responsive assertions also cover 1440, 1024, 430, 390, and 360px widths, require three computed grid columns, and require no document-level horizontal overflow.

## Focused region comparison evidence

The focused desktop crop was compared directly with the source in `m3-024-comparison-final.png`. Important text, progress bars, card edges, and the heat ring remain readable at this crop, so no additional magnified region was needed.

## Required fidelity surfaces

- Fonts and typography: keeps the project's established Data Garden font stack, tabular numerals, existing heading weight, and compact secondary labels. It is intentionally not an exact font clone because the existing design-system typography remains authoritative.
- Spacing and layout rhythm: matches the source's energy row → divider → three macro columns. The implementation is denser to fit the application's 768px main column; alignment, 20px card radius, and internal spacing remain consistent with existing surfaces.
- Colors and visual tokens: uses existing primary green plus the established carbohydrate green, protein coral, and fat yellow tokens. Empty progress tracks remain low-contrast and readable.
- Image quality and asset fidelity: neither source nor implementation requires product imagery, logos, or decorative raster assets in this card. The heat ring and progress tracks are functional data indicators, not substitute artwork.
- Copy and content: “已摄入 / 还可以吃 / 今日目标” maps only fields currently supported by the Dashboard response. Missing macro targets display “暂无目标”; exercise and diet-score copy are intentionally omitted rather than fabricated.

## Comparison history

1. Initial comparison found a P2 accuracy issue: the old fixed border treatment showed a green arc even at 0% completion.
2. Fixed the ring to bind its arc to the real calculated percentage and added 0%/14% regression assertions.
3. Post-fix browser capture shows a fully empty track at 0%; no actionable P0, P1, or P2 visual differences remain.

## Findings

No actionable P0, P1, or P2 findings remain. The missing exercise metric and diet score are accepted product-data constraints, not visual omissions.

## Implementation checklist

- [x] Macro metrics are inside the heat summary card.
- [x] Macro metrics keep three columns at all target viewports.
- [x] Current/target values and missing-target states remain explicit.
- [x] The heat ring reflects the real completion percentage.
- [x] Desktop and 390px browser-rendered evidence captured.
- [x] Console logs checked with no errors.

final result: passed
