/**
 * Génère un PDF imprimable listant les codes d'un batch (cartes "DIGITAL FILM CODE").
 * Usage : npx tsx --env-file=.env scripts/generate-codes-pdf.ts --batch "magazine-2026-09" --out intercites-codes-magazine-2026-09.pdf
 *
 * Nécessite Google Chrome installé localement (utilisé en headless pour l'impression HTML -> PDF).
 */
import { execFileSync } from "child_process";
import { writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { prisma } from "../src/lib/prisma";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SITE_URL_LABEL = "video.intercitesbmx.com";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i === -1 ? undefined : args[i + 1];
  };

  const batch = get("--batch");
  const out = get("--out") ?? (batch ? `intercites-codes-${batch}.pdf` : "intercites-codes.pdf");

  if (!batch) {
    throw new Error("--batch est requis (ex: --batch \"magazine-2026-09\")");
  }

  return { batch, out };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cardHtml(code: string) {
  const boxes = code
    .split("")
    .map((ch) => `<span class="char-box">${escapeHtml(ch)}</span>`)
    .join("");

  return `
    <div class="card">
      <div class="card-title">DIGITAL FILM CODE</div>
      <div class="code-row">${boxes}</div>
      <div class="divider"></div>
      <div class="instructions">
        Enter at ${SITE_URL_LABEL}<br />
        to watch the digital version
      </div>
      <div class="warning"><span class="warning-icon">!</span> Single use only</div>
    </div>
  `;
}

function buildHtml(codes: string[]) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Helvetica, Arial, sans-serif;
    -webkit-print-color-adjust: exact;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: 98pt;
  }
  .card {
    border: 1px dashed #999;
    padding: 6pt 5pt;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    break-inside: avoid;
  }
  .card-title {
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.5pt;
    margin-bottom: 5pt;
    text-align: center;
  }
  .code-row {
    display: flex;
    gap: 2pt;
    margin-bottom: 5pt;
  }
  .char-box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 15pt;
    height: 18pt;
    border: 1.5pt solid #000;
    font-weight: 700;
    font-size: 11pt;
    line-height: 1;
  }
  .divider {
    width: 90%;
    border-top: 1pt dotted #999;
    margin-bottom: 5pt;
  }
  .instructions {
    font-size: 6pt;
    color: #555;
    text-align: center;
    line-height: 1.35;
    margin-bottom: 3pt;
  }
  .warning {
    font-size: 6pt;
    font-weight: 600;
    color: #333;
    display: flex;
    align-items: center;
    gap: 3pt;
  }
  .warning-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 8pt;
    height: 8pt;
    border-radius: 50%;
    border: 1pt solid #333;
    font-size: 6pt;
    font-weight: 700;
  }
</style>
</head>
<body>
  <div class="grid">
    ${codes.map(cardHtml).join("\n")}
  </div>
</body>
</html>`;
}

async function main() {
  const { batch, out } = parseArgs();

  const codes = await prisma.code.findMany({
    where: { batchLabel: batch },
    orderBy: { createdAt: "asc" },
    select: { codeValue: true },
  });

  if (codes.length === 0) {
    throw new Error(`Aucun code trouvé pour le batch "${batch}"`);
  }

  const html = buildHtml(codes.map((c) => c.codeValue));

  const tmpDir = mkdtempSync(join(tmpdir(), "intercites-codes-"));
  const htmlPath = join(tmpDir, "codes.html");
  writeFileSync(htmlPath, html, "utf-8");

  const outPath = join(process.cwd(), out);

  execFileSync(CHROME_PATH, [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--print-to-pdf=${outPath}`,
    `file://${htmlPath}`,
  ]);

  console.log(`${codes.length} codes écrits dans ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
