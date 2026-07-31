// LocalStorage utility for managing app data with Firebase sync
import { child, get, onValue, ref, remove, set, type Unsubscribe } from "firebase/database";
import { createFirebaseAuthUser, database } from "./firebase";

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

export interface Student {
  id: string;
  name: string;
  email: string;
  batchId: string;
  password: string;
  firebaseUid?: string;
  collegeName?: string;
  phoneNo?: string;
  whatsappNo?: string;
  studentClass?: string;
  parentWhatsApp?: string;
  dob?: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  firebaseUid?: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  password: string;
  assignedSubjects: string[];
  assignedBatchIds?: string[];
  firebaseUid?: string;
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

export interface MCQQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
}

export interface Test {
  id: string;
  name: string;
  batchId?: string; // legacy single-batch
  batchIds?: string[]; // new multi-batch assignment
  date: string;
  totalMarks: number;
  subject?: string; // e.g. "Mathematics", "Physics", etc.
  type?: 'subjective' | 'mcq';
  questions?: MCQQuestion[];
}

export interface TestResult {
  id: string; // usually studentId_testId
  testId: string;
  studentId: string;
  marksObtained: number;
  answers?: Record<string, number>; // questionId -> selectedOptionIndex
  submittedAt?: string;
  isAbsent?: boolean;
}

export interface Class {
  id: string;
  name: string;
  subject: string;
  batchId: string;
  teacherId?: string;
  teacherName?: string;
  schedule?: string;
  date: string;
  time: string;
  endTime: string;
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
  title: string;
  message: string;
  createdAt: string;
}

interface PushNotificationQueueItem {
  id: string;
  role: 'students_batch';
  referenceId: string;
  notification: ClassNotification;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  subject: string;
  batchId: string;
  batchIds?: string[];
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

export interface Subject {
  id: string;
  name: string;
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

export const deleteBatch = (batchId: string): boolean => {
  try {
    const batches = getFromStorage<Batch>(STORAGE_KEYS.BATCHES);
    const filteredBatches = batches.filter(b => b.id !== batchId);
    saveToStorage(STORAGE_KEYS.BATCHES, filteredBatches);
    void removeItemFromRealtime(DB_PATHS.BATCHES, batchId);
    return true;
  } catch (error) {
    console.error('Error deleting batch:', error);
    return false;
  }
};

const STORAGE_KEYS = {
  STUDENTS: 'smartclass_students',
  CLASSES: 'smartclass_classes',
  NOTES: 'smartclass_notes',
  ATTENDANCE: 'smartclass_attendance',
  BATCHES: 'smartclass_batches',
  CURRENT_USER: 'smartclass_current_user',
  FEES: 'smartclass_fees',
  TESTS: 'smartclass_tests',
  TEST_RESULTS: 'smartclass_test_results',
  STAFF: 'smartclass_staff',
  TEACHERS: 'smartclass_teachers',
  INSTITUTE_SETTINGS: 'smartclass_institute_settings',
  SUBJECTS: 'smartclass_subjects',
};

const DB_PATHS = {
  STUDENTS: 'students',
  CLASSES: 'classes',
  NOTES: 'notes',
  ATTENDANCE: 'attendance',
  BATCHES: 'batches',
  NOTIFICATIONS_STUDENTS: 'notifications/students',
  NOTIFICATION_TOKENS_STUDENTS: 'notificationTokens/students',
  NOTIFICATION_TOKENS_STUDENTS_BATCH: 'notificationTokens/studentsByBatch',
  NOTIFICATION_QUEUE: 'notificationQueue',
  FEES: 'fees',
  TESTS: 'tests',
  TEST_RESULTS: 'testResults',
  STAFF: 'staff',
  TEACHERS: 'teachers',
  INSTITUTE_SETTINGS: 'instituteSettings',
  SUBJECTS: 'subjects',
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

  if (!localStorage.getItem(STORAGE_KEYS.STAFF)) {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.SUBJECTS)) {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.TEACHERS)) {
    localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify([]));
  }
};

initializeDefaultData();

const writeItemToRealtime = async (collection: string, id: string, value: unknown) => {
  try {
    // Strip undefined values – Firebase Realtime Database rejects them
    const cleanValue = JSON.parse(JSON.stringify(value));
    await set(ref(database, `${collection}/${id}`), cleanValue);
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
  const [students, classes, notes, attendance, batches, fees, tests, testResults, staffList, subjects, teachersList] = await Promise.all([
    fetchCollectionFromRealtime<Student>(DB_PATHS.STUDENTS),
    fetchCollectionFromRealtime<Class>(DB_PATHS.CLASSES),
    fetchCollectionFromRealtime<Note>(DB_PATHS.NOTES),
    fetchCollectionFromRealtime<AttendanceRecord>(DB_PATHS.ATTENDANCE),
    fetchCollectionFromRealtime<Batch>(DB_PATHS.BATCHES),
    !isElectron ? fetchCollectionFromRealtime<FeeRecord>(DB_PATHS.FEES) : Promise.resolve(null),
    fetchCollectionFromRealtime<Test>(DB_PATHS.TESTS),
    fetchCollectionFromRealtime<TestResult>(DB_PATHS.TEST_RESULTS),
    fetchCollectionFromRealtime<Staff>(DB_PATHS.STAFF),
    fetchCollectionFromRealtime<Subject>(DB_PATHS.SUBJECTS),
    fetchCollectionFromRealtime<Teacher>(DB_PATHS.TEACHERS),
  ]);

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
  if (staffList) {
    saveToStorage(STORAGE_KEYS.STAFF, staffList);
  }
  if (subjects) {
    saveToStorage(STORAGE_KEYS.SUBJECTS, subjects);
  }
  if (teachersList) {
    saveToStorage(STORAGE_KEYS.TEACHERS, teachersList);
  }
};

void syncRealtimeData();

export const refreshDataFromFirebase = (): Promise<void> => syncRealtimeData();

interface SaveNotificationTokenOptions {
  batchId?: string;
}

const sanitizeTokenKey = (token: string): string => encodeURIComponent(token);

export const saveNotificationToken = async (
  role: 'student',
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
  const basePath = DB_PATHS.NOTIFICATION_TOKENS_STUDENTS;

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
    title: `${classData.name} scheduled`,
    message: `${classData.subject} • ${classData.date || ''} ${classData.time || ''} - ${classData.endTime || ''} ${classData.schedule || ''}`.trim(),
    createdAt: new Date().toISOString(),
  };
};

const notifyClassCreation = async (classData: Class): Promise<void> => {
  const notification = buildClassNotificationPayload(classData);
  const studentPath = `${DB_PATHS.NOTIFICATIONS_STUDENTS}/${classData.batchId}/${notification.id}`;

  try {
    await Promise.all([
      set(ref(database, studentPath), notification),
      enqueuePushNotification('students_batch', classData.batchId, notification),
    ]);
  } catch (error) {
    console.error('Failed to write class notification to Firebase', error);
  }
};

const attachListener = <T>(collection: string, storageKey: string, onUpdate?: () => void): Unsubscribe => {
  const collectionRef = ref(database, collection);
  const unsubscribe = onValue(
    collectionRef,
    snapshot => {
      const data = snapshot.val();
      const items = data ? (Object.values(data) as T[]) : [];
      saveToStorage(storageKey, items);
      if (onUpdate) onUpdate();
    },
    error => {
      console.error(`Failed to listen for updates on ${collection}`, error);
    }
  );
  return unsubscribe;
};

export const subscribeToRealtimeUpdates = (onUpdate?: () => void): Unsubscribe => {
  const unsubscribes: Unsubscribe[] = [
    attachListener<Student>(DB_PATHS.STUDENTS, STORAGE_KEYS.STUDENTS, onUpdate),
    attachListener<Class>(DB_PATHS.CLASSES, STORAGE_KEYS.CLASSES, onUpdate),
    attachListener<Note>(DB_PATHS.NOTES, STORAGE_KEYS.NOTES, onUpdate),
    attachListener<AttendanceRecord>(DB_PATHS.ATTENDANCE, STORAGE_KEYS.ATTENDANCE, onUpdate),
    attachListener<Batch>(DB_PATHS.BATCHES, STORAGE_KEYS.BATCHES, onUpdate),
    attachListener<Test>(DB_PATHS.TESTS, STORAGE_KEYS.TESTS, onUpdate),
    attachListener<TestResult>(DB_PATHS.TEST_RESULTS, STORAGE_KEYS.TEST_RESULTS, onUpdate),
    attachListener<Staff>(DB_PATHS.STAFF, STORAGE_KEYS.STAFF, onUpdate),
    attachListener<Subject>(DB_PATHS.SUBJECTS, STORAGE_KEYS.SUBJECTS, onUpdate),
    attachListener<Teacher>(DB_PATHS.TEACHERS, STORAGE_KEYS.TEACHERS, onUpdate),
  ];

  if (!isElectron) {
    unsubscribes.push(attachListener<FeeRecord>(DB_PATHS.FEES, STORAGE_KEYS.FEES, onUpdate));
  }

  return () => unsubscribes.forEach(u => u());
};

export const subscribeToClassNotifications = (
  role: 'student',
  referenceId: string,
  callback: (notifications: ClassNotification[]) => void,
): Unsubscribe => {
  if (!referenceId) {
    return () => undefined;
  }

  const basePath = DB_PATHS.NOTIFICATIONS_STUDENTS;
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
  role: 'student',
  referenceId: string,
  notificationId: string,
): Promise<void> => {
  const basePath = DB_PATHS.NOTIFICATIONS_STUDENTS;
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

// Students
export const getStudents = (): Student[] => getFromStorage<Student>(STORAGE_KEYS.STUDENTS);
export const addStudent = async (student: Student): Promise<void> => {
  try {
    let firebaseUid = `fallback-${Date.now()}`;
    try {
      firebaseUid = await createFirebaseAuthUser(student.email, student.password);
    } catch (authError: any) {
      console.warn("Firebase auth creation failed or email exists, using fallback UID:", authError);
      // Even if email exists, we still process the student locally and in realtime DB
    }
    
    const studentRecord: Student = { ...student, firebaseUid };
    const students = getStudents();
    saveToStorage(STORAGE_KEYS.STUDENTS, [...students, studentRecord]);
    await writeItemToRealtime(DB_PATHS.STUDENTS, studentRecord.id, studentRecord);
  } catch (error) {
    console.error("Error adding student:", error);
    throw error;
  }
};
export const updateStudent = (studentId: string, updates: Partial<Student>): void => {
  const students = getStudents();
  const index = students.findIndex(s => s.id === studentId);
  if (index !== -1) {
    const updatedStudent = { ...students[index], ...updates };
    students[index] = updatedStudent;
    saveToStorage(STORAGE_KEYS.STUDENTS, students);
    void writeItemToRealtime(DB_PATHS.STUDENTS, studentId, updatedStudent);
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

// Staff
export const getStaff = (): Staff[] => getFromStorage<Staff>(STORAGE_KEYS.STAFF);
export const addStaff = async (staff: Staff): Promise<void> => {
  try {
    const firebaseUid = await createFirebaseAuthUser(staff.email, staff.password);
    const staffRecord: Staff = { ...staff, firebaseUid };
    const allStaff = getStaff();
    saveToStorage(STORAGE_KEYS.STAFF, [...allStaff, staffRecord]);
    await writeItemToRealtime(DB_PATHS.STAFF, staffRecord.id, staffRecord);
  } catch (error) {
    console.error("Error adding staff:", error);
    throw error;
  }
};
export const deleteStaff = (staffId: string): boolean => {
  try {
    const allStaff = getStaff();
    saveToStorage(STORAGE_KEYS.STAFF, allStaff.filter(s => s.id !== staffId));
    void removeItemFromRealtime(DB_PATHS.STAFF, staffId);
    return true;
  } catch (error) {
    console.error('Error deleting staff:', error);
    return false;
  }
};

// Teachers
export const getTeachers = (): Teacher[] => {
  const teachers = getFromStorage<Teacher>(STORAGE_KEYS.TEACHERS);
  const map = new Map<string, Teacher>();
  teachers.forEach(t => {
    if (t && t.id) {
      // Deduplicate by ID and Email
      const existingKey = t.id;
      if (!map.has(existingKey)) {
        map.set(existingKey, t);
      }
    }
  });
  return Array.from(map.values());
};

export const addTeacher = async (teacher: Teacher): Promise<void> => {
  try {
    let firebaseUid = `fallback-${Date.now()}`;
    try {
      firebaseUid = await createFirebaseAuthUser(teacher.email, teacher.password);
    } catch (authError: any) {
      console.warn("Firebase auth creation failed or email exists, using fallback UID:", authError);
    }
    const teacherRecord: Teacher = { ...teacher, firebaseUid };
    const teachers = getTeachers();
    const filtered = teachers.filter(t => t.id !== teacherRecord.id && t.email.toLowerCase() !== teacherRecord.email.toLowerCase());
    saveToStorage(STORAGE_KEYS.TEACHERS, [...filtered, teacherRecord]);
    await writeItemToRealtime(DB_PATHS.TEACHERS, teacherRecord.id, teacherRecord);
  } catch (error) {
    console.error("Error adding teacher:", error);
    throw error;
  }
};
export const updateTeacher = (teacherId: string, updates: Partial<Teacher>): void => {
  const teachers = getTeachers();
  const index = teachers.findIndex(t => t.id === teacherId);
  if (index !== -1) {
    const updatedTeacher = { ...teachers[index], ...updates };
    teachers[index] = updatedTeacher;
    saveToStorage(STORAGE_KEYS.TEACHERS, teachers);
    void writeItemToRealtime(DB_PATHS.TEACHERS, teacherId, updatedTeacher);
  }
};
export const deleteTeacher = (teacherId: string): boolean => {
  try {
    const teachers = getTeachers();
    saveToStorage(STORAGE_KEYS.TEACHERS, teachers.filter(t => t.id !== teacherId));
    void removeItemFromRealtime(DB_PATHS.TEACHERS, teacherId);
    return true;
  } catch (error) {
    console.error('Error deleting teacher:', error);
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
  return getNotes().filter(n => n.batchId === batchId || (n.batchIds && n.batchIds.includes(batchId)));
};
export const updateNote = (noteId: string, updates: Partial<Note>): void => {
  const notes = getNotes();
  const index = notes.findIndex(n => n.id === noteId);
  if (index !== -1) {
    const updatedNote = { ...notes[index], ...updates };
    notes[index] = updatedNote;
    saveToStorage(STORAGE_KEYS.NOTES, notes);
    void writeItemToRealtime(DB_PATHS.NOTES, noteId, updatedNote);
  }
};
export const deleteNote = (noteId: string): boolean => {
  try {
    const notes = getNotes();
    saveToStorage(STORAGE_KEYS.NOTES, notes.filter(n => n.id !== noteId));
    void removeItemFromRealtime(DB_PATHS.NOTES, noteId);
    return true;
  } catch (error) {
    console.error('Error deleting note:', error);
    return false;
  }
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

export const getFeeRecords = async (): Promise<FeeRecord[]> => {
  if (isElectron) {
    try {
      return await window.electronAPI.getFeeRecords();
    } catch (error) {
      console.error('SQLite getFeeRecords failed', error);
    }
  }
  return getFromStorage<FeeRecord>(STORAGE_KEYS.FEES);
};

export const getFeeRecordByStudent = async (studentId: string): Promise<FeeRecord | undefined> => {
  if (isElectron) {
    try {
      return await window.electronAPI.getFeeRecord(studentId) || undefined;
    } catch (error) {
      console.error('SQLite getFeeRecord failed', error);
    }
  }
  return (await getFeeRecords()).find(f => f.studentId === studentId);
};

export const updateFeeRecord = async (feeRecord: FeeRecord): Promise<void> => {
  if (isElectron) {
    try {
      await window.electronAPI.updateFeeRecord(feeRecord);
      return;
    } catch (error) {
      console.error('SQLite updateFeeRecord failed', error);
    }
  }
  const records = await getFeeRecords();
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

export const addFeePayment = async (studentId: string, amount: number): Promise<FeeRecord | null> => {
  const record = await getFeeRecordByStudent(studentId);
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
  
  await updateFeeRecord(updatedRecord);
  return updatedRecord;
};

// Tests
export const getTests = (): Test[] => getFromStorage<Test>(STORAGE_KEYS.TESTS);
export const getTestsByBatch = (batchId: string): Test[] => 
  getTests().filter(t => t.batchId === batchId || (t.batchIds && t.batchIds.includes(batchId)));
export const addTest = (test: Test): void => {
  const tests = getTests();
  saveToStorage(STORAGE_KEYS.TESTS, [...tests, test]);
  void writeItemToRealtime(DB_PATHS.TESTS, test.id, test);
};

export const updateTest = (testId: string, updates: Partial<Test>): void => {
  const tests = getTests();
  const index = tests.findIndex(t => t.id === testId);
  if (index !== -1) {
    const updatedTest = { ...tests[index], ...updates };
    tests[index] = updatedTest;
    saveToStorage(STORAGE_KEYS.TESTS, tests);
    void writeItemToRealtime(DB_PATHS.TESTS, testId, updatedTest);
  }
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
    if ((email === 'admin@sankalpacademy.com' || email === 'admin@rctutorials.com') && password === 'admin123') {
      return { id: 'admin', name: 'Administrator' };
    }
    return null;
  }

  if (role === 'student') {
    const student = getStudents().find(s => s.email === email && s.password === password);
    return student ? { id: student.id, name: student.name } : null;
  }

  if (role === 'staff') {
    const staffMember = getStaff().find(s => s.email === email && s.password === password);
    if (staffMember) return { id: staffMember.id, name: staffMember.name };
    
    // Fallback for default staff
    if ((email === 'staff@sankalpacademy.com' || email === 'staff@rctutorials.com') && password === 'staff123') {
      return { id: 'staff', name: 'Staff Member' };
    }
    return null;
  }

  if (role === 'teacher') {
    const teacher = getTeachers().find(t => t.email === email && t.password === password);
    if (teacher) return { id: teacher.id, name: teacher.name };

    // Fallback default teacher
    if ((email === 'teacher@sankalpacademy.com' || email === 'teacher@rctutorials.com') && password === 'teacher123') {
      return { id: 'teacher', name: 'Teacher' };
    }
    return null;
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
  return { name: 'Sankalp Academy ERP', address: '', phone: '', email: '' };
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
  // Primary check: use date + endTime fields (structured schedule)
  if (classItem.date && classItem.endTime) {
    const classEndTime = new Date(`${classItem.date}T${classItem.endTime}`);
    return classEndTime < new Date();
  }
  // Fallback: use endDate field
  if (classItem.endDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(classItem.endDate + 'T00:00:00');
    return endDate < today;
  }
  return false;
};

// Format time helper for 12h display
export const format12h = (time24: string): string => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${period}`;
};

export const getSubjects = (): Subject[] => getFromStorage<Subject>(STORAGE_KEYS.SUBJECTS);

export const addSubject = async (subject: Subject): Promise<void> => {
  const subjects = getSubjects();
  if (subjects.some(s => s.name.toLowerCase() === subject.name.toLowerCase())) {
    throw new Error("Subject already exists");
  }
  saveToStorage(STORAGE_KEYS.SUBJECTS, [...subjects, subject]);
  void writeItemToRealtime(DB_PATHS.SUBJECTS, subject.id, subject);
};

export const deleteSubject = async (subjectId: string): Promise<boolean> => {
  try {
    const subjects = getSubjects();
    const filteredSubjects = subjects.filter(s => s.id !== subjectId);
    saveToStorage(STORAGE_KEYS.SUBJECTS, filteredSubjects);
    void removeItemFromRealtime(DB_PATHS.SUBJECTS, subjectId);
    return true;
  } catch (error) {
    console.error('Error deleting subject:', error);
    return false;
  }
};
