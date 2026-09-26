/**
 * Upload d'un gros fichier vers le bucket R2 (upload multipart via l'API S3).
 * Le dashboard Cloudflare est limité à 300 MB par fichier, d'où ce script.
 * Usage : npm run upload-r2 -- /chemin/vers/intercites-dvd.mp4 [--key intercites-dvd.mp4]
 */
import { createReadStream, statSync } from "node:fs";
import { basename } from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

function parseArgs() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith("--"));
  if (!filePath) throw new Error("Chemin du fichier manquant");

  const i = args.indexOf("--key");
  const key = i === -1 ? basename(filePath) : args[i + 1];
  return { filePath, key };
}

async function main() {
  const { filePath, key } = parseArgs();
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("Variables R2_* manquantes dans .env");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const totalBytes = statSync(filePath).size;
  const upload = new Upload({
    client,
    params: {
      Bucket: bucketName,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: "video/mp4",
    },
    partSize: 100 * 1024 * 1024,
    queueSize: 4,
  });

  upload.on("httpUploadProgress", ({ loaded }) => {
    if (!loaded) return;
    const pct = ((loaded / totalBytes) * 100).toFixed(1);
    process.stdout.write(`\r${pct}% (${(loaded / 1e9).toFixed(2)} / ${(totalBytes / 1e9).toFixed(2)} GB)`);
  });

  await upload.done();
  console.log(`\n✅ Uploadé : ${bucketName}/${key}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
