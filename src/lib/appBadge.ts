export function updateAppBadge(count: number): void {
  try {
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        (navigator as any).setAppBadge(count);
      } else {
        (navigator as any).clearAppBadge();
      }
    }
  } catch {
    // Silently ignore — browser may not support or user may not have granted permission
  }
}

export function clearAppBadge(): void {
  try {
    if ('clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge();
    }
  } catch {
    // Silently ignore
  }
}
