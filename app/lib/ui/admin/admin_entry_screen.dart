import 'package:flutter/material.dart';

import '../../app_scope.dart';
import '../../core/app_exception.dart';
import '../theme.dart';
import 'admin_dashboard_screen.dart';

/// بوابة الإدارة: تعرض تسجيل الدخول أو اللوحة حسب حالة الجلسة.
class AdminEntryScreen extends StatefulWidget {
  const AdminEntryScreen({super.key});

  @override
  State<AdminEntryScreen> createState() => _AdminEntryScreenState();
}

enum _Stage { checking, login, dashboard }

class _AdminEntryScreenState extends State<AdminEntryScreen> {
  _Stage _stage = _Stage.checking;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_started) {
      _started = true;
      _check();
    }
  }

  Future<void> _check() async {
    final repo = AppScope.read(context).repository;
    final ok = await repo.restoreAdminSession();
    if (!mounted) return;
    setState(() => _stage = ok ? _Stage.dashboard : _Stage.login);
  }

  @override
  Widget build(BuildContext context) {
    return switch (_stage) {
      _Stage.checking =>
        const Scaffold(body: Center(child: CircularProgressIndicator())),
      _Stage.login => _LoginScreen(
          onSignedIn: () => setState(() => _stage = _Stage.dashboard),
        ),
      _Stage.dashboard => AdminDashboardScreen(
          onSignedOut: () => setState(() => _stage = _Stage.login),
        ),
    };
  }
}

class _LoginScreen extends StatefulWidget {
  const _LoginScreen({required this.onSignedIn});

  final VoidCallback onSignedIn;

  @override
  State<_LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<_LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _password = TextEditingController();
  bool _busy = false;
  bool _hidePassword = true;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || !_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).repository.signIn(password: _password.text);
      if (!mounted) return;
      widget.onSignedIn();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = AppException.from(e).message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('دخول الإدارة')),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const SizedBox(height: 12),
              const Center(child: Text('👑', style: TextStyle(fontSize: 56))),
              const SizedBox(height: 8),
              Text('لوحة إدارة مركز الوسيط',
                  textAlign: TextAlign.center,
                  style:
                      text.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text('هذا القسم مخصص للمسؤولين فقط.',
                  textAlign: TextAlign.center,
                  style: text.bodyMedium?.copyWith(color: AppColors.muted)),
              const SizedBox(height: 28),
              TextFormField(
                controller: _password,
                obscureText: _hidePassword,
                textDirection: TextDirection.ltr,
                autofillHints: const [AutofillHints.password],
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _submit(),
                decoration: InputDecoration(
                  labelText: 'كلمة مرور الإدارة',
                  prefixIcon: const Icon(Icons.lock_outline),
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    tooltip: _hidePassword ? 'إظهار' : 'إخفاء',
                    icon: Icon(_hidePassword
                        ? Icons.visibility
                        : Icons.visibility_off),
                    onPressed: () =>
                        setState(() => _hidePassword = !_hidePassword),
                  ),
                ),
                validator: (v) =>
                    (v ?? '').isEmpty ? 'كلمة المرور مطلوبة' : null,
              ),
              if (_error != null) ...[
                const SizedBox(height: 14),
                Text(_error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 22),
              FilledButton(
                style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(50)),
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('دخول'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
