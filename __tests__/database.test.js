const mockSQLite = {
  enablePromise: jest.fn(),
  openDatabase: jest.fn(),
};

jest.mock('react-native-sqlite-storage', () => mockSQLite);

function emptySqlResult() {
  return {
    rows: {
      length: 0,
      item: () => null,
    },
    rowsAffected: 0,
  };
}

let mockDatabase;
let capturedStatements;
let transactionCallbackWasAsync;
let openDatabase;
let restorePlannerBackup;

beforeEach(() => {
  jest.resetModules();
  capturedStatements = [];
  transactionCallbackWasAsync = false;

  mockDatabase = {
    executeSql: jest.fn(async () => [emptySqlResult()]),
    transaction: jest.fn(callback => {
      const transaction = {
        executeSql: (sql, params = []) => {
          capturedStatements.push({sql, params});
        },
      };
      const callbackResult = callback(transaction);
      transactionCallbackWasAsync = !!(callbackResult && typeof callbackResult.then === 'function');
      if (transactionCallbackWasAsync) {
        return Promise.reject(new Error('SQLite transaction callback must queue statements synchronously.'));
      }
      return Promise.resolve();
    }),
  };

  mockSQLite.enablePromise.mockClear();
  mockSQLite.openDatabase.mockReset().mockResolvedValue(mockDatabase);
  ({openDatabase, restorePlannerBackup} = require('../src/data/database'));
});

describe('SQLite database initialization', () => {
  test('shares concurrent opens and queues schema statements outside transactions', async () => {
    let resolveOpen;
    mockSQLite.openDatabase.mockImplementation(() => new Promise(resolve => {
      resolveOpen = resolve;
    }));

    const firstOpen = openDatabase();
    const secondOpen = openDatabase();
    expect(mockSQLite.openDatabase).toHaveBeenCalledTimes(1);

    resolveOpen(mockDatabase);
    const [first, second] = await Promise.all([firstOpen, secondOpen]);

    expect(first).toBe(mockDatabase);
    expect(second).toBe(mockDatabase);
    expect(mockDatabase.transaction).not.toHaveBeenCalled();
    const statements = mockDatabase.executeSql.mock.calls.map(([sql]) => sql);
    expect(statements.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS subjects'))).toBe(true);
    expect(statements.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS lecture_files'))).toBe(true);
    expect(statements.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS settings'))).toBe(true);
  });

  test('clears the cached open promise after failure so a later attempt can recover', async () => {
    mockSQLite.openDatabase
      .mockRejectedValueOnce(new Error('temporary SQLite open failure'))
      .mockResolvedValueOnce(mockDatabase);

    await expect(openDatabase()).rejects.toThrow('temporary SQLite open failure');
    await expect(openDatabase()).resolves.toBe(mockDatabase);
    expect(mockSQLite.openDatabase).toHaveBeenCalledTimes(2);
  });
});

describe('SQLite backup restore transaction', () => {
  test('queues every delete and restore statement synchronously in one transaction', async () => {
    const emptyBackup = {
      subjects: [],
      classes: [],
      notes: [],
      tasks: [],
      activities: [],
      budget_transactions: [],
      monthly_budgets: [],
      category_budgets: [],
      savings_goals: [],
      settings: [],
    };
    const lectureFile = {
      name: 'lecture.pdf',
      path: 'lecture-files/lecture.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 128,
      subjectId: null,
      category: 'Lecture',
    };

    await restorePlannerBackup(emptyBackup, [lectureFile], true);

    expect(mockDatabase.transaction).toHaveBeenCalledTimes(1);
    expect(transactionCallbackWasAsync).toBe(false);
    expect(capturedStatements[0].sql).toBe('DELETE FROM lecture_files;');
    expect(capturedStatements).toContainEqual({
      sql: 'DELETE FROM subjects;',
      params: [],
    });
    expect(capturedStatements).toContainEqual({
      sql: 'INSERT INTO lecture_files (name, stored_path, mime_type, size_bytes, subject_id, category) VALUES (?, ?, ?, ?, ?, ?)',
      params: ['lecture.pdf', 'lecture-files/lecture.pdf', 'application/pdf', 128, null, 'Lecture'],
    });
  });
});
