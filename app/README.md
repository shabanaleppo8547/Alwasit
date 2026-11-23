# تطبيق مركز الوسيط (Flutter)

## التشغيل المحلي (للمطوّرين)
```
flutter create --org com.alwasit --project-name alwasit_center --platforms android,ios .
flutter pub get
flutter run --dart-define=API_BASE_URL=https://<عنوان-الخادم>.vercel.app
```
أمر `flutter create` يولّد ملفات المنصات الناقصة دون أن يستبدل ملفات المشروع.

## البنية
```
lib/
  main.dart                       نقطة البداية
  config/app_config.dart          عنوان الخادم
  core/                           الوقت 12 ساعة، والنص العربي، والأخطاء
  models/                         المحاضرة، والقوائم، والأيام، والسنوات
  data/api_schedule_repository.dart   الاتصال بالخادم
  data/schedule_cache.dart        آخر جدول محفوظ للعمل دون إنترنت
  logic/schedule_filter.dart      الفلترة والترتيب والتزامن
  logic/share_message.dart        نص رسالة واتساب
  state/schedule_controller.dart  الحالة المشتركة بين الطلاب والإدارة
  ui/student/  ui/admin/          الشاشات
```
لتغيير مصدر البيانات اكتب تطبيقًا جديدًا للواجهة `ScheduleRepository` دون تعديل الشاشات.
