const REQUIRED_MODULES = ['homepage', 'schedule', 'tasks', 'academics'];
const MAX_ROWS_PER_TABLE = 10000;
const MAX_TOTAL_ROWS = 30000;
const MAX_LEGACY_FILE_BYTES = 12 * 1024 * 1024;
const DEFAULT_COLOR = '#55745B';

function parseJsonValue(value, label) {
  if (typeof value === 'string') {
    try { return JSON.parse(value); }
    catch (_) { throw new Error('The CampusOS ' + label + ' section is not valid JSON.'); }
  }
  return value;
}

function parseArray(value, label, required = false, objectsOnly = true) {
  if (value === undefined || value === null) {
    if (required) throw new Error('The CampusOS backup is missing ' + label + '.');
    return [];
  }
  const parsed = parseJsonValue(value, label);
  if (!Array.isArray(parsed)) throw new Error('The CampusOS ' + label + ' section must be an array.');
  if (parsed.length > MAX_ROWS_PER_TABLE) throw new Error('The CampusOS ' + label + ' section contains too many records.');
  return objectsOnly ? parsed.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : parsed;
}

function uniqueId(rawId, used, nextRef) {
  const candidate = Number(rawId);
  let id = Number.isSafeInteger(candidate) && candidate > 0 ? candidate : nextRef.value;
  while (used.has(id)) id += 1;
  used.add(id);
  nextRef.value = Math.max(nextRef.value, id + 1);
  return id;
}

function cleanText(value, maximum = 500) {
  return String(value === undefined || value === null ? '' : value).replace(/\u0000/g, '').trim().slice(0, maximum);
}

function normalizeCode(value) {
  return cleanText(value, 80).replace(/\s+/g, ' ').replace(/\s*[-–—]\s*(lecture|lec|laboratory|lab)\s*$/i, '').trim();
}

function normalizeDay(value) {
  const text = cleanText(value, 20).toLowerCase();
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const aliases = {sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6};
  const nameIndex = names.indexOf(text);
  if (nameIndex >= 0) return nameIndex;
  if (Object.prototype.hasOwnProperty.call(aliases, text)) return aliases[text];
  if (/^\d$/.test(text)) {
    const numeric = Number(text);
    return numeric >= 0 && numeric <= 6 ? numeric : null;
  }
  return null;
}

function normalizeTime(value) {
  const text = cleanText(value, 30);
  if (!text) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(text);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = String(match[3] || '').toUpperCase();
  if (minute > 59 || hour > 23) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === 'AM') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
  }
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}

function normalizeDate(value) {
  const text = cleanText(value, 40);
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function normalizeColor(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return DEFAULT_COLOR;
  const hex = (Math.trunc(number) >>> 0).toString(16).padStart(8, '0').slice(-6);
  return '#' + hex.toUpperCase();
}

function normalizeDateTime(dateValue, timeValue) {
  const date = normalizeDate(dateValue);
  if (!date) return null;
  const time = normalizeTime(timeValue);
  return time ? date + ' ' + time + ':00' : date;
}

function paletteForCampusOs(value) {
  const preset = cleanText(value, 30).toLowerCase();
  if (preset === 'sunset' || preset === 'coral') return 'Sunset';
  if (preset === 'mono' || preset === 'monochrome') return 'Monochrome';
  if (preset === 'night') return 'Night';
  return 'Forest';
}

function mimeForName(name) {
  const extension = String(name).split('.').pop().toLowerCase();
  const types = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', gif: 'image/gif', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    odt: 'application/vnd.oasis.opendocument.text',
    odp: 'application/vnd.oasis.opendocument.presentation',
    txt: 'text/plain', csv: 'text/csv', rtf: 'text/rtf',
  };
  return types[extension] || 'application/octet-stream';
}

function normalizeSubjectNotes(raw, subjectIdMap, usedNoteIds, nextNoteId) {
  if (raw === undefined || raw === null) return [];
  const parsed = parseJsonValue(raw, 'subject notes');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The CampusOS subject notes section must be an object.');
  }
  const result = [];
  Object.keys(parsed).forEach(oldSubjectId => {
    const subjectId = subjectIdMap.get(String(oldSubjectId));
    if (!subjectId) return;
    const notes = parseArray(parsed[oldSubjectId], 'subject notes for subject ' + oldSubjectId);
    notes.forEach(note => {
      const title = cleanText(note.title, 200);
      if (!title) return;
      const oldUpdated = Number(note.updatedAt);
      const updatedAt = Number.isFinite(oldUpdated) && oldUpdated > 0
        ? new Date(oldUpdated).toISOString()
        : new Date().toISOString();
      result.push({
        id: uniqueId(note.id, usedNoteIds, nextNoteId),
        subject_id: subjectId,
        title,
        body: cleanText(note.body, 200000),
        pinned: note.favorite ? 1 : 0,
        updated_at: updatedAt,
        category: 'Lecture',
      });
    });
  });
  return result;
}

function convertCampusOsBackup(input) {
  const root = typeof input === 'string' ? parseJsonValue(input, 'backup file') : input;
  if (!root || typeof root !== 'object' || Array.isArray(root) || root.format !== 'CampusOS Backup') {
    throw new Error('This is not a valid CampusOS Backup JSON file.');
  }
  const version = Number(root.version);
  if (!Number.isInteger(version) || version < 1 || version > 2) {
    throw new Error('This CampusOS backup version is not supported.');
  }
  const modules = parseArray(root.modules, 'modules', true, false).map(item => cleanText(item, 40));
  const selected = new Set(modules);
  const missingModules = REQUIRED_MODULES.filter(module => !selected.has(module));
  if (missingModules.length) {
    throw new Error('This is a partial CampusOS backup. Create a full backup with Homepage, Class Schedule, Notes, and Academics selected.');
  }

  const campusSubjects = parseArray(root.subjects, 'subjects', true);
  const campusSchedule = parseArray(root.schedule, 'schedule', true);
  const campusTasks = parseArray(root.tasks, 'tasks', true);
  const usedSubjectIds = new Set(), usedClassIds = new Set(), usedTaskIds = new Set(), usedNoteIds = new Set();
  const nextSubjectId = {value: 1}, nextClassId = {value: 1}, nextTaskId = {value: 1}, nextNoteId = {value: 1};
  const subjectIdMap = new Map();
  const subjectsByCode = new Map();
  const subjects = [];

  function ensureSubject(oldId, codeValue, nameValue, roomValue, professorValue, colorValue) {
    const code = normalizeCode(codeValue);
    const name = cleanText(nameValue, 160) || code || 'Imported Subject';
    const oldKey = Number(oldId) > 0 ? String(Number(oldId)) : '';
    if (oldKey && subjectIdMap.has(oldKey)) {
      const existing = subjects.find(item => item.id === subjectIdMap.get(oldKey));
      if (existing) {
        if (!existing.code && code) existing.code = code;
        if (!existing.name && name) existing.name = name;
        if (!existing.room && roomValue) existing.room = cleanText(roomValue, 100);
        if (!existing.professor && professorValue) existing.professor = cleanText(professorValue, 120);
      }
      return subjectIdMap.get(oldKey);
    }
    const codeKey = code.toLowerCase();
    if (codeKey && subjectsByCode.has(codeKey)) {
      const existing = subjectsByCode.get(codeKey);
      if (oldKey) subjectIdMap.set(oldKey, existing.id);
      if (!existing.name && name) existing.name = name;
      if (!existing.room && roomValue) existing.room = cleanText(roomValue, 100);
      if (!existing.professor && professorValue) existing.professor = cleanText(professorValue, 120);
      return existing.id;
    }
    const id = uniqueId(oldId, usedSubjectIds, nextSubjectId);
    const subject = {
      id,
      code,
      name,
      room: cleanText(roomValue, 100),
      professor: cleanText(professorValue, 120),
      color: normalizeColor(colorValue),
      created_at: new Date().toISOString(),
    };
    subjects.push(subject);
    if (oldKey) subjectIdMap.set(oldKey, id);
    if (codeKey) subjectsByCode.set(codeKey, subject);
    return id;
  }

  campusSubjects.forEach(subject => {
    ensureSubject(subject.id, subject.title || subject.code, subject.subtitle || subject.name, subject.room, subject.professor, subject.color);
  });

  const classes = [];
  campusSchedule.forEach(record => {
    const day = normalizeDay(record.day);
    const startTime = normalizeTime(record.startTime || record.start_time);
    const endTime = normalizeTime(record.endTime || record.end_time);
    if (day === null || !startTime || !endTime || endTime <= startTime) return;
    const subjectId = ensureSubject(
      record.subjectId || record.subject_id,
      record.title || record.code || '',
      record.subtitle || record.name || '',
      record.room,
      record.professor,
      record.color,
    );
    classes.push({
      id: uniqueId(record.id, usedClassIds, nextClassId),
      subject_id: subjectId,
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
      room: cleanText(record.room, 100),
      class_type: /lab/i.test(cleanText(record.classType || record.class_type, 30)) ? 'Lab' : 'Lecture',
    });
  });

  const tasks = [];
  campusTasks.forEach(record => {
    const title = cleanText(record.title, 200);
    if (!title) return;
    const details = [cleanText(record.subtitle, 5000), cleanText(record.extra, 5000)].filter(Boolean).join('\n\n');
    const dueAt = normalizeDateTime(record.dueDate || record.due_date, record.dueTime || record.due_time);
    tasks.push({
      id: uniqueId(record.id, usedTaskIds, nextTaskId),
      title,
      details,
      due_at: dueAt,
      priority: 'Medium',
      category: 'Assignment',
      completed: record.done ? 1 : 0,
      checklist_json: '[]',
      note_id: null,
      created_at: new Date().toISOString(),
    });
  });

  const notes = normalizeSubjectNotes(root.subjectNotes, subjectIdMap, usedNoteIds, nextNoteId);
  const legacyFiles = [];
  const subjectFiles = parseArray(root.subjectFiles, 'subject files');
  let totalFileBytes = 0;
  subjectFiles.forEach((file, index) => {
    const path = cleanText(file.path, 500).replace(/\\/g, '/');
    const segments = path.split('/').filter(Boolean);
    const baseName = segments.pop() || ('campusos-file-' + (index + 1));
    const name = baseName.replace(/[\u0000-\u001f]/g, '_').slice(0, 120);
    const data = cleanText(file.data, 20000000).replace(/\s/g, '');
    if (!data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      throw new Error('A CampusOS attachment has invalid Base64 data: ' + name);
    }
    totalFileBytes += Math.floor(data.length * 3 / 4);
    if (totalFileBytes > MAX_LEGACY_FILE_BYTES) {
      throw new Error('CampusOS attachments exceed the 12 MB migration limit. Create a smaller backup or transfer large files separately.');
    }
    const oldSubjectId = segments.length > 0 ? segments[0] : '';
    const mappedSubjectId = subjectIdMap.get(String(Number(oldSubjectId))) || null;
    legacyFiles.push({name, data, mimeType: mimeForName(name), category: 'Lecture', subjectId: mappedSubjectId});
  });

  const preset = paletteForCampusOs(root.appearancePreset || root.theme || 'forest');
  const settings = [
    {key: 'appearance_palette', value: preset},
    {key: 'profile_name', value: cleanText(root.profileName, 40)},
  ];
  if (root.profileStudentId !== undefined) settings.push({key: 'profile_student_id', value: cleanText(root.profileStudentId, 80)});
  if (root.profileSection !== undefined) settings.push({key: 'profile_section', value: cleanText(root.profileSection, 80)});

  const data = {
    subjects,
    classes,
    notes,
    tasks,
    activities: [],
    budget_transactions: [],
    monthly_budgets: [],
    category_budgets: [],
    savings_goals: [],
    settings,
  };
  const totalRecords = subjects.length + classes.length + notes.length + tasks.length;
  if (totalRecords > MAX_TOTAL_ROWS) throw new Error('This CampusOS backup contains too many records to migrate safely.');
  const warnings = [
    'CampusOS Backup v2 does not export Budget transactions or savings goals; any existing NewApk Budget records are preserved.',
    'CampusOS app-lock PINs, profile photos, old launcher layout settings and detailed timetable appearance settings are not imported.',
  ];
  return {
    data,
    legacyFiles,
    warnings,
    counts: {subjects: subjects.length, classes: classes.length, tasks: tasks.length, notes: notes.length, files: legacyFiles.length},
  };
}

module.exports = {convertCampusOsBackup};
