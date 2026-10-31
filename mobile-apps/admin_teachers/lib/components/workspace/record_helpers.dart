part of '../../app/edunexa_client.dart';

List<Json> _asRows(dynamic value) => (value as List? ?? [])
    .map((e) => Map<String, dynamic>.from(e as Map))
    .toList();
String _asText(dynamic value) => value == null ? '' : value.toString();
String _asDate(dynamic value) {
  final date = DateTime.tryParse(_asText(value))?.toLocal();
  if (date == null) return '—';
  return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
}

Future<Json> _asUpload(CollegeApi api, XFile file, {String? assignment, bool resource = false, bool assessment = false, bool event = false}) async {
  final size = await file.length();
  if (size == 0 || size > 10 * 1024 * 1024) {
    throw const FormatException('Choose files up to 10 MB each.');
  }
  final started = Map<String, dynamic>.from(
    await api.startFileUpload(
          filename: file.name,
          sizeBytes: size,
          assignmentCode: assignment,
          resource: resource,
          assessment: assessment,
          event: event,
        )
        as Map,
  );
  final bytes = await file.readAsBytes();
  final chunkSize = started['chunk_size'] as int;
  for (int offset = 0, index = 0; offset < size; offset += chunkSize, index++) {
    final end = (offset + chunkSize).clamp(0, size);
    await api.uploadFileChunk(
      _asText(started['code']),
      index,
      base64Encode(bytes.sublist(offset, end)),
    );
  }
  return Map<String, dynamic>.from(
    await api.finishFileUpload(_asText(started['code']))
        as Map,
  );
}

Future<List<XFile>> _asPickFiles() async {
  final files = await openFiles(
    acceptedTypeGroups: [
      const XTypeGroup(
        label: 'PDF and images',
        extensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
        mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        uniformTypeIdentifiers: [
          'com.adobe.pdf',
          'public.jpeg',
          'public.png',
          'org.webmproject.webp',
        ],
      ),
    ],
  );
  if (files.length > 10) throw const FormatException('Choose up to 10 files.');
  for (final file in files) {
    if (await file.length() > 10 * 1024 * 1024) {
      throw const FormatException('Each file must be 10 MB or smaller.');
    }
  }
  return files;
}

void _asError(BuildContext context, Object error) => ScaffoldMessenger.of(
  context,
).showSnackBar(SnackBar(content: Text(error.toString())));
Future<void> _asPreview(BuildContext context, CollegeApi api, Json file) async {
  try {
    final bytes = await api.assignmentFile(_asText(file['code']));
    if (!context.mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: Text(_asText(file['filename']))),
          body: file['mime_type'] == 'application/pdf'
              ? PdfViewer.data(bytes, sourceName: _asText(file['code']))
              : Center(
                  child: InteractiveViewer(
                    minScale: .5,
                    maxScale: 6,
                    child: Image.memory(
                      bytes,
                      errorBuilder: (_, _, _) =>
                          const Text('This image could not be decoded.'),
                    ),
                  ),
                ),
        ),
      ),
    );
  } catch (e) {
    if (context.mounted) _asError(context, e);
  }
}

Widget _asAttachments(BuildContext context, CollegeApi api, dynamic files) =>
    Wrap(
      spacing: 8,
      runSpacing: 6,
      children: _asRows(files)
          .map(
            (file) => OutlinedButton.icon(
              icon: const Icon(Icons.description_outlined, size: 18),
              label: Text(
                _asText(file['filename']),
                overflow: TextOverflow.ellipsis,
              ),
              onPressed: () => _asPreview(context, api, file),
            ),
          )
          .toList(),
    );

