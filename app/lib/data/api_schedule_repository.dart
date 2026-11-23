import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../core/app_exception.dart';
import '../models/lecture.dart';
import '../models/lookup.dart';
import '../models/schedule_snapshot.dart';
import 'schedule_repository.dart';

/// يتصل بخادم المركز على Vercel.
///
/// - GET  /api/schedule  → الجدول للطلاب (بلا تسجيل دخول)
/// - POST /api/admin     → عمليات الإدارة (برمز دخول)
///
/// الصلاحيات مفروضة على الخادم نفسه؛ التطبيق لا يستطيع الكتابة دون
/// كلمة مرور الإدارة الصحيحة.
class ApiScheduleRepository implements ScheduleRepository {
  ApiScheduleRepository({
    required String baseUrl,
    required SharedPreferences prefs,
    http.Client? client,
  })  : _base = baseUrl.replaceAll(RegExp(r'/+$'), ''),
        _prefs = prefs,
        _client = client ?? http.Client();

  static const String _tokenKey = 'alwasit_admin_token_v1';
  static const Duration _timeout = Duration(seconds: 20);

  final String _base;
  final SharedPreferences _prefs;
  final http.Client _client;

  String? get _token => _prefs.getString(_tokenKey);

  @override
  bool get isRemote => true;

  // ---------- الطلاب ----------

  @override
  Future<ScheduleSnapshot> fetchAll() async {
    final json = await _send(() => _client.get(
          Uri.parse('$_base/api/schedule'),
          headers: const {'Accept': 'application/json'},
        ));
    try {
      return ScheduleSnapshot.fromJson(json);
    } catch (e) {
      throw AppException('وصلت بيانات غير مفهومة من الخادم.', cause: e);
    }
  }

  // ---------- الإدارة ----------

  @override
  Future<bool> restoreAdminSession() async {
    if (_token == null) return false;
    try {
      await _admin({'action': 'check'});
      return true;
    } on AppException catch (e) {
      // بدون إنترنت: نفترض أن الجلسة ما زالت صالحة، وأي عملية ستوضح الخطأ.
      return e.cause is! _Unauthorized && _token != null;
    }
  }

  @override
  Future<void> signIn({required String password}) async {
    final res = await _admin(
      {'action': 'login', 'password': password},
      authenticated: false,
    );
    final token = res['token'];
    if (token is! String || token.isEmpty) {
      throw const AppException('رد غير متوقع من الخادم عند تسجيل الدخول.');
    }
    await _prefs.setString(_tokenKey, token);
  }

  @override
  Future<void> signOut() async {
    await _prefs.remove(_tokenKey);
  }

  @override
  Future<void> saveLecture(LectureDraft draft) =>
      _admin({'action': 'saveLecture', 'lecture': draft.toJson()});

  @override
  Future<void> deleteLecture(String id) =>
      _admin({'action': 'deleteLecture', 'id': id});

  @override
  Future<LookupItem> addLookup(LookupKind kind, String name) async {
    final res = await _admin(
        {'action': 'addLookup', 'kind': kind.name, 'name': name.trim()});
    final item = res['item'];
    if (item is! Map) {
      throw const AppException('رد غير متوقع من الخادم.');
    }
    return LookupItem.fromJson(item.cast<String, dynamic>());
  }

  @override
  Future<void> renameLookup(LookupKind kind, String id, String name) =>
      _admin({
        'action': 'renameLookup',
        'kind': kind.name,
        'id': id,
        'name': name.trim(),
      });

  @override
  Future<void> deleteLookup(LookupKind kind, String id) =>
      _admin({'action': 'deleteLookup', 'kind': kind.name, 'id': id});

  // ---------- الاتصال ومعالجة الأخطاء ----------

  Future<Map<String, dynamic>> _admin(
    Map<String, dynamic> body, {
    bool authenticated = true,
  }) async {
    final token = _token;
    if (authenticated && token == null) {
      throw const AppException('سجّل الدخول إلى لوحة الإدارة أولًا.',
          cause: _Unauthorized());
    }
    try {
      return await _send(() => _client.post(
            Uri.parse('$_base/api/admin'),
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Accept': 'application/json',
              if (authenticated) 'Authorization': 'Bearer $token',
            },
            body: jsonEncode(body),
          ));
    } on AppException catch (e) {
      if (authenticated && e.cause is _Unauthorized) {
        await _prefs.remove(_tokenKey);
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> _send(
      Future<http.Response> Function() request) async {
    final http.Response res;
    try {
      res = await request().timeout(_timeout);
    } on TimeoutException catch (e) {
      throw AppException('انتهت مهلة الاتصال بالخادم. حاول مجددًا.', cause: e);
    } catch (e) {
      throw AppException.from(e);
    }

    Map<String, dynamic>? json;
    try {
      final decoded = jsonDecode(utf8.decode(res.bodyBytes));
      if (decoded is Map) json = decoded.cast<String, dynamic>();
    } catch (_) {
      json = null;
    }

    if (res.statusCode >= 200 && res.statusCode < 300 && json != null) {
      return json;
    }

    final serverMessage = json?['error'];
    final message = serverMessage is String && serverMessage.isNotEmpty
        ? serverMessage
        : _fallbackMessage(res.statusCode);
    throw AppException(
      message,
      cause: res.statusCode == 401 ? const _Unauthorized() : res.statusCode,
    );
  }

  String _fallbackMessage(int status) {
    if (status == 404) {
      return 'عنوان الخادم غير صحيح أو لم يُنشر بعد.';
    }
    if (status >= 500) return 'الخادم يواجه مشكلة مؤقتة. حاول بعد قليل.';
    return 'تعذّر إتمام الطلب (رمز $status).';
  }
}

class _Unauthorized {
  const _Unauthorized();
}
