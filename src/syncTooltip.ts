export function setSyncTooltip(element: HTMLElement, text: string) {
  element.setAttribute("aria-label", text);
  element.setAttribute("data-tooltip", text);
}
