// Chats: WhatsApp-style conversations for EduNest (students, parents) and EduDesk (staff).
// Keep this file identical in both apps. Backend: backend/app/core/chat_workspace.py.
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:audioplayers/audioplayers.dart';
import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:record/record.dart';

import '../../services/api_service.dart';
import '../../services/push_notifications.dart';
import '../../theme/mobile_design.dart';

// Colours follow the app template: the role accent from the theme on ivory / card tones.
Color _accent(BuildContext context) => Theme.of(context).colorScheme.primary;
Color _bubbleMine(BuildContext context) => Color.alphaBlend(_accent(context).withValues(alpha: .13), collegeIvory);
const _bubbleTheirs = collegeIvory;
final _chatBackdrop = Color.alphaBlend(collegeCard.withValues(alpha: .55), collegeIvory);
const _uploads = '/academics/assignment-workspace/files';

/// Chat API calls (all under /api/v1/chat).
class ChatApi {
  ChatApi(this.api);
  final CollegeApi api;

  Future<Json> conversations() async => (await api.get('/chat/conversations') as Map).cast<String, dynamic>();
  Future<int> unread() async => ((await api.get('/chat/unread') as Map)['unread'] as num?)?.toInt() ?? 0;
  Future<Json> conversation(String code) async =>
      (await api.get('/chat/conversations/${Uri.encodeComponent(code)}') as Map).cast<String, dynamic>();
  Future<Json> messages(String code, {String? after, String? before}) async =>
      (await api.get(
                Uri(
                  path: '/chat/conversations/${Uri.encodeComponent(code)}/messages',
                  queryParameters: {'after': ?after, 'before': ?before},
                ).toString(),
              )
              as Map)
          .cast<String, dynamic>();
  Future<Json> send(
    String code, {
    String body = '',
    String? attachment,
    int? durationMs,
    required String clientId,
  }) async =>
      (await api.post('/chat/conversations/${Uri.encodeComponent(code)}/messages', {
                'body': body,
                'attachment_code': ?attachment,
                'duration_ms': ?durationMs,
                'client_id': clientId,
              })
              as Map)
          .cast<String, dynamic>();
  Future<Json> direct(String account) async =>
      (await api.post('/chat/direct', {'recipient_user_code': account}) as Map).cast<String, dynamic>();
  Future<Json> group(Json body) async => (await api.post('/chat/groups', body) as Map).cast<String, dynamic>();
  Future<Json> directory({String q = '', String role = ''}) async =>
      (await api.get(
                Uri(
                  path: '/chat/directory',
                  queryParameters: {if (q.isNotEmpty) 'q': q, if (role.isNotEmpty) 'role': role},
                ).toString(),
              )
              as Map)
          .cast<String, dynamic>();
  Future<Json> options() async => (await api.get('/chat/options') as Map).cast<String, dynamic>();

  /// Uploads [bytes] in chunks for conversation [thread]; returns the file code to send.
  Future<String> upload(String thread, String name, Uint8List bytes) async {
    final started =
        (await api.post('$_uploads/start', {'filename': name, 'size_bytes': bytes.length, 'chat_thread_code': thread})
            as Map);
    final code = '${started['code']}';
    final size = (started['chunk_size'] as num).toInt();
    for (var i = 0, offset = 0; offset < bytes.length; i++, offset += size) {
      await api.post('$_uploads/${Uri.encodeComponent(code)}/chunk', {
        'index': i,
        'content_base64': base64Encode(bytes.sublist(offset, math.min(offset + size, bytes.length))),
      });
    }
    await api.post('$_uploads/${Uri.encodeComponent(code)}/finish', {});
    return code;
  }

  static final Map<String, Uint8List> _cache = {};
  Future<Uint8List> file(String code) async => _cache[code] ??= await api.assignmentFile(code);
}

// ---- Shared bits ------------------------------------------------------------------------------
DateTime? _time(dynamic v) => DateTime.tryParse('${v ?? ''}')?.toLocal();

String _clock(DateTime t) {
  final h = t.hour % 12 == 0 ? 12 : t.hour % 12;
  return '$h:${t.minute.toString().padLeft(2, '0')} ${t.hour < 12 ? 'AM' : 'PM'}';
}

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

String _listTime(DateTime? t) {
  if (t == null) return '';
  final now = DateTime.now();
  final day = DateUtils.dateOnly(t), today = DateUtils.dateOnly(now);
  final diff = today.difference(day).inDays;
  if (diff == 0) return _clock(t);
  if (diff == 1) return 'Yesterday';
  if (diff < 7) return _days[t.weekday - 1];
  return '${t.day} ${_months[t.month - 1]}${t.year == now.year ? '' : ' ${t.year}'}';
}

String _dayLabel(DateTime t) {
  final diff = DateUtils.dateOnly(DateTime.now()).difference(DateUtils.dateOnly(t)).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  if (diff < 7) return _days[t.weekday - 1];
  return '${t.day} ${_months[t.month - 1]} ${t.year}';
}

String _duration(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  return (parts.first[0] + (parts.length > 1 ? parts.last[0] : '')).toUpperCase();
}

Color _roleColor(String role) => switch (role) {
  'teacher' => collegePine,
  'staff' || 'admin' => collegeClayInk,
  'parent' => const Color(0xff6b5b95),
  'student' => const Color(0xff2f6f8f),
  'group' => collegeCaramel,
  _ => collegeWarmGray,
};

String _roleLabel(String role) => switch (role) {
  'teacher' => 'Teacher',
  'staff' => 'Staff',
  'admin' => 'Admin',
  'parent' => 'Parent',
  'student' => 'Student',
  'group' => 'Group',
  _ => '',
};

class ChatAvatar extends StatelessWidget {
  const ChatAvatar({super.key, required this.name, required this.role, this.size = 48});
  final String name, role;
  final double size;
  @override
  Widget build(BuildContext context) {
    final color = _roleColor(role);
    return Semantics(
      label: '${_roleLabel(role)} $name',
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: color.withValues(alpha: .14), shape: BoxShape.circle),
        child: role == 'group'
            ? Icon(Icons.groups_rounded, color: color, size: size * .5)
            : Text(
                _initials(name),
                style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: size * .36),
              ),
      ),
    );
  }
}

void _toast(BuildContext context, Object error) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(error is ApiException ? error.message : '$error'.replaceFirst('Exception: ', ''))),
  );
}

// ---- Chat list ----------------------------------------------------------------------------------
/// Conversations list (Chats tab). [onUnread] reports the unread total for badges.
class ChatHome extends StatefulWidget {
  const ChatHome({super.key, required this.api, this.onUnread, this.openThread});
  final CollegeApi api;
  final ValueChanged<int>? onUnread;

  /// A conversation to open right away (e.g. from a notification).
  final String? openThread;
  @override
  State<ChatHome> createState() => _ChatHomeState();
}

class _ChatHomeState extends State<ChatHome> with WidgetsBindingObserver {
  late final chat = ChatApi(widget.api);
  List<Json> items = [];
  bool loading = true, canGroup = false;
  String? error, query;
  String filter = 'All';
  Timer? timer;
  final search = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    load().then((_) {
      final open = widget.openThread;
      if (open != null && mounted) openConversation(open);
    });
    timer = Timer.periodic(const Duration(seconds: 15), (_) => load(quiet: true));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) load(quiet: true);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    timer?.cancel();
    search.dispose();
    super.dispose();
  }

  Future<void> load({bool quiet = false}) async {
    if (!quiet) setState(() => loading = items.isEmpty);
    try {
      final r = await chat.conversations();
      if (!mounted) return;
      setState(() {
        items = (r['items'] as List? ?? []).cast<Json>();
        canGroup = r['can_create_groups'] == true;
        loading = false;
        error = null;
      });
      widget.onUnread?.call((r['unread'] as num?)?.toInt() ?? 0);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        loading = false;
        if (!quiet || items.isEmpty) error = e is ApiException ? e.message : 'Could not load chats.';
      });
    }
  }

  Future<void> openConversation(String code, {Json? summary}) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ChatScreen(api: widget.api, code: code, summary: summary),
      ),
    );
    if (mounted) load(quiet: true);
  }

  Future<void> startChat() async {
    final picked = await Navigator.of(context).push<Json>(
      MaterialPageRoute(
        builder: (_) => NewChatScreen(api: widget.api, canGroup: canGroup),
      ),
    );
    if (picked != null && mounted) openConversation('${picked['code']}', summary: picked);
  }

  List<Json> get visible {
    final q = (query ?? '').trim().toLowerCase();
    return items.where((c) {
      if (filter == 'Unread' && ((c['unread'] as num?) ?? 0) == 0) return false;
      if (filter == 'Groups' && c['kind'] != 'group') return false;
      if (q.isEmpty) return true;
      return '${c['title']} ${c['subtitle']} ${c['last_message']}'.toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final unreadCount = items.where((c) => ((c['unread'] as num?) ?? 0) > 0).length;
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'new-chat',
        onPressed: startChat,
        backgroundColor: _accent(context),
        foregroundColor: collegeIvory,
        icon: const Icon(Icons.chat_rounded),
        label: const Text('New chat'),
      ),
      body: RefreshIndicator(
        onRefresh: load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              sliver: SliverList.list(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text('Chats', style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                      ),
                      if (canGroup)
                        IconButton.filledTonal(
                          tooltip: 'New group',
                          onPressed: () async {
                            final made = await showModalBottomSheet<Json>(
                              context: context,
                              isScrollControlled: true,
                              showDragHandle: true,
                              builder: (_) => NewGroupSheet(api: widget.api),
                            );
                            if (made != null && mounted) openConversation('${made['code']}', summary: made);
                          },
                          icon: const Icon(Icons.group_add_rounded),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: search,
                    onChanged: (v) => setState(() => query = v),
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      hintText: 'Search chats',
                      prefixIcon: const Icon(Icons.search_rounded),
                      suffixIcon: (query ?? '').isEmpty
                          ? null
                          : IconButton(
                              tooltip: 'Clear search',
                              onPressed: () => setState(() {
                                search.clear();
                                query = '';
                              }),
                              icon: const Icon(Icons.close_rounded),
                            ),
                      isDense: true,
                      filled: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(28), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final f in ['All', 'Unread', 'Groups'])
                        ChoiceChip(
                          label: Text(f == 'Unread' && unreadCount > 0 ? 'Unread $unreadCount' : f),
                          selected: filter == f,
                          onSelected: (_) => setState(() => filter = f),
                          selectedColor: _accent(context).withValues(alpha: .16),
                          showCheckmark: false,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            if (loading)
              const SliverFillRemaining(hasScrollBody: false, child: Center(child: CircularProgressIndicator()))
            else if (error != null && items.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _Empty(
                  icon: Icons.wifi_off_rounded,
                  title: 'Chats are not available',
                  message: error!,
                  action: ('Try again', load),
                ),
              )
            else if (visible.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: items.isEmpty
                    ? _Empty(
                        icon: Icons.forum_outlined,
                        title: 'No chats yet',
                        message: 'Start a conversation with your teachers, students or parents.',
                        action: ('Start a chat', startChat),
                      )
                    : const _Empty(
                        icon: Icons.search_off_rounded,
                        title: 'Nothing here',
                        message: 'No chats match this view.',
                      ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.only(bottom: 96),
                sliver: SliverList.separated(
                  itemCount: visible.length,
                  separatorBuilder: (_, _) => const Divider(height: 1, indent: 80),
                  itemBuilder: (context, i) => _ConversationTile(
                    item: visible[i],
                    onTap: () => openConversation('${visible[i]['code']}', summary: visible[i]),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.icon, required this.title, required this.message, this.action});
  final IconData icon;
  final String title, message;
  final (String, Future<void> Function())? action;
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(color: _accent(context).withValues(alpha: .1), shape: BoxShape.circle),
            child: Icon(icon, size: 36, color: _accent(context)),
          ),
          const SizedBox(height: 14),
          Text(
            title,
            style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            message,
            style: text.bodyMedium?.copyWith(color: collegeMuted),
            textAlign: TextAlign.center,
          ),
          if (action != null) ...[
            const SizedBox(height: 16),
            FilledButton(onPressed: action!.$2, child: Text(action!.$1)),
          ],
        ],
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({required this.item, required this.onTap});
  final Json item;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final unread = (item['unread'] as num?)?.toInt() ?? 0;
    final title = '${item['title'] ?? ''}';
    final last = '${item['last_message'] ?? ''}';
    final sender = '${item['last_sender'] ?? ''}';
    final preview = last.isEmpty ? '${item['subtitle'] ?? ''}' : (sender.isNotEmpty ? '$sender: $last' : last);
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            ChatAvatar(name: title, role: '${item['role'] ?? ''}', size: 52),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: text.titleSmall?.copyWith(fontWeight: unread > 0 ? FontWeight.w800 : FontWeight.w700),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _listTime(_time(item['last_at'])),
                        style: text.labelSmall?.copyWith(
                          color: unread > 0 ? _accent(context) : collegeMuted,
                          fontWeight: unread > 0 ? FontWeight.w800 : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      if (item['last_mine'] == true && sender.isEmpty) ...[
                        const Icon(Icons.done_all_rounded, size: 16, color: collegeMuted),
                        const SizedBox(width: 3),
                      ],
                      Expanded(
                        child: Text(
                          preview,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: text.bodyMedium?.copyWith(color: unread > 0 ? collegeEspresso : collegeMuted),
                        ),
                      ),
                      if (unread > 0)
                        Container(
                          margin: const EdgeInsets.only(left: 8),
                          constraints: const BoxConstraints(minWidth: 22),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: _accent(context), borderRadius: BorderRadius.circular(12)),
                          child: Text(
                            unread > 99 ? '99+' : '$unread',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---- New chat -----------------------------------------------------------------------------------
class NewChatScreen extends StatefulWidget {
  const NewChatScreen({super.key, required this.api, this.canGroup = false});
  final CollegeApi api;
  final bool canGroup;
  @override
  State<NewChatScreen> createState() => _NewChatScreenState();
}

class _NewChatScreenState extends State<NewChatScreen> {
  late final chat = ChatApi(widget.api);
  List<Json> people = [];
  String role = '', side = '';
  bool loading = true, opening = false;
  String? error;
  Timer? debounce;
  final search = TextEditingController();

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    debounce?.cancel();
    search.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final r = await chat.directory(q: search.text.trim(), role: role);
      if (!mounted) return;
      setState(() {
        people = (r['items'] as List? ?? []).cast<Json>();
        side = '${r['side'] ?? ''}';
        loading = false;
        error = null;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          loading = false;
          error = e is ApiException ? e.message : 'Could not load contacts.';
        });
      }
    }
  }

  Future<void> start(String account) async {
    if (opening) return;
    setState(() => opening = true);
    try {
      final c = await chat.direct(account);
      if (mounted) Navigator.of(context).pop(c);
    } catch (e) {
      if (mounted) _toast(context, e);
    } finally {
      if (mounted) setState(() => opening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final family = side == 'student' || side == 'parent';
    final roles = family
        ? <(String, String)>[]
        : [
            ('', 'Everyone'),
            ('teacher', 'Teachers'),
            ('staff', 'Staff'),
            ('student', 'Students'),
            ('parent', 'Parents'),
          ];
    return Scaffold(
      appBar: AppBar(title: const Text('New chat')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: search,
              autofocus: false,
              onChanged: (_) {
                debounce?.cancel();
                debounce = Timer(const Duration(milliseconds: 350), load);
              },
              decoration: InputDecoration(
                hintText: family ? 'Search teachers' : 'Search name, roll no., admission no. or phone',
                prefixIcon: const Icon(Icons.search_rounded),
                isDense: true,
                filled: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(28), borderSide: BorderSide.none),
              ),
            ),
          ),
          if (roles.isNotEmpty)
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  for (final r in roles)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(r.$2),
                        selected: role == r.$1,
                        showCheckmark: false,
                        selectedColor: _accent(context).withValues(alpha: .16),
                        onSelected: (_) {
                          setState(() => role = r.$1);
                          load();
                        },
                      ),
                    ),
                ],
              ),
            ),
          if (widget.canGroup)
            ListTile(
              leading: CircleAvatar(
                backgroundColor: _accent(context),
                foregroundColor: Colors.white,
                child: Icon(Icons.group_add_rounded),
              ),
              title: const Text('New group', style: TextStyle(fontWeight: FontWeight.w700)),
              subtitle: const Text('A course, branch, academic year or section'),
              onTap: () async {
                final made = await showModalBottomSheet<Json>(
                  context: context,
                  isScrollControlled: true,
                  showDragHandle: true,
                  builder: (_) => NewGroupSheet(api: widget.api),
                );
                if (made != null && context.mounted) Navigator.of(context).pop(made);
              },
            ),
          if (opening) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error != null
                ? _Empty(
                    icon: Icons.wifi_off_rounded,
                    title: 'Contacts are not available',
                    message: error!,
                    action: ('Try again', load),
                  )
                : people.isEmpty
                ? _Empty(
                    icon: Icons.person_search_rounded,
                    title: 'Nobody found',
                    message: family
                        ? 'Your class teachers appear here once their app login is ready.'
                        : 'Try another name, admission number or phone number.',
                  )
                : ListView.builder(
                    padding: const EdgeInsets.only(bottom: 24),
                    itemCount: people.length,
                    itemBuilder: (context, i) {
                      final p = people[i];
                      final parents = (p['parents'] as List? ?? []).cast<Json>();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ListTile(
                            leading: ChatAvatar(name: '${p['name']}', role: '${p['role']}', size: 44),
                            title: Text('${p['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Text('${p['detail'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis),
                            trailing: Icon(Icons.chat_bubble_outline_rounded, color: _accent(context)),
                            onTap: () => start('${p['code']}'),
                          ),
                          for (final parent in parents)
                            Padding(
                              padding: const EdgeInsets.only(left: 56),
                              child: ListTile(
                                dense: true,
                                enabled: parent['can_chat'] == true,
                                leading: ChatAvatar(name: '${parent['name']}', role: 'parent', size: 34),
                                title: Text(
                                  '${parent['name']}',
                                  style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                                ),
                                subtitle: Text(
                                  '${parent['relationship'] ?? 'Parent'}${parent['can_chat'] == true ? '' : ' · no app login yet'}',
                                ),
                                trailing: parent['can_chat'] == true
                                    ? Icon(Icons.chat_bubble_outline_rounded, color: _accent(context), size: 20)
                                    : null,
                                onTap: parent['can_chat'] == true ? () => start('${parent['code']}') : null,
                              ),
                            ),
                        ],
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

/// Staff: open a group for a course, branch, academic year or section.
class NewGroupSheet extends StatefulWidget {
  const NewGroupSheet({super.key, required this.api});
  final CollegeApi api;
  @override
  State<NewGroupSheet> createState() => _NewGroupSheetState();
}

class _NewGroupSheetState extends State<NewGroupSheet> {
  late final chat = ChatApi(widget.api);
  Json? options;
  String? level, program, year, section;
  String audience = 'both';
  bool replies = false, teachers = true, saving = false;
  final title = TextEditingController();

  @override
  void initState() {
    super.initState();
    chat
        .options()
        .then((r) {
          if (mounted) setState(() => options = r);
        })
        .catchError((Object e) {
          if (mounted) {
            _toast(context, e);
            Navigator.of(context).pop();
          }
        });
  }

  @override
  void dispose() {
    title.dispose();
    super.dispose();
  }

  List<Json> list(String key) => (options?[key] as List? ?? []).cast<Json>();

  Future<void> create() async {
    setState(() => saving = true);
    try {
      final made = await chat.group({
        'title': title.text.trim(),
        'course_level': ?level,
        'program_code': ?program,
        'academic_year_code': ?year,
        'section_code': ?section,
        'audience': audience,
        'include_teachers': teachers,
        'allow_replies': replies,
      });
      if (mounted) Navigator.of(context).pop(made);
    } catch (e) {
      if (mounted) _toast(context, e);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Widget picker(String label, String? value, List<(String, String)> items, ValueChanged<String?> changed) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: DropdownButtonFormField<String?>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      items: [
        const DropdownMenuItem<String?>(value: null, child: Text('Any')),
        for (final i in items)
          DropdownMenuItem<String?>(
            value: i.$1,
            child: Text(i.$2, overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: changed,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final programs = list('programs').where((p) => level == null || p['course_level'] == level);
    final years = list('academic_years').where((y) => program == null || y['program_code'] == program);
    final sections = list('sections').where(
      (s) =>
          (level == null || s['course_level'] == level) &&
          (program == null || s['program_code'] == program) &&
          (year == null || s['academic_year_code'] == year),
    );
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: options == null
            ? const SizedBox(height: 220, child: Center(child: CircularProgressIndicator()))
            : SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('New group', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(
                      'Everyone matching your choice joins. Only staff can post unless you allow replies.',
                      style: text.bodySmall?.copyWith(color: collegeMuted),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: title,
                      decoration: const InputDecoration(
                        labelText: 'Group name (optional)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (list('course_levels').isNotEmpty)
                      picker(
                        'Course',
                        level,
                        [for (final l in list('course_levels')) ('$l', '$l')],
                        (v) => setState(() {
                          level = v;
                          program = year = section = null;
                        }),
                      ),
                    picker(
                      'Branch / specialisation',
                      program,
                      [for (final p in programs) ('${p['code']}', '${p['name']}')],
                      (v) => setState(() {
                        program = v;
                        year = section = null;
                      }),
                    ),
                    picker(
                      'Academic year',
                      year,
                      [for (final y in years) ('${y['code']}', '${y['name']}')],
                      (v) => setState(() {
                        year = v;
                        section = null;
                      }),
                    ),
                    picker('Section', section, [
                      for (final s in sections) ('${s['code']}', '${s['label']}'),
                    ], (v) => setState(() => section = v)),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'students', label: Text('Students')),
                        ButtonSegment(value: 'parents', label: Text('Parents')),
                        ButtonSegment(value: 'both', label: Text('Both')),
                      ],
                      selected: {audience},
                      onSelectionChanged: (v) => setState(() => audience = v.first),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      value: teachers,
                      onChanged: (v) => setState(() => teachers = v),
                      title: const Text('Add their teachers'),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      value: replies,
                      onChanged: (v) => setState(() => replies = v),
                      title: const Text('Members can reply'),
                      subtitle: const Text('Off: an announcement group where only staff post'),
                    ),
                    const SizedBox(height: 8),
                    FilledButton.icon(
                      onPressed: saving || (level ?? program ?? year ?? section) == null ? null : create,
                      icon: saving
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.group_add_rounded),
                      label: const Text('Create group'),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}

// ---- Conversation -------------------------------------------------------------------------------
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.api, required this.code, this.summary});
  final CollegeApi api;
  final String code;
  final Json? summary;
  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with WidgetsBindingObserver {
  late final chat = ChatApi(widget.api);
  late Json info = {...?widget.summary};
  final List<Json> messages = [];
  final input = TextEditingController();
  final scroll = ScrollController();
  AudioRecorder? _recorder;
  AudioRecorder get recorder => _recorder ??= AudioRecorder(); // created on the first mic tap
  final picker = ImagePicker();
  bool loading = true, older = false, hasMore = false, recording = false;
  String? error;
  Timer? poll, recordTimer;
  Duration recorded = Duration.zero;
  int sequence = 0;

  bool get canPost => info['can_post'] != false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    PushNotifications.activeThread = widget.code; // no notification for the chat on screen
    input.addListener(() => setState(() {}));
    scroll.addListener(() {
      if (scroll.position.pixels > scroll.position.maxScrollExtent - 200) loadOlder();
    });
    chat
        .conversation(widget.code)
        .then((r) {
          if (mounted) setState(() => info = r);
        })
        .catchError((_) {});
    load();
    poll = Timer.periodic(const Duration(seconds: 4), (_) => refresh());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    if (PushNotifications.activeThread == widget.code) PushNotifications.activeThread = null;
    poll?.cancel();
    recordTimer?.cancel();
    _recorder?.dispose();
    input.dispose();
    scroll.dispose();
    super.dispose();
  }

  String? get newest => messages
      .where((m) => m['pending'] != true)
      .map((m) => '${m['sent_at']}')
      .fold<String?>(null, (a, b) => a == null || b.compareTo(a) > 0 ? b : a);

  Future<void> load() async {
    try {
      final r = await chat.messages(widget.code);
      if (!mounted) return;
      setState(() {
        messages
          ..clear()
          ..addAll((r['items'] as List? ?? []).cast<Json>());
        hasMore = r['has_more'] == true;
        loading = false;
        error = null;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          loading = false;
          error = e is ApiException ? e.message : 'Could not open this chat.';
        });
      }
    }
  }

  Future<void> refresh() async {
    if (loading || !mounted) return;
    try {
      // New messages, plus fresh read ticks on the latest ones.
      final latest = messages.where((m) => m['pending'] != true).toList();
      final since = latest.length > 30 ? '${latest[latest.length - 30]['sent_at']}' : null;
      final r = await chat.messages(widget.code, after: since);
      if (!mounted) return;
      final fresh = (r['items'] as List? ?? []).cast<Json>();
      setState(() {
        for (final m in fresh) {
          final i = messages.indexWhere(
            (x) => x['code'] == m['code'] || (x['client_id'] != null && x['client_id'] == m['client_id']),
          );
          if (i >= 0) {
            messages[i] = m;
          } else {
            messages.add(m);
          }
        }
        messages.sort(
          (a, b) => a['pending'] == true
              ? 1
              : b['pending'] == true
              ? -1
              : '${a['sent_at']}'.compareTo('${b['sent_at']}'),
        );
      });
    } catch (_) {
      /* Polling retries on the next tick. */
    }
  }

  Future<void> loadOlder() async {
    if (older || !hasMore || messages.isEmpty) return;
    older = true;
    try {
      final r = await chat.messages(widget.code, before: '${messages.first['sent_at']}');
      if (!mounted) return;
      setState(() {
        messages.insertAll(0, (r['items'] as List? ?? []).cast<Json>());
        hasMore = r['has_more'] == true;
      });
    } catch (_) {
    } finally {
      older = false;
    }
  }

  /// Sends a message optimistically; [upload] produces the attachment code first.
  Future<void> deliver({
    String body = '',
    Future<String> Function()? upload,
    Json? attachment,
    int? durationMs,
    String kind = 'text',
    Uint8List? local,
  }) async {
    final clientId = 'm${DateTime.now().microsecondsSinceEpoch}-${sequence++}';
    final pending = <String, dynamic>{
      'code': clientId,
      'client_id': clientId,
      'body': body,
      'kind': kind,
      'mine': true,
      'pending': true,
      'sent_at': DateTime.now().toUtc().toIso8601String(),
      'attachment': attachment,
      'upload': upload,
      'duration_ms': durationMs,
      'local': ?local,
    };
    setState(() => messages.add(pending));
    if (scroll.hasClients) scroll.animateTo(0, duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
    await _push(pending);
  }

  Future<void> _push(Json pending) async {
    setState(() => pending['failed'] = false);
    try {
      String? code = pending['attachment_code'] as String?;
      final upload = pending['upload'] as Future<String> Function()?;
      if (code == null && upload != null) {
        code = await upload();
        pending['attachment_code'] = code;
      }
      final sent = await chat.send(
        widget.code,
        body: '${pending['body']}',
        attachment: code,
        durationMs: pending['duration_ms'] as int?,
        clientId: '${pending['client_id']}',
      );
      if (!mounted) return;
      setState(() {
        final i = messages.indexOf(pending);
        if (i >= 0) messages[i] = {...sent, if (pending['local'] != null) 'local': pending['local']};
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => pending['failed'] = true);
      _toast(context, e);
    }
  }

  void sendText() {
    final body = input.text.trim();
    if (body.isEmpty) return;
    input.clear();
    deliver(body: body);
  }

  Future<void> attach() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              for (final (key, icon, label, color) in [
                ('camera', Icons.photo_camera_rounded, 'Camera', collegeClayInk),
                ('gallery', Icons.photo_library_rounded, 'Gallery', const Color(0xff6b5b95)),
                ('pdf', Icons.picture_as_pdf_rounded, 'Document', const Color(0xff2f6f8f)),
              ])
                InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => Navigator.pop(sheet, key),
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircleAvatar(
                          radius: 28,
                          backgroundColor: color,
                          foregroundColor: Colors.white,
                          child: Icon(icon),
                        ),
                        const SizedBox(height: 6),
                        Text(label),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
    if (choice == null || !mounted) return;
    try {
      Uint8List? bytes;
      String name = '';
      String kind = 'image';
      if (choice == 'pdf') {
        final file = await openFile(
          acceptedTypeGroups: const [
            XTypeGroup(
              label: 'PDF',
              extensions: ['pdf'],
              mimeTypes: ['application/pdf'],
              uniformTypeIdentifiers: ['com.adobe.pdf'],
            ),
          ],
        );
        if (file == null) return;
        bytes = await file.readAsBytes();
        name = file.name;
        kind = 'pdf';
      } else {
        final file = await picker.pickImage(
          source: choice == 'camera' ? ImageSource.camera : ImageSource.gallery,
          imageQuality: 80,
          maxWidth: 1800,
        );
        if (file == null) return;
        bytes = await file.readAsBytes();
        name = file.name.toLowerCase().endsWith('.heic') ? 'photo.jpg' : file.name;
      }
      if (bytes.length > 10 * 1024 * 1024) {
        if (mounted) _toast(context, 'Choose a file up to 10 MB.');
        return;
      }
      if (!mounted) return;
      final caption = kind == 'image' ? await _captionFor(bytes) : '';
      if (caption == null) return;
      final data = bytes;
      await deliver(
        body: caption,
        kind: kind,
        attachment: {'name': name, 'size': data.length},
        local: kind == 'image' ? data : null,
        upload: () => chat.upload(widget.code, name, data),
      );
    } catch (e) {
      if (mounted) _toast(context, e);
    }
  }

  /// Photo preview with an optional caption; null = cancelled.
  Future<String?> _captionFor(Uint8List bytes) => showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.black,
    builder: (sheet) {
      final caption = TextEditingController();
      return Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(sheet).bottom),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Align(
                alignment: Alignment.topLeft,
                child: IconButton(
                  tooltip: 'Cancel',
                  color: Colors.white,
                  onPressed: () => Navigator.pop(sheet),
                  icon: const Icon(Icons.close_rounded),
                ),
              ),
              ConstrainedBox(
                constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(sheet).height * .6),
                child: Image.memory(bytes, fit: BoxFit.contain),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: caption,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          hintText: 'Add a caption…',
                          hintStyle: const TextStyle(color: Colors.white60),
                          filled: true,
                          fillColor: Colors.white12,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(28),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      tooltip: 'Send photo',
                      style: IconButton.styleFrom(backgroundColor: _accent(context)),
                      onPressed: () => Navigator.pop(sheet, caption.text.trim()),
                      icon: const Icon(Icons.send_rounded),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    },
  );

  Future<void> startRecording() async {
    try {
      if (!await recorder.hasPermission()) {
        if (mounted) _toast(context, 'Allow microphone access in Settings to send voice messages.');
        return;
      }
      final dir = await getTemporaryDirectory();
      await recorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 64000, sampleRate: 44100, numChannels: 1),
        path: '${dir.path}/voice-${DateTime.now().millisecondsSinceEpoch}.m4a',
      );
      HapticFeedback.mediumImpact();
      setState(() {
        recording = true;
        recorded = Duration.zero;
      });
      recordTimer = Timer.periodic(const Duration(seconds: 1), (t) {
        if (!mounted) return;
        setState(() => recorded += const Duration(seconds: 1));
        if (recorded.inMinutes >= 10) stopRecording(send: true);
      });
    } catch (e) {
      if (mounted) _toast(context, 'Recording is not available on this device.');
    }
  }

  Future<void> stopRecording({required bool send}) async {
    recordTimer?.cancel();
    final length = recorded;
    setState(() => recording = false);
    try {
      if (!send) {
        await recorder.cancel();
        return;
      }
      final path = await recorder.stop();
      if (path == null || length.inMilliseconds < 800) {
        if (mounted) _toast(context, 'Hold on a little longer to record a voice message.');
        return;
      }
      final bytes = await File(path).readAsBytes();
      await deliver(
        kind: 'audio',
        durationMs: length.inMilliseconds,
        attachment: {'name': 'voice.m4a', 'size': bytes.length, 'duration_ms': length.inMilliseconds},
        upload: () => chat.upload(widget.code, 'voice.m4a', bytes),
      );
    } catch (e) {
      if (mounted) _toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final title = '${info['title'] ?? 'Chat'}';
    final group = info['kind'] == 'group';
    final reversed = messages.reversed.toList();
    return Scaffold(
      backgroundColor: _chatBackdrop,
      appBar: AppBar(
        titleSpacing: 0,
        title: InkWell(
          onTap: group ? showMembers : null,
          child: Row(
            children: [
              ChatAvatar(name: title, role: '${info['role'] ?? (group ? 'group' : '')}', size: 38),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      group ? '${info['members'] ?? ''} members · tap for details' : '${info['subtitle'] ?? ''}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.bodySmall?.copyWith(color: collegeMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: loading
                  ? const Center(child: CircularProgressIndicator())
                  : error != null
                  ? _Empty(
                      icon: Icons.lock_outline_rounded,
                      title: 'Chat unavailable',
                      message: error!,
                      action: ('Try again', load),
                    )
                  : messages.isEmpty
                  ? _Empty(
                      icon: Icons.waving_hand_rounded,
                      title: 'Say hello',
                      message: canPost
                          ? 'Send a message, photo, PDF or voice note.'
                          : 'Messages from staff will appear here.',
                    )
                  : ListView.builder(
                      controller: scroll,
                      reverse: true,
                      padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
                      itemCount: reversed.length,
                      itemBuilder: (context, i) {
                        final m = reversed[i];
                        final t = _time(m['sent_at']) ?? DateTime.now();
                        final older = i + 1 < reversed.length ? _time(reversed[i + 1]['sent_at']) : null;
                        final newDay = older == null || !DateUtils.isSameDay(older, t);
                        final sameSender =
                            i + 1 < reversed.length && !newDay && reversed[i + 1]['sender_code'] == m['sender_code'];
                        return Column(
                          children: [
                            if (newDay) _DayChip(label: _dayLabel(t)),
                            _Bubble(
                              message: m,
                              chat: chat,
                              group: group,
                              showName: group && m['mine'] != true && !sameSender,
                              onRetry: m['failed'] == true ? () => _push(m) : null,
                            ),
                          ],
                        );
                      },
                    ),
            ),
            if (canPost) composer(context) else readOnlyBar(context),
          ],
        ),
      ),
    );
  }

  Future<void> showMembers() async {
    final people = (info['people'] as List? ?? []).cast<Json>();
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheet) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: .6,
        builder: (_, controller) => ListView(
          controller: controller,
          children: [
            ListTile(
              title: Text(
                '${info['title']}',
                style: Theme.of(sheet).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              subtitle: Text('${info['subtitle'] ?? ''}'),
            ),
            for (final p in people)
              ListTile(
                leading: ChatAvatar(name: '${p['name']}', role: '${p['role']}', size: 40),
                title: Text('${p['name']}'),
                subtitle: Text('${p['detail'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
          ],
        ),
      ),
    );
  }

  Widget readOnlyBar(BuildContext context) => Container(
    width: double.infinity,
    color: Colors.white,
    padding: const EdgeInsets.all(14),
    child: Text(
      'Only staff can send messages in this group.',
      textAlign: TextAlign.center,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: collegeMuted),
    ),
  );

  Widget composer(BuildContext context) {
    final typing = input.text.trim().isNotEmpty;
    if (recording) {
      return Container(
        color: Colors.white,
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
        child: Row(
          children: [
            IconButton(
              tooltip: 'Discard recording',
              onPressed: () => stopRecording(send: false),
              icon: const Icon(Icons.delete_outline_rounded, color: collegeError),
            ),
            const _Pulse(),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Recording  ${_duration(recorded)}',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            IconButton.filled(
              tooltip: 'Send voice message',
              style: IconButton.styleFrom(backgroundColor: _accent(context), minimumSize: const Size(48, 48)),
              onPressed: () => stopRecording(send: true),
              icon: const Icon(Icons.send_rounded),
            ),
          ],
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(26),
                boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 6, offset: Offset(0, 1))],
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    tooltip: 'Attach photo or PDF',
                    onPressed: attach,
                    icon: const Icon(Icons.attach_file_rounded, color: collegeMuted),
                  ),
                  Expanded(
                    child: TextField(
                      controller: input,
                      minLines: 1,
                      maxLines: 5,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(
                        hintText: 'Message',
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        filled: false,
                        contentPadding: EdgeInsets.symmetric(vertical: 13),
                      ),
                    ),
                  ),
                  if (!typing)
                    IconButton(
                      tooltip: 'Take photo',
                      onPressed: () async {
                        final file = await picker.pickImage(
                          source: ImageSource.camera,
                          imageQuality: 80,
                          maxWidth: 1800,
                        );
                        if (file == null || !mounted) return;
                        final bytes = await file.readAsBytes();
                        final caption = await _captionFor(bytes);
                        if (caption == null) return;
                        final name = file.name.toLowerCase().endsWith('.heic') ? 'photo.jpg' : file.name;
                        await deliver(
                          body: caption,
                          kind: 'image',
                          attachment: {'name': name, 'size': bytes.length},
                          local: bytes,
                          upload: () => chat.upload(widget.code, name, bytes),
                        );
                      },
                      icon: const Icon(Icons.photo_camera_outlined, color: collegeMuted),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 6),
          IconButton.filled(
            tooltip: typing ? 'Send' : 'Record voice message',
            style: IconButton.styleFrom(
              backgroundColor: _accent(context),
              foregroundColor: Colors.white,
              minimumSize: const Size(50, 50),
            ),
            onPressed: typing ? sendText : startRecording,
            icon: Icon(typing ? Icons.send_rounded : Icons.mic_rounded),
          ),
        ],
      ),
    );
  }
}

class _Pulse extends StatefulWidget {
  const _Pulse();
  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);
  @override
  void dispose() {
    c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: Tween(begin: .3, end: 1.0).animate(c),
    child: Container(
      width: 12,
      height: 12,
      decoration: const BoxDecoration(color: collegeError, shape: BoxShape.circle),
    ),
  );
}

class _DayChip extends StatelessWidget {
  const _DayChip({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: .9), borderRadius: BorderRadius.circular(10)),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(color: collegeMuted, fontWeight: FontWeight.w700),
      ),
    ),
  );
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.chat, required this.group, required this.showName, this.onRetry});
  final Json message;
  final ChatApi chat;
  final bool group, showName;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final mine = message['mine'] == true;
    final kind = '${message['kind'] ?? 'text'}';
    final body = '${message['body'] ?? ''}';
    final attachment = (message['attachment'] as Map?)?.cast<String, dynamic>();
    final time = _time(message['sent_at']);
    final pending = message['pending'] == true;
    final failed = message['failed'] == true;
    final width = MediaQuery.sizeOf(context).width;
    final status = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (time != null) Text(_clock(time), style: text.labelSmall?.copyWith(color: collegeMuted, fontSize: 11)),
        if (mine) ...[
          const SizedBox(width: 3),
          Icon(
            failed
                ? Icons.error_outline_rounded
                : pending
                ? Icons.schedule_rounded
                : message['status'] == 'read'
                ? Icons.done_all_rounded
                : Icons.done_all_rounded,
            size: 15,
            color: failed
                ? collegeError
                : message['status'] == 'read'
                ? _accent(context)
                : collegeMuted,
            semanticLabel: failed
                ? 'Not sent'
                : pending
                ? 'Sending'
                : message['status'] == 'read'
                ? 'Read'
                : 'Delivered',
          ),
        ],
      ],
    );
    Widget content;
    if (kind == 'image' && attachment != null) {
      content = _ImageAttachment(
        chat: chat,
        attachment: attachment,
        local: message['local'] as Uint8List?,
        caption: body,
      );
    } else if (kind == 'pdf' && attachment != null) {
      content = _PdfAttachment(chat: chat, attachment: attachment, mine: mine);
    } else if (kind == 'audio' && attachment != null) {
      content = _VoiceNote(
        chat: chat,
        attachment: attachment,
        mine: mine,
        durationMs: (message['duration_ms'] ?? attachment['duration_ms']) as int?,
      );
    } else {
      content = const SizedBox.shrink();
    }
    final showBody = body.isNotEmpty && kind != 'image';
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onTap: onRetry,
        onLongPress: body.isEmpty
            ? null
            : () {
                Clipboard.setData(ClipboardData(text: body));
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Message copied')));
              },
        child: Container(
          margin: EdgeInsets.only(top: showName ? 8 : 2, bottom: 2, left: mine ? 48 : 0, right: mine ? 0 : 48),
          constraints: BoxConstraints(maxWidth: math.min(width * .78, 460)),
          padding: const EdgeInsets.fromLTRB(10, 7, 10, 6),
          decoration: BoxDecoration(
            color: mine ? _bubbleMine(context) : _bubbleTheirs,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(mine ? 16 : 4),
              bottomRight: Radius.circular(mine ? 4 : 16),
            ),
            boxShadow: const [BoxShadow(color: Color(0x12000000), blurRadius: 3, offset: Offset(0, 1))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (showName)
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Text(
                    '${message['sender_name'] ?? ''}',
                    style: text.labelMedium?.copyWith(
                      color: _roleColor('${message['sender_role']}'),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              if (attachment != null) content,
              if (showBody)
                Padding(
                  padding: EdgeInsets.only(top: attachment != null ? 6 : 0),
                  child: Text(body, style: text.bodyLarge?.copyWith(height: 1.3)),
                ),
              const SizedBox(height: 2),
              Align(alignment: Alignment.bottomRight, child: status),
              if (failed)
                Text(
                  'Tap to retry',
                  style: text.labelSmall?.copyWith(color: collegeError, fontWeight: FontWeight.w700),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ImageAttachment extends StatelessWidget {
  const _ImageAttachment({required this.chat, required this.attachment, this.local, this.caption = ''});
  final ChatApi chat;
  final Json attachment;
  final Uint8List? local;
  final String caption;
  @override
  Widget build(BuildContext context) {
    final code = attachment['code'] as String?;
    Widget image(Uint8List bytes) => GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => Scaffold(
            backgroundColor: Colors.black,
            appBar: AppBar(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              title: Text(caption.isEmpty ? 'Photo' : caption),
            ),
            body: InteractiveViewer(
              maxScale: 5,
              child: Center(child: Image.memory(bytes, fit: BoxFit.contain)),
            ),
          ),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.memory(
          bytes,
          width: 240,
          height: 240,
          fit: BoxFit.cover,
          semanticLabel: caption.isEmpty ? 'Photo' : caption,
        ),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (local != null)
          image(local!)
        else if (code != null)
          FutureBuilder<Uint8List>(
            future: chat.file(code),
            builder: (context, s) => s.hasData
                ? image(s.data!)
                : Container(
                    width: 240,
                    height: 240,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: collegeCanvas, borderRadius: BorderRadius.circular(12)),
                    child: s.hasError
                        ? const Icon(Icons.broken_image_outlined, color: collegeMuted)
                        : const CircularProgressIndicator(),
                  ),
          )
        else
          Container(
            width: 240,
            height: 180,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: collegeCanvas, borderRadius: BorderRadius.circular(12)),
            child: const CircularProgressIndicator(),
          ),
        if (caption.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(caption, style: Theme.of(context).textTheme.bodyLarge),
          ),
      ],
    );
  }
}

String _size(dynamic bytes) {
  final b = (bytes as num?)?.toInt() ?? 0;
  if (b >= 1024 * 1024) return '${(b / 1024 / 1024).toStringAsFixed(1)} MB';
  return '${math.max(1, (b / 1024).round())} KB';
}

class _PdfAttachment extends StatelessWidget {
  const _PdfAttachment({required this.chat, required this.attachment, required this.mine});
  final ChatApi chat;
  final Json attachment;
  final bool mine;
  @override
  Widget build(BuildContext context) {
    final name = '${attachment['name'] ?? 'Document.pdf'}';
    final code = attachment['code'] as String?;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: code == null
          ? null
          : () async {
              try {
                final bytes = await chat.file(code);
                if (!context.mounted) return;
                await Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => Scaffold(
                      appBar: AppBar(title: Text(name)),
                      body: PdfViewer.data(bytes, sourceName: name),
                    ),
                  ),
                );
              } catch (e) {
                if (context.mounted) _toast(context, e);
              }
            },
      child: Container(
        width: 250,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: (mine ? Colors.white : collegeCanvas).withValues(alpha: .7),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: collegeError, borderRadius: BorderRadius.circular(6)),
              child: const Text(
                'PDF',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    code == null ? 'Uploading…' : '${_size(attachment['size'])} · Tap to open',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: collegeMuted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VoiceNote extends StatefulWidget {
  const _VoiceNote({required this.chat, required this.attachment, required this.mine, this.durationMs});
  final ChatApi chat;
  final Json attachment;
  final bool mine;
  final int? durationMs;
  @override
  State<_VoiceNote> createState() => _VoiceNoteState();
}

class _VoiceNoteState extends State<_VoiceNote> {
  final player = AudioPlayer();
  Duration position = Duration.zero, total = Duration.zero;
  bool playing = false, loading = false;
  String? path;
  final subs = <StreamSubscription<dynamic>>[];

  @override
  void initState() {
    super.initState();
    total = Duration(milliseconds: widget.durationMs ?? 0);
    subs
      ..add(player.onPositionChanged.listen((p) => mounted ? setState(() => position = p) : null))
      ..add(player.onDurationChanged.listen((d) => mounted && d > Duration.zero ? setState(() => total = d) : null))
      ..add(
        player.onPlayerComplete.listen(
          (_) => mounted
              ? setState(() {
                  playing = false;
                  position = Duration.zero;
                })
              : null,
        ),
      );
  }

  @override
  void dispose() {
    for (final s in subs) {
      s.cancel();
    }
    player.dispose();
    super.dispose();
  }

  Future<void> toggle() async {
    final code = widget.attachment['code'] as String?;
    if (code == null) return;
    if (playing) {
      await player.pause();
      setState(() => playing = false);
      return;
    }
    try {
      if (path == null) {
        setState(() => loading = true);
        final bytes = await widget.chat.file(code);
        final dir = await getTemporaryDirectory();
        final mime = '${widget.attachment['mime'] ?? 'audio/mp4'}';
        final ext = mime.contains('webm')
            ? 'webm'
            : mime.contains('ogg')
            ? 'ogg'
            : mime.contains('mpeg')
            ? 'mp3'
            : mime.contains('wav')
            ? 'wav'
            : 'm4a';
        final file = File('${dir.path}/chat-$code.$ext');
        await file.writeAsBytes(bytes, flush: true);
        path = file.path;
        await player.play(DeviceFileSource(path!));
      } else {
        await player.resume();
      }
      if (mounted) {
        setState(() {
          playing = true;
          loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => loading = false);
        _toast(context, 'This voice message could not be played.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final max = total.inMilliseconds > 0 ? total.inMilliseconds.toDouble() : 1.0;
    final ready = widget.attachment['code'] != null;
    return SizedBox(
      width: 250,
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: widget.mine ? _accent(context) : collegeCaramel,
            foregroundColor: Colors.white,
            child: const Icon(Icons.mic_rounded, size: 20),
          ),
          IconButton(
            tooltip: playing ? 'Pause' : 'Play voice message',
            onPressed: ready && !loading ? toggle : null,
            icon: loading
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                : Icon(playing ? Icons.pause_rounded : Icons.play_arrow_rounded, size: 30, color: collegeEspresso),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 3,
                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                    overlayShape: SliderComponentShape.noOverlay,
                  ),
                  child: Slider(
                    value: position.inMilliseconds.clamp(0, max.toInt()).toDouble(),
                    max: max,
                    activeColor: _accent(context),
                    inactiveColor: collegeLine,
                    onChanged: path == null ? null : (v) => player.seek(Duration(milliseconds: v.toInt())),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _duration(playing || position > Duration.zero ? position : total),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(color: collegeMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
