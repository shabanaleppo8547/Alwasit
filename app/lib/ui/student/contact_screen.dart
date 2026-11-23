import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app_scope.dart';
import '../../config/app_config.dart';
import '../../models/teacher.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'shell_app_bar.dart';

/// 📞 التواصل مع الأساتذة: حسابات الأساتذة الشخصية (منفصلة عن قنوات المواد).
class ContactScreen extends StatelessWidget {
  const ContactScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).schedule;
    return ListenableBuilder(
      listenable: c,
      builder: (context, _) => Scaffold(
        appBar: shellAppBar(context, c, title: 'التواصل مع الأساتذة'),
        body: RefreshIndicator(
          onRefresh: c.load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              const Text('📞 اختر الأستاذ ثم وسيلة التواصل.',
                  style: TextStyle(color: AppColors.muted)),
              const SizedBox(height: 12),
              if (c.snapshot == null && c.isLoading)
                const Padding(
                  padding: EdgeInsets.all(48),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (c.teachers.isEmpty)
                const CenteredMessage(
                  icon: Icons.person_off_outlined,
                  title: 'لا توجد بيانات تواصل بعد',
                )
              else
                for (final t in c.teachers)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _TeacherCard(teacher: t),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TeacherCard extends StatelessWidget {
  const _TeacherCard({required this.teacher});

  final Teacher teacher;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.goldSoft,
            child: Text('👨‍🏫'),
          ),
          title: Text('الأستاذ ${teacher.name}',
              style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text(
            teacher.contacts.map((c) => c.displayLabel).join(' · '),
            style: const TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            if (teacher.contacts.isEmpty)
              const Text('لا توجد وسائل تواصل مضافة.',
                  style: TextStyle(color: AppColors.muted)),
            for (final contact in teacher.contacts)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: _ContactButton(teacher: teacher, contact: contact),
              ),
          ],
        ),
      ),
    );
  }
}

class _ContactButton extends StatelessWidget {
  const _ContactButton({required this.teacher, required this.contact});

  final Teacher teacher;
  final Contact contact;

  static IconData iconFor(ContactType t) => switch (t) {
        ContactType.whatsapp => Icons.chat,
        ContactType.telegram => Icons.telegram,
        ContactType.facebook => Icons.facebook,
        ContactType.phone => Icons.call,
        ContactType.other => Icons.link,
      };

  static Color colorFor(ContactType t) => switch (t) {
        ContactType.whatsapp => const Color(0xFF1FA855),
        ContactType.telegram => const Color(0xFF229ED9),
        ContactType.facebook => const Color(0xFF1877F2),
        ContactType.phone => AppColors.navySoft,
        ContactType.other => AppColors.navySoft,
      };

  Future<void> _launch(BuildContext context, Uri uri) async {
    var ok = false;
    try {
      ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      ok = false;
    }
    if (!ok && context.mounted) {
      showMessage(context, 'تعذّر فتح ${contact.displayLabel}.', error: true);
    }
  }

  Future<void> _onTap(BuildContext context) async {
    switch (contact.type) {
      case ContactType.whatsapp:
        final text = await _askWhatsAppMessage(context);
        if (text == null || !context.mounted) return;
        await _launch(
          context,
          Uri.parse(
              'https://wa.me/${contact.value}?text=${Uri.encodeComponent(text)}'),
        );
      case ContactType.phone:
        await _launch(context, Uri.parse('tel:+${contact.value}'));
      case ContactType.telegram:
      case ContactType.facebook:
      case ContactType.other:
        final uri = Uri.tryParse(contact.value);
        if (uri != null) await _launch(context, uri);
    }
  }

  Future<String?> _askWhatsAppMessage(BuildContext context) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (_) => _WhatsAppDraft(teacherName: teacher.name),
    );
  }

  @override
  Widget build(BuildContext context) {
    final color = colorFor(contact.type);
    return FilledButton.icon(
      style: FilledButton.styleFrom(
        backgroundColor: color,
        minimumSize: const Size.fromHeight(48),
        alignment: AlignmentDirectional.centerStart,
      ),
      onPressed: () => _onTap(context),
      icon: Icon(iconFor(contact.type)),
      label: Text(contact.type.isPhone
          ? '${contact.displayLabel}  (+${contact.value})'
          : contact.displayLabel),
    );
  }
}

/// رسالة واتساب جاهزة يستطيع الطالب تعديلها قبل الإرسال.
class _WhatsAppDraft extends StatefulWidget {
  const _WhatsAppDraft({required this.teacherName});

  final String teacherName;

  @override
  State<_WhatsAppDraft> createState() => _WhatsAppDraftState();
}

class _WhatsAppDraftState extends State<_WhatsAppDraft> {
  late final TextEditingController _ctrl = TextEditingController(
    text: 'السلام عليكم أستاذ، أنا أحد طلاب ${AppConfig.centerName}، '
        'وأرغب بالاستفسار عن ',
  );

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
          20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('رسالة إلى الأستاذ ${widget.teacherName}',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(
            controller: _ctrl,
            autofocus: true,
            minLines: 3,
            maxLines: 6,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              helperText: 'أكمل الرسالة أو عدّلها، ثم افتح واتساب.',
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF1FA855),
              minimumSize: const Size.fromHeight(48),
            ),
            icon: const Icon(Icons.send),
            label: const Text('فتح المحادثة في واتساب'),
            onPressed: () => Navigator.of(context).pop(_ctrl.text.trim()),
          ),
        ],
      ),
    );
  }
}
