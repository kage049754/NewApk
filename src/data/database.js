import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

let database;

export async function openDatabase() {
  if (database) return database;
  database = await SQLite.openDatabase({name: 'newapk.db', location: 'default'});
  await database.executeSql('PRAGMA foreign_keys = ON;');
  await database.transaction(async tx => {
    await tx.executeSql(`CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      room TEXT NOT NULL DEFAULT '',
      professor TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#55745B',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`);
    await tx.executeSql(`CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT NOT NULL DEFAULT '',
      class_type TEXT NOT NULL DEFAULT 'Lecture',
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL
    );`);
    await tx.executeSql(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      due_at TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`);
    await tx.executeSql(`CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      pinned INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL
    );`);
    await tx.executeSql(`CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      starts_at TEXT,
      ends_at TEXT,
      details TEXT NOT NULL DEFAULT ''
    );`);
    await tx.executeSql(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );`);
  });
  return database;
}

export async function query(sql, params = []) {
  const db = await openDatabase();
  const [result] = await db.executeSql(sql, params);
  const rows = [];
  for (let i = 0; i < result.rows.length; i += 1) rows.push(result.rows.item(i));
  return rows;
}

export async function execute(sql, params = []) {
  const db = await openDatabase();
  const [result] = await db.executeSql(sql, params);
  return result.insertId || result.rowsAffected;
}

export async function getDashboardSummary() {
  const [subjects, tasks, notes, classes] = await Promise.all([
    query('SELECT COUNT(*) AS count FROM subjects'),
    query('SELECT COUNT(*) AS count FROM tasks WHERE completed = 0'),
    query('SELECT COUNT(*) AS count FROM notes'),
    query('SELECT COUNT(*) AS count FROM classes'),
  ]);
  return {
    subjects: subjects[0]?.count || 0,
    pendingTasks: tasks[0]?.count || 0,
    notes: notes[0]?.count || 0,
    classes: classes[0]?.count || 0,
  };
}