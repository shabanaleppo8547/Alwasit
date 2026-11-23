// أدوات مشتركة للردود.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(status).send(JSON.stringify(body));
}

export function sendError(res, err) {
  if (err instanceof HttpError) {
    return sendJson(res, err.status, { error: err.message });
  }
  console.error(err);
  return sendJson(res, 500, { error: 'حدث خطأ في الخادم. حاول مجددًا.' });
}

export function readBody(req) {
  const b = req.body;
  if (b == null || b === '') return {};
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      throw new HttpError(400, 'طلب غير صالح.');
    }
  }
  if (typeof b === 'object') return b;
  throw new HttpError(400, 'طلب غير صالح.');
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip'] || 'unknown';
}
