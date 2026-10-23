import { resolveInput } from "@ardia/core";
import { fromLegacyUrl } from "../legacy";
import { searchUrlPrefix, type Settings } from "../store/settings";

const asChromiumSeesIt = (url: string) => url.replace(/^[\u0000- ]+/, "").replace(/[\t\n\r]/g, "");
const withoutViewSource = (url: string) => url.replace(/^(?:view-source:[\u0000- ]*)+/i, "");
const executesScript = (url: string) => {
  const target = asChromiumSeesIt(withoutViewSource(asChromiumSeesIt(url)));
  return /^javascript:/i.test(target) || /^data:\s*(?:text\/html|application\/xhtml\+xml|image\/svg\+xml)/i.test(target);
};

export function runsJavaScript(input: string, settings: Settings): boolean {
  const resolved = resolveInput(fromLegacyUrl(input.trim()), searchUrlPrefix(settings));
  return [input, resolved].some(executesScript);
}

export const JAVASCRIPT_FROM_APPLE_EVENTS_REFUSED = { refused: "javaScriptFromAppleEvents" } as const;
