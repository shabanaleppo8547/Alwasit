import 'package:flutter/widgets.dart';

import 'data/schedule_repository.dart';
import 'state/schedule_controller.dart';

/// يوفر المستودع والحالة لكل الشاشات.
class AppScope extends InheritedWidget {
  const AppScope({
    super.key,
    required this.repository,
    required this.schedule,
    required super.child,
  });

  final ScheduleRepository repository;
  final ScheduleController schedule;

  static AppScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope غير موجود في شجرة الواجهات');
    return scope!;
  }

  /// للاستخدام خارج build (في الأحداث) دون تسجيل اعتماد.
  static AppScope read(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope غير موجود في شجرة الواجهات');
    return scope!;
  }

  @override
  bool updateShouldNotify(AppScope oldWidget) =>
      repository != oldWidget.repository || schedule != oldWidget.schedule;
}
