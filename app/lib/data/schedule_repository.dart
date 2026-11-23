import '../models/lecture.dart';
import '../models/lookup.dart';
import '../models/schedule_snapshot.dart';

/// مصدر البيانات الوحيد الذي يقرأ منه الطلاب ويكتب فيه المسؤول.
///
/// لتغيير مكان البيانات يكفي كتابة تطبيق جديد لهذه الواجهة دون
/// تعديل الشاشات.
abstract class ScheduleRepository {
  /// true عند الاتصال بالخادم المركزي.
  bool get isRemote;

  /// يجلب كل المحاضرات والقوائم.
  Future<ScheduleSnapshot> fetchAll();

  // ---------- صلاحيات الإدارة ----------

  /// يتحقق من وجود جلسة مسؤول محفوظة وصالحة.
  Future<bool> restoreAdminSession();

  /// تسجيل دخول المسؤول بكلمة المرور. يرمي AppException عند الفشل.
  Future<void> signIn({required String password});

  Future<void> signOut();

  // ---------- المحاضرات ----------

  /// إضافة (عند id == null) أو تعديل.
  Future<void> saveLecture(LectureDraft draft);

  Future<void> deleteLecture(String id);

  // ---------- القوائم ----------

  Future<LookupItem> addLookup(LookupKind kind, String name);

  Future<void> renameLookup(LookupKind kind, String id, String name);

  /// يرفض الحذف إذا كان العنصر مستخدمًا في محاضرات.
  Future<void> deleteLookup(LookupKind kind, String id);
}
