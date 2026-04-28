// LocalStorage utility for managing app data with Firebase sync
import { child, get, onValue, ref, remove, set, type Unsubscribe } from "firebase/database";
import { createFirebaseAuthUser, database } from "./firebase";

export interface Teacher {
  id: string;
  name: string;
  email: string;
  subject: string;
  password: string;
  firebaseUid?: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  batchId: string;
  password: string;
  firebaseUid?: string;
  collegeName?: string;
  phoneNo?: string;
  studentClass?: string;
}

export interface FeePayment {
  id: string;
  date: string;
  amount: number;
}

export interface FeeRecord {
  studentId: string;
  totalFees: number;
  emiMonths: number;
  payments: FeePayment[];
}

export interface Test {
  id: string;
  name: string;
  batchId: string;
  date: string;
  totalMarks: number;
}

export interface TestResult {
  id: string; // usually studentId_testId
  testId: string;
  studentId: string;
  marksObtained: number;
}

export interface Class {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
  batchId: string;
  schedule: string;
  endDate?: string; // ISO date string (YYYY-MM-DD)
}

export interface InstituteSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface ClassNotification {
  id: string;
  classId: string;
  batchId: string;
  teacherId: string;
  title: string;
  message: string;
  createdAt: string;
}

interface PushNotificationQueueItem {
  id: string;
  role: 'teacher' | 'students_batch';
  referenceId: string;
  notification: ClassNotification;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  subject: string;
  batchId: string;
  teacherId: string;
  content: string;
  fileUrl?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: 'present' | 'absent';
  markedBy: string;
}

export interface Batch {
  id: string;
  name: string;
  year: string;
}

// Delete functions
export const deleteStudent = (studentId: string): boolean => {
  try {
    // Delete student
    const students = getFromStorage<Student>(STORAGE_KEYS.STUDENTS);
    const filteredStudents = students.filter(s => s.id !== studentId);
    saveToStorage(STORAGE_KEYS.STUDENTS, filteredStudents);
    void removeItemFromRealtime(DB_PATHS.STUDENTS, studentId);
    
    // Delete related attendance records
    const attendance = getFromStorage<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
    const attendanceToRemove = attendance.filter(a => a.studentId === studentId);
    const filteredAttendance = attendance.filter(a => a.studentId !== studentId);
    saveToStorage(STORAGE_KEYS.ATTENDANCE, filteredAttendance);
    attendanceToRemove.forEach(record => void removeItemFromRealtime(DB_PATHS.ATTENDANCE, record.id));
    
    return true;
  } catch (error) {
    console.error('Error deleting student:', error);
    return false;
  }
};

export const deleteTeacher = (teacherId: string): boolean => {
  try {
    // Delete teacher
    const teachers = getFromStorage<Teacher>(STORAGE_KEYS.TEACHERS);
    const filteredTeachers = teachers.filter(t => t.id !== teacherId);
    saveToStorage(STORAGE_KEYS.TEACHERS, filteredTeachers);
    void removeItemFromRealtime(DB_PATHS.TEACHERS, teacherId);
    
    // Delete teacher's classes
    const classes = getFromStorage<Class>(STORAGE_KEYS.CLASSES);
    const classesToRemove = classes.filter(c => c.teacherId === teacherId);
    const filteredClasses = classes.filter(c => c.teacherId !== teacherId);
    saveToStorage(STORAGE_KEYS.CLASSES, filteredClasses);
    classesToRemove.forEach(cls => void removeItemFromRealtime(DB_PATHS.CLASSES, cls.id));
    
    // Delete teacher's notes
    const notes = getFromStorage<Note>(STORAGE_KEYS.NOTES);
    const notesToRemove = notes.filter(n => n.teacherId === teacherId);
    const filteredNotes = notes.filter(n => n.teacherId !== teacherId);
    saveToStorage(STORAGE_KEYS.NOTES, filteredNotes);
    notesToRemove.forEach(note => void removeItemFromRealtime(DB_PATHS.NOTES, note.id));
    
    // Delete attendance records for teacher's classes
    const attendance = getFromStorage<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
    const deletedClassIds = classes.filter(c => c.teacherId === teacherId).map(c => c.id);
    const filteredAttendance = attendance.filter(a => !deletedClassIds.includes(a.classId));
    saveToStorage(STORAGE_KEYS.ATTENDANCE, filteredAttendance);
    deletedClassIds.forEach(classId => {
      attendance
        .filter(a => a.classId === classId)
        .forEach(record => void removeItemFromRealtime(DB_PATHS.ATTENDANCE, record.id));
    });
    
    return true;
  } catch (error) {
    console.error('Error deleting teacher:', error);
    return false;
  }
};

export const deleteClass = (classId: string): boolean => {
  try {
    // Delete class
    const classes = getFromStorage<Class>(STORAGE_KEYS.CLASSES);
    const filteredClasses = classes.filter(c => c.id !== classId);
    saveToStorage(STORAGE_KEYS.CLASSES, filteredClasses);
    void removeItemFromRealtime(DB_PATHS.CLASSES, classId);
    
    // Delete related attendance records
    const attendance = getFromStorage<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
    const attendanceToRemove = attendance.filter(a => a.classId === classId);
    const filteredAttendance = attendance.filter(a => a.classId !== classId);
    saveToStorage(STORAGE_KEYS.ATTENDANCE, filteredAttendance);
    attendanceToRemove.forEach(record => void removeItemFromRealtime(DB_PATHS.ATTENDANCE, record.id));
    
    return true;
  } catch (error) {
    console.error('Error deleting class:', error);
    return false;
  }
};

const STORAGE_KEYS = {
  TEACHERS: 'smartclass_teachers',
  STUDENTS: 'smartclass_students',
  CLASSES: 'smartclass_classes',
  NOTES: 'smartclass_notes',
  ATTENDANCE: 'smartclass_attendance',
  BATCHES: 'smartclass_batches',
  CURRENT_USER: 'smartclass_current_user',
  FEES: 'smartclass_fees',
  TESTS: 'smartclass_tests',
  TEST_RESULTS: 'smartclass_test_results',
  INSTITUTE_SETTINGS: 'smartclass_institute_settings',
};

const DB_PATHS = {
  TEACHERS: 'teachers',
  STUDENTS: 'students',
  CLASSES: 'classes',
  NOTES: 'notes',
  ATTENDANCE: 'attendance',
  BATCHES: 'batches',
  NOTIFICATIONS_TEACHERS: 'notifications/teachers',
  NOTIFICATIONS_STUDENTS: 'notifications/students',
  NOTIFICATION_TOKENS_TEACHERS: 'notificationTokens/teachers',
  NOTIFICATION_TOKENS_STUDENTS: 'notificationTokens/students',
  NOTIFICATION_TOKENS_STUDENTS_BATCH: 'notificationTokens/studentsByBatch',
  NOTIFICATION_QUEUE: 'notificationQueue',
  FEES: 'fees',
  TESTS: 'tests',
  TEST_RESULTS: 'testResults',
  INSTITUTE_SETTINGS: 'instituteSettings',
};

// Initialize default data
const initializeDefaultData = () => {
  if (!localStorage.getItem(STORAGE_KEYS.BATCHES)) {
    const defaultBatches: Batch[] = [
      { id: '1', name: 'Batch A', year: '2024' },
      { id: '2', name: 'Batch B', year: '2024' },
      { id: '3', name: 'Batch C', year: '2024' },
    ];
    localStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(defaultBatches));
  }

  if (!localStorage.getItem(STORAGE_KEYS.TEACHERS)) {
    localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.CLASSES)) {
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.NOTES)) {
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.FEES)) {
    localStorage.setItem(STORAGE_KEYS.FEES, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.TESTS)) {
    localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.TEST_RESULTS)) {
    localStorage.setItem(STORAGE_KEYS.TEST_RESULTS, JSON.stringify([]));
  }
};

initializeDefaultData();

const writeItemToRealtime = async (collection: string, id: string, value: unknown) => {
  try {
    await set(ref(database, `${collection}/${id}`), value);
  } catch (error) {
    console.error(`Failed to write ${collection}/${id} to Firebase`, error);
  }
};

const removeItemFromRealtime = async (collection: string, id: string) => {
  try {
    await remove(ref(database, `${collection}/${id}`));
  } catch (error) {
    console.error(`Failed to remove ${collection}/${id} from Firebase`, error);
  }
};

const fetchCollectionFromRealtime = async <T>(collection: string): Promise<T[] | null> => {
  try {
    const snapshot = await get(child(ref(database), collection));
    if (!snapshot.exists()) {
      return [];
    }
    const data = snapshot.val();
    return Object.values(data) as T[];
  } catch (error) {
    console.error(`Failed to fetch ${collection} from Firebase`, error);
    return null;
  }
};

const syncRealtimeData = async () => {
  const [teachers, students, classes, notes, attendance, batches, fees, tests, testResults] = await Promise.all([
    fetchCollectionFromRealtime<Teacher>(DB_PATHS.TEACHERS),
    fetchCollectionFromRealtime<Student>(DB_PATHS.STUDENTS),
    fetchCollectionFromRealtime<Class>(DB_PATHS.CLASSES),
    fetchCollectionFromRealtime<Note>(DB_PATHS.NOTES),
    fetchCollectionFromRealtime<AttendanceRecord>(DB_PATHS.ATTENDANCE),
    fetchCollectionFromRealtime<Batch>(DB_PATHS.BATCHES),
    fetchCollectionFromRealtime<FeeRecord>(DB_PATHS.FEES),
    fetchCollectionFromRealtime<Test>(DB_PATHS.TESTS),
    fetchCollectionFromRealtime<TestResult>(DB_PATHS.TEST_RESULTS),
  ]);

  if (teachers) {
    saveToStorage(STORAGE_KEYS.TEACHERS, teachers);
  }
  if (students) {
    saveToStorage(STORAGE_KEYS.STUDENTS, students);
  }
  if (classes) {
    saveToStorage(STORAGE_KEYS.CLASSES, classes);
  }
  if (notes) {
    saveToStorage(STORAGE_KEYS.NOTES, notes);
  }
  if (attendance) {
    saveToStorage(STORAGE_KEYS.ATTENDANCE, attendance);
  }
  if (batches && batches.length) {
    saveToStorage(STORAGE_KEYS.BATCHES, batches);
  }
  if (fees) {
    saveToStorage(STORAGE_KEYS.FEES, fees);
  }
  if (tests) {
    saveToStorage(STORAGE_KEYS.TESTS, tests);
  }
  if (testResults) {
    saveToStorage(STORAGE_KEYS.TEST_RESULTS, testResults);
  }

  // Sync institute settings (single object, not a collection)
  try {
    const snapshot = await get(child(ref(database), DB_PATHS.INSTITUTE_SETTINGS));
    if (snapshot.exists()) {
      localStorage.setItem(STORAGE_KEYS.INSTITUTE_SETTINGS, JSON.stringify(snapshot.val()));
    }
  } catch (error) {
    console.error('Failed to sync institute settings from Firebase', error);
  }
};

void syncRealtimeData();

export const refreshDataFromFirebase = (): Promise<void> => syncRealtimeData();

interface SaveNotificationTokenOptions {
  batchId?: string;
}

const sanitizeTokenKey = (token: string): string => encodeURIComponent(token);

export const saveNotificationToken = async (
  role: 'teacher' | 'student',
  referenceId: string,
  token: string,
  options: SaveNotificationTokenOptions = {},
): Promise<void> => {
  if (!referenceId || !token) {
    return;
  }

  const now = new Date().toISOString();
  const tokenKey = sanitizeTokenKey(token);
  const payload = { token, updatedAt: now };
  const basePath = role === 'teacher' ? DB_PATHS.NOTIFICATION_TOKENS_TEACHERS : DB_PATHS.NOTIFICATION_TOKENS_STUDENTS;

  try {
    await set(ref(database, `${basePath}/${referenceId}/${tokenKey}`), payload);

    if (role === 'student' && options.batchId) {
      await set(
        ref(database, `${DB_PATHS.NOTIFICATION_TOKENS_STUDENTS_BATCH}/${options.batchId}/${referenceId}/${tokenKey}`),
        { ...payload, batchId: options.batchId },
      );
    }
  } catch (error) {
    console.error('Failed to save notification token', error);
  }
};

const enqueuePushNotification = async (
  role: PushNotificationQueueItem['role'],
  referenceId: string,
  notification: ClassNotification,
): Promise<void> => {
  const item: PushNotificationQueueItem = {
    id: `${notification.id}_${role}_${referenceId}`,
    role,
    referenceId,
    notification,
    createdAt: new Date().toISOString(),
  };

  try {
    await set(ref(database, `${DB_PATHS.NOTIFICATION_QUEUE}/${item.id}`), item);
  } catch (error) {
    console.error('Failed to enqueue push notification', error);
  }
};

const buildClassNotificationPayload = (classData: Class): ClassNotification => {
  return {
    id: `${classData.id}_${Date.now()}`,
    classId: classData.id,
    batchId: classData.batchId,
    teacherId: classData.teacherId,
    title: `${classData.name} scheduled`,
    message: `${classData.subject} • ${classData.schedule}`,
    createdAt: new Date().toISOString(),
  };
};

const notifyClassCreation = async (classData: Class): Promise<void> => {
  const notification = buildClassNotificationPayload(classData);
  const teacherPath = `${DB_PATHS.NOTIFICATIONS_TEACHERS}/${classData.teacherId}/${notification.id}`;
  const studentPath = `${DB_PATHS.NOTIFICATIONS_STUDENTS}/${classData.batchId}/${notification.id}`;

  try {
    await Promise.all([
      set(ref(database, teacherPath), notification),
      set(ref(database, studentPath), notification),
      enqueuePushNotification('teacher', classData.teacherId, notification),
      enqueuePushNotification('students_batch', classData.batchId, notification),
    ]);
  } catch (error) {
    console.error('Failed to write class notification to Firebase', error);
  }
};

const attachListener = <T>(collection: string, storageKey: string): Unsubscribe => {
  const databaseRef = ref(database, collection);
  const unsubscribe = onValue(
    databaseRef,
    snapshot => {
      const data = snapshot.val();
      const items = data ? (Object.values(data) as T[]) : [];
      saveToStorage(storageKey, items);
    },
    error => {
      console.error(`Failed to listen for updates on ${collection}`, error);
    }
  );
  return unsubscribe;
};

export const subscribeToRealtimeUpdates = (): Unsubscribe => {
  const unsubscribes: Unsubscribe[] = [
    attachListener<Teacher>(DB_PATHS.TEACHERS, STORAGE_KEYS.TEACHERS),
    attachListener<Student>(DB_PATHS.STUDENTS, STORAGE_KEYS.STUDENTS),
    attachListener<Class>(DB_PATHS.CLASSES, STORAGE_KEYS.CLASSES),
    attachListener<Note>(DB_PATHS.NOTES, STORAGE_KEYS.NOTES),
    attachListener<AttendanceRecord>(DB_PATHS.ATTENDANCE, STORAGE_KEYS.ATTENDANCE),
    attachListener<Batch>(DB_PATHS.BATCHES, STORAGE_KEYS.BATCHES),
    attachListener<FeeRecord>(DB_PATHS.FEES, STORAGE_KEYS.FEES),
    attachListener<Test>(DB_PATHS.TESTS, STORAGE_KEYS.TESTS),
    attachListener<TestResult>(DB_PATHS.TEST_RESULTS, STORAGE_KEYS.TEST_RESULTS),
  ];

  return () => {
    unsubscribes.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        console.error("Failed to unsubscribe from Firebase listener", error);
      }
    });
  };
};

export const subscribeToClassNotifications = (
  role: 'student' | 'teacher',
  referenceId: string,
  callback: (notifications: ClassNotification[]) => void,
): Unsubscribe => {
  if (!referenceId) {
    return () => undefined;
  }

  const basePath = role === 'teacher' ? DB_PATHS.NOTIFICATIONS_TEACHERS : DB_PATHS.NOTIFICATIONS_STUDENTS;
  const notificationsRef = ref(database, `${basePath}/${referenceId}`);

  const unsubscribe = onValue(
    notificationsRef,
    snapshot => {
      const data = snapshot.val();
      const notifications = data ? (Object.values(data) as ClassNotification[]) : [];
      notifications.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      callback(notifications);
    },
    error => {
      console.error('Failed to listen for class notifications', error);
    }
  );

  return unsubscribe;
};

export const acknowledgeClassNotification = async (
  role: 'student' | 'teacher',
  referenceId: string,
  notificationId: string,
): Promise<void> => {
  const basePath = role === 'teacher' ? DB_PATHS.NOTIFICATIONS_TEACHERS : DB_PATHS.NOTIFICATIONS_STUDENTS;
  const notificationRef = ref(database, `${basePath}/${referenceId}/${notificationId}`);
  try {
    await remove(notificationRef);
  } catch (error) {
    console.error('Failed to acknowledge class notification', error);
  }
};

// Generic functions
const getFromStorage = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const saveToStorage = <T>(key: string, data: T[]): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Teachers
export const getTeachers = (): Teacher[] => getFromStorage<Teacher>(STORAGE_KEYS.TEACHERS);
export const addTeacher = async (teacher: Teacher): Promise<void> => {
  try {
    const firebaseUid = await createFirebaseAuthUser(teacher.email, teacher.password);
    const teacherRecord: Teacher = { ...teacher, firebaseUid };
    const teachers = getTeachers();
    saveToStorage(STORAGE_KEYS.TEACHERS, [...teachers, teacherRecord]);
    await writeItemToRealtime(DB_PATHS.TEACHERS, teacherRecord.id, teacherRecord);
  } catch (error) {
    console.error("Error adding teacher:", error);
    throw error;
  }
};
export const getTeacherById = (id: string): Teacher | undefined => {
  return getTeachers().find(t => t.id === id);
};

// Students
export const getStudents = (): Student[] => getFromStorage<Student>(STORAGE_KEYS.STUDENTS);
export const addStudent = async (student: Student): Promise<void> => {
  try {
    const firebaseUid = await createFirebaseAuthUser(student.email, student.password);
    const studentRecord: Student = { ...student, firebaseUid };
    const students = getStudents();
    saveToStorage(STORAGE_KEYS.STUDENTS, [...students, studentRecord]);
    await writeItemToRealtime(DB_PATHS.STUDENTS, studentRecord.id, studentRecord);
  } catch (error) {
    console.error("Error adding student:", error);
    throw error;
  }
};
export const getStudentsByBatch = (batchId: string): Student[] => {
  return getStudents().filter(s => s.batchId === batchId);
};

export const changeStudentPassword = (studentId: string, newPassword: string): boolean => {
  try {
    const students = getStudents();
    const updatedStudents = students.map(student => 
      student.id === studentId 
        ? { ...student, password: newPassword }
        : student
    );
    saveToStorage(STORAGE_KEYS.STUDENTS, updatedStudents);
    const updated = updatedStudents.find(student => student.id === studentId);
    if (updated) {
      void writeItemToRealtime(DB_PATHS.STUDENTS, studentId, updated);
    }
    return true;
  } catch (error) {
    console.error('Error changing student password:', error);
    return false;
  }
};

// Classes
export const getClasses = (): Class[] => getFromStorage<Class>(STORAGE_KEYS.CLASSES);
export const addClass = async (classData: Class): Promise<void> => {
  const classes = getClasses();
  saveToStorage(STORAGE_KEYS.CLASSES, [...classes, classData]);
  try {
    await writeItemToRealtime(DB_PATHS.CLASSES, classData.id, classData);
    await notifyClassCreation(classData);
  } catch (error) {
    console.error('Error adding class to realtime or notifying:', error);
    // still resolve so caller can continue, but error logged
  }
};
export const getClassesByTeacher = (teacherId: string): Class[] => {
  return getClasses().filter(c => c.teacherId === teacherId);
};
export const getClassesByBatch = (batchId: string): Class[] => {
  return getClasses().filter(c => c.batchId === batchId);
};

// Notes
export const getNotes = (): Note[] => getFromStorage<Note>(STORAGE_KEYS.NOTES);
export const addNote = (note: Note): void => {
  const notes = getNotes();
  saveToStorage(STORAGE_KEYS.NOTES, [...notes, note]);
  void writeItemToRealtime(DB_PATHS.NOTES, note.id, note);
};
export const getNotesByBatch = (batchId: string): Note[] => {
  return getNotes().filter(n => n.batchId === batchId);
};

// Attendance
export const getAttendance = (): AttendanceRecord[] => getFromStorage<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
export const markAttendance = (record: AttendanceRecord): void => {
  const attendance = getAttendance();
  // Remove existing record for same student, class, and date
  const filtered = attendance.filter(
    a => !(a.studentId === record.studentId && a.classId === record.classId && a.date === record.date)
  );
  saveToStorage(STORAGE_KEYS.ATTENDANCE, [...filtered, record]);
  void writeItemToRealtime(DB_PATHS.ATTENDANCE, record.id, record);
};
export const getStudentAttendance = (studentId: string): AttendanceRecord[] => {
  return getAttendance().filter(a => a.studentId === studentId);
};
export const getAttendanceByClass = (classId: string, date: string): AttendanceRecord[] => {
  return getAttendance().filter(a => a.classId === classId && a.date === date);
};

// Batches
export const getBatches = (): Batch[] => getFromStorage<Batch>(STORAGE_KEYS.BATCHES);
export const addBatch = (batch: Batch): void => {
  const batches = getBatches();
  saveToStorage(STORAGE_KEYS.BATCHES, [...batches, batch]);
  void writeItemToRealtime(DB_PATHS.BATCHES, batch.id, batch);
};

// Current User
export const setCurrentUser = (user: { id: string; role: string; name: string }): void => {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
};
export const getCurrentUser = (): { id: string; role: string; name: string } | null => {
  const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return data ? JSON.parse(data) : null;
};
export const clearCurrentUser = (): void => {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
};

// Fees
export const getFeeRecords = (): FeeRecord[] => getFromStorage<FeeRecord>(STORAGE_KEYS.FEES);

export const getFeeRecordByStudent = (studentId: string): FeeRecord | undefined => {
  return getFeeRecords().find(f => f.studentId === studentId);
};

export const updateFeeRecord = (feeRecord: FeeRecord): void => {
  const records = getFeeRecords();
  const index = records.findIndex(f => f.studentId === feeRecord.studentId);
  
  let newRecords;
  if (index >= 0) {
    newRecords = [...records];
    newRecords[index] = feeRecord;
  } else {
    newRecords = [...records, feeRecord];
  }
  
  saveToStorage(STORAGE_KEYS.FEES, newRecords);
  void writeItemToRealtime(DB_PATHS.FEES, feeRecord.studentId, feeRecord);
};

export const addFeePayment = (studentId: string, amount: number): FeeRecord | null => {
  const record = getFeeRecordByStudent(studentId);
  if (!record) return null;
  
  const payment: FeePayment = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    amount
  };
  
  const updatedRecord = {
    ...record,
    payments: [...(record.payments || []), payment]
  };
  
  updateFeeRecord(updatedRecord);
  return updatedRecord;
};

// Tests
export const getTests = (): Test[] => getFromStorage<Test>(STORAGE_KEYS.TESTS);
export const getTestsByBatch = (batchId: string): Test[] => getTests().filter(t => t.batchId === batchId);
export const addTest = (test: Test): void => {
  const tests = getTests();
  saveToStorage(STORAGE_KEYS.TESTS, [...tests, test]);
  void writeItemToRealtime(DB_PATHS.TESTS, test.id, test);
};

export const deleteTest = (testId: string): boolean => {
  try {
    const tests = getTests();
    saveToStorage(STORAGE_KEYS.TESTS, tests.filter(t => t.id !== testId));
    void removeItemFromRealtime(DB_PATHS.TESTS, testId);

    // Also delete associated results
    const results = getTestResults();
    const resultsToRemove = results.filter(r => r.testId === testId);
    saveToStorage(STORAGE_KEYS.TEST_RESULTS, results.filter(r => r.testId !== testId));
    resultsToRemove.forEach(r => void removeItemFromRealtime(DB_PATHS.TEST_RESULTS, r.id));

    return true;
  } catch (error) {
    console.error('Error deleting test:', error);
    return false;
  }
};

// Test Results
export const getTestResults = (): TestResult[] => getFromStorage<TestResult>(STORAGE_KEYS.TEST_RESULTS);
export const getTestResultsByTest = (testId: string): TestResult[] => getTestResults().filter(r => r.testId === testId);
export const getTestResultsByStudent = (studentId: string): TestResult[] => getTestResults().filter(r => r.studentId === studentId);

export const saveTestResult = (result: TestResult): void => {
  const results = getTestResults();
  const existingIndex = results.findIndex(r => r.id === result.id);
  
  let newResults;
  if (existingIndex >= 0) {
    newResults = [...results];
    newResults[existingIndex] = result;
  } else {
    newResults = [...results, result];
  }
  
  saveToStorage(STORAGE_KEYS.TEST_RESULTS, newResults);
  void writeItemToRealtime(DB_PATHS.TEST_RESULTS, result.id, result);
};

// Authentication helper
export const authenticateUser = (email: string, password: string, role: string): { id: string; name: string } | null => {
  if (role === 'admin') {
    if (email === 'admin@smartclass.com' && password === 'admin123') {
      return { id: 'admin', name: 'Administrator' };
    }
    return null;
  }

  if (role === 'teacher') {
    const teacher = getTeachers().find(t => t.email === email && t.password === password);
    return teacher ? { id: teacher.id, name: teacher.name } : null;
  }

  if (role === 'student') {
    const student = getStudents().find(s => s.email === email && s.password === password);
    return student ? { id: student.id, name: student.name } : null;
  }

  return null;
};

// Institute Settings
export const getInstituteSettings = (): InstituteSettings => {
  const data = localStorage.getItem(STORAGE_KEYS.INSTITUTE_SETTINGS);
  if (data) {
    try {
      return JSON.parse(data) as InstituteSettings;
    } catch {
      // fallback
    }
  }
  return { name: 'SmartClass', address: '', phone: '', email: '' };
};

export const saveInstituteSettings = async (settings: InstituteSettings): Promise<void> => {
  localStorage.setItem(STORAGE_KEYS.INSTITUTE_SETTINGS, JSON.stringify(settings));
  try {
    await set(ref(database, DB_PATHS.INSTITUTE_SETTINGS), settings);
  } catch (error) {
    console.error('Failed to save institute settings to Firebase', error);
  }
};

// Class date helpers
export const isClassPast = (classItem: Class): boolean => {
  if (!classItem.endDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(classItem.endDate + 'T00:00:00');
  return endDate < today;
};
