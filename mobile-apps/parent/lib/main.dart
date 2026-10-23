import 'package:flutter/material.dart';
import 'package:edunexa_client/edunexa_client.dart';
void main()=>runApp(const EduNexaApp());
class EduNexaApp extends StatelessWidget {
  const EduNexaApp({super.key});
  @override Widget build(BuildContext context)=>const EdunexaApp(title:'EduNexa Parent',clientId:'parent-mobile');
}
