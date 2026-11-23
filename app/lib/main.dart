import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_scope.dart';
import 'config/app_config.dart';
import 'data/api_schedule_repository.dart';
import 'data/schedule_cache.dart';
import 'data/schedule_repository.dart';
import 'state/schedule_controller.dart';
import 'ui/student/home_screen.dart';
import 'ui/theme.dart';
import 'ui/widgets/common.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    final prefs = await SharedPreferences.getInstance();

    final ScheduleRepository repository = ApiScheduleRepository(
      baseUrl: AppConfig.apiBaseUrl,
      prefs: prefs,
    );

    final schedule = ScheduleController(
      repository: repository,
      cache: ScheduleCache(prefs),
    );

    runApp(AlwasitApp(repository: repository, schedule: schedule));
    schedule.load();
  } catch (e) {
    runApp(_StartupErrorApp(error: e.toString()));
  }
}

class AlwasitApp extends StatelessWidget {
  const AlwasitApp({
    super.key,
    required this.repository,
    required this.schedule,
  });

  final ScheduleRepository repository;
  final ScheduleController schedule;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      repository: repository,
      schedule: schedule,
      child: MaterialApp(
        title: AppConfig.centerName,
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(),
        locale: const Locale('ar'),
        supportedLocales: const [Locale('ar')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const HomeScreen(),
      ),
    );
  }
}

class _StartupErrorApp extends StatelessWidget {
  const _StartupErrorApp({required this.error});

  final String error;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Scaffold(
        body: CenteredMessage(
          icon: Icons.error_outline,
          title: 'تعذّر تشغيل التطبيق',
          subtitle: error,
        ),
      ),
    );
  }
}
