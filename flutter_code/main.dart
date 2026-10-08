import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase connected to smartclass-3e828
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  runApp(const SmartClassApp());
}

class SmartClassApp extends StatelessWidget {
  const SmartClassApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Student Attendance Portal',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        useMaterial3: true,
      ),
      home: const RoleSelectionScreen(),
    );
  }
}

/// ==================== ROLE SELECTION SCREEN ====================
class RoleSelectionScreen extends StatelessWidget {
  const RoleSelectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.indigo.shade900,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.school, size: 80, color: Colors.amber),
              const SizedBox(height: 16),
              const Text(
                'Student Attendance Portal',
                style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold),
              ),
              const Text(
                'Live Sync with Web Admin Panel (smartclass-3e828)',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 40),

              // Parent Login Button
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: Colors.indigo.shade900,
                  minimumSize: const Size(double.infinity, 54),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const ParentPhoneLoginScreen()),
                  );
                },
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.family_restroom, size: 24),
                    SizedBox(width: 10),
                    Text('Parent Login (Phone No)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Teacher & Admin Overview Portal Button
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white, width: 1.5),
                  minimumSize: const Size(double.infinity, 54),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const TeacherLoginScreen()),
                  );
                },
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.rule, size: 24),
                    SizedBox(width: 10),
                    Text('Teacher & Student Attendance Portal', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Helper to extract clean 10-digit phone number regardless of spaces, dashes, or +91
String _cleanPhoneDigits(dynamic p) {
  if (p == null) return '';
  final digits = p.toString().replaceAll(RegExp(r'[^0-9]'), '');
  return digits.length > 10 ? digits.substring(digits.length - 10) : digits;
}

/// Helper to safely extract regex pattern matches from notice/report texts
String _extractRegex(String text, String pattern, [int group = 1]) {
  try {
    final reg = RegExp(pattern, caseSensitive: false);
    final match = reg.firstMatch(text);
    if (match != null && match.groupCount >= group) {
      return match.group(group)?.trim() ?? '';
    }
  } catch (_) {}
  return '';
}

/// ==================== PARENT PHONE LOGIN SCREEN ====================
class ParentPhoneLoginScreen extends StatefulWidget {
  const ParentPhoneLoginScreen({super.key});

  @override
  State<ParentPhoneLoginScreen> createState() => _ParentPhoneLoginScreenState();
}

class _ParentPhoneLoginScreenState extends State<ParentPhoneLoginScreen> {
  final TextEditingController _phoneController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  void _verifyParentPhone() async {
    final rawInput = _phoneController.text.trim();
    final phoneInput = _cleanPhoneDigits(rawInput);
    if (phoneInput.isEmpty) {
      setState(() => _errorMessage = 'Please enter parent mobile number');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final db = FirebaseFirestore.instance;
      final querySnapshot = await db.collection('students').get();

      final matchedStudents = querySnapshot.docs.where((doc) {
        final parentPhone = _cleanPhoneDigits((doc.data()['parentPhone'] ?? '').toString());
        if (parentPhone.isEmpty) return false;
        return parentPhone == phoneInput ||
            parentPhone.endsWith(phoneInput) ||
            phoneInput.endsWith(parentPhone);
      }).toList();

      setState(() => _isLoading = false);

      if (matchedStudents.isNotEmpty) {
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => ParentHomeScreen(parentPhone: phoneInput),
            ),
          );
        }
      } else {
        setState(() {
          _errorMessage =
              'No student found registered with "$rawInput". Please check number or contact Admin.';
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Error connecting to database: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Parent Mobile Login'), backgroundColor: Colors.indigo, foregroundColor: Colors.white),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAlignment: CrossAlignment.start,
          children: [
            const Text(
              'Enter Parent Registered Mobile Number',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            const Text(
              'Enter the mobile number registered by Admin in Web Panel to view child attendance & data.',
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
            const SizedBox(height: 20),

            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: 'Mobile Number',
                hintText: 'e.g. 8010861316',
                prefixIcon: const Icon(Icons.phone),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                child: Text(_errorMessage!, style: TextStyle(color: Colors.red.shade800, fontSize: 13)),
              ),
            ],
            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.indigo,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _isLoading ? null : _verifyParentPhone,
                child: _isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('Verify & Login', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// ==================== TEACHER PHONE LOGIN & CLASS RESTRICTION SCREEN ====================
class TeacherLoginScreen extends StatefulWidget {
  const TeacherLoginScreen({super.key});

  @override
  State<TeacherLoginScreen> createState() => _TeacherLoginScreenState();
}

class _TeacherLoginScreenState extends State<TeacherLoginScreen> {
  final TextEditingController _phoneController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _loginAsTeacher(
    String teacherId,
    String teacherName,
    String teacherPhone,
    List<String> assignedClassIds,
  ) async {
    setState(() => _isLoading = true);
    try {
      final db = FirebaseFirestore.instance;
      // Also query classes directly to ensure all classes assigned to this teacher are included
      final classSnap = await db.collection('classes').get();
      final extraClassIds = classSnap.docs.where((d) {
        final data = d.data();
        final tId = data['teacherId']?.toString() ?? data['classTeacherId']?.toString();
        return tId == teacherId;
      }).map((d) => d.id).toList();

      final combinedSet = <String>{...assignedClassIds, ...extraClassIds};
      final combinedList = combinedSet.toList();

      if (mounted) {
        setState(() => _isLoading = false);
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => MainAndroidPortalScreen(
              isTeacher: true,
              isAdmin: false,
              teacherId: teacherId,
              teacherName: teacherName,
              teacherPhone: teacherPhone,
              assignedClassIds: combinedList,
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Error loading teacher classes: $e';
        });
      }
    }
  }

  void _verifyTeacherPhone() async {
    final rawInput = _phoneController.text.trim();
    final phoneInput = _cleanPhoneDigits(rawInput);
    if (phoneInput.isEmpty) {
      setState(() => _errorMessage = 'Please enter teacher mobile number');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final db = FirebaseFirestore.instance;
      final querySnapshot = await db.collection('teachers').get();

      final matchedTeachers = querySnapshot.docs.where((doc) {
        final data = doc.data();
        if (data['deletedInAndroid'] == true || data['hiddenInAndroid'] == true) return false;
        final teacherPhone = _cleanPhoneDigits(data['phone'] ?? '');
        if (teacherPhone.isEmpty) return false;
        return teacherPhone == phoneInput ||
            teacherPhone.endsWith(phoneInput) ||
            phoneInput.endsWith(teacherPhone);
      }).toList();

      if (matchedTeachers.isNotEmpty) {
        final doc = matchedTeachers.first;
        final data = doc.data();
        final teacherId = doc.id;
        final teacherName = data['name'] ?? 'Teacher';
        final teacherPhone = (data['phone'] ?? '').toString();
        final rawAssigned = (data['assignedClassIds'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];
        if (data['assignedClassId'] != null) {
          rawAssigned.add(data['assignedClassId'].toString());
        }

        await _loginAsTeacher(teacherId, teacherName, teacherPhone, rawAssigned);
      } else {
        setState(() {
          _isLoading = false;
          _errorMessage = 'No teacher found registered with "$rawInput". Please check mobile number or select your profile below.';
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Error connecting to database: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final db = FirebaseFirestore.instance;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Teacher Attendance Login'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAlignment: CrossAlignment.start,
          children: [
            // Header card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.indigo.shade50,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.indigo.shade100),
              ),
              child: const Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: Colors.indigo,
                    child: Icon(Icons.assignment_ind, color: Colors.white, size: 30),
                  ),
                  SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAlignment: CrossAlignment.start,
                      children: [
                        Text(
                          'Teacher Attendance Portal',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.indigo),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'फक्त आपल्या असाइन केलेल्या क्लासची हजेरी घेण्यासाठी लॉगिन करा (Attendance for Assigned Class Only)',
                          style: TextStyle(fontSize: 12, color: Colors.black87),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Phone number login section
            const Text(
              'Enter Teacher Registered Mobile Number',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            const Text(
              'Enter your 10-digit registered mobile number (e.g. Suraj Chavan: 7972495812)',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: 'Teacher Mobile Number',
                hintText: 'e.g. 7972495812',
                prefixIcon: const Icon(Icons.phone),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                child: Text(_errorMessage!, style: TextStyle(color: Colors.red.shade800, fontSize: 13)),
              ),
            ],
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.indigo,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _isLoading ? null : _verifyTeacherPhone,
                icon: const Icon(Icons.login),
                label: _isLoading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Verify & Take Attendance', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ),

            const SizedBox(height: 28),
            Row(
              children: [
                Expanded(child: Divider(color: Colors.grey.shade300)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Text('OR QUICK SELECT TEACHER', style: TextStyle(color: Colors.grey.shade600, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
                Expanded(child: Divider(color: Colors.grey.shade300)),
              ],
            ),
            const SizedBox(height: 16),

            // Real-time Teacher List
            StreamBuilder<QuerySnapshot>(
              stream: db.collection('classes').snapshots(),
              builder: (context, classSnap) {
                final rawClasses = classSnap.data?.docs ?? [];
                final classMap = {
                  for (var doc in rawClasses)
                    doc.id: '${(doc.data() as Map<String, dynamic>)['name'] ?? ''} - ${(doc.data() as Map<String, dynamic>)['section'] ?? ''}'
                };

                return StreamBuilder<QuerySnapshot>(
                  stream: db.collection('teachers').snapshots(),
                  builder: (context, teacherSnap) {
                    if (!teacherSnap.hasData) return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()));
                    final teachers = teacherSnap.data!.docs.where((d) {
                      final data = d.data() as Map<String, dynamic>;
                      return data['deletedInAndroid'] != true && data['hiddenInAndroid'] != true;
                    }).toList();

                    if (teachers.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.all(12),
                        child: Text('No teachers registered yet by Admin.', style: TextStyle(color: Colors.grey)),
                      );
                    }

                    return Column(
                      children: teachers.map((doc) {
                        final data = doc.data() as Map<String, dynamic>;
                        final name = data['name'] ?? 'Teacher';
                        final role = data['role'] ?? 'Teacher';
                        final phone = (data['phone'] ?? '').toString();
                        final rawAssigned = (data['assignedClassIds'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];
                        if (data['assignedClassId'] != null) {
                          rawAssigned.add(data['assignedClassId'].toString());
                        }

                        // Also check classes where this teacher is assigned
                        for (var cDoc in rawClasses) {
                          final cData = cDoc.data() as Map<String, dynamic>;
                          final tId = cData['teacherId']?.toString() ?? cData['classTeacherId']?.toString();
                          if (tId == doc.id && !rawAssigned.contains(cDoc.id)) {
                            rawAssigned.add(cDoc.id);
                          }
                        }

                        final assignedClassLabels = rawAssigned.map((id) => classMap[id] ?? 'Class').join(', ');
                        final hasAssigned = rawAssigned.isNotEmpty;

                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(color: Colors.indigo.shade100),
                          ),
                          elevation: 2,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: _isLoading ? null : () => _loginAsTeacher(doc.id, name, phone, rawAssigned),
                            child: Padding(
                              padding: const EdgeInsets.all(12.0),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 22,
                                    backgroundColor: Colors.teal.shade700,
                                    child: Text(
                                      name.isNotEmpty ? name[0].toUpperCase() : 'T',
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAlignment: CrossAlignment.start,
                                      children: [
                                        Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                        const SizedBox(height: 2),
                                        Text('Phone: $phone', style: TextStyle(color: Colors.grey.shade700, fontSize: 12)),
                                        const SizedBox(height: 4),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: hasAssigned ? Colors.green.shade50 : Colors.orange.shade50,
                                            border: Border.all(color: hasAssigned ? Colors.green.shade300 : Colors.orange.shade300),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            hasAssigned ? 'Assigned: $assignedClassLabels' : 'No Class Assigned',
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.bold,
                                              color: hasAssigned ? Colors.green.shade800 : Colors.orange.shade800,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.indigo,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                    ),
                                    onPressed: _isLoading ? null : () => _loginAsTeacher(doc.id, name, phone, rawAssigned),
                                    child: const Text('Login', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    );
                  },
                );
              },
            ),

            const SizedBox(height: 24),
            // Administrator Access button
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: ListTile(
                leading: const Icon(Icons.admin_panel_settings, color: Colors.indigo, size: 28),
                title: const Text('Administrator Access', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                subtitle: const Text('View and manage all classes without restrictions', style: TextStyle(fontSize: 11, color: Colors.grey)),
                trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.indigo),
                onTap: () {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const MainAndroidPortalScreen(isAdmin: true, isTeacher: false),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}

/// ==================== PARENT HOME SCREEN (REAL-TIME STREAM FOR NEWLY ADDED STUDENTS & OFFICIAL REPORT CARDS) ====================
class ParentHomeScreen extends StatelessWidget {
  final String parentPhone;

  const ParentHomeScreen({super.key, required this.parentPhone});

  @override
  Widget build(BuildContext context) {
    final db = FirebaseFirestore.instance;
    final cleanPhone = _cleanPhoneDigits(parentPhone);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Parent Attendance & Report Portal'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (context) => const RoleSelectionScreen()),
              );
            },
          )
        ],
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: db.collection('students').snapshots(),
        builder: (context, studentSnap) {
          if (!studentSnap.hasData) return const Center(child: CircularProgressIndicator());

          final studentDocs = studentSnap.data!.docs.where((doc) {
            final data = doc.data() as Map<String, dynamic>;
            if (data['deletedInAndroid'] == true || data['hiddenInAndroid'] == true) return false;
            final rawP = (data['parentPhone'] ?? '').toString();
            final pPhone = _cleanPhoneDigits(rawP);
            if (pPhone.isEmpty) return false;
            return pPhone == cleanPhone || pPhone.endsWith(cleanPhone) || cleanPhone.endsWith(pPhone);
          }).toList();

          if (studentDocs.isEmpty) {
            return Center(
              child: Container(
                margin: const EdgeInsets.all(24),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: Colors.indigo.shade50, borderRadius: BorderRadius.circular(12)),
                child: Text(
                  'No students found registered under parent mobile number ($parentPhone).\nPlease verify your registered number with the school administration.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14, color: Colors.indigo),
                ),
              ),
            );
          }

          final studentIds = studentDocs.map((d) => d.id).toSet();

          return StreamBuilder<QuerySnapshot>(
            stream: db.collection('classes').snapshots(),
            builder: (context, classSnap) {
              final classDocs = classSnap.data?.docs ?? [];
              final classMap = {
                for (var doc in classDocs)
                  doc.id: '${(doc.data() as Map<String, dynamic>)['name'] ?? ''} - ${(doc.data() as Map<String, dynamic>)['section'] ?? ''}'
              };

              return SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAlignment: CrossAlignment.start,
                  children: [
                    // 1. Children Attendance Status Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [Colors.indigo.shade800, Colors.indigo.shade600]),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 8, offset: Offset(0, 4))],
                      ),
                      child: Column(
                        crossAlignment: CrossAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.child_care, color: Colors.amber, size: 28),
                              SizedBox(width: 8),
                              Text('Child Attendance Status', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          const Divider(color: Colors.white30, height: 20),
                          ...studentDocs.map((doc) {
                            final student = doc.data() as Map<String, dynamic>;
                            final status = student['attendanceStatus'] ?? 'Present';
                            final isPresent = status == 'Present';
                            final rawClassId = student['classId']?.toString();
                            final className = rawClassId != null && classMap.containsKey(rawClassId)
                                ? classMap[rawClassId]!
                                : (classDocs.isNotEmpty
                                    ? '${(classDocs.first.data() as Map<String, dynamic>)['name']} - ${(classDocs.first.data() as Map<String, dynamic>)['section']}'
                                    : '10 - A');

                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8.0),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAlignment: CrossAlignment.start,
                                    children: [
                                      Text(student['name'] ?? 'Student Name', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                                      Text('Class: $className • Roll: ${student['rollNo'] ?? 'N/A'}', style: const TextStyle(color: Colors.white70, fontSize: 13)),
                                    ],
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: isPresent ? Colors.green.shade100 : Colors.red.shade100,
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(isPresent ? Icons.check_circle : Icons.cancel, size: 18, color: isPresent ? Colors.green.shade900 : Colors.red.shade900),
                                        const SizedBox(width: 6),
                                        Text(
                                          status,
                                          style: TextStyle(color: isPresent ? Colors.green.shade900 : Colors.red.shade900, fontWeight: FontWeight.bold, fontSize: 13),
                                        ),
                                      ],
                                    ),
                                  )
                                ],
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // 2. Official Student Report Card (NEW & PROMINENT)
                    StreamBuilder<QuerySnapshot>(
                      stream: db.collection('notices').snapshots(),
                      builder: (context, noticeSnap) {
                        return StreamBuilder<QuerySnapshot>(
                          stream: db.collection('reports').snapshots(),
                          builder: (context, reportSnap) {
                            final allDocs = <QueryDocumentSnapshot>[];
                            if (noticeSnap.hasData) allDocs.addAll(noticeSnap.data!.docs);
                            if (reportSnap.hasData) allDocs.addAll(reportSnap.data!.docs);

                            // Deduplicate by doc ID
                            final seenIds = <String>{};
                            final uniqueDocs = <QueryDocumentSnapshot>[];
                            for (var doc in allDocs) {
                              if (!seenIds.contains(doc.id)) {
                                seenIds.add(doc.id);
                                uniqueDocs.add(doc);
                              }
                            }

                            final reportDocs = uniqueDocs.where((doc) {
                              final data = doc.data() as Map<String, dynamic>;
                              if (data['deletedInAndroid'] == true || data['hiddenInAndroid'] == true) return false;
                              final hiddenFor = (data['hiddenForParents'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];
                              if (cleanPhone.isNotEmpty && hiddenFor.contains(cleanPhone)) return false;

                              final isReportType = data['type'] == 'report' ||
                                  (data['title'] ?? '').toString().toLowerCase().contains('report') ||
                                  (data['title'] ?? '').toString().toLowerCase().contains('progress');
                              if (!isReportType) return false;

                              final sId = (data['studentId'] ?? '').toString();
                              final nPhone = _cleanPhoneDigits(data['parentPhone']);
                              final nId = _cleanPhoneDigits(data['parentId']);

                              return (sId.isNotEmpty && studentIds.contains(sId)) ||
                                  (cleanPhone.isNotEmpty && (nPhone == cleanPhone || nId == cleanPhone));
                            }).toList();

                            // Sort newest first
                            reportDocs.sort((a, b) {
                              final aData = a.data() as Map<String, dynamic>;
                              final bData = b.data() as Map<String, dynamic>;
                              final aTime = aData['createdAt']?.toString() ?? aData['timestamp']?.toString() ?? '';
                              final bTime = bData['createdAt']?.toString() ?? bData['timestamp']?.toString() ?? '';
                              return bTime.compareTo(aTime);
                            });

                            return Container(
                              margin: const EdgeInsets.only(bottom: 20),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(colors: [Colors.teal.shade800, Colors.teal.shade600]),
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 8, offset: Offset(0, 4))],
                              ),
                              child: Column(
                                crossAlignment: CrossAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.workspace_premium, color: Colors.amber, size: 28),
                                      const SizedBox(width: 8),
                                      const Expanded(
                                        child: Text(
                                          'Official Student Report Card',
                                          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: Colors.amber,
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: const Text(
                                          'OFFICIAL',
                                          style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 11),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const Divider(color: Colors.white30, height: 20),
                                  if (reportDocs.isEmpty)
                                    const Padding(
                                      padding: EdgeInsets.symmetric(vertical: 8.0),
                                      child: Row(
                                        children: [
                                          Icon(Icons.info_outline, color: Colors.white70, size: 20),
                                          SizedBox(width: 8),
                                          Expanded(
                                            child: Text(
                                              'No official report card issued yet. Once sent from Admin Panel, it will appear here immediately.',
                                              style: TextStyle(color: Colors.white70, fontSize: 13),
                                            ),
                                          ),
                                        ],
                                      ),
                                    )
                                  else
                                    ...reportDocs.map((rDoc) {
                                      final rData = rDoc.data() as Map<String, dynamic>;
                                      final content = (rData['content'] ?? rData['message'] ?? '').toString();
                                      final sId = (rData['studentId'] ?? '').toString();

                                      // Match student doc if available
                                      Map<String, dynamic>? studentMatch;
                                      for (var doc in studentDocs) {
                                        if (doc.id == sId) {
                                          studentMatch = doc.data() as Map<String, dynamic>;
                                          break;
                                        }
                                      }
                                      if (studentMatch == null && studentDocs.isNotEmpty) {
                                        studentMatch = studentDocs.first.data() as Map<String, dynamic>;
                                      }

                                      // 1. Student Name
                                      final sName = (rData['studentName'] ?? studentMatch?['name'] ?? 'Student').toString();

                                      // 2. Roll No
                                      String roll = (rData['rollNo'] ?? studentMatch?['rollNo'] ?? '').toString();
                                      if (roll.isEmpty) {
                                        roll = _extractRegex(content, r'Roll:\s*([A-Za-z0-9]+)');
                                      }

                                      // 3. Class Name
                                      String clsName = (rData['className'] ?? '').toString();
                                      if (clsName.isEmpty && studentMatch != null) {
                                        final rawCId = studentMatch['classId']?.toString() ?? '';
                                        if (classMap.containsKey(rawCId)) {
                                          clsName = classMap[rawCId]!;
                                        }
                                      }
                                      if (clsName.isEmpty) {
                                        final extractedCls = _extractRegex(content, r'(?:Class|Grade)\s*([0-9]+[A-Za-z]*)');
                                        if (extractedCls.isNotEmpty) clsName = 'Class $extractedCls';
                                      }

                                      // 4. Parent / Guardian Name
                                      String parentName = (rData['parentName'] ?? studentMatch?['parentName'] ?? '').toString();
                                      if (parentName.isEmpty) {
                                        parentName = _extractRegex(content, r'Dear\s+([^,\n\r]+)');
                                      }
                                      if (parentName.isEmpty) parentName = 'Parent / Guardian';

                                      // 5. Parent Phone
                                      String pPhone = (rData['parentPhone'] ?? studentMatch?['parentPhone'] ?? parentPhone).toString();

                                      // 6. Title
                                      final title = (rData['title'] ?? 'Official Student Report Card').toString();

                                      // 7. Attendance
                                      String attendance = (rData['attendance'] ?? studentMatch?['attendanceStatus'] ?? '').toString();
                                      if (attendance.isEmpty) {
                                        attendance = _extractRegex(content, r"Today'?s\s+Attendance:\s*([^\n\r•]+)");
                                      }
                                      if (attendance.isEmpty) attendance = 'Present';
                                      final isPresent = attendance.toLowerCase().contains('present');

                                      // 8. Total Score, Max, Percentage
                                      String totalScore = (rData['totalScore'] != null ? rData['totalScore'].toString() : '');
                                      String totalMax = (rData['totalMax'] != null ? rData['totalMax'].toString() : '');
                                      String percentage = (rData['percentage'] != null ? rData['percentage'].toString() : '');
                                      if (totalScore.isEmpty || totalMax.isEmpty) {
                                        final scoreMatch = RegExp(r'(?:Total|Overall)\s+Examination\s+Score:\s*([0-9]+)\s*\/\s*([0-9]+)(?:\s*\(([0-9]+)%\))?', caseSensitive: false).firstMatch(content);
                                        if (scoreMatch != null) {
                                          totalScore = scoreMatch.group(1) ?? '';
                                          totalMax = scoreMatch.group(2) ?? '';
                                          if (percentage.isEmpty && scoreMatch.group(3) != null) {
                                            percentage = scoreMatch.group(3)!;
                                          }
                                        }
                                      }
                                      if (percentage.isEmpty && totalScore.isNotEmpty && totalMax.isNotEmpty) {
                                        final sc = double.tryParse(totalScore) ?? 0;
                                        final mx = double.tryParse(totalMax) ?? 1;
                                        percentage = (mx > 0 ? (sc / mx * 100).round() : 0).toString();
                                      }

                                      // 9. Cumulative Grade
                                      String grade = (rData['grade'] ?? '').toString();
                                      if (grade.isEmpty) {
                                        grade = _extractRegex(content, r'(?:Cumulative|Overall)\s+Grade:\s*([A-Za-z0-9+-]+)');
                                      }

                                      // 10. Academic Result
                                      String academicResult = (rData['academicResult'] ?? '').toString();
                                      if (academicResult.isEmpty) {
                                        academicResult = _extractRegex(content, r'Academic\s+Result:\s*([A-Za-z]+)');
                                      }
                                      if (academicResult.isEmpty && percentage.isNotEmpty) {
                                        final pNum = double.tryParse(percentage) ?? 0;
                                        academicResult = pNum >= 40 ? 'PASSED' : 'REMEDIAL';
                                      }
                                      final isPassed = academicResult.toUpperCase() == 'PASSED';

                                      // 11. School Authority & Date
                                      String author = (rData['schoolAuthority'] ?? rData['author'] ?? '').toString();
                                      if (author.isEmpty || author == 'Admin') {
                                        final authMatch = RegExp(r'Regards,\s*[\r\n]+([^\r\n]+)(?:[\r\n]+([^\r\n]+))?', caseSensitive: false).firstMatch(content);
                                        if (authMatch != null) {
                                          final l1 = authMatch.group(1)?.trim() ?? '';
                                          final l2 = authMatch.group(2)?.trim() ?? '';
                                          author = l2.isNotEmpty ? '$l1, $l2' : l1;
                                        }
                                      }
                                      if (author.isEmpty) author = 'Principal Administrator, SmartClass Academy';

                                      final date = (rData['date'] ?? (rData['createdAt'] != null ? rData['createdAt'].toString().substring(0, 10) : '')).toString();

                                      return Container(
                                        margin: const EdgeInsets.only(bottom: 14),
                                        padding: const EdgeInsets.all(14),
                                        decoration: BoxDecoration(
                                          color: Colors.white.withOpacity(0.12),
                                          borderRadius: BorderRadius.circular(14),
                                          border: Border.all(color: Colors.white24),
                                        ),
                                        child: Column(
                                          crossAlignment: CrossAlignment.start,
                                          children: [
                                            // Header: Student Name & Delivered Badge
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Expanded(
                                                  child: Column(
                                                    crossAlignment: CrossAlignment.start,
                                                    children: [
                                                      Text(
                                                        sName,
                                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                                      ),
                                                      const SizedBox(height: 2),
                                                      Text(
                                                        '${clsName.isNotEmpty ? clsName : "Class"}${roll.isNotEmpty ? " • Roll: $roll" : ""}',
                                                        style: const TextStyle(color: Colors.amberAccent, fontWeight: FontWeight.w600, fontSize: 13),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                  decoration: BoxDecoration(
                                                    color: Colors.teal.shade900,
                                                    borderRadius: BorderRadius.circular(8),
                                                    border: Border.all(color: Colors.teal.shade300),
                                                  ),
                                                  child: const Row(
                                                    mainAxisSize: MainAxisSize.min,
                                                    children: [
                                                      Icon(Icons.check_circle, size: 12, color: Colors.tealAccent),
                                                      SizedBox(width: 4),
                                                      Text(
                                                        'DELIVERED',
                                                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 10),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 10),

                                            // Student & Parent Metadata Card
                                            Container(
                                              width: double.infinity,
                                              padding: const EdgeInsets.all(10),
                                              decoration: BoxDecoration(
                                                color: Colors.black.withOpacity(0.22),
                                                borderRadius: BorderRadius.circular(8),
                                                border: Border.all(color: Colors.white12),
                                              ),
                                              child: Column(
                                                crossAlignment: CrossAlignment.start,
                                                children: [
                                                  Row(
                                                    children: [
                                                      const Icon(Icons.person, size: 14, color: Colors.lightBlueAccent),
                                                      const SizedBox(width: 6),
                                                      Expanded(
                                                        child: RichText(
                                                          text: TextSpan(
                                                            style: const TextStyle(color: Colors.white, fontSize: 12),
                                                            children: [
                                                              const TextSpan(text: 'Parent / Guardian: ', style: TextStyle(color: Colors.white70)),
                                                              TextSpan(text: parentName, style: const TextStyle(fontWeight: FontWeight.bold)),
                                                            ],
                                                          ),
                                                        ),
                                                      ),
                                                      if (pPhone.isNotEmpty) ...[
                                                        const Icon(Icons.phone, size: 12, color: Colors.white70),
                                                        const SizedBox(width: 4),
                                                        Text(pPhone, style: const TextStyle(color: Colors.white70, fontSize: 11)),
                                                      ],
                                                    ],
                                                  ),
                                                  if (title.isNotEmpty && !title.toLowerCase().contains('official report card')) ...[
                                                    const SizedBox(height: 4),
                                                    Row(
                                                      children: [
                                                        const Icon(Icons.label_outline, size: 14, color: Colors.amberAccent),
                                                        const SizedBox(width: 6),
                                                        Expanded(
                                                          child: Text(
                                                            'Notice Title: $title',
                                                            style: const TextStyle(color: Colors.white70, fontSize: 11),
                                                            maxLines: 1,
                                                            overflow: TextOverflow.ellipsis,
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ],
                                                ],
                                              ),
                                            ),
                                            const SizedBox(height: 10),

                                            // KPI Performance Badges Matrix (Attendance, Score, Grade, Result)
                                            Wrap(
                                              spacing: 6,
                                              runSpacing: 6,
                                              children: [
                                                // Attendance
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                  decoration: BoxDecoration(
                                                    color: isPresent ? Colors.green.shade900.withOpacity(0.85) : Colors.red.shade900.withOpacity(0.85),
                                                    borderRadius: BorderRadius.circular(6),
                                                    border: Border.all(color: isPresent ? Colors.greenAccent : Colors.redAccent),
                                                  ),
                                                  child: Row(
                                                    mainAxisSize: MainAxisSize.min,
                                                    children: [
                                                      Icon(isPresent ? Icons.check_circle : Icons.cancel, size: 13, color: Colors.white),
                                                      const SizedBox(width: 4),
                                                      Text(
                                                        'Attendance: $attendance',
                                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
                                                      ),
                                                    ],
                                                  ),
                                                ),

                                                // Total Exam Score
                                                if (totalScore.isNotEmpty)
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                    decoration: BoxDecoration(
                                                      color: Colors.indigo.shade900.withOpacity(0.85),
                                                      borderRadius: BorderRadius.circular(6),
                                                      border: Border.all(color: Colors.indigoAccent),
                                                    ),
                                                    child: Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      children: [
                                                        const Icon(Icons.assessment, size: 13, color: Colors.cyanAccent),
                                                        const SizedBox(width: 4),
                                                        Text(
                                                          'Score: $totalScore / $totalMax${percentage.isNotEmpty ? " ($percentage%)" : ""}',
                                                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
                                                        ),
                                                      ],
                                                    ),
                                                  ),

                                                // Cumulative Grade
                                                if (grade.isNotEmpty)
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                    decoration: BoxDecoration(
                                                      color: Colors.amber.shade900.withOpacity(0.85),
                                                      borderRadius: BorderRadius.circular(6),
                                                      border: Border.all(color: Colors.amberAccent),
                                                    ),
                                                    child: Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      children: [
                                                        const Icon(Icons.star, size: 13, color: Colors.amberAccent),
                                                        const SizedBox(width: 4),
                                                        Text(
                                                          'Grade: $grade',
                                                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
                                                        ),
                                                      ],
                                                    ),
                                                  ),

                                                // Academic Result
                                                if (academicResult.isNotEmpty)
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                    decoration: BoxDecoration(
                                                      color: isPassed ? Colors.teal.shade800 : Colors.deepOrange.shade900,
                                                      borderRadius: BorderRadius.circular(6),
                                                      border: Border.all(color: isPassed ? Colors.tealAccent : Colors.orangeAccent),
                                                    ),
                                                    child: Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      children: [
                                                        Icon(isPassed ? Icons.verified : Icons.warning_amber, size: 13, color: Colors.white),
                                                        const SizedBox(width: 4),
                                                        Text(
                                                          'Result: $academicResult',
                                                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                              ],
                                            ),
                                            const SizedBox(height: 10),

                                            // Content Preview
                                            Container(
                                              width: double.infinity,
                                              padding: const EdgeInsets.all(10),
                                              decoration: BoxDecoration(
                                                color: Colors.black.withOpacity(0.18),
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: Text(
                                                content,
                                                style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.45),
                                              ),
                                            ),
                                            const SizedBox(height: 10),

                                            // Footer: Authority & View Full Report Card
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Expanded(
                                                  child: Column(
                                                    crossAlignment: CrossAlignment.start,
                                                    children: [
                                                      Text(
                                                        'Authority: $author',
                                                        style: const TextStyle(color: Colors.white70, fontSize: 10),
                                                        maxLines: 1,
                                                        overflow: TextOverflow.ellipsis,
                                                      ),
                                                      if (date.isNotEmpty)
                                                        Text('Date: $date', style: const TextStyle(color: Colors.white60, fontSize: 10)),
                                                    ],
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                                ElevatedButton.icon(
                                                  style: ElevatedButton.styleFrom(
                                                    backgroundColor: Colors.amber,
                                                    foregroundColor: Colors.black87,
                                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                                  ),
                                                  icon: const Icon(Icons.workspace_premium, size: 15),
                                                  label: const Text('View Full Report Card', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                                                  onPressed: () {
                                                    showDialog(
                                                      context: context,
                                                      builder: (ctx) => AlertDialog(
                                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                                        title: Row(
                                                          children: [
                                                            const Icon(Icons.workspace_premium, color: Colors.teal, size: 24),
                                                            const SizedBox(width: 8),
                                                            Expanded(
                                                              child: Text(
                                                                title,
                                                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                                                              ),
                                                            ),
                                                          ],
                                                        ),
                                                        content: SingleChildScrollView(
                                                          child: Column(
                                                            crossAlignment: CrossAlignment.start,
                                                            mainAxisSize: MainAxisSize.min,
                                                            children: [
                                                              // Student & Parent Details Header Box
                                                              Container(
                                                                padding: const EdgeInsets.all(12),
                                                                decoration: BoxDecoration(
                                                                  color: Colors.teal.shade50,
                                                                  borderRadius: BorderRadius.circular(10),
                                                                  border: Border.all(color: Colors.teal.shade100),
                                                                ),
                                                                child: Column(
                                                                  crossAlignment: CrossAlignment.start,
                                                                  children: [
                                                                    Row(
                                                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                                      children: [
                                                                        Expanded(
                                                                          child: Text(
                                                                            sName,
                                                                            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.teal.shade900, fontSize: 15),
                                                                          ),
                                                                        ),
                                                                        Text(
                                                                          'Roll: ${roll.isNotEmpty ? roll : "N/A"}',
                                                                          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.teal.shade800, fontSize: 13),
                                                                        ),
                                                                      ],
                                                                    ),
                                                                    const SizedBox(height: 4),
                                                                    Text('Class: ${clsName.isNotEmpty ? clsName : "Class"}', style: const TextStyle(fontSize: 12, color: Colors.black87)),
                                                                    Text('Parent / Guardian: $parentName', style: const TextStyle(fontSize: 12, color: Colors.black87)),
                                                                    if (pPhone.isNotEmpty)
                                                                      Text('Mobile: $pPhone', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                                                  ],
                                                                ),
                                                              ),
                                                              const SizedBox(height: 12),

                                                              // Academic Performance Summary Grid
                                                              Container(
                                                                padding: const EdgeInsets.all(10),
                                                                decoration: BoxDecoration(
                                                                  color: Colors.grey.shade50,
                                                                  borderRadius: BorderRadius.circular(10),
                                                                  border: Border.all(color: Colors.grey.shade200),
                                                                ),
                                                                child: Column(
                                                                  children: [
                                                                    Row(
                                                                      children: [
                                                                        Expanded(
                                                                          child: Container(
                                                                            padding: const EdgeInsets.all(8),
                                                                            decoration: BoxDecoration(
                                                                              color: isPresent ? Colors.green.shade50 : Colors.red.shade50,
                                                                              borderRadius: BorderRadius.circular(6),
                                                                              border: Border.all(color: isPresent ? Colors.green.shade200 : Colors.red.shade200),
                                                                            ),
                                                                            child: Column(
                                                                              crossAlignment: CrossAlignment.start,
                                                                              children: [
                                                                                const Text("Today's Attendance", style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.w600)),
                                                                                const SizedBox(height: 2),
                                                                                Text(attendance, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: isPresent ? Colors.green.shade800 : Colors.red.shade800)),
                                                                              ],
                                                                            ),
                                                                          ),
                                                                        ),
                                                                        const SizedBox(width: 8),
                                                                        Expanded(
                                                                          child: Container(
                                                                            padding: const EdgeInsets.all(8),
                                                                            decoration: BoxDecoration(
                                                                              color: Colors.amber.shade50,
                                                                              borderRadius: BorderRadius.circular(6),
                                                                              border: Border.all(color: Colors.amber.shade200),
                                                                            ),
                                                                            child: Column(
                                                                              crossAlignment: CrossAlignment.start,
                                                                              children: [
                                                                                const Text('Cumulative Grade', style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.w600)),
                                                                                const SizedBox(height: 2),
                                                                                Text(grade.isNotEmpty ? grade : 'N/A', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.amber.shade900)),
                                                                              ],
                                                                            ),
                                                                          ),
                                                                        ),
                                                                      ],
                                                                    ),
                                                                    const SizedBox(height: 8),
                                                                    Row(
                                                                      children: [
                                                                        Expanded(
                                                                          child: Container(
                                                                            padding: const EdgeInsets.all(8),
                                                                            decoration: BoxDecoration(
                                                                              color: Colors.indigo.shade50,
                                                                              borderRadius: BorderRadius.circular(6),
                                                                              border: Border.all(color: Colors.indigo.shade200),
                                                                            ),
                                                                            child: Column(
                                                                              crossAlignment: CrossAlignment.start,
                                                                              children: [
                                                                                const Text('Total Examination Score', style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.w600)),
                                                                                const SizedBox(height: 2),
                                                                                Text(
                                                                                  totalScore.isNotEmpty ? '$totalScore / $totalMax${percentage.isNotEmpty ? " ($percentage%)" : ""}' : 'N/A',
                                                                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.indigo.shade900),
                                                                                ),
                                                                              ],
                                                                            ),
                                                                          ),
                                                                        ),
                                                                        const SizedBox(width: 8),
                                                                        Expanded(
                                                                          child: Container(
                                                                            padding: const EdgeInsets.all(8),
                                                                            decoration: BoxDecoration(
                                                                              color: isPassed ? Colors.teal.shade50 : Colors.orange.shade50,
                                                                              borderRadius: BorderRadius.circular(6),
                                                                              border: Border.all(color: isPassed ? Colors.teal.shade200 : Colors.orange.shade200),
                                                                            ),
                                                                            child: Column(
                                                                              crossAlignment: CrossAlignment.start,
                                                                              children: [
                                                                                const Text('Academic Result', style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.w600)),
                                                                                const SizedBox(height: 2),
                                                                                Text(
                                                                                  academicResult.isNotEmpty ? academicResult : 'N/A',
                                                                                  style: TextStyle(
                                                                                    fontWeight: FontWeight.bold,
                                                                                    fontSize: 13,
                                                                                    color: isPassed ? Colors.teal.shade900 : Colors.deepOrange.shade900,
                                                                                  ),
                                                                                ),
                                                                              ],
                                                                            ),
                                                                          ),
                                                                        ),
                                                                      ],
                                                                    ),
                                                                  ],
                                                                ),
                                                              ),
                                                              const SizedBox(height: 12),

                                                              // Full Report Message Content
                                                              const Text('Official Report Message:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87)),
                                                              const SizedBox(height: 4),
                                                              Container(
                                                                width: double.infinity,
                                                                padding: const EdgeInsets.all(10),
                                                                decoration: BoxDecoration(
                                                                  color: Colors.grey.shade100,
                                                                  borderRadius: BorderRadius.circular(8),
                                                                  border: Border.all(color: Colors.grey.shade300),
                                                                ),
                                                                child: Text(
                                                                  content,
                                                                  style: const TextStyle(fontSize: 13, height: 1.45, color: Colors.black87),
                                                                ),
                                                              ),
                                                              const SizedBox(height: 14),
                                                              Divider(color: Colors.grey.shade300),
                                                              Row(
                                                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                                children: [
                                                                  Text('Date: $date', style: const TextStyle(color: Colors.grey, fontSize: 11)),
                                                                  Text('Issued by: $author', style: const TextStyle(color: Colors.grey, fontSize: 11)),
                                                                ],
                                                              ),
                                                            ],
                                                          ),
                                                        ),
                                                        actions: [
                                                          TextButton(
                                                            onPressed: () => Navigator.pop(ctx),
                                                            child: const Text('Close', style: TextStyle(fontWeight: FontWeight.bold)),
                                                          ),
                                                        ],
                                                      ),
                                                    );
                                                  },
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      );
                                    }),
                                ],
                              ),
                            );
                          },
                        );
                      },
                    ),

                    // 3. Academic Performance & Marks Card
                    StreamBuilder<QuerySnapshot>(
                      stream: db.collection('marks').snapshots(),
                      builder: (context, marksSnap) {
                        final allMarks = marksSnap.data?.docs ?? [];
                        final childMarks = allMarks.where((m) {
                          final data = m.data() as Map<String, dynamic>;
                          return studentIds.contains(data['studentId']);
                        }).toList();

                        return Container(
                          margin: const EdgeInsets.only(bottom: 24),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(colors: [Colors.purple.shade800, Colors.deepPurple.shade600]),
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 8, offset: Offset(0, 4))],
                          ),
                          child: Column(
                            crossAlignment: CrossAlignment.start,
                            children: [
                              const Row(
                                children: [
                                  Icon(Icons.military_tech, color: Colors.amber, size: 28),
                                  SizedBox(width: 8),
                                  Text(
                                    'Academic Performance & Marks',
                                    style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                              const Divider(color: Colors.white30, height: 20),
                              if (childMarks.isEmpty)
                                const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 8.0),
                                  child: Text(
                                    'Exam marks will appear here once entered by teachers or school admin.',
                                    style: TextStyle(color: Colors.white70, fontSize: 13),
                                  ),
                                )
                              else
                                ...childMarks.map((mDoc) {
                                  final mData = mDoc.data() as Map<String, dynamic>;
                                  final sName = mData['studentName'] ?? 'Student';
                                  final examTitle = mData['examTitle'] ?? 'Exam';
                                  final total = mData['total'] ?? 0;
                                  final maxTotal = mData['maxTotal'] ?? 400;
                                  final percentage = mData['percentage'] ?? 0;
                                  final grade = mData['grade'] ?? '-';
                                  final gradeLabel = mData['gradeLabel'] ?? '';
                                  final marksMap = mData['marks'] as Map<String, dynamic>? ?? {};

                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: Colors.white24),
                                    ),
                                    child: Column(
                                      crossAlignment: CrossAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              '$sName • $examTitle',
                                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                              decoration: BoxDecoration(
                                                color: Colors.amber,
                                                borderRadius: BorderRadius.circular(12),
                                              ),
                                              child: Text(
                                                'Grade $grade',
                                                style: const TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 12),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          'Score: $total / $maxTotal  ($percentage%) • $gradeLabel',
                                          style: const TextStyle(color: Colors.white70, fontSize: 13),
                                        ),
                                        if (marksMap.isNotEmpty) ...[
                                          const SizedBox(height: 8),
                                          Wrap(
                                            spacing: 6,
                                            runSpacing: 4,
                                            children: marksMap.entries.map((e) {
                                              return Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: Colors.white24,
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Text(
                                                  '${e.key}: ${e.value}',
                                                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                                                ),
                                              );
                                            }).toList(),
                                          ),
                                        ]
                                      ],
                                    ),
                                  );
                                }),
                            ],
                          ),
                        );
                      },
                    ),

                    // 4. Live Notices & Alerts for Parents
                    StreamBuilder<QuerySnapshot>(
                      stream: db.collection('notices').snapshots(),
                      builder: (context, noticeSnap) {
                        return StreamBuilder<QuerySnapshot>(
                          stream: db.collection('alerts').snapshots(),
                          builder: (context, alertSnap) {
                            if (!noticeSnap.hasData && !alertSnap.hasData) return const Center(child: CircularProgressIndicator());

                            final allRawDocs = <QueryDocumentSnapshot>[];
                            if (noticeSnap.hasData) allRawDocs.addAll(noticeSnap.data!.docs);
                            if (alertSnap.hasData) allRawDocs.addAll(alertSnap.data!.docs);

                            final seenDocKeys = <String>{};
                            final deduplicatedDocs = <QueryDocumentSnapshot>[];
                            for (var d in allRawDocs) {
                              final map = d.data() as Map<String, dynamic>;
                              final title = (map['title'] ?? '').toString();
                              final sId = (map['studentId'] ?? '').toString();
                              final content = (map['content'] ?? map['message'] ?? '').toString();
                              final dedupKey = '$title-$sId-$content';
                              if (!seenDocKeys.contains(d.id) && !seenDocKeys.contains(dedupKey)) {
                                seenDocKeys.add(d.id);
                                seenDocKeys.add(dedupKey);
                                deduplicatedDocs.add(d);
                              }
                            }

                            final docs = deduplicatedDocs.where((doc) {
                          final data = doc.data() as Map<String, dynamic>;
                          if (data['deletedInAndroid'] == true || data['hiddenInAndroid'] == true) return false;
                          final hiddenFor = (data['hiddenForParents'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];
                          if (cleanPhone.isNotEmpty && hiddenFor.contains(cleanPhone)) return false;

                          final target = (data['targetRole'] ?? 'All').toString();
                          final nPhone = _cleanPhoneDigits(data['parentPhone']);
                          final nId = _cleanPhoneDigits(data['parentId']);
                          final sId = (data['studentId'] ?? '').toString();

                          // 1. Notice sent to ALL
                          if (target == 'All') return true;

                          // 2. Notice sent to PARENTS
                          if (target == 'Parents') return true;

                          // 3. Notice specifically for this child
                          if (sId.isNotEmpty && studentIds.contains(sId)) return true;

                          // 4. Notice sent to this specific parent
                          if (cleanPhone.isNotEmpty && (nPhone == cleanPhone || nId == cleanPhone)) return true;

                          return false;
                        }).toList();

                        // Sort newest first
                        docs.sort((a, b) {
                          final aData = a.data() as Map<String, dynamic>;
                          final bData = b.data() as Map<String, dynamic>;
                          final aTime = aData['createdAt']?.toString() ?? '';
                          final bTime = bData['createdAt']?.toString() ?? '';
                          return bTime.compareTo(aTime);
                        });

                        // Calculate unread count for this parent
                        final unreadCount = docs.where((doc) {
                          final data = doc.data() as Map<String, dynamic>;
                          final isReadField = data['isRead'] == true;
                          final readByList = (data['readBy'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];
                          return !isReadField && !readByList.contains(cleanPhone);
                        }).length;

                        return Column(
                          crossAlignment: CrossAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.notifications_active, color: Colors.indigo, size: 20),
                                const SizedBox(width: 8),
                                const Text('School Alerts & Notices', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                                if (unreadCount > 0) ...[
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.red.shade600,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      '$unreadCount NEW ALERT${unreadCount > 1 ? "S" : ""}',
                                      style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ]
                              ],
                            ),
                            const SizedBox(height: 10),

                            if (docs.isEmpty)
                              Container(
                                padding: const EdgeInsets.all(20),
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade50,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.grey.shade200),
                                ),
                                child: const Column(
                                  children: [
                                    Icon(Icons.mark_email_read_outlined, size: 40, color: Colors.grey),
                                    SizedBox(height: 8),
                                    Text('No announcements or notices for you right now.', style: TextStyle(color: Colors.grey)),
                                  ],
                                ),
                              )
                            else
                              ...docs.map((doc) {
                                final data = doc.data() as Map<String, dynamic>;
                                final isIndividual = data['targetRole'] == 'Selected Parent' ||
                                    (data['parentPhone'] != null && data['parentPhone'].toString().isNotEmpty) ||
                                    (data['studentId'] != null && data['studentId'].toString().isNotEmpty);
                                final isReport = data['type'] == 'report' ||
                                    (data['title'] ?? '').toString().toLowerCase().contains('report');
                                final nType = (data['type'] ?? '').toString().toLowerCase();
                                final isAtt = nType == 'attendance' || (data['title'] ?? '').toString().toLowerCase().contains('attendance');
                                final isMarks = nType == 'marks' || (data['title'] ?? '').toString().toLowerCase().contains('marks');
                                final isExam = nType == 'exam' || (data['title'] ?? '').toString().toLowerCase().contains('exam');
                                final studentName = data['studentName']?.toString();
                                final className = data['className']?.toString();
                                final priority = (data['priority'] ?? 'Normal').toString();
                                final isReadField = data['isRead'] == true;
                                final readByList = (data['readBy'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];
                                final hasRead = isReadField || readByList.contains(cleanPhone);

                                Color priorityColor = Colors.blue;
                                if (priority == 'Urgent') {
                                  priorityColor = Colors.red;
                                } else if (priority == 'High') {
                                  priorityColor = Colors.orange;
                                }

                                return Card(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  elevation: hasRead ? 1 : 3,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    side: BorderSide(
                                      color: !hasRead ? Colors.indigo.shade200 : Colors.grey.shade200,
                                      width: !hasRead ? 1.5 : 1,
                                    ),
                                  ),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(12),
                                    onTap: () async {
                                      if (!hasRead) {
                                        await db.collection('notices').doc(doc.id).update({
                                          'isRead': true,
                                          'status': 'read',
                                          'readBy': FieldValue.arrayUnion([cleanPhone]),
                                        });
                                      }

                                      if (context.mounted) {
                                        showDialog(
                                          context: context,
                                          builder: (ctx) => AlertDialog(
                                            title: Row(
                                              children: [
                                                Icon(isIndividual ? Icons.mark_email_read : Icons.campaign, color: Colors.indigo),
                                                const SizedBox(width: 8),
                                                Expanded(
                                                  child: Text(data['title'] ?? 'Notice Details', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                                                ),
                                              ],
                                            ),
                                            content: SingleChildScrollView(
                                              child: Column(
                                                crossAlignment: CrossAlignment.start,
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  if (isIndividual && studentName != null && studentName.isNotEmpty) ...[
                                                    Container(
                                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                                      decoration: BoxDecoration(
                                                        color: Colors.indigo.shade50,
                                                        borderRadius: BorderRadius.circular(8),
                                                      ),
                                                      child: Row(
                                                        children: [
                                                          const Icon(Icons.school, size: 16, color: Colors.indigo),
                                                          const SizedBox(width: 6),
                                                          Expanded(
                                                            child: Text(
                                                              'Regarding Student: $studentName${className != null ? " ($className)" : ""}',
                                                              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.indigo.shade900, fontSize: 13),
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                    const SizedBox(height: 12),
                                                  ],
                                                  Text(
                                                    (data['content'] ?? data['message'] ?? '').toString(),
                                                    style: const TextStyle(fontSize: 14, height: 1.4, color: Colors.black87),
                                                  ),
                                                  const SizedBox(height: 16),
                                                  Divider(color: Colors.grey.shade300),
                                                  Row(
                                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                    children: [
                                                      Text('Date: ${data['date'] ?? ''}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                                                      Text('By: ${data['author'] ?? 'Admin'}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ),
                                            actions: [
                                              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
                                            ],
                                          ),
                                        );
                                      }
                                    },
                                    child: Padding(
                                      padding: const EdgeInsets.all(12),
                                      child: Column(
                                        crossAlignment: CrossAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: priorityColor.withOpacity(0.12),
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Text(
                                                  priority.toUpperCase(),
                                                  style: TextStyle(color: priorityColor, fontWeight: FontWeight.bold, fontSize: 11),
                                                ),
                                              ),
                                              const SizedBox(width: 6),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: isReport
                                                      ? Colors.teal.shade50
                                                      : isAtt
                                                          ? Colors.green.shade50
                                                          : isMarks
                                                              ? Colors.amber.shade50
                                                              : isExam
                                                                  ? Colors.orange.shade50
                                                                  : (isIndividual ? Colors.purple.shade50 : Colors.grey.shade100),
                                                  borderRadius: BorderRadius.circular(6),
                                                  border: Border.all(
                                                    color: isReport
                                                        ? Colors.teal.shade300
                                                        : isAtt
                                                            ? Colors.green.shade300
                                                            : isMarks
                                                                ? Colors.amber.shade300
                                                                : isExam
                                                                    ? Colors.orange.shade300
                                                                    : Colors.transparent,
                                                  ),
                                                ),
                                                child: Text(
                                                  isReport
                                                      ? '📊 PROGRESS REPORT ALERT'
                                                      : isAtt
                                                          ? '📅 ATTENDANCE ALERT'
                                                          : isMarks
                                                              ? '📝 MARKS UPDATE'
                                                              : isExam
                                                                  ? '📋 EXAM ALERT'
                                                                  : (isIndividual ? 'INDIVIDUAL ALERT' : 'GENERAL NOTICE'),
                                                  style: TextStyle(
                                                    color: isReport
                                                        ? Colors.teal.shade900
                                                        : isAtt
                                                            ? Colors.green.shade900
                                                            : isMarks
                                                                ? Colors.amber.shade900
                                                                : isExam
                                                                    ? Colors.orange.shade900
                                                                    : (isIndividual ? Colors.purple.shade800 : Colors.grey.shade800),
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 10,
                                                  ),
                                                ),
                                              ),
                                              const Spacer(),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: hasRead ? Colors.grey.shade100 : Colors.green.shade50,
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    Icon(
                                                      hasRead ? Icons.check : Icons.fiber_manual_record,
                                                      size: 10,
                                                      color: hasRead ? Colors.grey : Colors.green,
                                                    ),
                                                    const SizedBox(width: 3),
                                                    Text(
                                                      hasRead ? 'Read' : 'New',
                                                      style: TextStyle(
                                                        color: hasRead ? Colors.grey : Colors.green.shade800,
                                                        fontSize: 10,
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 8),
                                          Text(
                                            data['title'] ?? 'Notice',
                                            style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 15,
                                              color: hasRead ? Colors.black87 : Colors.indigo.shade900,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            (data['content'] ?? data['message'] ?? '').toString(),
                                            style: const TextStyle(fontSize: 13, color: Colors.black87, height: 1.4),
                                          ),
                                          if (isIndividual && studentName != null && studentName.isNotEmpty) ...[
                                            const SizedBox(height: 8),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                              decoration: BoxDecoration(
                                                color: Colors.indigo.shade50,
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  const Icon(Icons.person, size: 14, color: Colors.indigo),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    'Student: $studentName${className != null ? " ($className)" : ""}',
                                                    style: TextStyle(
                                                      color: Colors.indigo.shade900,
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 11,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                          const SizedBox(height: 6),
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                'By: ${data['author'] ?? 'Admin'}',
                                                style: const TextStyle(fontSize: 11, color: Colors.grey),
                                              ),
                                              Text(
                                                data['date'] ?? '',
                                                style: const TextStyle(fontSize: 11, color: Colors.grey),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              }),
                          ],
                        );
                      },
                    );
                  },
                ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}

/// ==================== MAIN ANDROID PORTAL SCREEN (EXACT FIRESTORE COLLECTIONS SYNC) ====================
class MainAndroidPortalScreen extends StatefulWidget {
  final bool isTeacher;
  final bool isAdmin;
  final String? teacherId;
  final String? teacherName;
  final String? teacherPhone;
  final List<String>? assignedClassIds;

  const MainAndroidPortalScreen({
    super.key,
    this.isTeacher = false,
    this.isAdmin = false,
    this.teacherId,
    this.teacherName,
    this.teacherPhone,
    this.assignedClassIds,
  });

  @override
  State<MainAndroidPortalScreen> createState() => _MainAndroidPortalScreenState();
}

class _MainAndroidPortalScreenState extends State<MainAndroidPortalScreen> {
  int _tabIndex = 2; // Default to Attendance / Students tab
  String _selectedClassFilter = 'all'; // 'all' or class doc ID
  int _examsSubTabIndex = 1; // 0 for Scheduled Exams, 1 for Marks Management
  String _selectedMarksExamId = 'all'; // Filter exam in Marks Management

  @override
  void initState() {
    super.initState();
    if (widget.isTeacher && widget.assignedClassIds != null && widget.assignedClassIds!.isNotEmpty) {
      _selectedClassFilter = widget.assignedClassIds!.first;
    }
  }

  bool _isClassAssignedToTeacher(DocumentSnapshot cDoc, [Set<String>? liveAssignedIds]) {
    if (!widget.isTeacher) return true; // Admin has access to all classes
    final cId = cDoc.id;
    if (liveAssignedIds != null) {
      return liveAssignedIds.contains(cId);
    }
    final data = cDoc.data() as Map<String, dynamic>;
    final tId = data['teacherId']?.toString() ?? data['classTeacherId']?.toString();
    if (tId != null && tId == widget.teacherId) return true;
    if (widget.assignedClassIds != null && widget.assignedClassIds!.contains(cId)) return true;
    return false;
  }

  void _showAddClassDialog(BuildContext context) {
    final nameCtrl = TextEditingController();
    final sectionCtrl = TextEditingController();
    final roomCtrl = TextEditingController(text: 'Room 101');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.meeting_room, color: Colors.indigo),
            SizedBox(width: 8),
            Text('Add New Class Section', style: TextStyle(fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Class Name (e.g. 10, 9, 8)')),
            TextField(controller: sectionCtrl, decoration: const InputDecoration(labelText: 'Section (e.g. A, B, C)')),
            TextField(controller: roomCtrl, decoration: const InputDecoration(labelText: 'Room Number (e.g. Room 101)')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, foregroundColor: Colors.white),
            onPressed: () async {
              final name = nameCtrl.text.trim();
              final sec = sectionCtrl.text.trim().toUpperCase();
              final room = roomCtrl.text.trim();
              if (name.isEmpty || sec.isEmpty) return;

              // Duplicate class check
              final existingSnap = await FirebaseFirestore.instance.collection('classes').get();
              final isDuplicate = existingSnap.docs.any((doc) {
                final d = doc.data();
                final dName = (d['name'] ?? '').toString().trim().toLowerCase();
                final dSec = (d['section'] ?? '').toString().trim().toUpperCase();
                return dName == name.toLowerCase() && dSec == sec;
              });

              if (isDuplicate) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Class $name - $sec already exists! (हा क्लास आधीच उपलब्ध आहे)'),
                      backgroundColor: Colors.red.shade700,
                    ),
                  );
                }
                return;
              }

              await FirebaseFirestore.instance.collection('classes').add({
                'name': name,
                'section': sec,
                'roomNumber': room.isEmpty ? 'Room 101' : room,
                'teacherId': null,
                'classTeacherId': null,
                'createdAt': DateTime.now().toIso8601String(),
              });

              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Class $name - $sec created successfully!')),
                );
              }
            },
            child: const Text('Create Class'),
          ),
        ],
      ),
    );
  }

  void _showAddStudentDialog(BuildContext context, List<QueryDocumentSnapshot> classDocs) {
    if (classDocs.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add a class first!')),
      );
      return;
    }

    final nameCtrl = TextEditingController();
    final rollCtrl = TextEditingController();
    final parentNameCtrl = TextEditingController();
    final parentPhoneCtrl = TextEditingController();
    String chosenClassId = _selectedClassFilter != 'all' && classDocs.any((c) => c.id == _selectedClassFilter)
        ? _selectedClassFilter
        : classDocs.first.id;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.person_add, color: Colors.indigo),
              SizedBox(width: 8),
              Text('Add New Student', style: TextStyle(fontSize: 18)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: chosenClassId,
                  decoration: const InputDecoration(labelText: 'Assign Class *'),
                  items: classDocs.map((c) {
                    final d = c.data() as Map<String, dynamic>;
                    return DropdownMenuItem(
                      value: c.id,
                      child: Text('${d['name']} - ${d['section']}'),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) setDialogState(() => chosenClassId = val);
                  },
                ),
                TextField(controller: rollCtrl, decoration: const InputDecoration(labelText: 'Roll Number * (e.g. 101)')),
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Student Full Name *')),
                TextField(controller: parentNameCtrl, decoration: const InputDecoration(labelText: 'Parent Name')),
                TextField(
                  controller: parentPhoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Parent Mobile Number * (10 Digits)'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, foregroundColor: Colors.white),
              onPressed: () async {
                final sName = nameCtrl.text.trim();
                final sRoll = rollCtrl.text.trim();
                final pName = parentNameCtrl.text.trim();
                final pPhone = parentPhoneCtrl.text.trim().replaceAll(' ', '');
                if (sName.isEmpty) return;

                await FirebaseFirestore.instance.collection('students').add({
                  'name': sName,
                  'rollNo': sRoll.isEmpty ? '101' : sRoll,
                  'classId': chosenClassId,
                  'parentName': pName.isEmpty ? 'Parent' : pName,
                  'parentPhone': pPhone,
                  'attendanceStatus': 'Not Marked',
                  'attendanceDate': '',
                  'createdAt': DateTime.now().toIso8601String(),
                });

                if (ctx.mounted) Navigator.pop(ctx);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Student $sName saved to class successfully!')),
                  );
                }
              },
              child: const Text('Save Student'),
            ),
          ],
        ),
      ),
    );
  }

  void _showEnterMarksDialog(
    BuildContext context, {
    required String studentId,
    required String studentName,
    required String rollNo,
    required String classId,
    required String className,
    String? preSelectedExamId,
    String? preSelectedExamTitle,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _MarksEntryDialogContent(
        studentId: studentId,
        studentName: studentName,
        rollNo: rollNo,
        classId: classId,
        className: className,
        initialExamId: preSelectedExamId,
        initialExamTitle: preSelectedExamTitle,
      ),
    );
  }

  void _showAddExamDialog(BuildContext context, {String? preSelectedClassId}) {
    final titleCtrl = TextEditingController();
    final subjectCtrl = TextEditingController(text: 'General');
    final maxCtrl = TextEditingController(text: '100');
    final passCtrl = TextEditingController(text: '35');
    String chosenClassId = preSelectedClassId ?? (_selectedClassFilter != 'all' ? _selectedClassFilter : '');
    bool isSaving = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              CircleAvatar(
                backgroundColor: Colors.indigo,
                radius: 18,
                child: Icon(Icons.assignment, color: Colors.white, size: 20),
              ),
              SizedBox(width: 10),
              Text('Schedule New Exam', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAlignment.start,
              children: [
                // Class Selector
                StreamBuilder<QuerySnapshot>(
                  stream: FirebaseFirestore.instance.collection('classes').snapshots(),
                  builder: (ctx, snap) {
                    final classDocs = snap.data?.docs ?? [];
                    if (chosenClassId.isEmpty && classDocs.isNotEmpty) {
                      chosenClassId = classDocs.first.id;
                    }
                    return DropdownButtonFormField<String>(
                      value: chosenClassId.isNotEmpty ? chosenClassId : null,
                      decoration: const InputDecoration(
                        labelText: 'Target Class *',
                        prefixIcon: Icon(Icons.meeting_room, color: Colors.indigo),
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      items: [
                        const DropdownMenuItem(value: 'all', child: Text('All Classes (School-Wide)')),
                        ...classDocs.map((doc) {
                          final d = doc.data() as Map<String, dynamic>;
                          final cName = '${d['name'] ?? ''} - ${d['section'] ?? ''}'.trim();
                          return DropdownMenuItem(
                            value: doc.id,
                            child: Text(cName.isEmpty ? doc.id : cName),
                          );
                        }),
                      ],
                      onChanged: (val) {
                        if (val != null) setDialogState(() => chosenClassId = val);
                      },
                    );
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: titleCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Exam Title * (e.g. Unit Test 1, Mid Term)',
                    prefixIcon: Icon(Icons.edit_note, color: Colors.indigo),
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: subjectCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Subject (e.g. Mathematics, Science, General)',
                    prefixIcon: Icon(Icons.menu_book, color: Colors.indigo),
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: maxCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Max Marks',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: passCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Pass Marks',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: isSaving ? null : () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, foregroundColor: Colors.white),
              onPressed: isSaving ? null : () async {
                final title = titleCtrl.text.trim();
                final subj = subjectCtrl.text.trim();
                final max = int.tryParse(maxCtrl.text.trim()) ?? 100;
                final pass = int.tryParse(passCtrl.text.trim()) ?? 35;

                if (title.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please enter Exam Title')),
                  );
                  return;
                }

                setDialogState(() => isSaving = true);

                try {
                  final now = DateTime.now();
                  final todayDate = now.toIso8601String().split('T')[0];
                  final examDocId = 'e_${now.millisecondsSinceEpoch}';
                  final finalSubj = subj.isEmpty ? 'General' : subj;
                  final targetClassId = chosenClassId.isEmpty ? 'all' : chosenClassId;

                  // Get class name for notification & card display
                  String targetClassName = 'All Classes';
                  if (targetClassId != 'all') {
                    try {
                      final cDoc = await FirebaseFirestore.instance.collection('classes').doc(targetClassId).get();
                      if (cDoc.exists) {
                        final cd = cDoc.data()!;
                        targetClassName = '${cd['name'] ?? ''} - ${cd['section'] ?? ''}'.trim();
                      }
                    } catch (_) {}
                  }

                  // Multi-key payload for Android & Web synchronization
                  final examPayload = {
                    'id': examDocId,
                    'title': title,
                    'examTitle': title,
                    'exam_title': title,
                    'subject': finalSubj,
                    'subject_name': finalSubj,
                    'classId': targetClassId,
                    'class_id': targetClassId,
                    'className': targetClassName,
                    'maxMarks': max,
                    'max_marks': max,
                    'passMarks': pass,
                    'pass_marks': pass,
                    'date': todayDate,
                    'isPublished': true,
                    'createdAt': now.toIso8601String(),
                  };

                  await FirebaseFirestore.instance.collection('exams').doc(examDocId).set(examPayload);

                  // Auto-sync subject to class curriculum subjects in Firestore
                  if (finalSubj != 'General' && targetClassId != 'all') {
                    try {
                      await FirebaseFirestore.instance.collection('classes').doc(targetClassId).update({
                        'subjects': FieldValue.arrayUnion([finalSubj]),
                      });
                    } catch (_) {}
                  }

                  // Real-time notifications to notices, alerts, notifications
                  final notifTitle = 'New Exam Scheduled: $title';
                  final notifContent = 'An exam titled "$title" ($finalSubj, Max Marks: $max) has been scheduled for $targetClassName.';
                  final notifTimestamp = now.toIso8601String();

                  final notifData = {
                    'title': notifTitle,
                    'content': notifContent,
                    'message': notifContent,
                    'priority': 'Normal',
                    'targetRole': 'All',
                    'type': 'exam',
                    'section': 'exams',
                    'classId': targetClassId,
                    'className': targetClassName,
                    'date': todayDate,
                    'createdAt': notifTimestamp,
                    'timestamp': notifTimestamp,
                  };

                  await FirebaseFirestore.instance.collection('notices').add(notifData);
                  await FirebaseFirestore.instance.collection('alerts').add(notifData);
                  await FirebaseFirestore.instance.collection('notifications').add(notifData);

                  if (ctx.mounted) Navigator.pop(ctx);
                  if (mounted) {
                    setState(() {
                      _selectedMarksExamId = examDocId;
                    });
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Exam "$title" created successfully!')),
                    );
                  }
                } catch (e) {
                  setDialogState(() => isSaving = false);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed to save exam: $e'), backgroundColor: Colors.red),
                    );
                  }
                }
              },
              child: isSaving
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Save Exam'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScheduledExamsView(BuildContext context, FirebaseFirestore db) {
    return StreamBuilder<QuerySnapshot>(
      stream: db.collection('exams').snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        final allDocs = snapshot.data!.docs;
        final docs = allDocs.where((d) {
          final data = d.data() as Map<String, dynamic>;
          return data['deletedInAndroid'] != true && data['hiddenInAndroid'] != true;
        }).toList();
        if (docs.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.assignment_late_outlined, size: 60, color: Colors.grey),
                const SizedBox(height: 12),
                const Text('No Exams scheduled by Admin yet.', style: TextStyle(color: Colors.grey, fontSize: 16)),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, foregroundColor: Colors.white),
                  onPressed: () => _showAddExamDialog(context),
                  icon: const Icon(Icons.add),
                  label: const Text('Schedule First Exam'),
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: docs.length,
          itemBuilder: (context, index) {
            final doc = docs[index];
            final data = doc.data() as Map<String, dynamic>;
            final examId = doc.id;
            final title = (data['title'] ?? data['examTitle'] ?? data['exam_title'] ?? 'Exam').toString();
            final subject = (data['subject'] ?? data['subject_name'] ?? 'General').toString();
            final maxMarks = data['maxMarks'] ?? data['max_marks'] ?? 100;
            final classId = (data['classId'] ?? data['class_id'] ?? '').toString();
            final className = (data['className'] ?? (classId == 'all' || classId.isEmpty ? 'All Classes' : 'Class $classId')).toString();

            return Card(
              elevation: 2,
              margin: const EdgeInsets.only(bottom: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAlignment.start,
                  children: [
                    Row(
                      children: [
                        const CircleAvatar(
                          backgroundColor: Colors.indigo,
                          child: Icon(Icons.assignment, color: Colors.white, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAlignment.start,
                            children: [
                              Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                              const SizedBox(height: 2),
                              Text('Class: $className • Subject: $subject • Max Marks: $maxMarks', style: const TextStyle(color: Colors.black54, fontSize: 13)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        StreamBuilder<QuerySnapshot>(
                          stream: db.collection('marks').snapshots(),
                          builder: (ctx, mSnap) {
                            final mDocs = mSnap.data?.docs ?? [];
                            final count = mDocs.where((m) {
                              final md = m.data() as Map<String, dynamic>;
                              return md['examId'] == examId || md['examTitle'] == title;
                            }).length;
                            return Text('$count Students Evaluated', style: TextStyle(color: Colors.green.shade800, fontWeight: FontWeight.bold, fontSize: 12));
                          },
                        ),
                        Row(
                          children: [
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.indigo,
                                foregroundColor: Colors.white,
                                visualDensity: VisualDensity.compact,
                              ),
                              icon: const Icon(Icons.edit_note, size: 16),
                              label: const Text('Enter / View Marks'),
                              onPressed: () {
                                setState(() {
                                  _selectedMarksExamId = examId;
                                  _examsSubTabIndex = 1;
                                });
                              },
                            ),
                            const SizedBox(width: 4),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                              tooltip: 'Remove Exam from Android',
                              visualDensity: VisualDensity.compact,
                              onPressed: () async {
                                final confirm = await showDialog<bool>(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    title: const Row(
                                      children: [
                                        Icon(Icons.archive_outlined, color: Colors.indigo),
                                        SizedBox(width: 8),
                                        Text('Remove from Android?'),
                                      ],
                                    ),
                                    content: Text('Are you sure you want to remove "$title" from the Android portal?\n\n'
                                        '✓ Removed from Android view\n'
                                        '✓ Safely saved & preserved in Web Admin Panel\n\n'
                                        '(हा पेपर अँड्रॉइड ॲपमधून काढला जाईल, पण ॲडमिन पॅनेलमध्ये सुरक्षित सेव्ह राहील.)'),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(ctx, false),
                                        child: const Text('Cancel'),
                                      ),
                                      ElevatedButton(
                                        style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
                                        onPressed: () => Navigator.pop(ctx, true),
                                        child: const Text('Remove from App'),
                                      ),
                                    ],
                                  ),
                                );
                                if (confirm == true) {
                                  final batch = db.batch();
                                  // Soft-delete in Android: Mark as removed, KEEP saved in Admin Panel
                                  batch.update(db.collection('exams').doc(examId), {
                                    'deletedInAndroid': true,
                                    'hiddenInAndroid': true,
                                    'removedFromAndroidAt': DateTime.now().toIso8601String(),
                                  });
                                  // 1. Soft-delete marks records in Android
                                  final mSnap = await db.collection('marks').get();
                                  for (final mDoc in mSnap.docs) {
                                    final md = mDoc.data() as Map<String, dynamic>;
                                    if (md['examId'] == examId || md['examTitle'] == title || mDoc.id.endsWith('_$examId')) {
                                      batch.update(mDoc.reference, {
                                        'deletedInAndroid': true,
                                        'hiddenInAndroid': true,
                                      });
                                    }
                                  }
                                  // 2. Soft-delete exam_results records in Android
                                  try {
                                    final rSnap = await db.collection('exam_results').get();
                                    for (final rDoc in rSnap.docs) {
                                      final rd = rDoc.data() as Map<String, dynamic>;
                                      if (rd['examId'] == examId || rDoc.id.startsWith('res_${examId}_')) {
                                        batch.update(rDoc.reference, {
                                          'deletedInAndroid': true,
                                          'hiddenInAndroid': true,
                                        });
                                      }
                                    }
                                  } catch (_) {}
                                  // 3. Soft-delete exam notice in Android
                                  try {
                                    batch.update(db.collection('notices').doc('notice_exam_$examId'), {
                                      'deletedInAndroid': true,
                                      'hiddenInAndroid': true,
                                    });
                                  } catch (_) {}
                                  await batch.commit();
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text('Exam "$title" removed from Android. Safely saved in Admin Panel.'),
                                        backgroundColor: Colors.indigo,
                                      ),
                                    );
                                  }
                                }
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildMarksManagementView(BuildContext context, FirebaseFirestore db, [Set<String>? liveAllowedClassIds]) {
    return StreamBuilder<QuerySnapshot>(
      stream: db.collection('classes').snapshots(),
      builder: (context, classSnapshot) {
        final rawClassDocs = classSnapshot.data?.docs ?? [];
        final allClasses = rawClassDocs.where((d) {
          final data = d.data() as Map<String, dynamic>;
          return data['deletedInAndroid'] != true && data['hiddenInAndroid'] != true;
        }).toList();

        final classDocs = widget.isTeacher
            ? (liveAllowedClassIds != null
                ? allClasses.where((c) => liveAllowedClassIds.contains(c.id)).toList()
                : allClasses.where((c) => _isClassAssignedToTeacher(c)).toList())
            : allClasses;

        final allowedClassIds = classDocs.map((c) => c.id).toSet();

        if (widget.isTeacher && classDocs.isEmpty) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(24.0),
              child: Text(
                'No class assigned for attendance.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.grey),
              ),
            ),
          );
        }

        final classMap = {
          for (var doc in allClasses)
            doc.id: '${(doc.data() as Map<String, dynamic>)['name'] ?? ''} - ${(doc.data() as Map<String, dynamic>)['section'] ?? ''}'
        };

        final effectiveFilter = widget.isTeacher
            ? (allowedClassIds.contains(_selectedClassFilter) ? _selectedClassFilter : (allowedClassIds.isNotEmpty ? allowedClassIds.first : ''))
            : _selectedClassFilter;

        return StreamBuilder<QuerySnapshot>(
          stream: db.collection('exams').snapshots(),
          builder: (context, examSnapshot) {
            final allExams = examSnapshot.data?.docs ?? [];
            final examDocs = allExams.where((d) {
              final data = d.data() as Map<String, dynamic>;
              return data['deletedInAndroid'] != true && data['hiddenInAndroid'] != true;
            }).toList();

            return StreamBuilder<QuerySnapshot>(
              stream: db.collection('students').snapshots(),
              builder: (context, studentSnapshot) {
                if (!studentSnapshot.hasData) return const Center(child: CircularProgressIndicator());
                final allStudents = studentSnapshot.data!.docs.where((d) {
                  final data = d.data() as Map<String, dynamic>;
                  return data['deletedInAndroid'] != true && data['hiddenInAndroid'] != true;
                }).toList();

                final permittedStudents = widget.isTeacher
                    ? allStudents.where((d) {
                        final sClassId = (d.data() as Map<String, dynamic>)['classId']?.toString();
                        return sClassId != null && allowedClassIds.contains(sClassId);
                      }).toList()
                    : allStudents;

                final filteredStudents = effectiveFilter == 'all' || effectiveFilter.isEmpty
                    ? permittedStudents
                    : permittedStudents.where((d) {
                        final sClassId = (d.data() as Map<String, dynamic>)['classId']?.toString();
                        return sClassId == effectiveFilter;
                      }).toList();

                return StreamBuilder<QuerySnapshot>(
                  stream: db.collection('marks').snapshots(),
                  builder: (context, marksSnapshot) {
                    final rawMarks = marksSnapshot.data?.docs ?? [];
                    final allMarks = rawMarks.where((d) {
                      final data = d.data() as Map<String, dynamic>;
                      return data['deletedInAndroid'] != true && data['hiddenInAndroid'] != true;
                    }).toList();

                    return Column(
                      children: [
                        // Class Selection Chips
                        Container(
                          height: 48,
                          color: Colors.grey.shade100,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            children: [
                              if (!widget.isTeacher) ...[
                                ChoiceChip(
                                  label: Text('All (${allStudents.length})'),
                                  selected: effectiveFilter == 'all',
                                  selectedColor: Colors.indigo,
                                  labelStyle: TextStyle(
                                    color: effectiveFilter == 'all' ? Colors.white : Colors.black87,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                  ),
                                  onSelected: (_) => setState(() {
                                    _selectedClassFilter = 'all';
                                    _selectedMarksExamId = 'all';
                                  }),
                                ),
                                const SizedBox(width: 8),
                              ],
                              ...classDocs.map((cDoc) {
                                final cData = cDoc.data() as Map<String, dynamic>;
                                final cId = cDoc.id;
                                final cName = '${cData['name']} - ${cData['section']}';
                                final count = allStudents.where((d) => (d.data() as Map<String, dynamic>)['classId'] == cId).length;
                                return Padding(
                                  padding: const EdgeInsets.only(right: 8.0),
                                  child: ChoiceChip(
                                    label: Text('$cName ($count)'),
                                    selected: effectiveFilter == cId,
                                    selectedColor: Colors.indigo,
                                    labelStyle: TextStyle(
                                      color: effectiveFilter == cId ? Colors.white : Colors.black87,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                    onSelected: (_) => setState(() {
                                      _selectedClassFilter = cId;
                                      _selectedMarksExamId = 'all';
                                    }),
                                  ),
                                );
                              }),
                            ],
                          ),
                        ),

                        // Exam Filter Bar (Filtered strictly for chosen class)
                        Builder(
                          builder: (context) {
                            final classExamDocs = effectiveFilter == 'all' || effectiveFilter.isEmpty
                                ? examDocs
                                : examDocs.where((eDoc) {
                                    final ed = eDoc.data() as Map<String, dynamic>;
                                    final cId = (ed['classId'] ?? ed['class_id'])?.toString();
                                    return cId == null || cId == 'all' || cId.isEmpty || cId == effectiveFilter;
                                  }).toList();

                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              color: Colors.indigo.shade50,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Exam:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.indigo)),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Container(
                                      height: 36,
                                      padding: const EdgeInsets.symmetric(horizontal: 10),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: Colors.indigo.shade200),
                                      ),
                                      child: DropdownButtonHideUnderline(
                                        child: DropdownButton<String>(
                                          value: (_selectedMarksExamId == 'all' || classExamDocs.any((e) => e.id == _selectedMarksExamId))
                                              ? _selectedMarksExamId
                                              : 'all',
                                          isDense: true,
                                          style: const TextStyle(fontSize: 12, color: Colors.black87, fontWeight: FontWeight.bold),
                                          items: [
                                            const DropdownMenuItem(value: 'all', child: Text('All Exams / Latest')),
                                            ...classExamDocs.map((eDoc) {
                                              final eData = eDoc.data() as Map<String, dynamic>;
                                              final eTitle = (eData['title'] ?? eData['examTitle'] ?? eData['exam_title'] ?? 'Exam').toString();
                                              final eSubj = (eData['subject'] ?? eData['subject_name'] ?? 'General').toString();
                                              return DropdownMenuItem(
                                                value: eDoc.id,
                                                child: Text('$eTitle ($eSubj)'),
                                              );
                                            }),
                                          ],
                                          onChanged: (val) {
                                            if (val != null) setState(() => _selectedMarksExamId = val);
                                          },
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),

                        // Students List with Marks
                        Expanded(
                          child: filteredStudents.isEmpty
                              ? const Center(child: Text('No students found in this class.', style: TextStyle(color: Colors.grey)))
                              : ListView.builder(
                                  padding: const EdgeInsets.all(12),
                                  itemCount: filteredStudents.length,
                                  itemBuilder: (context, index) {
                                    final doc = filteredStudents[index];
                                    final sData = doc.data() as Map<String, dynamic>;
                                    final sId = doc.id;
                                    final sName = sData['name'] ?? 'Student';
                                    final sRoll = sData['rollNo']?.toString() ?? '${index + 1}';
                                    final sClassId = sData['classId']?.toString() ?? '';
                                    final sClassName = sClassId.isNotEmpty && classMap.containsKey(sClassId)
                                        ? classMap[sClassId]!
                                        : (classDocs.isNotEmpty
                                            ? '${(classDocs.first.data() as Map<String, dynamic>)['name']} - ${(classDocs.first.data() as Map<String, dynamic>)['section']}'
                                            : 'Class 10A');

                                    // Find student's marks record
                                    Map<String, dynamic>? studentMarks;
                                    for (final m in allMarks) {
                                      final md = m.data() as Map<String, dynamic>;
                                      if (md['studentId'] == sId) {
                                        if (_selectedMarksExamId == 'all' || md['examId'] == _selectedMarksExamId) {
                                          studentMarks = md;
                                          break;
                                        }
                                      }
                                    }

                                    final hasMarks = studentMarks != null && (studentMarks['marks'] is Map);
                                    final total = hasMarks ? (studentMarks['total'] ?? 0) : 0;
                                    final maxTotal = hasMarks ? (studentMarks['maxTotal'] ?? 400) : 400;
                                    final pct = hasMarks ? (studentMarks['percentage'] ?? 0) : 0;
                                    final grade = hasMarks ? (studentMarks['grade'] ?? '-') : '-';
                                    final gradeLabel = hasMarks ? (studentMarks['gradeLabel'] ?? '') : '';
                                    final marksMap = hasMarks ? (studentMarks['marks'] as Map<String, dynamic>) : <String, dynamic>{};

                                    return Card(
                                      elevation: 2,
                                      margin: const EdgeInsets.only(bottom: 10),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                      child: Padding(
                                        padding: const EdgeInsets.all(12.0),
                                        child: Column(
                                          crossAxisAlignment: CrossAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                CircleAvatar(
                                                  backgroundColor: hasMarks ? Colors.green.shade100 : Colors.grey.shade200,
                                                  child: Text(sRoll, style: TextStyle(fontWeight: FontWeight.bold, color: hasMarks ? Colors.green.shade900 : Colors.black54)),
                                                ),
                                                const SizedBox(width: 12),
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment: CrossAlignment.start,
                                                    children: [
                                                      Text(sName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                                      Text('Class: $sClassName', style: const TextStyle(color: Colors.black54, fontSize: 12)),
                                                    ],
                                                  ),
                                                ),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                                  decoration: BoxDecoration(
                                                    color: hasMarks ? Colors.indigo.shade50 : Colors.grey.shade100,
                                                    borderRadius: BorderRadius.circular(8),
                                                    border: Border.all(color: hasMarks ? Colors.indigo.shade200 : Colors.grey.shade300),
                                                  ),
                                                  child: Text(
                                                    hasMarks ? 'Grade $grade' : 'Not Graded',
                                                    style: TextStyle(
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 12,
                                                      color: hasMarks ? Colors.indigo.shade900 : Colors.grey.shade600,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const Divider(height: 16),
                                            if (hasMarks) ...[
                                              Row(
                                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                children: [
                                                  Text(
                                                    'Score: $total / $maxTotal  ($pct%)',
                                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87),
                                                  ),
                                                  Text(
                                                    gradeLabel,
                                                    style: TextStyle(color: Colors.green.shade800, fontWeight: FontWeight.bold, fontSize: 12),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 6),
                                              Wrap(
                                                spacing: 6,
                                                runSpacing: 4,
                                                children: marksMap.entries.map((e) {
                                                  return Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                    decoration: BoxDecoration(
                                                      color: Colors.grey.shade100,
                                                      borderRadius: BorderRadius.circular(6),
                                                      border: Border.all(color: Colors.grey.shade300),
                                                    ),
                                                    child: Text(
                                                      '${e.key}: ${e.value}',
                                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                                                    ),
                                                  );
                                                }).toList(),
                                              ),
                                              const SizedBox(height: 10),
                                            ] else ...[
                                              const Text('No marks entered for this exam yet.', style: TextStyle(color: Colors.grey, fontSize: 12, fontStyle: FontStyle.italic)),
                                              const SizedBox(height: 10),
                                            ],
                                            Align(
                                              alignment: Alignment.centerRight,
                                              child: ElevatedButton.icon(
                                                style: ElevatedButton.styleFrom(
                                                  backgroundColor: hasMarks ? Colors.indigo : Colors.green.shade700,
                                                  foregroundColor: Colors.white,
                                                  visualDensity: VisualDensity.compact,
                                                ),
                                                icon: Icon(hasMarks ? Icons.edit : Icons.add, size: 16),
                                                label: Text(hasMarks ? 'Edit Marks' : 'Enter Marks'),
                                                onPressed: () {
                                                  _showEnterMarksDialog(
                                                    context,
                                                    studentId: sId,
                                                    studentName: sName,
                                                    rollNo: sRoll,
                                                    classId: sClassId,
                                                    className: sClassName,
                                                    preSelectedExamId: _selectedMarksExamId != 'all' ? _selectedMarksExamId : null,
                                                  );
                                                },
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                ),
                        ),
                      ],
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final db = FirebaseFirestore.instance;

    // Real-time listener for the logged-in teacher's document in Firestore
    return StreamBuilder<DocumentSnapshot>(
      stream: widget.isTeacher && widget.teacherId != null
          ? db.collection('teachers').doc(widget.teacherId).snapshots()
          : Stream.empty(),
      builder: (context, teacherDocSnap) {
        // Extract teacher's assigned classes in real time from teacher's Firestore document
        final Set<String> teacherDocAssignedIds = {};
        String currentTeacherName = widget.teacherName ?? 'Teacher';
        if (widget.isTeacher && teacherDocSnap.hasData && teacherDocSnap.data != null && teacherDocSnap.data!.exists) {
          final tData = teacherDocSnap.data!.data() as Map<String, dynamic>?;
          if (tData != null) {
            if (tData['name'] != null && tData['name'].toString().trim().isNotEmpty) {
              currentTeacherName = tData['name'].toString().trim();
            }
            final list = (tData['assignedClassIds'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];
            teacherDocAssignedIds.addAll(list);
            if (tData['assignedClassId'] != null && tData['assignedClassId'].toString().trim().isNotEmpty) {
              teacherDocAssignedIds.add(tData['assignedClassId'].toString().trim());
            }
          }
        } else if (widget.isTeacher && widget.assignedClassIds != null) {
          teacherDocAssignedIds.addAll(widget.assignedClassIds!);
        }

        // Real-time listener for all school classes in Firestore
        return StreamBuilder<QuerySnapshot>(
          stream: db.collection('classes').snapshots(),
          builder: (context, classSnapshot) {
            if (!classSnapshot.hasData) {
              return Scaffold(
                appBar: AppBar(
                  title: Text(widget.isTeacher ? 'Teacher: $currentTeacherName' : 'Loading...'),
                  backgroundColor: Colors.indigo,
                  foregroundColor: Colors.white,
                ),
                body: const Center(child: CircularProgressIndicator()),
              );
            }

            final rawClassDocs = classSnapshot.data!.docs;
            final allClasses = rawClassDocs.where((d) {
              final data = d.data() as Map<String, dynamic>;
              return data['deletedInAndroid'] != true && data['hiddenInAndroid'] != true;
            }).toList();

            final allExistingClassIds = allClasses.map((c) => c.id).toSet();

            // Classes where this teacher is assigned as class teacher or subject teacher
            final classTeacherAssignedIds = allClasses.where((d) {
              if (!widget.isTeacher || widget.teacherId == null) return false;
              final cData = d.data() as Map<String, dynamic>;
              final tId = cData['teacherId']?.toString() ?? cData['classTeacherId']?.toString();
              return tId == widget.teacherId;
            }).map((d) => d.id).toSet();

            // Live assigned classes: Union of teacher doc assignment and class doc assignment,
            // strictly restricted to classes that exist in the school
            final Set<String> liveAllowedClassIds = widget.isTeacher
                ? {...teacherDocAssignedIds, ...classTeacherAssignedIds}.where((cid) => allExistingClassIds.contains(cid)).toSet()
                : allExistingClassIds;

            final classDocs = widget.isTeacher
                ? allClasses.where((c) => liveAllowedClassIds.contains(c.id)).toList()
                : allClasses;

            final classMap = {
              for (var doc in allClasses)
                doc.id: '${(doc.data() as Map<String, dynamic>)['name'] ?? ''} - ${(doc.data() as Map<String, dynamic>)['section'] ?? ''}'
            };

            // Dynamic class selection: ensure teacher only ever views an assigned class
            String effectiveSelectedClassFilter = _selectedClassFilter;
            if (widget.isTeacher) {
              if (liveAllowedClassIds.isEmpty) {
                effectiveSelectedClassFilter = '';
              } else if (!liveAllowedClassIds.contains(_selectedClassFilter)) {
                effectiveSelectedClassFilter = classDocs.first.id;
              }
            }

            final List<Widget> tabs = [
              // 1. CLASSES TAB (LIVE REAL-TIME STREAM WITH STRICT TEACHER RESTRICTION)
              if (widget.isTeacher && liveAllowedClassIds.isEmpty)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.school_outlined, size: 64, color: Colors.orange),
                        const SizedBox(height: 12),
                        const Text(
                          'No class assigned for attendance.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'You have not been assigned to any class yet. Please contact the administrator in the Web Admin Panel.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 14, color: Colors.black54),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'हजेरी घेण्यासाठी कोणताही क्लास अजून असाइन केलेला नाही. कृपया अ‍ॅडमिन पॅनलमध्ये क्लास असाइन करण्यास सांगा.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 13, color: Colors.black45),
                        ),
                      ],
                    ),
                  ),
                )
              else
                StreamBuilder<QuerySnapshot>(
                  stream: db.collection('students').snapshots(),
                  builder: (context, studentSnapshot) {
                    final rawStudents = studentSnapshot.data?.docs ?? [];
                    final studentDocs = rawStudents.where((d) {
                      final data = d.data() as Map<String, dynamic>;
                      return data['deletedInAndroid'] != true && data['hiddenInAndroid'] != true;
                    }).toList();

                    return StreamBuilder<QuerySnapshot>(
                      stream: db.collection('teachers').snapshots(),
                      builder: (context, teacherSnapshot) {
                        final rawTeachers = teacherSnapshot.data?.docs ?? [];
                        final teacherDocs = rawTeachers.where((d) {
                          final data = d.data() as Map<String, dynamic>;
                          return data['deletedInAndroid'] != true && data['hiddenInAndroid'] != true;
                        }).toList();
                        final teacherMap = {
                          for (var t in teacherDocs)
                            t.id: (t.data() as Map<String, dynamic>)['name'] ?? 'Teacher'
                        };

                        if (classDocs.isEmpty) {
                          return Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.meeting_room_outlined, size: 64, color: Colors.grey),
                                const SizedBox(height: 12),
                                const Text('No Classes added yet.', style: TextStyle(fontSize: 16, color: Colors.grey)),
                                const SizedBox(height: 16),
                                if (!widget.isTeacher)
                                  ElevatedButton.icon(
                                    style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, foregroundColor: Colors.white),
                                    onPressed: () => _showAddClassDialog(context),
                                    icon: const Icon(Icons.add),
                                    label: const Text('Add First Class Section'),
                                  )
                              ],
                            ),
                          );
                        }

                        return ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: classDocs.length,
                          itemBuilder: (context, index) {
                            final cDoc = classDocs[index];
                            final cData = cDoc.data() as Map<String, dynamic>;
                            final cId = cDoc.id;
                            final className = cData['name'] ?? 'Class';
                            final section = cData['section'] ?? '';
                            final room = cData['roomNumber'] ?? 'N/A';
                            final teacherId = cData['teacherId'] ?? cData['classTeacherId'];
                            final teacherName = teacherId != null && teacherMap.containsKey(teacherId)
                                ? teacherMap[teacherId]
                                : 'Not Assigned';

                            final enrolledCount = studentDocs.where((s) {
                              final sData = s.data() as Map<String, dynamic>;
                              return sData['classId'] == cId;
                            }).length;

                            return Card(
                              elevation: 3,
                              margin: const EdgeInsets.only(bottom: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              child: Padding(
                                padding: const EdgeInsets.all(14.0),
                                child: Column(
                                  crossAlignment: CrossAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Row(
                                          children: [
                                            CircleAvatar(
                                              backgroundColor: Colors.indigo.shade100,
                                              child: const Icon(Icons.meeting_room, color: Colors.indigo),
                                            ),
                                            const SizedBox(width: 12),
                                            Column(
                                              crossAlignment: CrossAlignment.start,
                                              children: [
                                                Text('$className - $section', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                                                Text('Room: $room', style: const TextStyle(color: Colors.black54, fontSize: 13)),
                                              ],
                                            ),
                                          ],
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: Colors.blue.shade50,
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Text(
                                            '$enrolledCount Students',
                                            style: TextStyle(color: Colors.blue.shade900, fontWeight: FontWeight.bold, fontSize: 12),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text('Teacher: $teacherName', style: const TextStyle(color: Colors.black800, fontSize: 13)),
                                    const Divider(height: 20),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        ElevatedButton.icon(
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: Colors.indigo,
                                            foregroundColor: Colors.white,
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                          ),
                                          icon: const Icon(Icons.rule, size: 16),
                                          label: const Text('Take Attendance', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                          onPressed: () {
                                            setState(() {
                                              _selectedClassFilter = cId;
                                              _tabIndex = 2; // Switch to Attendance Tab
                                            });
                                          },
                                        ),
                                      ],
                                    )
                                  ],
                                ),
                              ),
                            );
                          },
                        );
                      },
                    );
                  },
                ),

      // 2. TEACHERS TAB
      StreamBuilder<QuerySnapshot>(
        stream: db.collection('teachers').snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          final rawDocs = snapshot.data!.docs;
          final docs = rawDocs.where((d) {
            final data = d.data() as Map<String, dynamic>;
            return data['deletedInAndroid'] != true && data['hiddenInAndroid'] != true;
          }).toList();
          if (docs.isEmpty) return const Center(child: Text('No Teachers added by Admin yet.'));

          return StreamBuilder<QuerySnapshot>(
            stream: db.collection('classes').snapshots(),
            builder: (context, classSnapshot) {
              final rawClassDocs = classSnapshot.data?.docs ?? [];
              final classDocs = rawClassDocs.where((d) {
                final data = d.data() as Map<String, dynamic>;
                return data['deletedInAndroid'] != true && data['hiddenInAndroid'] != true;
              }).toList();
              final classMap = {
                for (var doc in classDocs)
                  doc.id: '${(doc.data() as Map<String, dynamic>)['name'] ?? ''} - ${(doc.data() as Map<String, dynamic>)['section'] ?? ''}'
              };

              return ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: docs.length,
                itemBuilder: (context, index) {
                  final data = docs[index].data() as Map<String, dynamic>;
                  final name = data['name'] ?? 'Teacher';
                  final role = data['role'] ?? 'Teacher';
                  final subject = data['subject'] ?? 'General';
                  final phone = data['phone'] ?? 'N/A';
                  final password = data['password'] ?? '';
                  final assignedClassIds = (data['assignedClassIds'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];

                  final assignedNames = assignedClassIds.map((id) => classMap[id] ?? 'Class').join(', ');

                  return Card(
                    elevation: 3,
                    margin: const EdgeInsets.only(bottom: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAlignment: CrossAlignment.start,
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                radius: 24,
                                backgroundColor: Colors.teal,
                                child: Text(name.isNotEmpty ? name[0] : 'T', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAlignment: CrossAlignment.start,
                                  children: [
                                    Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                    Text('$role • $subject', style: TextStyle(color: Colors.teal.shade800, fontSize: 13, fontWeight: FontWeight.w600)),
                                    Text('Phone: $phone ${password.isNotEmpty ? "• Pwd: $password" : ""}', style: const TextStyle(color: Colors.black54, fontSize: 12)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          if (assignedNames.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(color: Colors.indigo.shade50, borderRadius: BorderRadius.circular(6)),
                              child: Text('Assigned Classes: $assignedNames', style: TextStyle(color: Colors.indigo.shade900, fontSize: 12, fontWeight: FontWeight.bold)),
                            )
                          ]
                        ],
                      ),
                    ),
                  );
                },
              );
            },
          );
        },
      ),

              // 3. STUDENTS & LIVE ATTENDANCE MARKING TAB (WITH STRICT TEACHER ACCESS CONTROL)
              if (widget.isTeacher && liveAllowedClassIds.isEmpty)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.school_outlined, size: 64, color: Colors.orange),
                        const SizedBox(height: 12),
                        const Text(
                          'No class assigned for attendance.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'You have not been assigned to any class yet. Please contact the administrator in the Web Admin Panel.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 14, color: Colors.black54),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'हजेरी घेण्यासाठी कोणताही क्लास अजून असाइन केलेला नाही. कृपया अ‍ॅडमिन पॅनलमध्ये क्लास असाइन करण्यास सांगा.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 13, color: Colors.black45),
                        ),
                      ],
                    ),
                  ),
                )
              else
                StreamBuilder<QuerySnapshot>(
                  stream: db.collection('students').snapshots(),
                  builder: (context, snapshot) {
                    if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
                    final rawDocs = snapshot.data!.docs;
                    final allDocs = rawDocs.where((d) {
                      final data = d.data() as Map<String, dynamic>;
                      return data['deletedInAndroid'] != true && data['hiddenInAndroid'] != true;
                    }).toList();

                    // STRICT ACCESS CONTROL:
                    // Only load students belonging to the currently selected assigned class
                    final permittedDocs = widget.isTeacher
                        ? allDocs.where((d) {
                            final sData = d.data() as Map<String, dynamic>;
                            final sClassId = sData['classId']?.toString();
                            return sClassId != null &&
                                   sClassId == effectiveSelectedClassFilter &&
                                   liveAllowedClassIds.contains(sClassId);
                          }).toList()
                        : (effectiveSelectedClassFilter == 'all'
                            ? allDocs
                            : allDocs.where((d) {
                                final sData = d.data() as Map<String, dynamic>;
                                final sClassId = sData['classId']?.toString();
                                return sClassId == effectiveSelectedClassFilter;
                              }).toList());

                    final todayDate = DateTime.now().toIso8601String().split('T')[0];

                    final presentCount = permittedDocs.where((d) {
                      final sData = d.data() as Map<String, dynamic>;
                      final isToday = (sData['attendanceDate'] ?? '') == todayDate;
                      return isToday && (sData['attendanceStatus'] ?? '') == 'Present';
                    }).length;

                    final absentCount = permittedDocs.where((d) {
                      final sData = d.data() as Map<String, dynamic>;
                      final isToday = (sData['attendanceDate'] ?? '') == todayDate;
                      return isToday && (sData['attendanceStatus'] ?? '') == 'Absent';
                    }).length;

                    final currentClassName = widget.isTeacher
                        ? (classMap[effectiveSelectedClassFilter] ?? 'Assigned Class')
                        : (effectiveSelectedClassFilter == 'all'
                            ? 'All Classes'
                            : (classMap[effectiveSelectedClassFilter] ?? 'Class'));

                    return Column(
                      children: [
                        // Class Selection Filter Chips
                        Container(
                          height: 52,
                          color: Colors.white,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            children: [
                              // All Classes chip: ADMIN ONLY (STRICTLY HIDDEN FOR TEACHERS)
                              if (!widget.isTeacher)
                                Padding(
                                  padding: const EdgeInsets.only(right: 8.0),
                                  child: ChoiceChip(
                                    label: Text('All Classes (${allDocs.length})'),
                                    selected: effectiveSelectedClassFilter == 'all',
                                    selectedColor: Colors.indigo,
                                    labelStyle: TextStyle(
                                      color: effectiveSelectedClassFilter == 'all' ? Colors.white : Colors.black87,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                    onSelected: (_) => setState(() => _selectedClassFilter = 'all'),
                                  ),
                                ),
                              // Each Class chip: STRICTLY ASSIGNED CLASSES FOR TEACHERS
                              ...classDocs.map((cDoc) {
                                final cData = cDoc.data() as Map<String, dynamic>;
                                final cId = cDoc.id;
                                final cName = '${cData['name']} - ${cData['section']}';
                                final count = allDocs.where((d) => (d.data() as Map<String, dynamic>)['classId'] == cId).length;
                                final isSelected = effectiveSelectedClassFilter == cId;

                                return Padding(
                                  padding: const EdgeInsets.only(right: 8.0),
                                  child: ChoiceChip(
                                    label: Text('$cName ($count)'),
                                    selected: isSelected,
                                    selectedColor: Colors.indigo,
                                    labelStyle: TextStyle(
                                      color: isSelected ? Colors.white : Colors.black87,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                    onSelected: (_) => setState(() => _selectedClassFilter = cId),
                                  ),
                                );
                              }),
                            ],
                          ),
                        ),

                        // Attendance Summary Banner
                        Container(
                          color: Colors.indigo.shade50,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAlignment: CrossAlignment.start,
                                children: [
                                  Text(currentClassName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.indigo)),
                                  Text('Enrolled: ${permittedDocs.length} Students', style: const TextStyle(fontSize: 12, color: Colors.black54)),
                                ],
                              ),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(color: Colors.green.shade100, borderRadius: BorderRadius.circular(8)),
                                    child: Text('Present: $presentCount', style: TextStyle(color: Colors.green.shade900, fontWeight: FontWeight.bold, fontSize: 12)),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(color: Colors.red.shade100, borderRadius: BorderRadius.circular(8)),
                                    child: Text('Absent: $absentCount', style: TextStyle(color: Colors.red.shade900, fontWeight: FontWeight.bold, fontSize: 12)),
                                  ),
                                ],
                              )
                            ],
                          ),
                        ),

                        // Students List
                        Expanded(
                          child: permittedDocs.isEmpty
                              ? Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(Icons.people_outline, size: 64, color: Colors.grey),
                                      const SizedBox(height: 12),
                                      Text(
                                        'No students enrolled in $currentClassName yet.',
                                        style: const TextStyle(color: Colors.grey, fontSize: 15),
                                      ),
                                      const SizedBox(height: 16),
                                      ElevatedButton.icon(
                                        style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, foregroundColor: Colors.white),
                                        onPressed: () => _showAddStudentDialog(context, classDocs),
                                        icon: const Icon(Icons.person_add),
                                        label: Text('Add Student to $currentClassName'),
                                      )
                                    ],
                                  ),
                                )
                              : ListView.builder(
                                  padding: const EdgeInsets.all(12),
                                  itemCount: permittedDocs.length,
                                  itemBuilder: (context, index) {
                                    final doc = permittedDocs[index];
                                    final data = doc.data() as Map<String, dynamic>;
                                    final studentId = doc.id;
                                    final rawStatus = (data['attendanceStatus'] ?? '').toString();
                                    final attDate = (data['attendanceDate'] ?? '').toString();
                                    final bool isMarkedToday = attDate == todayDate && (rawStatus == 'Present' || rawStatus == 'Absent');
                                    final attendanceStatus = isMarkedToday ? rawStatus : 'Not Marked';
                                    final isPresent = attendanceStatus == 'Present';
                                    final isAbsent = attendanceStatus == 'Absent';
                                    final studentClassId = data['classId']?.toString();
                                    final studentClassName = studentClassId != null && classMap.containsKey(studentClassId)
                                        ? classMap[studentClassId]!
                                        : currentClassName;

                                    Color statusBgColor = Colors.grey.shade100;
                                    Color statusBorderColor = Colors.grey.shade300;
                                    Color statusTextColor = Colors.grey.shade800;
                                    IconData statusIcon = Icons.radio_button_unchecked;

                                    if (isPresent) {
                                      statusBgColor = Colors.green.shade50;
                                      statusBorderColor = Colors.green.shade300;
                                      statusTextColor = Colors.green.shade800;
                                      statusIcon = Icons.check_circle;
                                    } else if (isAbsent) {
                                      statusBgColor = Colors.red.shade50;
                                      statusBorderColor = Colors.red.shade300;
                                      statusTextColor = Colors.red.shade800;
                                      statusIcon = Icons.cancel;
                                    }

                                    return Card(
                                      elevation: 2,
                                      margin: const EdgeInsets.only(bottom: 10),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                      child: Column(
                                        children: [
                                          ListTile(
                                            leading: CircleAvatar(
                                              backgroundColor: Colors.purple.shade100,
                                              child: Text(data['rollNo']?.toString() ?? '${index + 1}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.purple)),
                                            ),
                                            title: Row(
                                              children: [
                                                Expanded(
                                                  child: Text(data['name'] ?? 'Student', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                                ),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                  decoration: BoxDecoration(color: Colors.indigo.shade50, borderRadius: BorderRadius.circular(6)),
                                                  child: Text(studentClassName, style: TextStyle(color: Colors.indigo.shade900, fontWeight: FontWeight.bold, fontSize: 11)),
                                                )
                                              ],
                                            ),
                                            subtitle: Text('Parent: ${data['parentName'] ?? 'N/A'} (${data['parentPhone'] ?? ''})', style: const TextStyle(fontSize: 12)),
                                            trailing: InkWell(
                                              onTap: () async {
                                                final sClassId = data['classId']?.toString();

                                                // STRICT PERMISSION CHECK: Verify class is assigned to this teacher
                                                if (widget.isTeacher) {
                                                  if (sClassId == null || !liveAllowedClassIds.contains(sClassId) || sClassId != effectiveSelectedClassFilter) {
                                                    if (context.mounted) {
                                                      ScaffoldMessenger.of(context).showSnackBar(
                                                        SnackBar(
                                                          content: const Text('Access Denied: You are only allowed to take attendance for your assigned class!'),
                                                          backgroundColor: Colors.red.shade700,
                                                        ),
                                                      );
                                                    }
                                                    return;
                                                  }

                                                  // Real-time verification against live Firestore document before write
                                                  final tDoc = await db.collection('teachers').doc(widget.teacherId).get();
                                                  final tData = tDoc.data() ?? {};
                                                  final rawIds = (tData['assignedClassIds'] as List<dynamic>?)?.map((e) => e.toString()).toSet() ?? <String>{};
                                                  if (tData['assignedClassId'] != null) {
                                                    rawIds.add(tData['assignedClassId'].toString());
                                                  }
                                                  final cDoc = await db.collection('classes').doc(sClassId).get();
                                                  final cData = cDoc.data() ?? {};
                                                  final cTeacherId = cData['teacherId']?.toString() ?? cData['classTeacherId']?.toString();
                                                  if (cTeacherId == widget.teacherId) {
                                                    rawIds.add(sClassId);
                                                  }

                                                  if (!rawIds.contains(sClassId)) {
                                                    if (context.mounted) {
                                                      ScaffoldMessenger.of(context).showSnackBar(
                                                        SnackBar(
                                                          content: const Text('Permission Denied: Class is not assigned to you in database.'),
                                                          backgroundColor: Colors.red.shade700,
                                                        ),
                                                      );
                                                    }
                                                    return;
                                                  }
                                                }

                                                // Toggle status: if Not Marked or Absent -> Present; if Present -> Absent
                                                final nextStatus = isPresent ? 'Absent' : 'Present';

                                                // 1. Update status in students collection
                                                await db.collection('students').doc(studentId).update({
                                                  'attendanceStatus': nextStatus,
                                                  'attendanceDate': todayDate,
                                                });

                                                // 2. Persist to attendance collection in exact Web Admin format
                                                final attDocId = 'att_${todayDate}_General_$studentId';
                                                await db.collection('attendance').doc(attDocId).set({
                                                  'id': attDocId,
                                                  'studentId': studentId,
                                                  'studentName': data['name'] ?? '',
                                                  'rollNo': data['rollNo'] ?? '',
                                                  'classId': sClassId ?? '',
                                                  'status': nextStatus.toLowerCase(),
                                                  'date': todayDate,
                                                  'subject': 'General',
                                                  'remarks': '',
                                                  'recordedAt': DateTime.now().toIso8601String(),
                                                  'markedByTeacherId': widget.teacherId ?? '',
                                                  'markedByTeacherName': currentTeacherName,
                                                }, SetOptions(merge: true));

                                                // 3. Real-time notification dispatch
                                                final parentPhone = (data['parentPhone'] ?? '').toString().replaceAll(' ', '');
                                                final notifTitle = 'Attendance Update: ${data['name']} ($nextStatus)';
                                                final notifContent = 'Daily attendance for ${data['name']} (Roll: ${data['rollNo']}) was marked as ${nextStatus.toUpperCase()} on $todayDate by teacher.';
                                                final notifTimestamp = DateTime.now().toIso8601String();
                                                await db.collection('notices').add({
                                                  'title': notifTitle,
                                                  'content': notifContent,
                                                  'priority': nextStatus == 'Absent' ? 'High' : 'Normal',
                                                  'targetRole': parentPhone.isNotEmpty ? 'Selected Parent' : 'All',
                                                  'parentPhone': parentPhone,
                                                  'parentId': parentPhone,
                                                  'studentId': studentId,
                                                  'studentName': data['name'] ?? '',
                                                  'classId': sClassId ?? '',
                                                  'type': 'attendance',
                                                  'section': 'attendance',
                                                  'isAlert': true,
                                                  'isRead': false,
                                                  'date': todayDate,
                                                  'createdAt': notifTimestamp,
                                                });
                                              },
                                              child: AnimatedContainer(
                                                duration: const Duration(milliseconds: 200),
                                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                                decoration: BoxDecoration(
                                                  color: statusBgColor,
                                                  border: Border.all(color: statusBorderColor),
                                                  borderRadius: BorderRadius.circular(12),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  mainAxisAlignment: MainAxisAlignment.center,
                                                  children: [
                                                    Icon(
                                                      statusIcon,
                                                      size: 16,
                                                      color: statusTextColor,
                                                    ),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      attendanceStatus,
                                                      style: TextStyle(
                                                        color: statusTextColor,
                                                        fontWeight: FontWeight.bold,
                                                        fontSize: 12,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          ),
                                          const Divider(height: 1, indent: 16, endIndent: 16),
                                          Padding(
                                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                                            child: Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                StreamBuilder<QuerySnapshot>(
                                                  stream: db.collection('marks').where('studentId', isEqualTo: studentId).snapshots(),
                                                  builder: (ctx, mSnap) {
                                                    final mDocs = mSnap.data?.docs ?? [];
                                                    if (mDocs.isEmpty) {
                                                      return const Text('Marks: Not entered yet', style: TextStyle(fontSize: 12, color: Colors.grey));
                                                    }
                                                    final m = mDocs.first.data() as Map<String, dynamic>;
                                                    final pct = m['percentage'] ?? 0;
                                                    final grade = m['grade'] ?? '-';
                                                    return Row(
                                                      children: [
                                                        const Icon(Icons.grade, size: 16, color: Colors.amber),
                                                        const SizedBox(width: 4),
                                                        Text('Score: ${m['total'] ?? 0} ($pct%)', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                                        const SizedBox(width: 6),
                                                        Container(
                                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                                          decoration: BoxDecoration(color: Colors.indigo.shade50, borderRadius: BorderRadius.circular(4)),
                                                          child: Text('Grade $grade', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.indigo.shade900)),
                                                        ),
                                                      ],
                                                    );
                                                  },
                                                ),
                                                OutlinedButton.icon(
                                                  style: OutlinedButton.styleFrom(
                                                    visualDensity: VisualDensity.compact,
                                                    foregroundColor: Colors.indigo,
                                                    side: BorderSide(color: Colors.indigo.shade200),
                                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                                  ),
                                                  icon: const Icon(Icons.edit_note, size: 16),
                                                  label: const Text('Enter Marks', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                                  onPressed: () {
                                                    _showEnterMarksDialog(
                                                      context,
                                                      studentId: studentId,
                                                      studentName: data['name'] ?? 'Student',
                                                      rollNo: data['rollNo']?.toString() ?? '',
                                                      classId: studentClassId ?? '',
                                                      className: studentClassName,
                                                    );
                                                  },
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
                        ),
                      ],
                    );
                  },
                ),

      // 4. NOTICES TAB
      StreamBuilder<QuerySnapshot>(
        stream: db.collection('notices').snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          final allDocs = snapshot.data!.docs;
          final docs = allDocs.where((d) {
            final data = d.data() as Map<String, dynamic>;
            return data['deletedInAndroid'] != true && data['hiddenInAndroid'] != true;
          }).toList();
          if (docs.isEmpty) return const Center(child: Text('No Notices posted by Admin yet.'));

          return ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: docs.length,
            itemBuilder: (context, index) {
              final data = docs[index].data() as Map<String, dynamic>;
              final nType = (data['type'] ?? '').toString().toLowerCase();
              final nTitle = (data['title'] ?? '').toString().toLowerCase();
              final isReport = nType == 'report' || nTitle.contains('report');
              final isAtt = nType == 'attendance' || nTitle.contains('attendance');
              final isMarks = nType == 'marks' || nTitle.contains('marks');
              final isExam = nType == 'exam' || nTitle.contains('exam');
              final isStudent = nType == 'student' || nTitle.contains('student');
              final isTeacher = nType == 'teacher' || nTitle.contains('teacher');
              final isClass = nType == 'class' || nTitle.contains('class');

              Color avatarBg = Colors.indigo;
              IconData avatarIcon = Icons.notifications_active;
              String badgeLabel = 'NOTICE';
              Color badgeColor = Colors.indigo;

              if (isReport) {
                avatarBg = Colors.teal;
                avatarIcon = Icons.assignment_turned_in;
                badgeLabel = 'REPORT ALERT';
                badgeColor = Colors.teal;
              } else if (isAtt) {
                avatarBg = Colors.green.shade700;
                avatarIcon = Icons.how_to_reg;
                badgeLabel = 'ATTENDANCE';
                badgeColor = Colors.green.shade700;
              } else if (isMarks) {
                avatarBg = Colors.amber.shade800;
                avatarIcon = Icons.grade;
                badgeLabel = 'MARKS UPDATE';
                badgeColor = Colors.amber.shade800;
              } else if (isExam) {
                avatarBg = Colors.orange.shade800;
                avatarIcon = Icons.event_note;
                badgeLabel = 'EXAM SCHEDULE';
                badgeColor = Colors.orange.shade800;
              } else if (isStudent) {
                avatarBg = Colors.blue.shade700;
                avatarIcon = Icons.person_add;
                badgeLabel = 'STUDENT';
                badgeColor = Colors.blue.shade700;
              } else if (isTeacher) {
                avatarBg = Colors.purple.shade700;
                avatarIcon = Icons.badge;
                badgeLabel = 'TEACHER';
                badgeColor = Colors.purple.shade700;
              } else if (isClass) {
                avatarBg = Colors.teal.shade800;
                avatarIcon = Icons.school;
                badgeLabel = 'CLASS';
                badgeColor = Colors.teal.shade800;
              }

              return Card(
                elevation: 2,
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: avatarBg,
                    child: Icon(avatarIcon, color: Colors.white, size: 20),
                  ),
                  title: Row(
                    children: [
                      Expanded(
                        child: Text(data['title'] ?? 'Notice', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: badgeColor.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: badgeColor.withOpacity(0.4)),
                        ),
                        child: Text(badgeLabel, style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: badgeColor)),
                      ),
                    ],
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('${data['content'] ?? ''}\nTarget: ${data['targetRole'] ?? 'All'}', style: const TextStyle(fontSize: 12)),
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(data['date'] ?? '', style: const TextStyle(fontSize: 10.5, color: Colors.grey)),
                      IconButton(
                        icon: const Icon(Icons.close, size: 16, color: Colors.grey),
                        tooltip: 'Remove from Android view',
                        onPressed: () async {
                          await db.collection('notices').doc(docs[index].id).update({
                            'deletedInAndroid': true,
                            'hiddenInAndroid': true,
                            'removedFromAndroidAt': DateTime.now().toIso8601String(),
                          });
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Notice removed from Android. Preserved in Admin Panel.'),
                                backgroundColor: Colors.indigo,
                              ),
                            );
                          }
                        },
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),

              // 5. MARKS & EXAMS TAB
              Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    color: Colors.white,
                    child: Row(
                      children: [
                        Expanded(
                          child: ChoiceChip(
                            avatar: const Icon(Icons.assignment, size: 16),
                            label: const Text('Exams List'),
                            selected: _examsSubTabIndex == 0,
                            selectedColor: Colors.indigo,
                            labelStyle: TextStyle(
                              color: _examsSubTabIndex == 0 ? Colors.white : Colors.black87,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                            onSelected: (_) => setState(() => _examsSubTabIndex = 0),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ChoiceChip(
                            avatar: const Icon(Icons.grade, size: 16),
                            label: const Text('Marks Entry'),
                            selected: _examsSubTabIndex == 1,
                            selectedColor: Colors.indigo,
                            labelStyle: TextStyle(
                              color: _examsSubTabIndex == 1 ? Colors.white : Colors.black87,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                            onSelected: (_) => setState(() => _examsSubTabIndex = 1),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: _examsSubTabIndex == 0
                        ? _buildScheduledExamsView(context, db)
                        : _buildMarksManagementView(context, db, liveAllowedClassIds),
                  ),
                ],
              ),
            ];

            return Scaffold(
              appBar: AppBar(
                title: Column(
                  crossAlignment: CrossAlignment.start,
                  children: [
                    Text(
                      widget.isTeacher
                          ? 'Teacher: $currentTeacherName'
                          : 'Student Attendance & Admin Live Sync',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      widget.isTeacher
                          ? (liveAllowedClassIds.isEmpty
                              ? 'No Class Assigned'
                              : 'Assigned: ${classDocs.map((c) => "${(c.data() as Map<String, dynamic>)['name']} - ${(c.data() as Map<String, dynamic>)['section']}").join(", ")}')
                          : 'Full School Overview (All Classes)',
                      style: const TextStyle(fontSize: 11, color: Colors.white70),
                    ),
                  ],
                ),
                backgroundColor: Colors.indigo,
                foregroundColor: Colors.white,
                actions: [
                  IconButton(
                    icon: const Icon(Icons.logout),
                    tooltip: 'Logout / Switch User',
                    onPressed: () {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(builder: (context) => const RoleSelectionScreen()),
                      );
                    },
                  )
                ],
              ),
              body: tabs[_tabIndex],
              floatingActionButton: _tabIndex == 0
                  ? (!widget.isTeacher
                      ? FloatingActionButton.extended(
                          backgroundColor: Colors.indigo,
                          foregroundColor: Colors.white,
                          icon: const Icon(Icons.add),
                          label: const Text('Add Class'),
                          onPressed: () => _showAddClassDialog(context),
                        )
                      : null)
                  : _tabIndex == 2
                      ? (widget.isTeacher && liveAllowedClassIds.isEmpty
                          ? null
                          : FloatingActionButton.extended(
                              backgroundColor: Colors.indigo,
                              foregroundColor: Colors.white,
                              icon: const Icon(Icons.person_add),
                              label: const Text('Add Student'),
                              onPressed: () => _showAddStudentDialog(context, classDocs),
                            ))
                      : (_tabIndex == 4 && _examsSubTabIndex == 0 && !widget.isTeacher)
                          ? FloatingActionButton.extended(
                              backgroundColor: Colors.indigo,
                              foregroundColor: Colors.white,
                              icon: const Icon(Icons.add),
                              label: const Text('Add Exam'),
                              onPressed: () => _showAddExamDialog(context),
                            )
                          : null,
              bottomNavigationBar: BottomNavigationBar(
                currentIndex: _tabIndex,
                selectedItemColor: Colors.indigo,
                unselectedItemColor: Colors.grey,
                type: BottomNavigationBarType.fixed,
                onTap: (idx) => setState(() => _tabIndex = idx),
                items: const [
                  BottomNavigationBarItem(icon: Icon(Icons.meeting_room), label: 'Classes'),
                  BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Teachers'),
                  BottomNavigationBarItem(icon: Icon(Icons.rule), label: 'Attendance'),
                  BottomNavigationBarItem(icon: Icon(Icons.notifications_active), label: 'Alerts'),
                  BottomNavigationBarItem(icon: Icon(Icons.assignment_turned_in), label: 'Marks & Exams'),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _MarksEntryDialogContent extends StatefulWidget {
  final String studentId;
  final String studentName;
  final String rollNo;
  final String classId;
  final String className;
  final String? initialExamId;
  final String? initialExamTitle;

  const _MarksEntryDialogContent({
    required this.studentId,
    required this.studentName,
    required this.rollNo,
    required this.classId,
    required this.className,
    this.initialExamId,
    this.initialExamTitle,
  });

  @override
  State<_MarksEntryDialogContent> createState() => _MarksEntryDialogContentState();
}

class _MarksEntryDialogContentState extends State<_MarksEntryDialogContent> {
  String _chosenExamId = 'general';
  String _chosenExamTitle = 'General Evaluation';
  List<String> _subjects = [];
  List<Map<String, dynamic>> _examList = [];
  final Map<String, TextEditingController> _controllers = {};
  bool _isLoading = true;
  bool _isSaving = false;
  String? _existingDocId;

  @override
  void initState() {
    super.initState();
    _initData();
  }

  Future<void> _initData() async {
    final db = FirebaseFirestore.instance;

    // 1. Fetch class subjects
    try {
      if (widget.classId.isNotEmpty) {
        final classDoc = await db.collection('classes').doc(widget.classId).get();
        if (classDoc.exists) {
          final cData = classDoc.data() as Map<String, dynamic>;
          if (cData['subjects'] is List && (cData['subjects'] as List).isNotEmpty) {
            final sList = (cData['subjects'] as List)
                .map((e) => e.toString().trim())
                .where((s) => s.isNotEmpty && s != 'General')
                .toList();
            if (sList.isNotEmpty) {
              _subjects = sList;
            }
          }
        }
      }
    } catch (_) {}

    // 2. Fetch exams list
    try {
      final examSnaps = await db.collection('exams').get();
      _examList = examSnaps.docs.map((doc) {
        final d = doc.data();
        final title = (d['title'] ?? d['examTitle'] ?? d['exam_title'] ?? 'Exam').toString();
        final subject = (d['subject'] ?? d['subject_name'] ?? 'General').toString();
        final maxMarks = (d['maxMarks'] ?? d['max_marks'] ?? 100).toString();
        final classId = (d['classId'] ?? d['class_id'] ?? '').toString();
        return {
          'id': doc.id,
          'title': title,
          'subject': subject,
          'maxMarks': maxMarks,
          'classId': classId,
        };
      }).toList();

      // Discover additional subjects from exams for this class
      for (final e in _examList) {
        final eCls = e['classId']?.toString() ?? '';
        if (eCls == widget.classId || eCls == 'all' || eCls.isEmpty) {
          final eSubj = e['subject']?.toString().trim() ?? '';
          if (eSubj.isNotEmpty && eSubj != 'General' && !_subjects.contains(eSubj)) {
            _subjects.add(eSubj);
          }
        }
      }
    } catch (_) {}

    // Setup initial controllers
    for (final subj in _subjects) {
      _controllers[subj] = TextEditingController();
    }

    if (widget.initialExamId != null && widget.initialExamId!.isNotEmpty) {
      _chosenExamId = widget.initialExamId!;
      _chosenExamTitle = widget.initialExamTitle ?? 'Exam Evaluation';
    } else if (_examList.isNotEmpty) {
      _chosenExamId = _examList.first['id'];
      _chosenExamTitle = _examList.first['title'];
    } else {
      _chosenExamId = 'general';
      _chosenExamTitle = 'General Evaluation';
    }

    await _loadExistingMarks();
  }

  void _showAddNewSubjectDialog() {
    final subjCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.menu_book, color: Colors.indigo),
            SizedBox(width: 8),
            Text('Add New Subject', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: TextField(
          controller: subjCtrl,
          autofocus: true,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(
            labelText: 'Subject Name (e.g. Marathi, Hindi, Drawing, Computer)',
            border: OutlineInputBorder(),
            isDense: true,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, foregroundColor: Colors.white),
            onPressed: () async {
              final newSubj = subjCtrl.text.trim();
              if (newSubj.isEmpty) return;

              if (!_subjects.contains(newSubj)) {
                setState(() {
                  _subjects.add(newSubj);
                  _controllers[newSubj] = TextEditingController();
                });

                if (widget.classId.isNotEmpty) {
                  try {
                    await FirebaseFirestore.instance.collection('classes').doc(widget.classId).update({
                      'subjects': FieldValue.arrayUnion([newSubj]),
                    });
                  } catch (_) {}
                }
              }
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Add Subject'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    for (final ctrl in _controllers.values) {
      ctrl.dispose();
    }
    super.dispose();
  }

  Future<void> _loadExistingMarks() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    final db = FirebaseFirestore.instance;

    for (final ctrl in _controllers.values) {
      ctrl.text = '';
    }
    _existingDocId = null;

    try {
      final primaryDocId = 'm_${widget.studentId}_$_chosenExamId';
      final docSnap = await db.collection('marks').doc(primaryDocId).get();

      Map<String, dynamic>? data;
      if (docSnap.exists) {
        data = docSnap.data();
        _existingDocId = primaryDocId;
      } else {
        final querySnap = await db.collection('marks').where('studentId', isEqualTo: widget.studentId).get();
        for (final d in querySnap.docs) {
          final m = d.data();
          if (m['examId'] == _chosenExamId || m['examTitle'] == _chosenExamTitle) {
            data = m;
            _existingDocId = d.id;
            break;
          }
        }
        if (data == null && querySnap.docs.isNotEmpty && _chosenExamId == 'general') {
          data = querySnap.docs.first.data();
          _existingDocId = querySnap.docs.first.id;
        }
      }

      if (data != null && data['marks'] is Map) {
        final marksMap = data['marks'] as Map<String, dynamic>;
        // Dynamically include any subject present in student marks
        for (final k in marksMap.keys) {
          final cleanK = k.toString().trim();
          if (cleanK.isNotEmpty && cleanK != 'General' && !_subjects.contains(cleanK)) {
            _subjects.add(cleanK);
            _controllers[cleanK] = TextEditingController();
          }
        }

        for (final subj in _subjects) {
          if (marksMap.containsKey(subj)) {
            _controllers[subj]?.text = marksMap[subj]?.toString() ?? '';
          } else {
            final matchingKey = marksMap.keys.firstWhere(
              (k) => k.trim().toLowerCase() == subj.trim().toLowerCase(),
              orElse: () => '',
            );
            if (matchingKey.isNotEmpty) {
              _controllers[subj]?.text = marksMap[matchingKey]?.toString() ?? '';
            }
          }
        }
      }

      // Also check exam_results for any individual subject marks (e.g. res_examId_subject_studentId or res_examId_studentId)
      try {
        final resDocs = await db.collection('exam_results')
            .where('studentId', isEqualTo: widget.studentId)
            .get();
        for (final rd in resDocs.docs) {
          final rData = rd.data();
          final rExamId = (rData['examId'] ?? rData['exam_id'] ?? '').toString();
          if (rExamId == _chosenExamId || rd.id.contains(_chosenExamId)) {
            final rSubj = (rData['subject'] ?? rData['subject_name'] ?? '').toString().trim().replaceAll('_', ' ');
            final rScore = rData['marks'] ?? rData['marksObtained'] ?? rData['marks_obtained'];
            if (rSubj.isNotEmpty && rSubj != 'General' && rScore != null) {
              if (!_subjects.contains(rSubj)) {
                _subjects.add(rSubj);
                _controllers[rSubj] = TextEditingController();
              }
              if (_controllers[rSubj]?.text.isEmpty ?? true) {
                _controllers[rSubj]?.text = rScore.toString();
              }
            }
          }
        }
      } catch (_) {}
    } catch (e) {
      debugPrint('Error loading student marks: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Map<String, dynamic> _computeStats() {
    double total = 0;
    int enteredCount = 0;
    const maxPerSubj = 100.0;

    for (final subj in _subjects) {
      final text = _controllers[subj]?.text.trim() ?? '';
      if (text.isNotEmpty) {
        final val = double.tryParse(text);
        if (val != null) {
          total += val;
          enteredCount++;
        }
      }
    }

    final maxTotal = _subjects.length * maxPerSubj;
    final percentage = (enteredCount > 0 && maxTotal > 0)
        ? double.parse(((total / maxTotal) * 100).toStringAsFixed(1))
        : 0.0;

    String grade = '-';
    String gradeLabel = 'Not Graded';
    Color gradeColor = Colors.grey;

    if (enteredCount > 0) {
      if (percentage >= 90) {
        grade = 'A+';
        gradeLabel = 'Outstanding';
        gradeColor = Colors.green;
      } else if (percentage >= 80) {
        grade = 'A';
        gradeLabel = 'Excellent';
        gradeColor = Colors.blue;
      } else if (percentage >= 70) {
        grade = 'B+';
        gradeLabel = 'Very Good';
        gradeColor = Colors.teal;
      } else if (percentage >= 60) {
        grade = 'B';
        gradeLabel = 'Good';
        gradeColor = Colors.amber.shade800;
      } else if (percentage >= 50) {
        grade = 'C';
        gradeLabel = 'Average';
        gradeColor = Colors.orange;
      } else if (percentage >= 40) {
        grade = 'D';
        gradeLabel = 'Pass';
        gradeColor = Colors.brown;
      } else {
        grade = 'F';
        gradeLabel = 'Needs Improvement';
        gradeColor = Colors.red;
      }
    }

    return {
      'total': total,
      'maxTotal': maxTotal,
      'percentage': percentage,
      'grade': grade,
      'gradeLabel': gradeLabel,
      'gradeColor': gradeColor,
      'enteredCount': enteredCount,
    };
  }

  Future<void> _saveMarks() async {
    setState(() => _isSaving = true);
    final stats = _computeStats();

    final Map<String, dynamic> marksMap = {};
    for (final subj in _subjects) {
      final text = _controllers[subj]?.text.trim() ?? '';
      marksMap[subj] = text.isNotEmpty ? (double.tryParse(text) ?? 0.0) : 0.0;
    }

    final docId = _existingDocId ?? 'm_${widget.studentId}_$_chosenExamId';
    final payload = {
      'id': docId,
      'studentId': widget.studentId,
      'studentName': widget.studentName,
      'rollNo': widget.rollNo,
      'classId': widget.classId,
      'className': widget.className,
      'examId': _chosenExamId,
      'examTitle': _chosenExamTitle,
      'marks': marksMap,
      'total': stats['total'],
      'maxTotal': stats['maxTotal'],
      'percentage': stats['percentage'],
      'grade': stats['grade'],
      'gradeLabel': stats['gradeLabel'],
      'updatedAt': DateTime.now().toIso8601String(),
      'createdAt': DateTime.now().toIso8601String(),
    };

    try {
      await FirebaseFirestore.instance.collection('marks').doc(docId).set(payload, SetOptions(merge: true));

      // Also write to exam_results for interoperability with Android results view
      if (_chosenExamId.isNotEmpty && widget.studentId.isNotEmpty) {
        final resDocId = 'res_${_chosenExamId}_${widget.studentId}';
        await FirebaseFirestore.instance.collection('exam_results').doc(resDocId).set({
          'id': resDocId,
          'examId': _chosenExamId,
          'exam_id': _chosenExamId,
          'studentId': widget.studentId,
          'student_id': widget.studentId,
          'marksObtained': stats['total'],
          'marks_obtained': stats['total'],
          'marks': marksMap,
          'total': stats['total'],
          'percentage': stats['percentage'],
          'grade': stats['grade'],
          'gradeLabel': stats['gradeLabel'],
          'remarks': '',
          'updatedAt': DateTime.now().toIso8601String(),
        }, SetOptions(merge: true));
      }

      // Dispatch real-time marks notification for parents & Web Admin Panel
      final notifTitle = 'Marks Updated: ${widget.studentName} ($_chosenExamTitle)';
      final notifContent = 'Examination marks recorded for ${widget.studentName} in $_chosenExamTitle. Total score: ${stats['total']} / ${stats['maxTotal']}.';
      final notifTimestamp = DateTime.now().toIso8601String();
      await FirebaseFirestore.instance.collection('notices').add({
        'title': notifTitle,
        'content': notifContent,
        'priority': 'Normal',
        'targetRole': 'Selected Parent',
        'studentId': widget.studentId,
        'studentName': widget.studentName,
        'type': 'marks',
        'section': 'marks',
        'isAlert': true,
        'isRead': false,
        'date': DateTime.now().toIso8601String().split('T')[0],
        'createdAt': notifTimestamp,
      });

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.green.shade700,
            content: Text('Marks for ${widget.studentName} saved & synced to Web Admin Panel!'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: Colors.red, content: Text('Error saving marks: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final stats = _computeStats();

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAlignment: CrossAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  const CircleAvatar(
                    backgroundColor: Colors.indigo,
                    child: Icon(Icons.grade, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAlignment: CrossAlignment.start,
                      children: [
                        Text(
                          'Marks Entry • ${widget.studentName}',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'Roll: ${widget.rollNo} • ${widget.className}',
                          style: const TextStyle(fontSize: 12, color: Colors.black54),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const Divider(height: 20),

              // Exam Selection Row
              Row(
                children: [
                  const Text('Exam: ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.indigo)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      height: 38,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: Colors.indigo.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.indigo.shade200),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _chosenExamId,
                          isDense: true,
                          isExpanded: true,
                          style: const TextStyle(fontSize: 13, color: Colors.indigo, fontWeight: FontWeight.bold),
                          items: [
                            if (_examList.isEmpty)
                              const DropdownMenuItem(value: 'general', child: Text('General Term Evaluation'))
                            else
                              ..._examList.map((e) {
                                return DropdownMenuItem(
                                  value: e['id'].toString(),
                                  child: Text('${e['title']} (${e['subject']})'),
                                );
                              }),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                _chosenExamId = val;
                                final found = _examList.firstWhere(
                                  (e) => e['id'] == val,
                                  orElse: () => {'title': 'General Evaluation'},
                                );
                                _chosenExamTitle = found['title'] ?? 'Exam';
                              });
                              _loadExistingMarks();
                            }
                          },
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Subjects Header with + Add Subject Button
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Subject Marks (0-100)',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87),
                  ),
                  TextButton.icon(
                    onPressed: _showAddNewSubjectDialog,
                    icon: const Icon(Icons.add_circle_outline, size: 16, color: Colors.indigo),
                    label: const Text(
                      '+ Add Subject',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.indigo),
                    ),
                    style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4)),
                  ),
                ],
              ),
              const SizedBox(height: 6),

              // Subjects Inputs
              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.all(30.0),
                  child: Center(child: CircularProgressIndicator()),
                )
              else
                Flexible(
                  child: SingleChildScrollView(
                    child: Column(
                      children: _subjects.map((subj) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10.0),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: Text(
                                  subj,
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                ),
                              ),
                              Expanded(
                                flex: 2,
                                child: SizedBox(
                                  height: 42,
                                  child: TextFormField(
                                    controller: _controllers[subj],
                                    keyboardType: TextInputType.number,
                                    decoration: InputDecoration(
                                      hintText: '0-100',
                                      suffixText: '/100',
                                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                    ),
                                    onChanged: (_) => setState(() {}),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),

              const SizedBox(height: 10),

              // Summary Stats Card
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    Column(
                      children: [
                        const Text('Total Score', style: TextStyle(fontSize: 10, color: Colors.black54)),
                        Text(
                          '${(stats['total'] as double).toInt()} / ${(stats['maxTotal'] as double).toInt()}',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Column(
                      children: [
                        const Text('Percentage', style: TextStyle(fontSize: 10, color: Colors.black54)),
                        Text(
                          '${stats['percentage']}%',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.indigo),
                        ),
                      ],
                    ),
                    Column(
                      children: [
                        const Text('Grade', style: TextStyle(fontSize: 10, color: Colors.black54)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: stats['gradeColor'] as Color,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            stats['grade'] as String,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Action Buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: _isSaving ? null : () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigo,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    ),
                    icon: _isSaving
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.cloud_upload, size: 18),
                    label: Text(_isSaving ? 'Saving...' : 'Save Marks to Cloud'),
                    onPressed: _isSaving ? null : _saveMarks,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
