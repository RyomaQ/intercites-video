/**
 * Génère un lot de codes uniques et les insère en base.
 * Usage : npx tsx scripts/generate-codes.ts --count 100 --origin physical --batch "dvd-run-1"
 */
import { prisma } from "../src/lib/prisma";
import { generateCodeValue } from "../src/lib/codes";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i === -1 ? undefined : args[i + 1];
  };

  const count = Number(get("--count") ?? 10);
  const origin = get("--origin") ?? "physical";
  const batchLabel = get("--batch");

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("--count doit être un entier positif");
  }
  if (origin !== "physical" && origin !== "digital") {
    throw new Error("--origin doit être 'physical' ou 'digital'");
  }

  return { count, origin: origin as "physical" | "digital", batchLabel };
}

async function main() {
  const { count, origin, batchLabel } = parseArgs();
  const codes: string[] = [];

  while (codes.length < count) {
    const candidate = generateCodeValue();
    const exists = await prisma.code.findUnique({ where: { codeValue: candidate } });
    if (!exists && !codes.includes(candidate)) {
      codes.push(candidate);
    }
  }

  await prisma.code.createMany({
    data: codes.map((codeValue) => ({
      codeValue,
      origin,
      batchLabel,
    })),
  });

  console.log(`${codes.length} codes générés (origin=${origin}${batchLabel ? `, batch=${batchLabel}` : ""}).`);
  for (const c of codes) console.log(c);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
