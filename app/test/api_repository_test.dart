import 'dart:convert';

import 'package:alwasit_center/core/app_exception.dart';
import 'package:alwasit_center/data/api_schedule_repository.dart';
import 'package:alwasit_center/models/lookup.dart';
import 'package:alwasit_center/models/week_day.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// نفس شكل رد الخادم الحقيقي (api/schedule.js).
const _serverSnapshot = {
  'fetchedAt': '2026-11-24T00:00:00.000Z',
  'updatedAt': null,
  'lectures': [
    {
      'id': 'l1',
      'day': 'tuesday',
      'start': 990,
      'end': 1140,
      'year': 3,
      'subjectId': 's1',
      'subjectName': 'برمجة C++',
      'teacherId': 't1',
      'teacherName': 'شعبان',
      'groupId': null,
      'groupName': null,
      'departmentId': null,
      'departmentName': null,
      'notes': null,
    }
  ],
  'lookups': {
    'subject': [
      {'id': 's1', 'name': 'برمجة C++'}
    ],
    'teacher': [
      {'id': 't1', 'name': 'شعبان'}
    ],
    'group': [
      {'id': 'g1', 'name': 'A'}
    ],
    'department': [],
  },
};

http.Response _json(Object body, [int status = 200]) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

void main() {
  late SharedPreferences prefs;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
  });

  test('يقرأ جدول الخادم', () async {
    final repo = ApiScheduleRepository(
      baseUrl: 'https://x.vercel.app/',
      prefs: prefs,
      client: MockClient((req) async {
        expect(req.url.toString(), 'https://x.vercel.app/api/schedule');
        return _json(_serverSnapshot);
      }),
    );
    final snap = await repo.fetchAll();
    expect(snap.lectures.single.day, WeekDay.tuesday);
    expect(snap.lectures.single.teacherName, 'شعبان');
    expect(snap.of(LookupKind.group).single.name, 'A');
  });

  test('رسالة الخطأ العربية من الخادم تصل كما هي', () async {
    final repo = ApiScheduleRepository(
      baseUrl: 'https://x.vercel.app',
      prefs: prefs,
      client: MockClient((_) async =>
          _json({'error': 'كلمة المرور غير صحيحة.'}, 401)),
    );
    expect(
      () => repo.signIn(password: 'bad'),
      throwsA(isA<AppException>()
          .having((e) => e.message, 'message', 'كلمة المرور غير صحيحة.')),
    );
  });

  test('تسجيل الدخول يحفظ الرمز ويرسله مع عمليات الإدارة', () async {
    final seen = <Map<String, dynamic>>[];
    final repo = ApiScheduleRepository(
      baseUrl: 'https://x.vercel.app',
      prefs: prefs,
      client: MockClient((req) async {
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        seen.add({...body, 'auth': req.headers['Authorization']});
        if (body['action'] == 'login') return _json({'token': 'T1'});
        if (body['action'] == 'addLookup') {
          return _json({
            'item': {'id': 'n1', 'name': body['name']}
          });
        }
        return _json({'ok': true});
      }),
    );
    await repo.signIn(password: 'secret');
    expect(await repo.restoreAdminSession(), isTrue);
    final item = await repo.addLookup(LookupKind.teacher, '  سامر ');
    expect(item.name, 'سامر');
    expect(seen.last['kind'], 'teacher');
    expect(seen.last['auth'], 'Bearer T1');
    await repo.signOut();
    expect(await repo.restoreAdminSession(), isFalse);
  });

  test('انتهاء الجلسة يحذف الرمز', () async {
    var calls = 0;
    final repo = ApiScheduleRepository(
      baseUrl: 'https://x.vercel.app',
      prefs: prefs,
      client: MockClient((req) async {
        calls++;
        if (calls == 1) return _json({'token': 'T1'});
        return _json({'error': 'انتهت جلسة الدخول.'}, 401);
      }),
    );
    await repo.signIn(password: 'secret');
    await expectLater(repo.deleteLecture('x'), throwsA(isA<AppException>()));
    expect(await repo.restoreAdminSession(), isFalse);
  });
}
