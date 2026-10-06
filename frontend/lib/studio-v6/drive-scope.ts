export const STUDIO_DRIVE_ROOT_ID = "1NSPF-zrrM1RAqniRR4FHL56VvGDcBXWl";
export const STUDIO_DRIVE_ROOT_NAME = "TQS STUDIO — WORLD";
export const STUDIO_DRIVE_ROOT_URL = `https://drive.google.com/drive/folders/${STUDIO_DRIVE_ROOT_ID}`;

/**
 * Google has no OAuth scope limited to one existing folder.
 * `drive.file` only sees files this app created or the user picked, so the
 * existing TQS STUDIO — WORLD tree would stay unreadable.
 * `drive.readonly` can see that tree and cannot write a checkpoint or export.
 * `https://www.googleapis.com/auth/drive` is the smallest scope that can both
 * read and write the designated root. Studio still limits calls to that root.
 */
export const STUDIO_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
export const STUDIO_DRIVE_SCOPE_REASON =
  "Google не даёт доступ только к одной существующей папке. drive.file не читает уже лежащее дерево TQS STUDIO — WORLD, drive.readonly не пишет checkpoint и export. Поэтому подключение использует полный drive scope и работает только внутри этого корня.";
