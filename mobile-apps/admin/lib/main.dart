import 'package:flutter/material.dart';
import 'package:edunexa_client/edunexa_client.dart';
void main()=>runApp(const EduNexaAdminApp());
class EduNexaAdminApp extends StatelessWidget {
  const EduNexaAdminApp({super.key});
  @override Widget build(BuildContext context)=>const EdunexaApp(title:'EduNexa Admin',clientId:'admin-mobile');
}
