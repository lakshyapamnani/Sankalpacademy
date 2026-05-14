const fs = require('fs');
const path = './src/lib/localStorage.ts';
let code = fs.readFileSync(path, 'utf8');

// Normalize line endings to \n to make regexes easy
code = code.replace(/\r\n/g, '\n');

// 1. Remove Teacher interface
code = code.replace(/export interface Teacher \{[\s\S]*?\n\}\n/, '');

// 2. Remove Teacher-related DB_PATHS and STORAGE_KEYS
code = code.replace(/  TEACHERS: 'smartclass_teachers',\n/, '');
code = code.replace(/  TEACHERS: 'teachers',\n/, '');
code = code.replace(/  NOTIFICATIONS_TEACHERS: 'notifications\/teachers',\n/, '');
code = code.replace(/  NOTIFICATION_TOKENS_TEACHERS: 'notificationTokens\/teachers',\n/, '');

// 3. Remove teacherId from interfaces
code = code.replace(/  teacherId: string;\n/g, '');

// 4. Update PushNotificationQueueItem role
code = code.replace(/role: 'teacher' \| 'students_batch';/, "role: 'students_batch';");

// 5. Remove deleteTeacher
code = code.replace(/export const deleteTeacher =[\s\S]*?return false;\n  \}\n\};\n/, '');

// 6. Remove teachers from initializeDefaultData
code = code.replace(/  if \(!localStorage\.getItem\(STORAGE_KEYS\.TEACHERS\)\) \{\n    localStorage\.setItem\(STORAGE_KEYS\.TEACHERS, JSON\.stringify\(\[\]\)\);\n  \}\n\n/, '');

// 7. Remove from syncRealtimeData
code = code.replace(/teachers, /g, '');
code = code.replace(/    fetchCollectionFromRealtime<Teacher>\(DB_PATHS\.TEACHERS\),\n/, '');
code = code.replace(/  if \(teachers\) \{\n    saveToStorage\(STORAGE_KEYS\.TEACHERS, teachers\);\n  \}\n/, '');

// 8. Update saveNotificationToken role & basePath
code = code.replace(/role: 'teacher' \| 'student',/g, "role: 'student',");
code = code.replace(/const basePath = role === 'teacher' \? DB_PATHS\.NOTIFICATION_TOKENS_TEACHERS : DB_PATHS\.NOTIFICATION_TOKENS_STUDENTS;/g, "const basePath = DB_PATHS.NOTIFICATION_TOKENS_STUDENTS;");

// 9. Update notifyClassCreation
code = code.replace(/  const teacherPath = \\$\{DB_PATHS\.NOTIFICATIONS_TEACHERS\}\/\$\{classData\.teacherId\}\/\$\{notification\.id\}\;\n/g, '');
code = code.replace(/      set\(ref\(database, teacherPath\), notification\),\n/g, '');
code = code.replace(/      enqueuePushNotification\('teacher', classData\.teacherId, notification\),\n/g, '');

// 10. Remove subscribeToRealtimeUpdates Teacher listener
code = code.replace(/    attachListener<Teacher>\(DB_PATHS\.TEACHERS, STORAGE_KEYS\.TEACHERS, onUpdate\),\n/g, '');

// 11. Update subscribeToClassNotifications & acknowledgeClassNotification
code = code.replace(/role: 'student' \| 'teacher'/g, "role: 'student'");
code = code.replace(/const basePath = role === 'teacher' \? DB_PATHS\.NOTIFICATIONS_TEACHERS : DB_PATHS\.NOTIFICATIONS_STUDENTS;/g, "const basePath = DB_PATHS.NOTIFICATIONS_STUDENTS;");

// 12. Remove getTeachers, addTeacher, etc. if they exist
code = code.replace(/export const getTeachers = \(\): Teacher\[\] => getFromStorage<Teacher>\(STORAGE_KEYS\.TEACHERS\);\n/g, '');

// 13. Remove getClassesByTeacher and getNotesByTeacher
code = code.replace(/export const getClassesByTeacher = \(teacherId: string\): Class\[\] => \{\n  return getClasses\(\)\.filter\(c => c\.teacherId === teacherId\);\n\};\n/g, '');
code = code.replace(/export const getNotesByTeacher = \(teacherId: string\): Note\[\] => \{\n  return getNotes\(\)\.filter\(n => n\.teacherId === teacherId\);\n\};\n/g, '');

// 14. Update authenticateUser
code = code.replace(/  if \(role === 'teacher'\) \{\n    const teacher = getTeachers\(\)\.find\(t => t\.email === email && t\.password === password\);\n    return teacher \? \{ id: teacher\.id, name: teacher\.name \} : null;\n  \}\n\n/g, '');

// Re-write to original line endings if needed, but native fs writes \n on Windows just fine
fs.writeFileSync(path, code);
