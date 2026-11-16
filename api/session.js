import { configured, isAuthed, json } from '../lib/auth.js';

export function GET(request) {
  return json({ configured: configured(), logged: isAuthed(request), localUploads: Boolean(process.env.VSL_LOCAL_DIR) });
}
