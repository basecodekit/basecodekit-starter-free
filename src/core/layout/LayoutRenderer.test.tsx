import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { landingContent } from "@/config/landing.config";
import type { LayoutArchetype, StylePack } from "@/types/config";
import { LayoutRenderer } from "./LayoutRenderer";
import { layoutRegistry } from "./registry";
import { STYLE_PACK_COLOR_SCHEME } from "./style-packs";
import { SLOT_ORDER } from "./types";

/** Phase 5's acceptance matrix, rendered on the server: every archetype ×
 * style pack × business mode resolves and renders through LayoutRenderer. */

interface Combination {
  archetype: LayoutArchetype;
  stylePack: StylePack;
}

const archetypes = Object.keys(layoutRegistry) as LayoutArchetype[];
const stylePacks = Object.keys(STYLE_PACK_COLOR_SCHEME) as StylePack[];
const modes: Partial<Combination>[] = [{}];
const matrix = archetypes.flatMap((archetype) =>
  stylePacks.flatMap((stylePack) => modes.map((mode): Combination => ({ archetype, stylePack, ...mode }))),
);

function render({ archetype, stylePack, ...rest }: Combination) {
  return renderToStaticMarkup(<LayoutRenderer layout={{ archetype, stylePack }} {...rest} />);
}

describe("LayoutRenderer", () => {
  it("covers every v1 archetype", () => {
    expect(archetypes).toEqual(["saas-hero"]);
  });

  it.each(matrix.map((combination) => [Object.values(combination).join(" × "), combination] as const))(
    "renders %s",
    (_, combination) => {
      const html = render(combination);

      expect(html).toContain(`data-style-pack="${combination.stylePack}"`);
      expect(html).toContain(`data-archetype="${combination.archetype}"`);

      // Every slot, in SLOT_ORDER.
      const positions = SLOT_ORDER.map((slot) => html.indexOf(`id="${slot}-heading"`));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);

      expect(html).toContain(landingContent.hero.headline);
      for (const item of landingContent.faq.items) expect(html).toContain(item.question);
    },
  );




  // framer-motion server-renders a revealing element at its start state.
  const hidden = /style="[^"]*opacity:0/;

  it("renders statically under a pack without a motion preset", () => {
    for (const archetype of archetypes) {
      expect(render({ archetype, stylePack: "minimal" })).not.toMatch(hidden);
    }
  });

});
