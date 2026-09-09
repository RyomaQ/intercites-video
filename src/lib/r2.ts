import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DOWNLOAD_VALID_SECONDS = 300;
const TRAILER_VALID_SECONDS = 3600;

function getClient(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY manquants");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function getSignedFileUrl(
  fileName: string,
  validDurationInSeconds: number,
  contentDisposition?: string
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) throw new Error("R2_BUCKET_NAME manquant");

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    ...(contentDisposition ? { ResponseContentDisposition: contentDisposition } : {}),
  });

  return getSignedUrl(getClient(), command, { expiresIn: validDurationInSeconds });
}

/**
 * Génère une URL de téléchargement R2 signée, valide quelques minutes,
 * qui force le navigateur à télécharger le fichier (Content-Disposition: attachment).
 */
export async function getSignedDownloadUrl(): Promise<string> {
  const fileName = process.env.R2_FILE_NAME;
  if (!fileName) throw new Error("R2_FILE_NAME manquant");

  return getSignedFileUrl(
    fileName,
    DOWNLOAD_VALID_SECONDS,
    `attachment; filename="${fileName}"`
  );
}

/**
 * URL de lecture (pas de forçage de téléchargement) pour la bande-annonce en
 * fond de page. Validité longue car la vidéo boucle et peut être lue par
 * requêtes Range bien après le chargement initial.
 */
export async function getSignedTrailerUrl(): Promise<string> {
  const fileName = process.env.R2_TRAILER_FILE_NAME;
  if (!fileName) throw new Error("R2_TRAILER_FILE_NAME manquant");

  return getSignedFileUrl(fileName, TRAILER_VALID_SECONDS);
}

/**
 * URL de lecture pour la version portrait (9:16) de la bande-annonce, servie
 * sur mobile.
 */
export async function getSignedTrailerMobileUrl(): Promise<string> {
  const fileName = process.env.R2_TRAILER_MOBILE_FILE_NAME;
  if (!fileName) throw new Error("R2_TRAILER_MOBILE_FILE_NAME manquant");

  return getSignedFileUrl(fileName, TRAILER_VALID_SECONDS);
}
