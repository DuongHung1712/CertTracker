import { createCn } from "cn/config"

// Teach class merging the design-system text styles (`--text-*` in globals.css).
// Without this, `text-caption` looks like a colour and is dropped next to `text-foreground`.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["page-title", "section-title", "body", "table", "label", "caption", "kpi"] }],
    },
  },
})
