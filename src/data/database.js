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
      priority TEXT NOT NULL DEFAULT 'Medium',
      category TEXT NOT NULL DEFAULT 'Assignment',
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`);
    const [taskColumnInfo] = await tx.executeSql('PRAGMA table_info(tasks);');
    const existingTaskColumns = [];
    for (let i = 0; i < taskColumnInfo.rows.length; i += 1) {
      existingTaskColumns.push(taskColumnInfo.rows.item(i).name);
    }
    if (!existingTaskColumns.includes('priority')) {
      await tx.executeSql("ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'Medium';");
    }
    if (!existingTaskColumns.includes('category')) {
      await tx.executeSql("ALTER TABLE tasks ADD COLUMN category TEXT NOT NULL DEFAULT 'Assignment';");
    }
    await tx.executeSql('CREATE INDEX IF NOT EXISTS idx_tasks_due_completed ON tasks (due_at, completed);');
    await tx.executeSql(`CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      pinned INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL
    );`);
    const [noteColumnInfo] = await tx.executeSql('PRAGMA table_info(notes);');
    const existingNoteColumns = [];
    for (let i = 0; i < noteColumnInfo.rows.length; i += 1) {
      existingNoteColumns.push(noteColumnInfo.rows.item(i).name);
    }
    if (!existingNoteColumns.includes('category')) {
      await tx.executeSql("ALTER TABLE notes ADD COLUMN category TEXT NOT NULL DEFAULT 'General';");
    }
    await tx.executeSql('CREATE INDEX IF NOT EXISTS idx_notes_pinned_updated ON notes (pinned, updated_at);');
    await tx.executeSql(`CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      starts_at TEXT,
      ends_at TEXT,
      details TEXT NOT NULL DEFAULT ''
    );`);
    await tx.executeSql(`CREATE TABLE IF NOT EXISTS budget_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount >= 0),
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category TEXT NOT NULL DEFAULT 'Other',
      note TEXT NOT NULL DEFAULT '',
      occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`);
    await tx.executeSql(`CREATE TABLE IF NOT EXISTS monthly_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,
      limit_amount REAL NOT NULL CHECK(limit_amount >= 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`);
    await tx.executeSql(`CREATE TABLE IF NOT EXISTS category_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      category TEXT NOT NULL,
      limit_amount REAL NOT NULL CHECK(limit_amount > 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(month, category)
    );`);
    await tx.executeSql('CREATE INDEX IF NOT EXISTS idx_budget_transactions_category_type ON budget_transactions (category, type);');
    await tx.executeSql(`CREATE TABLE IF NOT EXISTS lecture_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      stored_path TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL DEFAULT '',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      subject_id INTEGER,
      category TEXT NOT NULL DEFAULT 'Lecture',
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL
    );`);
    await tx.executeSql('CREATE INDEX IF NOT EXISTS idx_lecture_files_subject_imported ON lecture_files (subject_id, imported_at);');
    await tx.executeSql(`CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      target_amount REAL NOT NULL CHECK(target_amount > 0),
      saved_amount REAL NOT NULL DEFAULT 0 CHECK(saved_amount >= 0),
      target_date TEXT
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