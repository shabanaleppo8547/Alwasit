import { authorizeLecture } from '@/server/access';
import { getCurrentUser } from '@/server/auth/session';
import { streamVideo } from '@/server/video';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * بث الفيديو بعد التحقق من الجلسة والاشتراك في كل طلب (بما فيها طلبات Range).
 * رابط المصدر الحقيقي لا يظهر للمتصفح أبدًا.
 */
export async function GET(req: Request, ctx: { params: Promise<{ lectureId: string }> }) {
  const { lectureId } = await ctx.params;
  if (!UUID.test(lectureId)) return new Response('غير موجود', { status: 404 });

  // منع تضمين الفيديو من مواقع أخرى.
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    return new Response('غير مسموح', { status: 403 });
  }

  const user = await getCurrentUser();
  const result = await authorizeLecture(user, lectureId);
  if (!result.ok) {
    const status = result.reason === 'unauthenticated' ? 401 : result.reason === 'forbidden' ? 403 : 404;
    return new Response(status === 403 ? 'لا تملك صلاحية مشاهدة هذه المحاضرة' : 'غير متاح', {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (!result.lecture.videoRef) return new Response('لا يوجد فيديو لهذه المحاضرة بعد', { status: 404 });
  return streamVideo(result.lecture.videoRef, req.headers.get('range'));
}
