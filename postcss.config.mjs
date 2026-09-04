import tailwindcss from "@tailwindcss/postcss";

const CSS_SIZE_KEYWORDS = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "xx-small",
  "x-small",
  "small",
  "medium",
  "large",
  "x-large",
  "xx-large",
  "xxx-large",
  "smaller",
  "larger",
  "math",
]);

const ffzFontSizeOffset = {
  postcssPlugin: "ffz-font-size-offset",
  Declaration(declaration) {
    if (declaration.prop !== "font-size") return;

    const value = declaration.value.trim();
    if (!value || CSS_SIZE_KEYWORDS.has(value.toLowerCase())) return;

    declaration.value = `calc(${value} + 2px)`;
  },
  OnceExit(root) {
    root.walkRules((rule) => {
      if (rule.selector !== "body") return;

      const hasFontSize = rule.nodes?.some(
        (node) => node.type === "decl" && node.prop === "font-size",
      );

      if (!hasFontSize) {
        rule.append({ prop: "font-size", value: "18px" });
      }
    });
  },
};

export default {
  plugins: [tailwindcss(), ffzFontSizeOffset],
};
