/** How many daily backups are kept (BACKUP_KEEP), so also how many days an erased record can still sit in one. */
export const BACKUP_KEEP = Number(process.env.BACKUP_KEEP ?? 14);
