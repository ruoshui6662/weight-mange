export const DATA_GARDEN_TOKENS = {
  color: {
    page: "#F4F7F6",
    surface: "#FFFFFF",
    surfaceSoft: "#F0F8F4",
    surfaceSelected: "#E2F5EB",
    primary: "#35C887",
    primaryStrong: "#159B64",
    primaryPressed: "#0F8253",
    text: "#17372A",
    textSecondary: "#5F786C",
    textTertiary: "#8EA198",
    border: "#E1EBE6",
    warning: "#C17A22",
    danger: "#C95656",
    success: "#168E5B",
  },
  layout: { sidebar: "216px", contextRail: "288px", pageGap: "24px" },
  size: { control: "44px", input: "48px" },
  radius: { surface: "20px", control: "12px", pill: "999px" },
} as const;

export type DataGardenTokenSet = typeof DATA_GARDEN_TOKENS;
