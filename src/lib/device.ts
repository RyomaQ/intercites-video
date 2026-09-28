// Le film fait ~4 Go et un code ne sert qu'une fois : sur téléphone/tablette
// le téléchargement échoue souvent ou le fichier reste inexploitable, et le
// code serait perdu. On bloque donc ces appareils avant de consommer le code.
// Détection best-effort (user-agent), contournable via "version ordinateur".

export const MOBILE_BLOCKED_MESSAGE =
  "Downloading only works on a computer. Please open this page on a computer.";

const MOBILE_UA_PATTERN =
  /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile/i;

export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  return !!userAgent && MOBILE_UA_PATTERN.test(userAgent);
}

// Côté navigateur uniquement : depuis iPadOS 13, Safari sur iPad se présente
// comme un Mac — seul le support tactile permet de le distinguer.
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const isIPadOS =
    /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return isIPadOS || isMobileUserAgent(navigator.userAgent);
}
