declare module 'bundle-text:*' {
  const content: string;
  export default content;
}

declare module '*decor-canvas-kinds.mjs' {
  export const decorCanvasKinds: readonly string[];
  export const decorCanvasTypes: Set<string>;
}
