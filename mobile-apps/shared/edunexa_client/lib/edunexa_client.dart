import 'package:url_launcher/url_launcher.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:share_plus/share_plus.dart';

typedef Json = Map<String,dynamic>;
class ApiException implements Exception {
  final String message; final int status;
  ApiException(this.message,this.status);
  @override String toString()=>message;
}
class CollegeApi {
  final String baseUrl,clientId;
  final http.Client httpClient;
  final FlutterSecureStorage storage;
  String? _access;
  String? _webRefresh;
  Future<void>? _refreshing;
  CollegeApi({required this.baseUrl,required this.clientId,http.Client? httpClient,FlutterSecureStorage? storage})
    :httpClient=httpClient??http.Client(),storage=storage??const FlutterSecureStorage();
  String get _key=>'edunexa-refresh-$clientId';
  Future<void> accept(Json result) async {
    _access=result['access_token'] as String;
    // A single native secure-storage entry keeps refresh rotation atomic.
    if(kIsWeb){_webRefresh=result['refresh_token'] as String;}else{await storage.write(key:_key,value:result['refresh_token'] as String);}
  }
  Future<void> login(String loginId,String password) async {
    final result=await _send('POST','/auth/login',{'login_id':loginId,'password':password,'client':clientId},auth:false);
    await accept(result as Json);
  }
  Future<bool> restore() async {
    if(kIsWeb)return false; // Never persist refresh tokens in browser localStorage.
    if(await storage.read(key:_key)==null)return false;
    try {await refresh();return true;} on ApiException catch(e){if(e.status==401)return false;rethrow;}
  }
  Future<void> refresh() {
    return _refreshing??= _rotate().whenComplete(()=>_refreshing=null);
  }
  Future<void> _rotate() async {
    final token=kIsWeb?_webRefresh:await storage.read(key:_key);
    if(token==null)throw ApiException('Please sign in again.',401);
    try {
      final result=await _send('POST','/auth/refresh',{'refresh_token':token,'client':clientId},auth:false);
      await accept(result as Json);
    } on ApiException catch(e){if(e.status==401)await clear();rethrow;}
  }
  Future<void> clear() async {_access=null;_webRefresh=null;if(!kIsWeb)await storage.delete(key:_key);}
  Future<void> logout() async {try{await _send('POST','/auth/logout',null);}finally{await clear();}}
  Future<dynamic> get(String path)=>_send('GET',path,null);
  Future<dynamic> post(String path,Json body)=>_send('POST',path,body);
  Future<http.Response> _response(String method,String path,Json? body,{bool auth=true,bool retry=true}) async {
    if(auth&&_access==null)await refresh();
    final uri=Uri.parse('$baseUrl/api/v1$path');
    if(uri.scheme!='https'&&!kDebugMode)throw ApiException('A secure HTTPS server is required.',0);
    try {
      final request=http.Request(method,uri)..headers['Content-Type']='application/json';
      if(auth)request.headers['Authorization']='Bearer $_access';
      if(body!=null)request.body=jsonEncode(body);
      final response=await http.Response.fromStream(await httpClient.send(request).timeout(const Duration(seconds:20)));
      if(response.statusCode==401&&auth&&retry){await refresh();return _response(method,path,body,auth:auth,retry:false);}
      if(response.statusCode>=400){
        dynamic detail;
        try{detail=jsonDecode(response.body)['detail'];}catch(_){detail='Server request failed';}
        throw ApiException(detail is String?detail:jsonEncode(detail),response.statusCode);
      }
      return response;
    } on ApiException{rethrow;}catch(_){throw ApiException('Cannot reach the college server. Check the connection and try again.',0);}
  }
  Future<dynamic> _send(String method,String path,Json? body,{bool auth=true}) async {
    final response=await _response(method,path,body,auth:auth);
    return response.body.isEmpty?<String,dynamic>{}:jsonDecode(response.body);
  }
  Future<Uint8List> download(String kind,String code) async =>(await _response('GET','/documents/$kind/${Uri.encodeComponent(code)}/download',null)).bodyBytes;
}

class EdunexaApp extends StatefulWidget {
  final String title,clientId;
  final CollegeApi? api;
  const EdunexaApp({super.key,required this.title,required this.clientId,this.api});
  @override State<EdunexaApp> createState()=>_EdunexaAppState();
}
class _EdunexaAppState extends State<EdunexaApp> {
  late final CollegeApi api;
  bool signedIn=false,restoring=true;
  String? restoreError;
  @override void initState(){super.initState();api=widget.api??CollegeApi(baseUrl:const String.fromEnvironment('API_BASE_URL',defaultValue:'http://127.0.0.1:8010'),clientId:widget.clientId);restore();}
  Future<void> restore() async {
    try{signedIn=await api.restore();}catch(e){restoreError=e.toString();}
    if(mounted)setState(()=>restoring=false);
  }
  @override Widget build(BuildContext context)=>MaterialApp(
    title:widget.title,debugShowCheckedModeBanner:false,
    theme:ThemeData(useMaterial3:true,colorScheme:ColorScheme.fromSeed(seedColor:const Color(0xff18344b)),scaffoldBackgroundColor:const Color(0xfff4f6f8),
      inputDecorationTheme:const InputDecorationTheme(border:OutlineInputBorder()),cardTheme:const CardThemeData(margin:EdgeInsets.symmetric(vertical:6))),
    home:restoring?const Scaffold(body:Center(child:CircularProgressIndicator())):signedIn?
      MobileWorkspace(title:widget.title,api:api,onLogout:(){setState(()=>signedIn=false);}):
      LoginScreen(title:widget.title,api:api,initialError:restoreError,onLogin:(){setState(()=>signedIn=true);}));
}
class LoginScreen extends StatefulWidget {
  final String title;final CollegeApi api;final VoidCallback onLogin;final String? initialError;
  const LoginScreen({super.key,required this.title,required this.api,required this.onLogin,this.initialError});
  @override State<LoginScreen> createState()=>_LoginScreenState();
}
class _LoginScreenState extends State<LoginScreen> {
  final form=GlobalKey<FormState>(),login=TextEditingController(),password=TextEditingController();
  bool busy=false,hidden=true;String? error;
  @override void initState(){super.initState();error=widget.initialError;}
  @override void dispose(){login.dispose();password.dispose();super.dispose();}
  Future<void> submit() async {
    if(!form.currentState!.validate())return;
    setState((){busy=true;error=null;});
    try{await widget.api.login(login.text.trim(),password.text);password.clear();widget.onLogin();}
    catch(e){if(mounted)setState(()=>error=e.toString());}
    finally{if(mounted)setState(()=>busy=false);}
  }
  @override Widget build(BuildContext context)=>Scaffold(body:SafeArea(child:Center(child:SingleChildScrollView(padding:const EdgeInsets.all(24),child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:420),child:Form(key:form,child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
    const Icon(Icons.school_outlined,size:52,color:Color(0xff18344b)),const SizedBox(height:24),Text(widget.title,style:Theme.of(context).textTheme.headlineMedium),const SizedBox(height:8),const Text('Sign in with your college account.'),const SizedBox(height:28),
    TextFormField(controller:login,decoration:const InputDecoration(labelText:'Login ID'),autofillHints:const[AutofillHints.username],validator:(v)=>v==null||v.trim().isEmpty?'Enter your login ID':null),const SizedBox(height:18),
    TextFormField(controller:password,obscureText:hidden,autofillHints:const[AutofillHints.password],decoration:InputDecoration(labelText:'Password',suffixIcon:IconButton(onPressed:()=>setState(()=>hidden=!hidden),icon:Icon(hidden?Icons.visibility_outlined:Icons.visibility_off_outlined))),validator:(v)=>v==null||v.isEmpty?'Enter your password':null,onFieldSubmitted:(_)=>submit()),
    if(error!=null)Padding(padding:const EdgeInsets.symmetric(vertical:16),child:Text(error!,style:const TextStyle(color:Colors.red))),const SizedBox(height:20),
    FilledButton(onPressed:busy?null:submit,child:Padding(padding:const EdgeInsets.all(14),child:Text(busy?'Signing in…':'Sign in')))
  ])))))));
}

class MobileWorkspace extends StatefulWidget {
  final String title;final CollegeApi api;final VoidCallback onLogout;
  const MobileWorkspace({super.key,required this.title,required this.api,required this.onLogout});
  @override State<MobileWorkspace> createState()=>_MobileWorkspaceState();
}
class _MobileWorkspaceState extends State<MobileWorkspace> {
  List<Json> screens=[];Json? data;String? selected,student,error;bool busy=true;
  @override void initState(){super.initState();loadScreens();}
  Future<void> loadScreens() async {
    try{final result=await widget.api.get('/mobile/workspace/screens') as Json;
      screens=(result['screens'] as List).cast<Json>();selected=screens.isEmpty?null:screens.first['key'] as String;
      await load();}catch(e){fail(e);}
  }
  void fail(Object e){if(!mounted)return;setState((){busy=false;error=e.toString();});if(e is ApiException&&e.status==401)widget.onLogout();}
  Future<void> load() async {
    if(selected==null){if(mounted)setState(()=>busy=false);return;}
    setState((){busy=true;error=null;data=null;});
    try{final result=await widget.api.get('/mobile/workspace/$selected${student==null?'':'?student_code=${Uri.encodeComponent(student!)}'}') as Json;
      if(mounted)setState((){data=result;student??=result['selected_student_code'] as String?;busy=false;});}catch(e){fail(e);}
  }
  Future<void> action(Json descriptor) async {
    final values=await showDialog<Json>(context:context,builder:(context)=>ActionDialog(action:descriptor,lookups:(data?['lookups'] as Json?)??{}));
    if(values==null)return;
    try{final response=await widget.api.post('/mobile/workspace/$selected/actions/${descriptor['key']}',{'values':values,if(student!=null)'student_code':student,if(descriptor['form_revision']!=null)'form_revision':descriptor['form_revision']});if(response['checkout_url']!=null){final uri=Uri.parse(response['checkout_url'] as String);if(uri.scheme!='https')throw ApiException('Invalid checkout address',0);if(!await launchUrl(uri,mode:LaunchMode.externalApplication))throw ApiException('Unable to open checkout',0);}
      if(response['reauthenticate']==true){await widget.api.clear();widget.onLogout();return;}await load();}
    catch(e){fail(e);}
  }
  Future<void> download(String kind,String code) async {
    try{
      final bytes=await widget.api.download(kind,code);
      if(!mounted)return;
      final box=context.findRenderObject() as RenderBox?;
      await SharePlus.instance.share(ShareParams(files:[XFile.fromData(bytes,mimeType:'application/pdf')],fileNameOverrides:['$kind-$code.pdf'],sharePositionOrigin:box==null?null:box.localToGlobal(Offset.zero)&box.size));
    }catch(e){fail(e);}
  }
  Future<void> logout() async {try{await widget.api.logout();}catch(_){}widget.onLogout();}
  @override Widget build(BuildContext context){
    final items=(data?['items'] as List? ??[]).cast<Json>();final children=(data?['students'] as List? ??[]).cast<Json>();
    return Scaffold(appBar:AppBar(title:Text(widget.title),actions:[IconButton(tooltip:'Refresh',onPressed:load,icon:const Icon(Icons.refresh)),IconButton(tooltip:'Sign out',onPressed:logout,icon:const Icon(Icons.logout))]),
      drawer:Drawer(child:SafeArea(child:ListView(children:[Padding(padding:const EdgeInsets.all(20),child:Text(widget.title,style:Theme.of(context).textTheme.titleLarge)),...screens.map((s)=>ListTile(selected:selected==s['key'],title:Text(s['title'] as String),onTap:(){Navigator.pop(context);setState(()=>selected=s['key'] as String);load();}))]))),
      body:RefreshIndicator(onRefresh:load,child:ListView(padding:const EdgeInsets.all(18),children:[
        Text(data?['title'] as String? ??'College workspace',style:Theme.of(context).textTheme.headlineSmall),const SizedBox(height:18),
        if(children.length>1)DropdownButtonFormField<String>(initialValue:student,decoration:const InputDecoration(labelText:'Student'),items:children.map((s)=>DropdownMenuItem(value:s['code'] as String,child:Text(s['name'] as String))).toList(),onChanged:(value){setState(()=>student=value);load();}),
        if(error!=null)Card(child:Padding(padding:const EdgeInsets.all(16),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text(error!,style:const TextStyle(color:Colors.red)),TextButton(onPressed:load,child:const Text('Try again'))]))),
        if(busy)const Padding(padding:EdgeInsets.all(32),child:Center(child:CircularProgressIndicator())),
        if(!busy&&data?['summary']!=null)RecordCard(record:data!['summary'] as Json),
        if(!busy&&selected=='reports')OutlinedButton.icon(onPressed:()async{try{final response=await widget.api._response('GET','/reports/finance.pdf',null);if(!context.mounted)return;final box=context.findRenderObject() as RenderBox?;await SharePlus.instance.share(ShareParams(files:[XFile.fromData(response.bodyBytes,mimeType:'application/pdf')],fileNameOverrides:['college-finance.pdf'],sharePositionOrigin:box==null?null:box.localToGlobal(Offset.zero)&box.size));}catch(e){fail(e);}},icon:const Icon(Icons.download_outlined),label:const Text('Download finance report')),
        if(!busy)...(data?['actions'] as List? ??[]).map((a)=>Padding(padding:const EdgeInsets.only(bottom:8),child:OutlinedButton.icon(onPressed:()=>action(a as Json),icon:const Icon(Icons.add),label:Text(a['label'] as String)))),
        if(!busy&&items.isEmpty&&data?['summary']==null)const Padding(padding:EdgeInsets.symmetric(vertical:40),child:Text('No records yet. New college records will appear here when they are available.')),
        if(!busy)...items.map((record)=>Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[RecordCard(record:record,onDownload:data?['downloads']!=null&&record['record_type']!='request'?()=>download(data!['downloads'] as String,record['code'] as String):null),if(record['receipts'] is List)...(record['receipts'] as List).map((r)=>OutlinedButton.icon(onPressed:()=>download('receipt',r['code'] as String),icon:const Icon(Icons.download_outlined),label:Text('Receipt ${r['receipt_number']}')))])),
        if(!busy&&data!=null&&items.length<(data!['total'] as int? ??0))TextButton(onPressed:()async{try{final result=await widget.api.get('/mobile/workspace/$selected?offset=${items.length}${student==null?'':'&student_code=$student'}') as Json;if(mounted)setState(()=>data={...data!,'items':[...items,...result['items']]});}catch(e){fail(e);}},child:const Text('Load more')),
      ])));
  }
}
String label(String key)=>key.replaceAll('_',' ').split(' ').map((s)=>s.isEmpty?s:'${s[0].toUpperCase()}${s.substring(1)}').join(' ');
String display(dynamic value){if(value==null)return'—';if(value is Map)return value.entries.map((e)=>'${label(e.key.toString())}: ${display(e.value)}').join('\n');if(value is List)return value.map(display).join('\n');return value.toString();}
class RecordCard extends StatelessWidget {
  final Json record;final VoidCallback? onDownload;
  const RecordCard({super.key,required this.record,this.onDownload});
  @override Widget build(BuildContext context)=>Card(child:Padding(padding:const EdgeInsets.all(16),child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
    ...record.entries.where((e)=>e.value!=null).map((e)=>Padding(padding:const EdgeInsets.only(bottom:10),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text(label(e.key),style:Theme.of(context).textTheme.labelMedium),const SizedBox(height:3),SelectableText(display(e.value))]))),
    if(onDownload!=null)OutlinedButton.icon(onPressed:onDownload,icon:const Icon(Icons.download_outlined),label:const Text('Download / share PDF'))
  ])));
}
class ActionDialog extends StatefulWidget {
  final Json action,lookups;
  const ActionDialog({super.key,required this.action,required this.lookups});
  @override State<ActionDialog> createState()=>_ActionDialogState();
}
class _ActionDialogState extends State<ActionDialog> {
  final form=GlobalKey<FormState>();final values=<String,dynamic>{};
  @override Widget build(BuildContext context)=>AlertDialog(title:Text(widget.action['label'] as String),content:SizedBox(width:420,child:Form(key:form,child:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,children:[
    ...(widget.action['fields'] as List).map((raw){final f=raw as Json;final key=f['key'] as String;final type=f['type'];
      List<Json> choices=[];
      final ref={'offering_code':'offerings','student_code':'students','leave_type_code':'leave_types','type_code':'certificate_types','recipient_user_code':'contacts'}[key];
      if(ref!=null)choices=((widget.lookups[ref] as List?)??[]).cast<Json>();
      if(type=='boolean')return CheckboxListTile(title:Text(f['label'] as String),value:values[key]==true,onChanged:(v)=>setState(()=>values[key]=v));
      final options=(f['options'] as List? ??[]);
      if(choices.isNotEmpty||options.isNotEmpty)return Padding(padding:const EdgeInsets.only(bottom:14),child:DropdownButtonFormField<String>(isExpanded:true,decoration:InputDecoration(labelText:f['label'] as String),items:choices.isNotEmpty?choices.map((c)=>DropdownMenuItem(value:c['code'] as String,child:Text((c['name']??c['code']).toString(),overflow:TextOverflow.ellipsis))).toList():options.map((c)=>DropdownMenuItem(value:c.toString(),child:Text(c.toString()))).toList(),onChanged:(v)=>values[key]=v,validator:(v)=>f['required']==true&&v==null?'Required':null));
      return Padding(padding:const EdgeInsets.only(bottom:14),child:TextFormField(obscureText:type=='password',decoration:InputDecoration(labelText:f['label'] as String,hintText:type=='date'?'YYYY-MM-DD':type=='datetime-local'?'YYYY-MM-DDTHH:MM:SS':null),maxLines:type=='textarea'?3:1,keyboardType:type=='number'?const TextInputType.numberWithOptions(decimal:true):TextInputType.text,onChanged:(v)=>values[key]=v,validator:(v){if(f['required']==true&&(v==null||v.trim().isEmpty))return'Required';if(type=='number'&&v!=null&&v.isNotEmpty&&num.tryParse(v)==null)return'Enter a number';return null;}));
    }),
  ])))) ,actions:[TextButton(onPressed:()=>Navigator.pop(context),child:const Text('Cancel')),FilledButton(onPressed:(){if(form.currentState!.validate()){for(final raw in widget.action['fields'] as List){if(raw['type']=='boolean')values.putIfAbsent(raw['key'] as String,()=>false);}Navigator.pop(context,values);}},child:const Text('Save'))]);
}
