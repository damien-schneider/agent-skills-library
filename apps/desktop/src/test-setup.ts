// happy-dom lacks two browser APIs the Control UI components call: the Web
// Animations API (Base UI's scroll area) and `reportError` (the composer).
Element.prototype.getAnimations ??= () => [];
globalThis.reportError ??= (error: unknown) => {
  throw error;
};
