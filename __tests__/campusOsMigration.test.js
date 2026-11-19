const {convertCampusOsBackup} = require('../src/data/campusOsMigration');

function fullBackup(overrides = {}) {
  return {
    format: 'CampusOS Backup', version: 2,
    modules: ['homepage', 'schedule', 'tasks', 'academics'],
    subjects: JSON.stringify([{id: 7, title: 'ITEC 80', subtitle: 'Human Computer Interaction', room: 'LAB 2', professor: 'Prof. A', color: -12298906}]),
    schedule: JSON.stringify([
      {id: 101, subjectId: 7, title: 'ITEC 80', subtitle: 'Human Computer Interaction', day: 'Monday', startTime: '8:00 AM', endTime: '9:30 AM', room: 'LAB 2', professor: 'Prof. A', classType: 'Lecture'},
      {id: 102, subjectId: 7, title: 'ITEC 80', subtitle: 'Human Computer Interaction', day: 'Friday', startTime: '13:00', endTime: '14:00', room: 'LAB 3', classType: 'Lab'},
    ]),
    tasks: JSON.stringify([
      {id: 201, title: 'HCI wireframe', subtitle: 'Finish the first screen', extra: 'Bring the prototype', dueDate: '2026-11-25', dueTime: '10:30', done: false},
      {id: 202, title: 'Read chapter 2', dueDate: '', done: true},
    ]),
    subjectNotes: {'7': JSON.stringify([{id: 301, title: 'Lecture 1', body: 'HCI notes', updatedAt: 1790000000000, favorite: true}])},
    subjectFiles: [{path: '7/lecture-one.pdf', data: Buffer.from('sample-pdf').toString('base64')}],
    appearancePreset: 'forest', profileName: 'Taylor', profileStudentId: '12345', profileSection: 'BSIT 2-6',
    ...overrides,
  };
}
describe('CampusOS backup migration', () => {
  test('maps subjects, schedule, tasks, linked notes and file attachments', () => {
    const result = convertCampusOsBackup(fullBackup());
    expect(result.data.subjects).toHaveLength(1);
    expect(result.data.subjects[0]).toMatchObject({id: 7, code: 'ITEC 80', name: 'Human Computer Interaction', room: 'LAB 2'});
    expect(result.data.classes).toHaveLength(2);
    expect(result.data.classes[0]).toMatchObject({day_of_week: 1, start_time: '08:00', end_time: '09:30', class_type: 'Lecture'});
    expect(result.data.classes[1]).toMatchObject({day_of_week: 5, class_type: 'Lab', subject_id: 7});
    expect(result.data.tasks[0]).toMatchObject({id: 201, title: 'HCI wireframe', due_at: '2026-11-25 10:30:00', completed: 0});
    expect(result.data.tasks[1].completed).toBe(1);
    expect(result.data.notes[0]).toMatchObject({subject_id: 7, title: 'Lecture 1', pinned: 1, category: 'Lecture'});
    expect(result.legacyFiles[0]).toMatchObject({name: 'lecture-one.pdf', mimeType: 'application/pdf', subjectId: 7});
    expect(result.counts).toEqual({subjects: 1, classes: 2, tasks: 2, notes: 1, files: 1});
    expect(result.data.settings).toContainEqual({key: 'profile_name', value: 'Taylor'});
  });
  test('rejects unrelated JSON and malformed files', () => {
    expect(() => convertCampusOsBackup({format: 'newapk-backup', version: 1})).toThrow('valid CampusOS Backup');
    expect(() => convertCampusOsBackup('{bad json')).toThrow('not valid JSON');
  });
  test('rejects partial backups before data replacement', () => {
    expect(() => convertCampusOsBackup(fullBackup({modules: ['schedule', 'tasks']}))).toThrow('partial CampusOS backup');
  });
  test('skips invalid class rows', () => {
    const backup = fullBackup({schedule: JSON.stringify([{id: 1, title: 'CODE', day: 'Funday', startTime: '30:70', endTime: '32:80'}])});
    expect(convertCampusOsBackup(backup).data.classes).toHaveLength(0);
  });
  test('rejects attachments that exceed the 12 MB migration limit', () => {
    const huge = 'A'.repeat(17 * 1024 * 1024);
    expect(() => convertCampusOsBackup(fullBackup({subjectFiles: [{path: '7/big.pdf', data: huge}]}))).toThrow('12 MB migration limit');
  });
});
