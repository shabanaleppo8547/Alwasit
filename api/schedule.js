// GET /api/schedule — الجدول كاملًا للطلاب (لا يحتاج تسجيل دخول).

import { publicSnapshot } from '../lib/db.js';
import { sendError, sendJson, setCors } from '../lib/http.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'طريقة غير مسموحة.' });
  try {
    return sendJson(res, 200, await publicSnapshot());
  } catch (err) {
    return sendError(res, err);
  }
}
