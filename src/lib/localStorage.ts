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
}

export interface Class {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
  batchId: string;
  schedule: string;
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
};

const DB_PATHS = {
  TEACHERS: 'teachers',
  STUDENTS: 'students',
  CLASSES: 'classes',
  NOTES: 'notes',
  ATTENDANCE: 'attendance',
  BATCHES: 'batches',
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
  const [teachers, students, classes, notes, attendance, batches] = await Promise.all([
    fetchCollectionFromRealtime<Teacher>(DB_PATHS.TEACHERS),
    fetchCollectionFromRealtime<Student>(DB_PATHS.STUDENTS),
    fetchCollectionFromRealtime<Class>(DB_PATHS.CLASSES),
    fetchCollectionFromRealtime<Note>(DB_PATHS.NOTES),
    fetchCollectionFromRealtime<AttendanceRecord>(DB_PATHS.ATTENDANCE),
    fetchCollectionFromRealtime<Batch>(DB_PATHS.BATCHES),
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
};

void syncRealtimeData();

export const refreshDataFromFirebase = (): Promise<void> => syncRealtimeData();

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
export const addClass = (classData: Class): void => {
  const classes = getClasses();
  saveToStorage(STORAGE_KEYS.CLASSES, [...classes, classData]);
  void writeItemToRealtime(DB_PATHS.CLASSES, classData.id, classData);
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
