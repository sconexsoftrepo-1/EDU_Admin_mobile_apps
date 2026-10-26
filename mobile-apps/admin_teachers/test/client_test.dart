import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:edunexa_admin/services/api_service.dart';
void main(){
 TestWidgetsFlutterBinding.ensureInitialized();
 setUp(()=>FlutterSecureStorage.setMockInitialValues({}));
 test('login token is used in Authorization and only refresh is persisted',()async{
  final api=CollegeApi(baseUrl:'http://localhost:8010',clientId:'student-mobile',httpClient:MockClient((request)async{
   if(request.url.path.endsWith('/login'))return http.Response(jsonEncode({'access_token':'access','refresh_token':'refresh'}),200);
   expect(request.headers['Authorization'],'Bearer access');return http.Response('{}',200);
  }));
  await api.login('student','password');await api.get('/mobile/profile');
  const storage=FlutterSecureStorage();expect(await storage.read(key:'edunexa-refresh-student-mobile'),'refresh');
 });
 test('concurrent 401 responses rotate once and retry with new token',()async{
  int rotations=0;
  final api=CollegeApi(baseUrl:'http://localhost:8010',clientId:'teacher-mobile',httpClient:MockClient((request)async{
   if(request.url.path.endsWith('/login'))return http.Response(jsonEncode({'access_token':'old','refresh_token':'refresh-1'}),200);
   if(request.url.path.endsWith('/refresh')){rotations++;await Future<void>.delayed(const Duration(milliseconds:30));return http.Response(jsonEncode({'access_token':'new','refresh_token':'refresh-2'}),200);}
   return http.Response(request.headers['Authorization']=='Bearer new'?'{}':'{"detail":"expired"}',request.headers['Authorization']=='Bearer new'?200:401);
  }));
  await api.login('teacher','password');await Future.wait([api.get('/one'),api.get('/two')]);expect(rotations,1);
 });
 test('logout clears stored refresh token even if server is offline',()async{
  final api=CollegeApi(baseUrl:'http://localhost:8010',clientId:'parent-mobile',httpClient:MockClient((request)async{
   if(request.url.path.endsWith('/login'))return http.Response(jsonEncode({'access_token':'old','refresh_token':'refresh-1'}),200);
   throw Exception('offline');
  }));
  await api.login('parent','password');try{await api.logout();}catch(_){}
  expect(await const FlutterSecureStorage().read(key:'edunexa-refresh-parent-mobile'),isNull);
 });
}
