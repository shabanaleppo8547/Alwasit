import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/schedule_snapshot.dart';

/// يحفظ آخر جدول تم جلبه بنجاح، ليبقى متاحًا للطالب دون إنترنت.
class ScheduleCache {
  ScheduleCache(this._prefs);

  static const String _key = 'alwasit_schedule_cache_v1';

  final SharedPreferences _prefs;

  Future<void> save(ScheduleSnapshot snapshot) async {
    try {
      await _prefs.setString(_key, jsonEncode(snapshot.toJson()));
    } catch (_) {
      // فشل التخزين المؤقت لا يجب أن يمنع عرض الجدول.
    }
  }

  ScheduleSnapshot? read() {
    final raw = _prefs.getString(_key);
    if (raw == null) return null;
    try {
      return ScheduleSnapshot.fromJson(
          (jsonDecode(raw) as Map).cast<String, dynamic>());
    } catch (_) {
      return null;
    }
  }
}
