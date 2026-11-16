import { configured, isAuthed, json } from '../lib/auth.js';
import { blobConfigured, NO_BLOB_MSG } from '../lib/store.js';

export function GET(request) {
  return json({ configured: configured(), logged: isAuthed(request), localUploads: Boolean(process.env.VSL_LOCAL_DIR),
    storageWarning: blobConfigured() || process.env.VSL_LOCAL_DIR ? '' : NO_BLOB_MSG });
}
