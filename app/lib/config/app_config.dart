/// إعدادات التطبيق.
class AppConfig {
  const AppConfig._();

  /// عنوان خادم المركز على Vercel (نفس الاستضافة التي يعمل عليها موقع
  /// الطلاب في سوريا دون VPN). يُمرَّر وقت البناء من ملف api_url.txt،
  /// ويمكن تغييره دون تعديل الكود:
  ///   flutter build apk --dart-define=API_BASE_URL=https://...
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://alwasit-pearl.vercel.app',
  );

  static const String centerName = 'مركز الوسيط';
}
