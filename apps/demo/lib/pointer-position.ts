let lastMousePosition: { x: number; y: number } | null = null;

export function rememberMousePosition(event: PointerEvent) {
  if (event.pointerType === "mouse") {
    lastMousePosition = { x: event.clientX, y: event.clientY };
  }
}

export function getLastMousePosition() {
  return lastMousePosition;
}
