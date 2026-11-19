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
      checklist_json TEXT NOT NULL DEFAULT '[]',
      note_id INTEGER,
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
    if (!existingTaskColumns.includes('checklist_json')) {
      await tx.executeSql("ALTER TABLE tasks ADD COLUMN checklist_json TEXT NOT NULL DEFAULT '[]';");
    }
    if (!existingTaskColumns.includes('note_id')) {
      await tx.executeSql('ALTER TABLE tasks ADD COLUMN note_id INTEGER;');
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
const BACKUP_TABLES = {
  subjects: ['id', 'code', 'name', 'room', 'professor', 'color', 'created_at'],
  classes: ['id', 'subject_id', 'day_of_week', 'start_time', 'end_time', 'room', 'class_type'],
  notes: ['id', 'subject_id', 'title', 'body', 'pinned', 'updated_at', 'category'],
  tasks: ['id', 'title', 'details', 'due_at', 'priority', 'category', 'completed', 'checklist_json', 'note_id', 'created_at'],
  activities: ['id', 'title', 'starts_at', 'ends_at', 'details'],
  budget_transactions: ['id', 'title', 'amount', 'type', 'category', 'note', 'occurred_at'],
  monthly_budgets: ['id', 'month', 'limit_amount', 'updated_at'],
  category_budgets: ['id', 'month', 'category', 'limit_amount', 'updated_at'],
  savings_goals: ['id', 'title', 'target_amount', 'saved_amount', 'target_date'],
  settings: ['key', 'value'],
};

export async function createPlannerBackup() {
  const tableNames = Object.keys(BACKUP_TABLES);
  const rows = await Promise.all(tableNames.map(table => query('SELECT * FROM ' + table)));
  const data = {};
  tableNames.forEach((table, index) => { data[table] = rows[index]; });
  const lectureFiles = await query('SELECT name, mime_type, size_bytes, category, imported_at FROM lecture_files ORDER BY imported_at DESC, id DESC');
  return {
    format: 'newapk-backup',
    version: 1,
    generatedAt: new Date().toISOString(),
    data,
    lectureFilesManifest: lectureFiles,
  };
}

export async function restorePlannerBackup(data, importedLectureFiles = []) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('The backup data section is invalid.');
  }
  if (!Array.isArray(importedLectureFiles)) throw new Error('Imported Lecture Files data is invalid.');
  if (importedLectureFiles.length > 500) throw new Error('This import contains too many Lecture Files.');
  importedLectureFiles.forEach((file, index) => {
    if (!file || typeof file !== 'object' || !file.name || !file.path || !file.mimeType) {
      throw new Error('Invalid imported Lecture File at position ' + (index + 1) + '.');
    }
  });

  const tableNames = Object.keys(BACKUP_TABLES);
  let totalRows = 0;
  tableNames.forEach(table => {
    const rows = data[table];
    if (!Array.isArray(rows)) throw new Error('The backup is missing the ' + table + ' table.');
    if (rows.length > 10000) throw new Error('The ' + table + ' table contains too many records.');
    totalRows += rows.length;
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error('Invalid ' + table + ' record at position ' + (index + 1) + '.');
      }
      BACKUP_TABLES[table].forEach(column => {
        if (!Object.prototype.hasOwnProperty.call(row, column)) {
          throw new Error('The ' + table + ' record is missing ' + column + '.');
        }
      });
    });
  });
  if (totalRows > 30000) throw new Error('This backup contains more than 30,000 planner records.');

  const db = await openDatabase();
  const deleteOrder = [
    'classes', 'tasks', 'notes', 'activities', 'budget_transactions',
    'category_budgets', 'monthly_budgets', 'savings_goals', 'subjects', 'settings',
  ];
  const insertOrder = [
    'subjects', 'notes', 'classes', 'tasks', 'activities',
    'budget_transactions', 'monthly_budgets', 'category_budgets',
    'savings_goals', 'settings',
  ];

  await db.transaction(async tx => {
    // Keep imported files on this device, but detach their old subject IDs before replacing subjects.
    await tx.executeSql('UPDATE lecture_files SET subject_id = NULL;');
    for (const table of deleteOrder) {
      await tx.executeSql('DELETE FROM ' + table + ';');
    }
    for (const table of insertOrder) {
      const columns = BACKUP_TABLES[table];
      const columnSql = columns.join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const sql = 'INSERT INTO ' + table + ' (' + columnSql + ') VALUES (' + placeholders + ')';
      for (const row of data[table]) {
        const values = columns.map(column => row[column] === undefined ? null : row[column]);
        await tx.executeSql(sql, values);
      }
    }
    for (const file of importedLectureFiles) {
      await tx.executeSql(
        'INSERT INTO lecture_files (name, stored_path, mime_type, size_bytes, subject_id, category) VALUES (?, ?, ?, ?, ?, ?)',
        [file.name, file.path, file.mimeType, Number(file.sizeBytes) || 0, Number(file.subjectId) > 0 ? Number(file.subjectId) : null, file.category || 'Lecture'],
      );
    }
  });
  return totalRows;
}
