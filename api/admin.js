// POST /api/admin — عمليات الإدارة (تحتاج تسجيل دخول).
//
// { "action": "login", "password": "..." }            → { token, expiresAt }
// { "action": "check" }                               → { ok }
// { "action": "saveLecture", "lecture": {...} }       → { id }
// { "action": "deleteLecture", "id": "..." }
// { "action": "saveSubject", "subject": {...} }       → { id }   (مع روابط قنوات تيليغرام)
// { "action": "deleteSubject", "id": "..." }
// { "action": "saveTeacher", "teacher": {...} }       → { id }   (مع وسائل التواصل)
// { "action": "deleteTeacher", "id": "..." }
// { "action": "addLookup", "kind": "group|department", "name": "..." } → { item }
// { "action": "renameLookup", "kind", "id", "name" }
// { "action": "deleteLookup", "kind", "id" }

import { login, requireAdmin } from '../lib/auth.js';
import { mutate, ops } from '../lib/db.js';
import { HttpError, readBody, sendError, sendJson, setCors } from '../lib/http.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'طريقة غير مسموحة.' });

  try {
    const body = readBody(req);
    const action = body.action;

    if (action === 'login') {
      return sendJson(res, 200, await login(req, body.password));
    }

    requireAdmin(req);

    if (action === 'check') return sendJson(res, 200, { ok: true });

    let result;
    switch (action) {
      case 'saveLecture':
        result = await mutate((db) => ops.saveLecture(db, body.lecture ?? {}));
        break;
      case 'deleteLecture':
        result = await mutate((db) => ops.deleteLecture(db, body));
        break;
      case 'saveSubject':
        result = await mutate((db) => ops.saveSubject(db, body.subject ?? {}));
        break;
      case 'deleteSubject':
        result = await mutate((db) => ops.deleteSubject(db, body));
        break;
      case 'saveTeacher':
        result = await mutate((db) => ops.saveTeacher(db, body.teacher ?? {}));
        break;
      case 'deleteTeacher':
        result = await mutate((db) => ops.deleteTeacher(db, body));
        break;
      case 'addLookup':
        result = await mutate((db) => ops.addLookup(db, body));
        break;
      case 'renameLookup':
        result = await mutate((db) => ops.renameLookup(db, body));
        break;
      case 'deleteLookup':
        result = await mutate((db) => ops.deleteLookup(db, body));
        break;
      default:
        throw new HttpError(400, 'عملية غير معروفة.');
    }
    return sendJson(res, 200, result);
  } catch (err) {
    return sendError(res, err);
  }
}
