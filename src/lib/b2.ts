const AUTHORIZE_URL = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account";
const DOWNLOAD_VALID_SECONDS = 300;

interface B2AuthorizeResponse {
  apiUrl: string;
  authorizationToken: string;
  downloadUrl: string;
}

interface B2DownloadAuthResponse {
  authorizationToken: string;
}

async function authorizeAccount(): Promise<B2AuthorizeResponse> {
  const keyId = process.env.B2_APPLICATION_KEY_ID;
  const key = process.env.B2_APPLICATION_KEY;
  if (!keyId || !key) {
    throw new Error("B2_APPLICATION_KEY_ID / B2_APPLICATION_KEY manquants");
  }

  const credentials = Buffer.from(`${keyId}:${key}`).toString("base64");
  const res = await fetch(AUTHORIZE_URL, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) {
    throw new Error(`b2_authorize_account a échoué (${res.status})`);
  }

  return res.json();
}

/**
 * Génère une URL de téléchargement B2 signée, valide quelques minutes,
 * qui force le navigateur à télécharger le fichier (Content-Disposition: attachment).
 */
export async function getSignedDownloadUrl(): Promise<string> {
  const bucketId = process.env.B2_BUCKET_ID;
  const bucketName = process.env.B2_BUCKET_NAME;
  const fileName = process.env.B2_FILE_NAME;
  if (!bucketId || !bucketName || !fileName) {
    throw new Error("B2_BUCKET_ID / B2_BUCKET_NAME / B2_FILE_NAME manquants");
  }

  const { apiUrl, authorizationToken, downloadUrl } = await authorizeAccount();

  const contentDisposition = `attachment; filename="${fileName}"`;
  const res = await fetch(`${apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId,
      fileNamePrefix: fileName,
      validDurationInSeconds: DOWNLOAD_VALID_SECONDS,
      b2ContentDisposition: contentDisposition,
    }),
  });

  if (!res.ok) {
    throw new Error(`b2_get_download_authorization a échoué (${res.status})`);
  }

  const { authorizationToken: downloadAuthToken }: B2DownloadAuthResponse = await res.json();

  return `${downloadUrl}/file/${bucketName}/${encodeURIComponent(fileName)}?Authorization=${downloadAuthToken}`;
}
