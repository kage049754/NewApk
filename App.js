import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator, Alert, NativeModules, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, Pressable, View,
} from 'react-native';
import {execute, getDashboardSummary, openDatabase, query} from './src/data/database';
import {palettes} from './src/theme/palettes';

const tabs = [
  {id: 'Home', icon: '⌂'}, {id: 'Schedule', icon: '▦'},
  {id: 'Tasks', icon: '✓'}, {id: 'Budget', icon: '₱'},
  {id: 'Notepad', icon: '✎'}, {id: 'Files', icon: '▧'},
  {id: 'Settings', icon: '⚙'},
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'School', 'Personal', 'Bills', 'Other'];
const INCOME_CATEGORIES = ['Allowance', 'Salary', 'Gift', 'Other'];
const NOTE_CATEGORIES = ['General', 'Lecture', 'Ideas', 'Personal', 'Other'];

function formatClock(value) {
  if (!value) return '';
  const parts = String(value).split(':');
  const hour = Number(parts[0]);
  const minute = parts[1] || '00';
  if (!Number.isFinite(hour)) return String(value);
  return (hour % 12 || 12) + ':' + minute.slice(0, 2) + (hour >= 12 ? ' PM' : ' AM');
}

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return MONTHS[parsed.getMonth()] + ' ' + parsed.getDate();
}

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / (1024 * 1024)).toFixed(1) + ' MB';
}

function fileKind(mimeType, name) {
  const mime = String(mimeType || '').toLowerCase();
  const lowerName = String(name || '').toLowerCase();
  if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) return 'PDF';
  if (mime.startsWith('image/')) return 'Image';
  return 'Document';
}

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function getTaskDueLabel(value) {
  if (!value) return 'No due date';
  const key = String(value).slice(0, 10);
  const today = getLocalDateKey();
  if (key < today) return 'Overdue · ' + formatDate(key);
  if (key === today) return 'Due today';
  return 'Due ' + formatDate(key);
}

export default function App() {
  const [active, setActive] = useState('Home');
  const [paletteName, setPaletteName] = useState('Forest');
  const [summary, setSummary] = useState({subjects: 0, pendingTasks: 0, notes: 0, classes: 0});
  const [subjects, setSubjects] = useState([]);
  const [todayClasses, setTodayClasses] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [scheduleDay, setScheduleDay] = useState(new Date().getDay());
  const [scheduleFormType, setScheduleFormType] = useState('class');
  const [scheduleSubjectName, setScheduleSubjectName] = useState('');
  const [scheduleSubjectCode, setScheduleSubjectCode] = useState('');
  const [scheduleSubjectRoom, setScheduleSubjectRoom] = useState('');
  const [scheduleProfessor, setScheduleProfessor] = useState('');
  const [scheduleSubjectColor, setScheduleSubjectColor] = useState('#55745B');
  const [scheduleClassSubjectId, setScheduleClassSubjectId] = useState('');
  const [scheduleClassDay, setScheduleClassDay] = useState(new Date().getDay());
  const [scheduleStart, setScheduleStart] = useState('08:00');
  const [scheduleEnd, setScheduleEnd] = useState('09:00');
  const [scheduleClassRoom, setScheduleClassRoom] = useState('');
  const [scheduleClassType, setScheduleClassType] = useState('Lecture');
  const [tasks, setTasks] = useState([]);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskCategory, setTaskCategory] = useState('Assignment');
  const [taskFilter, setTaskFilter] = useState('All');
  const [taskSearch, setTaskSearch] = useState('');
  const [notes, setNotes] = useState([]);
  const [noteCategory, setNoteCategory] = useState('General');
  const [noteSubjectId, setNoteSubjectId] = useState('');
  const [noteFilter, setNoteFilter] = useState('All');
  const [noteSearch, setNoteSearch] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [lectureFiles, setLectureFiles] = useState([]);
  const [fileSubjectFilter, setFileSubjectFilter] = useState('All');
  const [fileTypeFilter, setFileTypeFilter] = useState('All');
  const [fileSearch, setFileSearch] = useState('');
  const [fileImportSubjectId, setFileImportSubjectId] = useState('');
  const [fileCategoryDraft, setFileCategoryDraft] = useState('Lecture');
  const [activities, setActivities] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [monthlyLimit, setMonthlyLimit] = useState(0);
  const [categoryBudgets, setCategoryBudgets] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [budgetLimitCategory, setBudgetLimitCategory] = useState('Food');
  const [categoryLimitDraft, setCategoryLimitDraft] = useState('');
  const [goalTitleDraft, setGoalTitleDraft] = useState('');
  const [goalTargetDraft, setGoalTargetDraft] = useState('');
  const [goalContributionDraft, setGoalContributionDraft] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [budgetFormMode, setBudgetFormMode] = useState('transaction');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [budgetLimitDraft, setBudgetLimitDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [detail, setDetail] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [budgetType, setBudgetType] = useState('expense');
  const colors = palettes[paletteName] || palettes.Forest;

  const refresh = async () => {
    const dayOfWeek = new Date().getDay(); // Schedule convention: Sunday=0 through Saturday=6.
    const [stats, subjectRows, taskRows, noteRows, fileRows, classRows, activityRows, transactionRows, limitRows, categoryBudgetRows, savingsGoalRows] = await Promise.all([
      getDashboardSummary(),
      query('SELECT * FROM subjects ORDER BY name'),
      query("SELECT * FROM tasks ORDER BY completed, CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at ASC, CASE priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END, id DESC"),
      query('SELECT notes.*, subjects.name AS subject_name, subjects.code AS subject_code FROM notes LEFT JOIN subjects ON subjects.id = notes.subject_id ORDER BY notes.pinned DESC, notes.updated_at DESC, notes.id DESC'),
      query('SELECT lecture_files.*, subjects.name AS subject_name, subjects.code AS subject_code FROM lecture_files LEFT JOIN subjects ON subjects.id = lecture_files.subject_id ORDER BY lecture_files.imported_at DESC, lecture_files.id DESC'),
      query('SELECT classes.*, subjects.name AS subject_name, subjects.code AS subject_code, subjects.color AS subject_color, subjects.room AS subject_room FROM classes LEFT JOIN subjects ON subjects.id = classes.subject_id ORDER BY classes.day_of_week, classes.start_time'),
      query('SELECT * FROM activities WHERE starts_at IS NOT NULL ORDER BY starts_at ASC LIMIT 5'),
      query("SELECT * FROM budget_transactions WHERE strftime('%Y-%m', occurred_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime') ORDER BY occurred_at DESC, id DESC"),
      query("SELECT limit_amount FROM monthly_budgets WHERE month = strftime('%Y-%m', 'now', 'localtime') LIMIT 1"),
      query("SELECT * FROM category_budgets WHERE month = strftime('%Y-%m', 'now', 'localtime') ORDER BY category"),
      query('SELECT * FROM savings_goals ORDER BY id DESC'),
    ]);
    setSummary(stats);
    setSubjects(subjectRows);
    setTasks(taskRows);
    setNotes(noteRows);
    setLectureFiles(fileRows);
    setAllClasses(classRows);
    setTodayClasses(classRows.filter(item => Number(item.day_of_week) === dayOfWeek));
    setActivities(activityRows);
    setTransactions(transactionRows);
    setMonthlyLimit(limitRows[0]?.limit_amount || 0);
    setCategoryBudgets(categoryBudgetRows);
    setSavingsGoals(savingsGoalRows);
  };

  useEffect(() => {
    openDatabase()
      .then(refresh)
      .catch(error => Alert.alert('Storage unavailable', String(error)))
      .finally(() => setLoading(false));
  }, []);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const addItem = async () => {
    try {
      if (active === 'Schedule') {
        if (scheduleFormType === 'subject') {
          const name = scheduleSubjectName.trim();
          if (!name) {
            Alert.alert('Missing subject name', 'Enter a subject name before saving.');
            return;
          }
          await execute(
            'INSERT INTO subjects (name, code, room, professor, color) VALUES (?, ?, ?, ?, ?)',
            [name, scheduleSubjectCode.trim(), scheduleSubjectRoom.trim(), scheduleProfessor.trim(), scheduleSubjectColor.trim() || '#55745B'],
          );
        } else {
          const startValid = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduleStart);
          const endValid = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduleEnd);
          if (!startValid || !endValid) {
            Alert.alert('Invalid time', 'Use 24-hour time in HH:MM format, such as 08:30.');
            return;
          }
          const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
          if (toMinutes(scheduleEnd) <= toMinutes(scheduleStart)) {
            Alert.alert('Invalid class duration', 'The end time must be later than the start time.');
            return;
          }
          const subjectId = Number(scheduleClassSubjectId);
          if (!subjectId || !subjects.some(subject => subject.id === subjectId)) {
            Alert.alert('Choose a subject', 'Select a subject for this class.');
            return;
          }
          const day = Number(scheduleClassDay);
          const conflicts = await query(
            'SELECT id FROM classes WHERE day_of_week = ? AND start_time < ? AND end_time > ?',
            [day, scheduleEnd, scheduleStart],
          );
          if (conflicts.length) {
            Alert.alert('Schedule conflict', 'This time overlaps with another class on ' + DAYS[day] + '. Choose a different time.');
            return;
          }
          await execute(
            'INSERT INTO classes (subject_id, day_of_week, start_time, end_time, room, class_type) VALUES (?, ?, ?, ?, ?, ?)',
            [subjectId, day, scheduleStart, scheduleEnd, scheduleClassRoom.trim(), scheduleClassType],
          );
          setScheduleDay(day);
        }
        setScheduleSubjectName('');
        setScheduleSubjectCode('');
        setScheduleSubjectRoom('');
        setScheduleProfessor('');
        setScheduleSubjectColor('#55745B');
        setScheduleClassRoom('');
        setShowForm(false);
        await refresh();
        return;
      }

      const value = draft.trim();
      if (!value) {
        Alert.alert('Missing title', 'Enter a title before saving.');
        return;
      }
      if (active === 'Tasks') {
        const dueDate = taskDueDate.trim();
        if (dueDate) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            Alert.alert('Invalid due date', 'Use YYYY-MM-DD, for example 2026-11-25.');
            return;
          }
          const [year, month, day] = dueDate.split('-').map(Number);
          const parsedDate = new Date(year, month - 1, day);
          if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) {
            Alert.alert('Invalid due date', 'Enter a real calendar date.');
            return;
          }
        }
        await execute(
          'INSERT INTO tasks (title, details, due_at, priority, category) VALUES (?, ?, ?, ?, ?)',
          [value, detail.trim(), dueDate || null, taskPriority, taskCategory],
        );
      } else if (active === 'Notepad') {
        if (editingNoteId) {
          await execute(
            'UPDATE notes SET title = ?, body = ?, subject_id = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [value, detail.trim(), noteSubjectId ? Number(noteSubjectId) : null, noteCategory, editingNoteId],
          );
        } else {
          await execute(
            'INSERT INTO notes (title, body, subject_id, category) VALUES (?, ?, ?, ?)',
            [value, detail.trim(), noteSubjectId ? Number(noteSubjectId) : null, noteCategory],
          );
        }
      } else if (active === 'Budget') {
        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
          Alert.alert('Invalid amount', 'Enter an amount greater than zero.');
          return;
        }
        await execute(
          'INSERT INTO budget_transactions (title, amount, type, category, note) VALUES (?, ?, ?, ?, ?)',
          [value, numericAmount, budgetType, category.trim() || 'Other', detail.trim()],
        );
      } else {
        Alert.alert('Not available yet', 'This form is not available in this module yet.');
        return;
      }
      setDraft('');
      setDetail('');
      setAmount('');
      setCategory('Other');
      setTaskDueDate('');
      setTaskPriority('Medium');
      setTaskCategory('Assignment');
      setTaskSearch('');
      setTaskFilter('All');
      setEditingNoteId(null);
      setNoteCategory('General');
      setNoteSubjectId('');
      setBudgetFormMode('transaction');
      setShowForm(false);
      await refresh();
    } catch (error) {
      Alert.alert('Could not save', String(error));
    }
  };

  const saveMonthlyLimit = async () => {
    const value = Number(budgetLimitDraft);
    if (!Number.isFinite(value) || value < 0) {
      Alert.alert('Invalid budget', 'Enter a valid monthly budget limit.');
      return;
    }
    try {
      await execute(
        "INSERT INTO monthly_budgets (month, limit_amount) VALUES (strftime('%Y-%m', 'now', 'localtime'), ?) ON CONFLICT(month) DO UPDATE SET limit_amount = excluded.limit_amount, updated_at = CURRENT_TIMESTAMP",
        [value],
      );
      setBudgetLimitDraft('');
      await refresh();
    } catch (error) {
      Alert.alert('Could not save budget', String(error));
    }
  };

  const importLectureFile = async () => {
    if (!NativeModules.LectureFiles || !NativeModules.LectureFiles.pickFile) {
      Alert.alert('File import unavailable', 'The Android file picker is not available in this build.');
      return;
    }
    let picked;
    try {
      picked = await NativeModules.LectureFiles.pickFile();
      if (!picked) return;
      await execute(
        'INSERT INTO lecture_files (name, stored_path, mime_type, size_bytes, subject_id, category) VALUES (?, ?, ?, ?, ?, ?)',
        [picked.name, picked.path, picked.mimeType || '', Number(picked.sizeBytes) || 0, fileImportSubjectId ? Number(fileImportSubjectId) : null, fileCategoryDraft],
      );
      setFileSearch('');
      await refresh();
    } catch (error) {
      if (picked?.path && NativeModules.LectureFiles.deleteFile) {
        try { await NativeModules.LectureFiles.deleteFile(picked.path); } catch (_) {}
      }
      Alert.alert('Could not import file', String(error?.message || error));
    }
  };

  const openLectureFile = async item => {
    try {
      await NativeModules.LectureFiles.openFile(item.stored_path);
    } catch (error) {
      Alert.alert('Could not open file', String(error?.message || error) + '\n\nInstall an app that can open this file type and try again.');
    }
  };

  const removeLectureFile = item => {
    Alert.alert('Delete file?', 'This removes the local copy of ' + item.name + ' from NewApk.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          if (NativeModules.LectureFiles?.deleteFile) await NativeModules.LectureFiles.deleteFile(item.stored_path);
          await execute('DELETE FROM lecture_files WHERE id = ?', [item.id]);
          await refresh();
        } catch (error) {
          Alert.alert('Could not delete file', String(error?.message || error));
        }
      }},
    ]);
  };

  const openNoteForm = note => {
    setEditingNoteId(note?.id || null);
    setDraft(note?.title || '');
    setDetail(note?.body || '');
    setNoteCategory(note?.category || 'General');
    setNoteSubjectId(note?.subject_id ? String(note.subject_id) : '');
    setShowForm(true);
  };

  const toggleNotePin = async note => {
    try {
      await execute('UPDATE notes SET pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [note.pinned ? 0 : 1, note.id]);
      await refresh();
    } catch (error) {
      Alert.alert('Could not update note', String(error?.message || error));
    }
  };

  const removeNote = note => {
    Alert.alert('Delete note?', 'This note will be permanently removed from this device.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await execute('DELETE FROM notes WHERE id = ?', [note.id]);
          await refresh();
        } catch (error) {
          Alert.alert('Could not delete note', String(error?.message || error));
        }
      }},
    ]);
  };

  const saveCategoryLimit = async () => {
    const value = Number(categoryLimitDraft);
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Invalid category limit', 'Enter an amount greater than zero.');
      return;
    }
    try {
      await execute(
        "INSERT INTO category_budgets (month, category, limit_amount) VALUES (strftime('%Y-%m', 'now', 'localtime'), ?, ?) ON CONFLICT(month, category) DO UPDATE SET limit_amount = excluded.limit_amount, updated_at = CURRENT_TIMESTAMP",
        [budgetLimitCategory, value],
      );
      setCategoryLimitDraft('');
      await refresh();
    } catch (error) {
      Alert.alert('Could not save category limit', String(error));
    }
  };

  const saveSavingsGoal = async () => {
    const title = goalTitleDraft.trim();
    const target = Number(goalTargetDraft);
    if (!title) {
      Alert.alert('Missing goal name', 'Enter a name for your savings goal.');
      return;
    }
    if (!Number.isFinite(target) || target <= 0) {
      Alert.alert('Invalid target', 'Enter a target amount greater than zero.');
      return;
    }
    try {
      await execute('INSERT INTO savings_goals (title, target_amount, saved_amount) VALUES (?, ?, 0)', [title, target]);
      setGoalTitleDraft('');
      setGoalTargetDraft('');
      setShowForm(false);
      await refresh();
    } catch (error) {
      Alert.alert('Could not save savings goal', String(error));
    }
  };

  const contributeToSavingsGoal = async () => {
    const value = Number(goalContributionDraft);
    if (!selectedGoalId) return;
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Invalid amount', 'Enter an amount greater than zero.');
      return;
    }
    try {
      await execute('UPDATE savings_goals SET saved_amount = saved_amount + ? WHERE id = ?', [value, selectedGoalId]);
      setGoalContributionDraft('');
      setSelectedGoalId(null);
      setShowForm(false);
      await refresh();
    } catch (error) {
      Alert.alert('Could not add savings', String(error));
    }
  };

  const removeSavingsGoal = goal => {
    Alert.alert('Delete savings goal?', 'This will remove the goal and its saved progress.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await execute('DELETE FROM savings_goals WHERE id = ?', [goal.id]);
          await refresh();
        } catch (error) {
          Alert.alert('Could not delete savings goal', String(error));
        }
      }},
    ]);
  };

  const toggleTask = async task => {
    try {
      await execute('UPDATE tasks SET completed = ? WHERE id = ?', [task.completed ? 0 : 1, task.id]);
      await refresh();
    } catch (error) {
      Alert.alert('Could not update task', String(error));
    }
  };

  const removeTask = task => {
    Alert.alert('Delete task?', 'This task will be permanently removed from this device.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await execute('DELETE FROM tasks WHERE id = ?', [task.id]);
          await refresh();
        } catch (error) {
          Alert.alert('Could not delete task', String(error));
        }
      }},
    ]);
  };

  const openScheduleForm = type => {
    if (type === 'class' && !subjects.length) {
      Alert.alert('Add a subject first', 'Create a subject before adding its class.', [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Add subject', onPress: () => openScheduleForm('subject')},
      ]);
      return;
    }
    setScheduleFormType(type);
    setScheduleClassDay(scheduleDay);
    setScheduleClassSubjectId(subjects.length ? String(subjects[0].id) : '');
    setShowForm(true);
  };

  const removeClass = item => {
    Alert.alert('Remove class?', 'This will remove this class from your timetable.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await execute('DELETE FROM classes WHERE id = ?', [item.id]);
          await refresh();
        } catch (error) {
          Alert.alert('Could not remove class', String(error));
        }
      }},
    ]);
  };


  const Card = ({children, style}) => <View style={[styles.card, style]}>{children}</View>;
  const Heading = ({children, muted = false}) => <Text style={muted ? styles.muted : styles.heading}>{children}</Text>;
  const Action = ({label, onPress, secondary = false}) => (
    <Pressable onPress={onPress} style={[styles.action, secondary && styles.secondaryAction]}>
      <Text style={[styles.actionText, secondary && styles.secondaryActionText]}>{label}</Text>
    </Pressable>
  );
  const Empty = ({label}) => <Text style={styles.empty}>{label}</Text>;
  const SectionTitle = ({title, action, onPress}) => (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Pressable onPress={onPress}><Text style={styles.sectionAction}>{action}  ›</Text></Pressable> : null}
    </View>
  );

  const income = transactions.filter(item => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = transactions.filter(item => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0);
  const budgetRemaining = monthlyLimit - expenses;
  const budgetProgress = monthlyLimit > 0 ? Math.min(100, Math.max(0, expenses / monthlyLimit * 100)) : 0;
  const pendingTasks = tasks.filter(task => !task.completed);
  const now = new Date();
  const dateLabel = DAYS[now.getDay()] + ', ' + MONTHS[now.getMonth()] + ' ' + now.getDate();

  const renderHome = () => (
    <>
      <View style={styles.dashboardHero}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroEyebrow}>{dateLabel.toUpperCase()}</Text>
            <Text style={styles.heroGreeting}>{greetingForHour(now.getHours())}</Text>
          </View>
          <View style={styles.heroAvatar}><Text style={styles.heroAvatarText}>N</Text></View>
        </View>
        <Text style={styles.heroTitle}>Make today count.</Text>
        <Text style={styles.heroSubtitle}>Your classes, plans, and progress at a glance.</Text>
        <View style={styles.heroFooter}>
          <Text style={styles.heroFooterText}>{summary.subjects} subjects</Text>
          <View style={styles.heroFooterDot} />
          <Text style={styles.heroFooterText}>{pendingTasks.length} tasks to finish</Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        {[
          {label: 'Schedule', icon: '▦', screen: 'Schedule'},
          {label: 'Add task', icon: '+', screen: 'Tasks'},
          {label: 'Notepad', icon: '✎', screen: 'Notepad'},
          {label: 'Budget', icon: '₱', screen: 'Budget'},
        ].map(item => (
          <Pressable key={item.label} onPress={() => {setActive(item.screen); setShowForm(item.screen === 'Tasks' || item.screen === 'Notepad');}} style={styles.quickAction}>
            <View style={styles.quickIcon}><Text style={styles.quickIconText}>{item.icon}</Text></View>
            <Text style={styles.quickLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.statsGrid}>
        {[
          {label: 'Classes today', value: todayClasses.length, tone: 'green'},
          {label: 'Pending tasks', value: pendingTasks.length, tone: 'peach'},
          {label: 'Subjects', value: subjects.length, tone: 'blue'},
          {label: 'Notes saved', value: notes.length, tone: 'gold'},
        ].map(item => (
          <View key={item.label} style={[styles.statCard, styles['stat' + item.tone]]}>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionBlock}>
        <SectionTitle title="Today's classes" action="See schedule" onPress={() => setActive('Schedule')} />
        <Card>
          {todayClasses.length ? todayClasses.map(item => (
            <View key={item.id} style={styles.classRow}>
              <View style={styles.classTime}>
                <Text style={styles.classStart}>{formatClock(item.start_time)}</Text>
                <Text style={styles.classEnd}>{formatClock(item.end_time)}</Text>
              </View>
              <View style={[styles.classColor, {backgroundColor: item.subject_color || colors.primary}]} />
              <View style={styles.classInfo}>
                <Text style={styles.className}>{item.subject_name || 'Class'}</Text>
                <Text style={styles.classMeta}>{item.subject_code || item.class_type || 'Scheduled class'}{item.class_type ? ' · ' + item.class_type : ''}</Text>
                <Text style={styles.classRoom}>{item.room || item.subject_room || 'Room not set'}</Text>
              </View>
            </View>
          )) : (
            <View style={styles.emptySchedule}>
              <View style={styles.emptyScheduleIcon}><Text style={styles.emptyScheduleGlyph}>▦</Text></View>
              <Text style={styles.emptyScheduleTitle}>Nothing scheduled yet</Text>
              <Text style={styles.emptyScheduleText}>Your classes for today will appear here.</Text>
              <Action label="Open schedule" secondary onPress={() => setActive('Schedule')} />
            </View>
          )}
        </Card>
      </View>

      <View style={styles.sectionBlock}>
        <SectionTitle title="Your subjects" action="View all" onPress={() => setActive('Schedule')} />
        {subjects.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectStrip}>
            {subjects.slice(0, 8).map((subject, index) => (
              <Pressable key={subject.id} onPress={() => setActive('Schedule')} style={[styles.subjectTile, {backgroundColor: index % 2 === 0 ? colors.surface : colors.accent + '55', borderColor: colors.border}]}>
                <View style={[styles.subjectTileMark, {backgroundColor: subject.color || colors.primary}]} />
                <Text style={styles.subjectTileName} numberOfLines={2}>{subject.name}</Text>
                <Text style={styles.subjectTileCode} numberOfLines={1}>{subject.code || 'Subject'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Card><Empty label="Your subjects will appear here after you add them to Schedule." /><Action label="Add subjects" secondary onPress={() => setActive('Schedule')} /></Card>
        )}
      </View>

      <View style={styles.sectionBlock}>
        <SectionTitle title="Tasks to finish" action="See all" onPress={() => setActive('Tasks')} />
        <Card>
          {pendingTasks.slice(0, 3).map(task => (
            <Pressable key={task.id} onPress={() => toggleTask(task)} style={styles.taskRow}>
              <View style={styles.check}><Text style={styles.checkText} /></View>
              <View style={styles.taskInfo}>
                <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                <Text style={styles.taskDue}>{task.due_at ? 'Due ' + formatDate(task.due_at) : 'No deadline set'}</Text>
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </Pressable>
          ))}
          {!pendingTasks.length ? <Empty label="You are all caught up. Add a task when something needs your attention." /> : null}
          <Action label="＋ Add task" onPress={() => {setActive('Tasks'); setShowForm(true);}} />
        </Card>
      </View>

      <View style={styles.sectionBlock}>
        <SectionTitle title="Budget snapshot" action="Open budget" onPress={() => setActive('Budget')} />
        <Card>
          <View style={styles.budgetSummaryRow}>
            <View>
              <Text style={styles.budgetCaption}>MONTHLY EXPENSES</Text>
              <Text style={styles.budgetAmount}>₱{expenses.toFixed(2)}</Text>
            </View>
            <View style={styles.budgetBalance}>
              <Text style={styles.budgetCaption}>BALANCE</Text>
              <Text style={styles.budgetBalanceValue}>₱{(income - expenses).toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, {width: budgetProgress + '%'}]} /></View>
          <Text style={styles.budgetFootnote}>{monthlyLimit > 0 ? '₱' + Math.max(0, budgetRemaining).toFixed(2) + ' remaining from your monthly limit' : 'Set a monthly limit to track your spending progress.'}</Text>
        </Card>
      </View>

      <View style={styles.sectionBlock}>
        <SectionTitle title="Personal activities" />
        <Card>
          {activities.slice(0, 3).map(activity => (
            <View key={activity.id} style={styles.activityRow}>
              <View style={styles.activityMark} />
              <View style={styles.activityInfo}>
                <Text style={styles.taskTitle}>{activity.title}</Text>
                <Text style={styles.taskDue}>{formatDate(activity.starts_at)}</Text>
              </View>
            </View>
          ))}
          {!activities.length ? <Empty label="Personal appointments and activities will appear here." /> : null}
        </Card>
      </View>
    </>
  );

  const renderSchedule = () => {
    const visibleClasses = allClasses.filter(item => Number(item.day_of_week) === scheduleDay);
    const orderedDays = [1, 2, 3, 4, 5, 6, 0];
    return (
      <>
        <View style={styles.scheduleHeaderRow}>
          <View>
            <Text style={styles.scheduleEyebrow}>YOUR WEEK</Text>
            <Text style={styles.scheduleHeading}>Class timetable</Text>
          </View>
          <Pressable onPress={() => setScheduleDay(new Date().getDay())} style={styles.todayButton}>
            <Text style={styles.todayButtonText}>Today</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekdayStrip}>
          {orderedDays.map(day => (
            <Pressable key={day} onPress={() => setScheduleDay(day)} style={[styles.weekdayChip, scheduleDay === day && styles.weekdayChipSelected]}>
              <Text style={[styles.weekdayLabel, scheduleDay === day && styles.weekdayLabelSelected]}>{DAYS[day].slice(0, 3)}</Text>
              <Text style={[styles.weekdayNumber, scheduleDay === day && styles.weekdayNumberSelected]}>{day === new Date().getDay() ? '•' : String(day + 1)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.sectionBlock}>
          <SectionTitle title={DAYS[scheduleDay] + ' classes'} />
          <Card>
            {visibleClasses.length ? visibleClasses.map(item => (
              <View key={item.id} style={styles.classRow}>
                <View style={styles.classTime}>
                  <Text style={styles.classStart}>{formatClock(item.start_time)}</Text>
                  <Text style={styles.classEnd}>{formatClock(item.end_time)}</Text>
                </View>
                <View style={[styles.classColor, {backgroundColor: item.subject_color || colors.primary}]} />
                <View style={styles.classInfo}>
                  <Text style={styles.className}>{item.subject_name || 'Unassigned subject'}</Text>
                  <Text style={styles.classMeta}>{item.subject_code || 'No subject code'} · {item.class_type}</Text>
                  <Text style={styles.classRoom}>{item.room || item.subject_room || 'Room not set'}</Text>
                </View>
                <Pressable onPress={() => removeClass(item)} style={styles.classRemove}>
                  <Text style={styles.classRemoveText}>×</Text>
                </Pressable>
              </View>
            )) : (
              <View style={styles.emptySchedule}>
                <View style={styles.emptyScheduleIcon}><Text style={styles.emptyScheduleGlyph}>▦</Text></View>
                <Text style={styles.emptyScheduleTitle}>No classes on {DAYS[scheduleDay]}</Text>
                <Text style={styles.emptyScheduleText}>Add a class to build your weekly timetable.</Text>
              </View>
            )}
          </Card>
          <View style={styles.scheduleButtons}>
            <View style={styles.scheduleButtonFlex}><Action label="＋ Add class" onPress={() => openScheduleForm('class')} /></View>
            <View style={styles.scheduleButtonFlex}><Action label="＋ Add subject" secondary onPress={() => openScheduleForm('subject')} /></View>
          </View>
        </View>
        <View style={styles.sectionBlock}>
          <SectionTitle title="My subjects" />
          <Card>
            {subjects.map(subject => (
              <View key={subject.id} style={styles.subjectManageRow}>
                <View style={[styles.subjectTileMark, {backgroundColor: subject.color || colors.primary}]} />
                <View style={styles.subjectManageInfo}>
                  <Text style={styles.className}>{subject.name}</Text>
                  <Text style={styles.classMeta}>{subject.code || 'No subject code'}{subject.professor ? ' · ' + subject.professor : ''}</Text>
                  <Text style={styles.classRoom}>{subject.room || 'No default room'}</Text>
                </View>
              </View>
            ))}
            {!subjects.length ? <Empty label="No subjects yet. Add a subject to start creating your timetable." /> : null}
          </Card>
        </View>
      </>
    );
  };

  const renderTasks = () => {
    const today = getLocalDateKey();
    const openTasks = tasks.filter(item => !Number(item.completed));
    const completedTasks = tasks.filter(item => Number(item.completed));
    const highPriorityTasks = openTasks.filter(item => (item.priority || 'Medium') === 'High');
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));
    const weekEndKey = getLocalDateKey(weekEnd);
    const dueThisWeek = openTasks.filter(item => {
      const due = String(item.due_at || '').slice(0, 10);
      return due && due >= today && due <= weekEndKey;
    }).length;
    const progress = tasks.length ? Math.round(completedTasks.length / tasks.length * 100) : 0;
    const visibleTasks = tasks.filter(item => {
      const due = String(item.due_at || '').slice(0, 10);
      const matchesFilter = taskFilter === 'All'
        || (taskFilter === 'Today' && due === today)
        || (taskFilter === 'Upcoming' && !Number(item.completed) && due > today)
        || (taskFilter === 'Completed' && Number(item.completed));
      const searchValue = taskSearch.trim().toLowerCase();
      const matchesSearch = !searchValue || [item.title, item.details, item.category, item.priority]
        .some(value => String(value || '').toLowerCase().includes(searchValue));
      return matchesFilter && matchesSearch;
    });
    return (
      <>
        <View style={styles.taskDashboardHero}>
          <View style={styles.taskHeroTop}>
            <Text style={styles.taskHeroEyebrow}>YOUR WEEKLY OVERVIEW</Text>
            <Text style={styles.taskHeroCount}>{openTasks.length} open</Text>
          </View>
          <Text style={styles.taskHeroHeadline}>{completedTasks.length} tasks completed</Text>
          <Text style={styles.taskHeroCaption}>{dueThisWeek} due this week · {highPriorityTasks.length} high priority</Text>
          <View style={styles.taskHeroProgressTrack}>
            <View style={[styles.taskHeroProgressFill, {width: progress + '%'}]} />
          </View>
          <Text style={styles.taskHeroFoot}>{progress}% of your task list completed</Text>
        </View>

        <View style={styles.taskStatsRow}>
          <View style={styles.taskStatCard}>
            <Text style={styles.taskStatValue}>{openTasks.length}</Text>
            <Text style={styles.taskStatLabel}>To do</Text>
          </View>
          <View style={styles.taskStatCard}>
            <Text style={styles.taskStatValue}>{dueThisWeek}</Text>
            <Text style={styles.taskStatLabel}>Due this week</Text>
          </View>
          <View style={styles.taskStatCard}>
            <Text style={styles.taskStatValue}>{completedTasks.length}</Text>
            <Text style={styles.taskStatLabel}>Completed</Text>
          </View>
        </View>

        <TextInput
          value={taskSearch}
          onChangeText={setTaskSearch}
          placeholder="Search your tasks"
          placeholderTextColor={colors.muted}
          style={styles.taskSearch}
          returnKeyType="search"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.taskFilterRow}>
          {['All', 'Today', 'Upcoming', 'Completed'].map(filter => (
            <Pressable key={filter} onPress={() => setTaskFilter(filter)} style={[styles.taskFilterChip, taskFilter === filter && styles.taskFilterSelected]}>
              <Text style={[styles.taskFilterText, taskFilter === filter && styles.taskFilterTextSelected]}>{filter}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionBlock}>
          <SectionTitle title={taskFilter === 'All' ? 'Your tasks' : taskFilter + ' tasks'} />
          {visibleTasks.map(item => {
            const priority = item.priority || 'Medium';
            const priorityStyle = priority === 'High' ? styles.priorityHigh : priority === 'Low' ? styles.priorityLow : styles.priorityMedium;
            const priorityTextStyle = priority === 'High' ? styles.priorityTextHigh : priority === 'Low' ? styles.priorityTextLow : styles.priorityTextMedium;
            return (
              <View key={item.id} style={[styles.taskCard, Number(item.completed) && styles.taskCardCompleted]}>
                <View style={styles.taskCardMain}>
                  <Pressable onPress={() => toggleTask(item)} style={[styles.taskCheckLarge, Number(item.completed) && styles.taskCheckLargeDone]} accessibilityRole="checkbox" accessibilityState={{checked: !!Number(item.completed)}} accessibilityLabel={'Mark ' + item.title + (item.completed ? ' incomplete' : ' complete')}>
                    <Text style={styles.taskCheckLargeText}>{Number(item.completed) ? '✓' : ''}</Text>
                  </Pressable>
                  <View style={styles.taskCardInfo}>
                    <Text style={[styles.taskCardTitle, Number(item.completed) && styles.strike]} numberOfLines={2}>{item.title}</Text>
                    {!!item.details ? <Text style={styles.taskCardDescription} numberOfLines={2}>{item.details}</Text> : null}
                    <View style={styles.taskMetaRow}>
                      <Text style={styles.taskCategoryText}>{item.category || 'General'}</Text>
                      <Text style={styles.taskDueText}>{getTaskDueLabel(item.due_at)}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => removeTask(item)} style={styles.taskRemove} accessibilityRole="button" accessibilityLabel={'Delete ' + item.title}>
                    <Text style={styles.taskRemoveText}>×</Text>
                  </Pressable>
                </View>
                <View style={[styles.taskPriorityTag, priorityStyle]}>
                  <Text style={[styles.taskPriorityText, priorityTextStyle]}>{priority.toUpperCase()} PRIORITY</Text>
                </View>
              </View>
            );
          })}
          {!visibleTasks.length ? (
            <Card>
              <Empty label={taskSearch.trim() ? 'No tasks match your search.' : taskFilter === 'Completed' ? 'Completed tasks will appear here.' : taskFilter === 'Today' ? 'No tasks are due today.' : taskFilter === 'Upcoming' ? 'No upcoming tasks. Add a due date to plan ahead.' : 'No tasks yet. Add your first task to get started.'} />
            </Card>
          ) : null}
        </View>
        <Action label="＋ Add task" onPress={() => setShowForm(true)} />
      </>
    );
  };

  const renderList = (items, type) => (
    <Card>
      {items.map(item => (
        <View key={item.id} style={styles.listRow}>
          {type === 'Tasks' ? (
            <Pressable onPress={() => toggleTask(item)} style={[styles.check, item.completed && styles.checked]}>
              <Text style={styles.checkText}>{item.completed ? '✓' : ''}</Text>
            </Pressable>
          ) : <View style={styles.subjectMark} />}
          <View style={{flex: 1}}>
            <Text style={[styles.rowTitle, item.completed && styles.strike]}>{item.title || item.name}</Text>
            {!!(item.details || item.body || item.code) && <Text style={styles.rowHint}>{item.details || item.body || item.code}</Text>}
          </View>
        </View>
      ))}
      {!items.length && <Empty label={'No ' + type.toLowerCase() + ' added yet.'} />}
    </Card>
  );

  const renderNotepad = () => {
    const visibleNotes = notes.filter(note => {
      const categoryMatches = noteFilter === 'All' || (note.category || 'General') === noteFilter;
      const needle = noteSearch.trim().toLowerCase();
      const searchMatches = !needle || [note.title, note.body, note.category, note.subject_name, note.subject_code]
        .some(value => String(value || '').toLowerCase().includes(needle));
      return categoryMatches && searchMatches;
    });
    const pinnedCount = notes.filter(note => Number(note.pinned)).length;
    return (
      <>
        <View style={styles.noteHero}>
          <View style={styles.noteHeroTop}>
            <View>
              <Text style={styles.noteHeroEyebrow}>YOUR NOTEBOOK</Text>
              <Text style={styles.noteHeroTitle}>Ideas worth keeping.</Text>
            </View>
            <View style={styles.noteCountBubble}>
              <Text style={styles.noteCountValue}>{notes.length}</Text>
              <Text style={styles.noteCountLabel}>NOTES</Text>
            </View>
          </View>
          <Text style={styles.noteHeroCaption}>{pinnedCount} pinned · {subjects.length} subjects available</Text>
        </View>
        <TextInput value={noteSearch} onChangeText={setNoteSearch} placeholder="Search notes, details, or subjects" placeholderTextColor={colors.muted} style={styles.taskSearch} returnKeyType="search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.noteCategoryStrip}>
          {['All', ...NOTE_CATEGORIES].map(option => (
            <Pressable key={option} onPress={() => setNoteFilter(option)} style={[styles.taskFilterChip, noteFilter === option && styles.taskFilterSelected]}>
              <Text style={[styles.taskFilterText, noteFilter === option && styles.taskFilterTextSelected]}>{option}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.noteGrid}>
          {visibleNotes.map((note, index) => (
            <View key={note.id} style={[styles.noteCard, {borderTopColor: [colors.primary, '#C68A61', '#8B9BA6', '#B69C64'][index % 4]}]}>
              <Pressable onPress={() => openNoteForm(note)} style={styles.noteCardContent} accessibilityRole="button" accessibilityLabel={'Edit note ' + note.title}>
                <View style={styles.noteCardTop}>
                  <Text style={styles.noteCategoryTag}>{note.category || 'General'}</Text>
                  {Number(note.pinned) ? <Text style={styles.notePinned}>PINNED</Text> : null}
                </View>
                <Text style={styles.noteCardTitle} numberOfLines={2}>{note.title}</Text>
                <Text style={styles.noteCardBody} numberOfLines={5}>{note.body || 'No additional details.'}</Text>
                <Text style={styles.noteCardSubject}>{note.subject_code || note.subject_name || 'Personal note'}</Text>
              </Pressable>
              <View style={styles.noteCardActions}>
                <Pressable onPress={() => toggleNotePin(note)} style={styles.noteActionButton} accessibilityRole="button" accessibilityLabel={note.pinned ? 'Unpin note' : 'Pin note'}>
                  <Text style={styles.noteActionText}>{note.pinned ? 'Unpin' : 'Pin'}</Text>
                </Pressable>
                <Pressable onPress={() => removeNote(note)} style={styles.noteActionButton} accessibilityRole="button" accessibilityLabel={'Delete ' + note.title}>
                  <Text style={styles.noteDeleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
        {!visibleNotes.length ? (
          <Card><Empty label={noteSearch.trim() ? 'No notes match your search.' : noteFilter !== 'All' ? 'No notes in this category yet.' : 'Your notebook is empty. Create a note or save a lecture summary.'} /></Card>
        ) : null}
        <Action label="＋ New note" onPress={() => openNoteForm(null)} />
      </>
    );
  };

  const renderBudget = () => {
    const observedCategories = transactions
      .filter(item => item.type === 'expense')
      .map(item => String(item.category || 'Other'));
    const categoryNames = [...new Set([...EXPENSE_CATEGORIES, ...observedCategories])].sort();
    const categoryRows = categoryNames.map(name => {
      const spent = transactions
        .filter(item => item.type === 'expense' && String(item.category || 'Other') === name)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const limit = Number(categoryBudgets.find(item => item.category === name)?.limit_amount || 0);
      return {name, spent, limit};
    }).filter(item => item.spent > 0 || item.limit > 0);
    const largestCategorySpend = Math.max(1, ...categoryRows.map(item => item.spent));
    const monthlyProgress = monthlyLimit > 0 ? Math.min(100, Math.max(0, expenses / monthlyLimit * 100)) : 0;
    const selectedCategoryLimit = categoryBudgets.find(item => item.category === budgetLimitCategory);
    return (
      <>
        <View style={styles.budgetHero}>
          <Text style={styles.budgetHeroLabel}>AVAILABLE THIS MONTH</Text>
          <Text style={styles.budgetHeroValue}>₱{Math.max(0, budgetRemaining).toFixed(2)}</Text>
          <Text style={styles.budgetHeroSubtitle}>
            {monthlyLimit > 0 ? '₱' + expenses.toFixed(2) + ' spent from ₱' + Number(monthlyLimit).toFixed(2) : 'Set a monthly limit to track your spending.'}
          </Text>
          <View style={styles.budgetHeroTrack}>
            <View style={[styles.budgetHeroFill, {width: monthlyProgress + '%'}]} />
          </View>
          <Text style={styles.budgetHeroFoot}>
            {monthlyLimit > 0 ? Math.round(monthlyProgress) + '% of monthly budget used' : 'Your transactions are saved on this device.'}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statgreen]}><Text style={styles.statValue}>₱{income.toFixed(2)}</Text><Text style={styles.statLabel}>Income</Text></View>
          <View style={[styles.statCard, styles.statpeach]}><Text style={styles.statValue}>₱{expenses.toFixed(2)}</Text><Text style={styles.statLabel}>Expenses</Text></View>
          <View style={[styles.statCard, styles.statblue]}><Text style={styles.statValue}>₱{(income - expenses).toFixed(2)}</Text><Text style={styles.statLabel}>Balance</Text></View>
          <View style={[styles.statCard, styles.statgold]}><Text style={styles.statValue}>₱{budgetRemaining.toFixed(2)}</Text><Text style={styles.statLabel}>Limit remaining</Text></View>
        </View>

        <View style={styles.sectionBlock}>
          <SectionTitle title="Monthly spending limit" />
          <Card>
            <Text style={styles.bodyText}>{monthlyLimit > 0 ? 'Your monthly expense limit is ₱' + Number(monthlyLimit).toFixed(2) + '.' : 'Choose a monthly spending cap to track how much remains.'}</Text>
            <TextInput value={budgetLimitDraft} onChangeText={setBudgetLimitDraft} keyboardType="decimal-pad" placeholder="Monthly limit (₱)" placeholderTextColor={colors.muted} style={styles.input} />
            <Action label="Save monthly limit" onPress={saveMonthlyLimit} />
          </Card>
        </View>

        <View style={styles.sectionBlock}>
          <SectionTitle title="Spending by category" />
          <Card>
            {categoryRows.map(item => {
              const ratio = item.limit > 0 ? Math.min(100, item.spent / item.limit * 100) : Math.min(100, item.spent / largestCategorySpend * 100);
              return (
                <View key={item.name} style={styles.budgetCategoryRow}>
                  <View style={styles.budgetCategoryTop}>
                    <Text style={styles.budgetCategoryName}>{item.name}</Text>
                    <Text style={styles.budgetCategoryAmount}>₱{item.spent.toFixed(2)}{item.limit > 0 ? ' / ₱' + item.limit.toFixed(2) : ''}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, {width: ratio + '%'}]} />
                  </View>
                  {item.limit > 0 && item.spent > item.limit ? <Text style={styles.budgetOverLimit}>Over category limit by ₱{(item.spent - item.limit).toFixed(2)}</Text> : null}
                </View>
              );
            })}
            {!categoryRows.length ? <Empty label="Your expense categories will appear here after you add transactions." /> : null}
          </Card>
        </View>

        <View style={styles.sectionBlock}>
          <SectionTitle title="Category limits" />
          <Card>
            <Text style={styles.bodyText}>Set a separate monthly spending cap for each category.</Text>
            <View style={styles.choiceRow}>
              {categoryNames.map(name => (
                <Pressable key={name} onPress={() => {
                  setBudgetLimitCategory(name);
                  const savedLimit = categoryBudgets.find(item => item.category === name);
                  setCategoryLimitDraft(savedLimit ? String(savedLimit.limit_amount) : '');
                }} style={[styles.choiceChip, budgetLimitCategory === name && styles.choiceChipSelected]}>
                  <Text style={[styles.choiceChipText, budgetLimitCategory === name && styles.choiceChipTextSelected]}>{name}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>{budgetLimitCategory.toUpperCase()} MONTHLY LIMIT</Text>
            <TextInput value={categoryLimitDraft} onChangeText={setCategoryLimitDraft} keyboardType="decimal-pad" placeholder="Category limit (₱)" placeholderTextColor={colors.muted} style={styles.input} />
            <Text style={styles.formSubtitle}>{selectedCategoryLimit ? 'Current limit: ₱' + Number(selectedCategoryLimit.limit_amount).toFixed(2) : 'No limit set for this category yet.'}</Text>
            <Action label="Save category limit" onPress={saveCategoryLimit} />
          </Card>
        </View>

        <View style={styles.sectionBlock}>
          <SectionTitle title="Savings goals" action="＋ New goal" onPress={() => {
            setBudgetFormMode('goal');
            setShowForm(true);
          }} />
          <Card>
            {savingsGoals.map(goal => {
              const target = Number(goal.target_amount);
              const saved = Number(goal.saved_amount);
              const progress = target > 0 ? Math.min(100, Math.max(0, saved / target * 100)) : 0;
              return (
                <View key={goal.id} style={styles.savingsGoalCard}>
                  <View style={styles.savingsGoalTop}>
                    <View style={{flex: 1}}>
                      <Text style={styles.savingsGoalTitle}>{goal.title}</Text>
                      <Text style={styles.savingsGoalAmounts}>₱{saved.toFixed(2)} saved · ₱{target.toFixed(2)} goal</Text>
                    </View>
                    <Pressable onPress={() => removeSavingsGoal(goal)} style={styles.taskRemove} accessibilityRole="button" accessibilityLabel={'Delete ' + goal.title}>
                      <Text style={styles.taskRemoveText}>×</Text>
                    </Pressable>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, {width: progress + '%'}]} />
                  </View>
                  <View style={styles.savingsGoalBottom}>
                    <Text style={styles.savingsGoalProgress}>{Math.round(progress)}% saved</Text>
                    <Pressable onPress={() => {
                      setSelectedGoalId(goal.id);
                      setBudgetFormMode('contribution');
                      setShowForm(true);
                    }}>
                      <Text style={styles.savingsGoalAction}>＋ Add savings</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            {!savingsGoals.length ? <Empty label="Create a goal to track money you are saving toward something important." /> : null}
            <Action label="＋ Create savings goal" secondary onPress={() => {
              setBudgetFormMode('goal');
              setShowForm(true);
            }} />
          </Card>
        </View>

        <View style={styles.sectionBlock}>
          <SectionTitle title="Recent transactions" />
          <Card>
            {transactions.slice(0, 20).map(item => (
              <View key={item.id} style={styles.listRow}>
                <View style={{flex: 1}}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowHint}>{item.category} · {item.type}</Text>
                </View>
                <Text style={[styles.rowTitle, {color: item.type === 'income' ? colors.primary : colors.text}]}>{item.type === 'income' ? '+' : '−'}₱{Number(item.amount).toFixed(2)}</Text>
              </View>
            ))}
            {!transactions.length ? <Empty label="No income or expenses recorded yet." /> : null}
          </Card>
        </View>

        <View style={styles.formActions}>
          <Action label="＋ Add expense" onPress={() => {
            setBudgetType('expense');
            setBudgetFormMode('transaction');
            setCategory('Other');
            setShowForm(true);
          }} />
          <Action label="＋ Add income" secondary onPress={() => {
            setBudgetType('income');
            setBudgetFormMode('transaction');
            setCategory('Other');
            setShowForm(true);
          }} />
        </View>
      </>
    );
  };

  const renderFiles = () => {
    const visibleFiles = lectureFiles.filter(item => {
      const matchesSubject = fileSubjectFilter === 'All' || String(item.subject_id || '') === fileSubjectFilter;
      const kind = fileKind(item.mime_type, item.name);
      const matchesType = fileTypeFilter === 'All'
        || (fileTypeFilter === 'PDFs' && kind === 'PDF')
        || (fileTypeFilter === 'Images' && kind === 'Image')
        || (fileTypeFilter === 'Documents' && kind === 'Document');
      const needle = fileSearch.trim().toLowerCase();
      const matchesSearch = !needle || [item.name, item.subject_name, item.subject_code, item.category]
        .some(value => String(value || '').toLowerCase().includes(needle));
      return matchesSubject && matchesType && matchesSearch;
    });
    const pdfCount = lectureFiles.filter(item => fileKind(item.mime_type, item.name) === 'PDF').length;
    const imageCount = lectureFiles.filter(item => fileKind(item.mime_type, item.name) === 'Image').length;
    const documentCount = lectureFiles.filter(item => fileKind(item.mime_type, item.name) === 'Document').length;
    return (
      <>
        <View style={styles.fileHero}>
          <Text style={styles.fileHeroEyebrow}>YOUR OFFLINE LIBRARY</Text>
          <Text style={styles.fileHeroTitle}>Keep your study files close.</Text>
          <Text style={styles.fileHeroCaption}>Import once and open saved copies without an internet connection.</Text>
          <View style={styles.fileStatsRow}>
            <View style={styles.fileStat}>
              <Text style={styles.fileStatValue}>{lectureFiles.length}</Text>
              <Text style={styles.fileStatLabel}>FILES</Text>
            </View>
            <View style={styles.fileStat}>
              <Text style={styles.fileStatValue}>{pdfCount}</Text>
              <Text style={styles.fileStatLabel}>PDFS</Text>
            </View>
            <View style={styles.fileStat}>
              <Text style={styles.fileStatValue}>{imageCount + documentCount}</Text>
              <Text style={styles.fileStatLabel}>OTHER</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <SectionTitle title="Import to subject" />
          <Card>
            <Text style={styles.bodyText}>Choose where to organize the next file. You can leave it unassigned.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fileChipRow}>
              <Pressable onPress={() => setFileImportSubjectId('')} style={[styles.choiceChip, !fileImportSubjectId && styles.choiceChipSelected]}>
                <Text style={[styles.choiceChipText, !fileImportSubjectId && styles.choiceChipTextSelected]}>Unassigned</Text>
              </Pressable>
              {subjects.map(subject => (
                <Pressable key={subject.id} onPress={() => setFileImportSubjectId(String(subject.id))} style={[styles.choiceChip, fileImportSubjectId === String(subject.id) && styles.choiceChipSelected]}>
                  <Text style={[styles.choiceChipText, fileImportSubjectId === String(subject.id) && styles.choiceChipTextSelected]}>{subject.code || subject.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.fieldLabel}>FILE CATEGORY</Text>
            <View style={styles.choiceRow}>
              {['Lecture', 'Handout', 'Reference', 'Other'].map(option => (
                <Pressable key={option} onPress={() => setFileCategoryDraft(option)} style={[styles.choiceChip, fileCategoryDraft === option && styles.choiceChipSelected]}>
                  <Text style={[styles.choiceChipText, fileCategoryDraft === option && styles.choiceChipTextSelected]}>{option}</Text>
                </Pressable>
              ))}
            </View>
            <Action label="＋ Import file from device" onPress={importLectureFile} />
          </Card>
        </View>

        <View style={styles.sectionBlock}>
          <SectionTitle title="My library" />
          <TextInput value={fileSearch} onChangeText={setFileSearch} placeholder="Search files or subjects" placeholderTextColor={colors.muted} style={styles.taskSearch} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fileChipRow}>
            {['All', ...subjects.map(subject => String(subject.id))].map(filter => {
              const selected = fileSubjectFilter === filter;
              const label = filter === 'All' ? 'All subjects' : (subjects.find(subject => String(subject.id) === filter)?.code || subjects.find(subject => String(subject.id) === filter)?.name || 'Subject');
              return (
                <Pressable key={filter} onPress={() => setFileSubjectFilter(filter)} style={[styles.taskFilterChip, selected && styles.taskFilterSelected]}>
                  <Text style={[styles.taskFilterText, selected && styles.taskFilterTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fileChipRow}>
            {['All', 'PDFs', 'Images', 'Documents'].map(filter => (
              <Pressable key={filter} onPress={() => setFileTypeFilter(filter)} style={[styles.taskFilterChip, fileTypeFilter === filter && styles.taskFilterSelected]}>
                <Text style={[styles.taskFilterText, fileTypeFilter === filter && styles.taskFilterTextSelected]}>{filter}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.fileList}>
            {visibleFiles.map(item => {
              const kind = fileKind(item.mime_type, item.name);
              return (
                <View key={item.id} style={styles.fileCard}>
                  <Pressable onPress={() => openLectureFile(item)} style={styles.fileOpenRow} accessibilityRole="button" accessibilityLabel={'Open ' + item.name}>
                    <View style={[styles.fileKindIcon, kind === 'PDF' ? styles.fileKindPdf : kind === 'Image' ? styles.fileKindImage : styles.fileKindDocument]}>
                      <Text style={styles.fileKindGlyph}>{kind === 'PDF' ? 'PDF' : kind === 'Image' ? 'IMG' : 'DOC'}</Text>
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.fileMeta}>{item.subject_code || item.subject_name || 'Unassigned'} · {item.category} · {formatFileSize(item.size_bytes)}</Text>
                      <Text style={styles.fileOpenHint}>Tap to open saved copy</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => removeLectureFile(item)} style={styles.taskRemove} accessibilityRole="button" accessibilityLabel={'Delete ' + item.name}>
                    <Text style={styles.taskRemoveText}>×</Text>
                  </Pressable>
                </View>
              );
            })}
            {!visibleFiles.length ? (
              <Card><Empty label={fileSearch.trim() ? 'No files match your search.' : lectureFiles.length ? 'No files match these filters.' : 'Your library is empty. Import lecture files, PDFs, and images from your device.'} /></Card>
            ) : null}
          </View>
        </View>
      </>
    );
  };

  const renderContent = () => {
    if (active === 'Home') return renderHome();
    if (active === 'Tasks') return renderTasks();
    if (active === 'Notepad') return renderNotepad();
    if (active === 'Budget') return renderBudget();
    if (active === 'Schedule') return renderSchedule();
    if (active === 'Files') return renderFiles();
    return (
      <>
        <Card>
          <Heading>Appearance</Heading>
          <Text style={styles.bodyText}>Choose a color combination for the entire app.</Text>
          {Object.keys(palettes).map(name => (
            <Pressable key={name} onPress={() => setPaletteName(name)} style={styles.listRow}>
              <View style={[styles.paletteDot, {backgroundColor: palettes[name].primary}]} />
              <Text style={styles.rowTitle}>{name}</Text>
              <Text style={styles.rowHint}>{paletteName === name ? 'Selected ✓' : 'Select'}</Text>
            </Pressable>
          ))}
        </Card>
        <Card><Heading>Data and privacy</Heading><Text style={styles.bodyText}>Your planner data is stored locally on this device. NewApk does not require an account or cloud database.</Text></Card>
        <Card><Heading>About NewApk</Heading><Text style={styles.bodyText}>React Native student productivity app · Offline-first</Text></Card>
      </>
    );
  };

  const pageTitle = active === 'Home' ? '' : active === 'Files' ? 'Lecture Files' : active;

  if (loading) return <SafeAreaView style={[styles.loading, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Preparing your workspace…</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle={paletteName === 'Night' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.topBar}>
        <View><Text style={styles.brand}>NewApk</Text><Text style={styles.topCaption}>STUDENT WORKSPACE</Text></View>
        <View style={styles.avatar}><Text style={styles.avatarText}>N</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!!pageTitle ? <Text style={styles.pageTitle}>{pageTitle}</Text> : null}
        {renderContent()}
      </ScrollView>
      {showForm && active === 'Schedule' ? (
        <View style={styles.formOverlay}>
          <View style={styles.formCard}>
            <Text style={styles.heading}>{scheduleFormType === 'subject' ? 'Add subject' : 'Add class'}</Text>
            <Text style={styles.formSubtitle}>{scheduleFormType === 'subject' ? 'Create a subject for your timetable.' : 'Choose a subject and set its class time.'}</Text>
            <ScrollView style={styles.scheduleFormScroll} keyboardShouldPersistTaps="handled">
              {scheduleFormType === 'subject' ? (
                <>
                  <TextInput value={scheduleSubjectName} onChangeText={setScheduleSubjectName} placeholder="Subject name *" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={scheduleSubjectCode} onChangeText={setScheduleSubjectCode} placeholder="Subject code" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={scheduleSubjectRoom} onChangeText={setScheduleSubjectRoom} placeholder="Default room" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={scheduleProfessor} onChangeText={setScheduleProfessor} placeholder="Professor" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={scheduleSubjectColor} onChangeText={setScheduleSubjectColor} placeholder="Color (hex)" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" />
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>SUBJECT</Text>
                  <View style={styles.choiceRow}>
                    {subjects.map(subject => (
                      <Pressable key={subject.id} onPress={() => setScheduleClassSubjectId(String(subject.id))} style={[styles.choiceChip, scheduleClassSubjectId === String(subject.id) && styles.choiceChipSelected]}>
                        <Text style={[styles.choiceChipText, scheduleClassSubjectId === String(subject.id) && styles.choiceChipTextSelected]}>{subject.code || subject.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.fieldLabel}>DAY</Text>
                  <View style={styles.choiceRow}>
                    {[1, 2, 3, 4, 5, 6, 0].map(day => (
                      <Pressable key={day} onPress={() => setScheduleClassDay(day)} style={[styles.choiceChip, scheduleClassDay === day && styles.choiceChipSelected]}>
                        <Text style={[styles.choiceChipText, scheduleClassDay === day && styles.choiceChipTextSelected]}>{DAYS[day].slice(0, 3)}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.fieldLabel}>CLASS TIME (24-HOUR)</Text>
                  <View style={styles.timeInputRow}>
                    <TextInput value={scheduleStart} onChangeText={setScheduleStart} placeholder="08:00" placeholderTextColor={colors.muted} style={[styles.input, styles.timeInput]} keyboardType="numbers-and-punctuation" maxLength={5} />
                    <Text style={styles.timeSeparator}>to</Text>
                    <TextInput value={scheduleEnd} onChangeText={setScheduleEnd} placeholder="09:00" placeholderTextColor={colors.muted} style={[styles.input, styles.timeInput]} keyboardType="numbers-and-punctuation" maxLength={5} />
                  </View>
                  <TextInput value={scheduleClassRoom} onChangeText={setScheduleClassRoom} placeholder="Room (optional)" placeholderTextColor={colors.muted} style={styles.input} />
                  <Text style={styles.fieldLabel}>CLASS TYPE</Text>
                  <View style={styles.choiceRow}>
                    {['Lecture', 'Lab'].map(type => (
                      <Pressable key={type} onPress={() => setScheduleClassType(type)} style={[styles.choiceChip, scheduleClassType === type && styles.choiceChipSelected]}>
                        <Text style={[styles.choiceChipText, scheduleClassType === type && styles.choiceChipTextSelected]}>{type}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
            <View style={styles.formActions}>
              <Action label="Cancel" secondary onPress={() => setShowForm(false)} />
              <Action label={scheduleFormType === 'subject' ? 'Save subject' : 'Save class'} onPress={addItem} />
            </View>
          </View>
        </View>
      ) : showForm ? (
        <View style={styles.formOverlay}>
          <View style={styles.formCard}>
            <Text style={styles.heading}>{active === 'Budget' ? (budgetFormMode === 'goal' ? 'New savings goal' : budgetFormMode === 'contribution' ? 'Add to savings' : budgetType === 'income' ? 'Add income' : 'Add expense') : active === 'Tasks' ? 'New task' : active === 'Notepad' && editingNoteId ? 'Edit note' : 'New note'}</Text>
            {active !== 'Budget' || budgetFormMode === 'transaction' ? (
              <TextInput value={draft} onChangeText={setDraft} placeholder={active === 'Budget' ? 'Transaction name' : 'Title'} placeholderTextColor={colors.muted} style={styles.input} />
            ) : null}
            {active === 'Tasks' ? <>
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <View style={styles.choiceRow}>
                {['Assignment', 'Project', 'Reading', 'Personal', 'Other'].map(option => (
                  <Pressable key={option} onPress={() => setTaskCategory(option)} style={[styles.choiceChip, taskCategory === option && styles.choiceChipSelected]}>
                    <Text style={[styles.choiceChipText, taskCategory === option && styles.choiceChipTextSelected]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>PRIORITY</Text>
              <View style={styles.choiceRow}>
                {['Low', 'Medium', 'High'].map(option => (
                  <Pressable key={option} onPress={() => setTaskPriority(option)} style={[styles.choiceChip, taskPriority === option && styles.choiceChipSelected]}>
                    <Text style={[styles.choiceChipText, taskPriority === option && styles.choiceChipTextSelected]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={taskDueDate} onChangeText={setTaskDueDate} placeholder="Due date (YYYY-MM-DD)" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" maxLength={10} />
              <Text style={styles.formSubtitle}>Leave the due date blank when there is no deadline.</Text>
            </> : null}
            {active === 'Budget' && budgetFormMode === 'transaction' ? <>
              <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount (₱)" placeholderTextColor={colors.muted} style={styles.input} />
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <View style={styles.choiceRow}>
                {(budgetType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(option => (
                  <Pressable key={option} onPress={() => setCategory(option)} style={[styles.choiceChip, category === option && styles.choiceChipSelected]}>
                    <Text style={[styles.choiceChipText, category === option && styles.choiceChipTextSelected]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            </> : null}
            {active === 'Budget' && budgetFormMode === 'goal' ? <>
              <TextInput value={goalTitleDraft} onChangeText={setGoalTitleDraft} placeholder="Goal name" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={goalTargetDraft} onChangeText={setGoalTargetDraft} keyboardType="decimal-pad" placeholder="Target amount (₱)" placeholderTextColor={colors.muted} style={styles.input} />
            </> : null}
            {active === 'Budget' && budgetFormMode === 'contribution' ? (
              <TextInput value={goalContributionDraft} onChangeText={setGoalContributionDraft} keyboardType="decimal-pad" placeholder="Amount to add (₱)" placeholderTextColor={colors.muted} style={styles.input} />
            ) : null}
            {active === 'Notepad' ? <>
              <Text style={styles.fieldLabel}>NOTE CONTENT</Text>
              <TextInput value={detail} onChangeText={setDetail} placeholder="Write your note..." placeholderTextColor={colors.muted} style={[styles.input, styles.noteEditor]} multiline textAlignVertical="top" />
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <View style={styles.choiceRow}>
                {NOTE_CATEGORIES.map(option => (
                  <Pressable key={option} onPress={() => setNoteCategory(option)} style={[styles.choiceChip, noteCategory === option && styles.choiceChipSelected]}>
                    <Text style={[styles.choiceChipText, noteCategory === option && styles.choiceChipTextSelected]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>LINK TO SUBJECT (OPTIONAL)</Text>
              <View style={styles.choiceRow}>
                <Pressable onPress={() => setNoteSubjectId('')} style={[styles.choiceChip, !noteSubjectId && styles.choiceChipSelected]}>
                  <Text style={[styles.choiceChipText, !noteSubjectId && styles.choiceChipTextSelected]}>None</Text>
                </Pressable>
                {subjects.map(subject => (
                  <Pressable key={subject.id} onPress={() => setNoteSubjectId(String(subject.id))} style={[styles.choiceChip, noteSubjectId === String(subject.id) && styles.choiceChipSelected]}>
                    <Text style={[styles.choiceChipText, noteSubjectId === String(subject.id) && styles.choiceChipTextSelected]}>{subject.code || subject.name}</Text>
                  </Pressable>
                ))}
              </View>
            </> : active !== 'Budget' || budgetFormMode === 'transaction' ? (
              <TextInput value={detail} onChangeText={setDetail} placeholder="Details (optional)" placeholderTextColor={colors.muted} style={styles.input} />
            ) : null}
            <View style={styles.formActions}>
              <Action label="Cancel" secondary onPress={() => setShowForm(false)} />
              <Action label={active === 'Budget' ? budgetFormMode === 'goal' ? 'Create goal' : budgetFormMode === 'contribution' ? 'Add savings' : 'Save transaction' : active === 'Notepad' && editingNoteId ? 'Save changes' : 'Save'} onPress={active === 'Budget' ? budgetFormMode === 'goal' ? saveSavingsGoal : budgetFormMode === 'contribution' ? contributeToSavingsGoal : addItem : addItem} />
            </View>
          </View>
        </View>
      ) : null}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
          {tabs.map(tab => (
            <Pressable key={tab.id} onPress={() => {setActive(tab.id); setShowForm(false);}} style={[styles.tab, active === tab.id && styles.activeTab]}>
              <Text style={[styles.tabIcon, active === tab.id && styles.activeTabText]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, active === tab.id && styles.activeTabText]}>{tab.id === 'Notepad' ? 'Notes' : tab.id}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    screen: {flex: 1, backgroundColor: c.background},
    loading: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12},
    topBar: {paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    brand: {fontSize: 22, fontWeight: '800', color: c.text, letterSpacing: -0.5},
    topCaption: {fontSize: 9, color: c.muted, letterSpacing: 1.5, marginTop: 2, fontWeight: '700'},
    avatar: {width: 38, height: 38, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center'},
    avatarText: {color: c.primary, fontWeight: '800', fontSize: 16},
    content: {paddingHorizontal: 18, paddingBottom: 24, gap: 17},
    pageTitle: {fontSize: 27, fontWeight: '800', color: c.text, letterSpacing: -0.7, marginTop: 4},
    dashboardHero: {backgroundColor: c.primary, borderRadius: 25, padding: 21, minHeight: 190, justifyContent: 'space-between'},
    heroTopRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    heroEyebrow: {color: '#DCE8D8', fontSize: 9, letterSpacing: 1.5, fontWeight: '800'},
    heroGreeting: {color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 5},
    heroAvatar: {width: 38, height: 38, borderRadius: 14, backgroundColor: '#FFFFFF33', alignItems: 'center', justifyContent: 'center'},
    heroAvatarText: {fontSize: 16, fontWeight: '800', color: '#FFFFFF'},
    heroTitle: {color: '#FFFFFF', fontSize: 27, fontWeight: '800', marginTop: 19, letterSpacing: -0.7},
    heroSubtitle: {color: '#E4EDE1', fontSize: 12, marginTop: 6},
    heroFooter: {flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 8},
    heroFooterText: {color: '#F4F7F1', fontSize: 10, fontWeight: '700'},
    heroFooterDot: {width: 4, height: 4, borderRadius: 2, backgroundColor: '#DCE8D8'},
    quickActions: {flexDirection: 'row', justifyContent: 'space-between', gap: 7},
    quickAction: {flex: 1, alignItems: 'center', gap: 6},
    quickIcon: {width: 46, height: 46, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center'},
    quickIconText: {fontSize: 19, color: c.primary, fontWeight: '800'},
    quickLabel: {fontSize: 10, color: c.text, fontWeight: '700'},
    statsGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 9},
    statCard: {width: '48%', flexGrow: 1, borderRadius: 17, padding: 14, minHeight: 78, justifyContent: 'center'},
    statgreen: {backgroundColor: c.accent + '65'},
    statpeach: {backgroundColor: '#F3D8C8'},
    statblue: {backgroundColor: '#D9E6E8'},
    statgold: {backgroundColor: '#F0E5C8'},
    statValue: {fontSize: 23, fontWeight: '800', color: c.text},
    statLabel: {fontSize: 10, color: c.muted, fontWeight: '700', marginTop: 2},
    sectionBlock: {gap: 9},
    sectionTitleRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2},
    sectionTitle: {fontSize: 16, fontWeight: '800', color: c.text},
    sectionAction: {fontSize: 11, color: c.primary, fontWeight: '800'},
    card: {backgroundColor: c.surface, borderRadius: 20, padding: 15, borderWidth: 1, borderColor: c.border, gap: 10},
    heading: {fontSize: 16, fontWeight: '800', color: c.text},
    muted: {fontSize: 12, color: c.muted},
    bodyText: {fontSize: 13, color: c.muted, lineHeight: 20},
    classRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border},
    classTime: {width: 68},
    classStart: {fontSize: 11, color: c.text, fontWeight: '800'},
    classEnd: {fontSize: 9, color: c.muted, marginTop: 3},
    classColor: {width: 4, alignSelf: 'stretch', borderRadius: 3},
    classInfo: {flex: 1, paddingVertical: 2},
    className: {fontSize: 13, color: c.text, fontWeight: '800'},
    classMeta: {fontSize: 10, color: c.muted, marginTop: 3},
    classRoom: {fontSize: 10, color: c.primary, fontWeight: '700', marginTop: 3},
    emptySchedule: {alignItems: 'center', paddingVertical: 12, gap: 7},
    emptyScheduleIcon: {width: 42, height: 42, borderRadius: 15, backgroundColor: c.accent + '66', alignItems: 'center', justifyContent: 'center'},
    emptyScheduleGlyph: {fontSize: 20, color: c.primary},
    emptyScheduleTitle: {fontSize: 13, color: c.text, fontWeight: '800'},
    emptyScheduleText: {fontSize: 11, color: c.muted, textAlign: 'center'},
    subjectStrip: {gap: 9, paddingRight: 8},
    subjectTile: {width: 126, minHeight: 112, borderWidth: 1, borderRadius: 17, padding: 12, justifyContent: 'space-between'},
    subjectTileMark: {width: 22, height: 5, borderRadius: 3},
    subjectTileName: {fontSize: 12, lineHeight: 16, color: c.text, fontWeight: '800'},
    subjectTileCode: {fontSize: 9, color: c.muted, fontWeight: '700'},
    taskRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border},
    check: {width: 21, height: 21, borderWidth: 1.5, borderColor: c.border, borderRadius: 7, alignItems: 'center', justifyContent: 'center'},
    checked: {backgroundColor: c.primary, borderColor: c.primary},
    checkText: {color: '#FFFFFF', fontSize: 12, fontWeight: '800'},
    taskInfo: {flex: 1},
    taskTitle: {fontSize: 12, color: c.text, fontWeight: '700'},
    taskDue: {fontSize: 10, color: c.muted, marginTop: 3},
    rowChevron: {fontSize: 22, color: c.muted},
    budgetSummaryRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    budgetCaption: {fontSize: 9, letterSpacing: 1, color: c.muted, fontWeight: '800'},
    budgetAmount: {fontSize: 21, color: c.text, fontWeight: '800', marginTop: 4},
    budgetBalance: {alignItems: 'flex-end'},
    budgetBalanceValue: {fontSize: 15, color: c.primary, fontWeight: '800', marginTop: 6},
    progressTrack: {height: 8, backgroundColor: c.background, borderRadius: 5, overflow: 'hidden'},
    progressFill: {height: 8, backgroundColor: c.primary, borderRadius: 5},
    budgetFootnote: {fontSize: 10, color: c.muted},
    activityRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7},
    activityMark: {width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary},
    activityInfo: {flex: 1},
    listRow: {flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border},
    rowTitle: {fontSize: 13, color: c.text, fontWeight: '600', flex: 1},
    rowHint: {fontSize: 11, color: c.muted},
    subjectMark: {width: 9, height: 28, borderRadius: 5, backgroundColor: c.accent},
    empty: {fontSize: 12, color: c.muted, paddingVertical: 12, lineHeight: 18},
    action: {backgroundColor: c.primary, borderRadius: 13, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center'},
    actionText: {color: '#FFFFFF', fontSize: 12, fontWeight: '800'},
    secondaryAction: {backgroundColor: c.background, borderWidth: 1, borderColor: c.border},
    secondaryActionText: {color: c.text},
    strike: {textDecorationLine: 'line-through', color: c.muted},
    paletteDot: {width: 20, height: 20, borderRadius: 10},
    tabBar: {backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, paddingVertical: 7},
    tabContent: {paddingHorizontal: 8, gap: 4},
    tab: {minWidth: 62, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 7, borderRadius: 13},
    activeTab: {backgroundColor: c.accent + '55'},
    tabIcon: {fontSize: 17, color: c.muted, fontWeight: '700'},
    tabLabel: {fontSize: 9, color: c.muted, marginTop: 3, fontWeight: '700'},
    activeTabText: {color: c.primary},
    formOverlay: {position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#0008', justifyContent: 'center', padding: 20},
    formCard: {backgroundColor: c.surface, borderRadius: 22, padding: 18, gap: 12},
    input: {borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: c.text, fontSize: 14},
    formActions: {flexDirection: 'row', gap: 10, justifyContent: 'flex-end'},
    scheduleHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    scheduleEyebrow: {fontSize: 9, color: c.muted, letterSpacing: 1.5, fontWeight: '800'},
    scheduleHeading: {fontSize: 21, color: c.text, fontWeight: '800', marginTop: 3},
    todayButton: {backgroundColor: c.accent + '66', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9},
    todayButtonText: {fontSize: 11, fontWeight: '800', color: c.primary},
    weekdayStrip: {gap: 8, paddingVertical: 2, paddingRight: 8},
    weekdayChip: {width: 48, height: 62, borderRadius: 15, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', gap: 4},
    weekdayChipSelected: {backgroundColor: c.primary, borderColor: c.primary},
    weekdayLabel: {fontSize: 10, color: c.muted, fontWeight: '700'},
    weekdayLabelSelected: {color: '#FFFFFF'},
    weekdayNumber: {fontSize: 13, color: c.text, fontWeight: '800'},
    weekdayNumberSelected: {color: '#FFFFFF'},
    scheduleButtons: {flexDirection: 'row', gap: 9},
    scheduleButtonFlex: {flex: 1},
    classRemove: {width: 28, height: 28, borderRadius: 10, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center'},
    classRemoveText: {fontSize: 19, color: c.muted, lineHeight: 22},
    subjectManageRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border},
    subjectManageInfo: {flex: 1},
    formSubtitle: {fontSize: 11, color: c.muted, marginTop: -5},
    scheduleFormScroll: {maxHeight: 420},
    fieldLabel: {fontSize: 9, letterSpacing: 1, color: c.muted, fontWeight: '800', marginTop: 5},
    choiceRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 5},
    choiceChip: {backgroundColor: c.background, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12},
    choiceChipSelected: {backgroundColor: c.primary, borderColor: c.primary},
    choiceChipText: {fontSize: 10, color: c.text, fontWeight: '700'},
    choiceChipTextSelected: {color: '#FFFFFF'},
    timeInputRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
    timeInput: {flex: 1}, 
    timeSeparator: {fontSize: 11, color: c.muted},
    taskDashboardHero: {backgroundColor: c.primary, borderRadius: 24, padding: 19, gap: 9},
    taskHeroTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    taskHeroEyebrow: {fontSize: 9, color: '#E4EDE1', letterSpacing: 1.3, fontWeight: '800'},
    taskHeroCount: {fontSize: 10, color: '#FFFFFF', fontWeight: '800', backgroundColor: '#FFFFFF26', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10},
    taskHeroHeadline: {fontSize: 23, color: '#FFFFFF', fontWeight: '800', letterSpacing: -0.5, marginTop: 8},
    taskHeroCaption: {fontSize: 11, color: '#E4EDE1'},
    taskHeroProgressTrack: {height: 8, backgroundColor: '#FFFFFF35', borderRadius: 5, overflow: 'hidden', marginTop: 8},
    taskHeroProgressFill: {height: 8, backgroundColor: '#FFFFFF', borderRadius: 5},
    taskHeroFoot: {fontSize: 9, color: '#E4EDE1', fontWeight: '700'},
    taskStatsRow: {flexDirection: 'row', gap: 8},
    taskStatCard: {flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 15, padding: 12, gap: 3},
    taskStatValue: {fontSize: 21, color: c.text, fontWeight: '800'},
    taskStatLabel: {fontSize: 9, color: c.muted, fontWeight: '700'},
    taskSearch: {borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11, color: c.text, fontSize: 13},
    taskFilterRow: {gap: 7, paddingRight: 8},
    taskFilterChip: {borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.surface, paddingHorizontal: 14, paddingVertical: 9},
    taskFilterSelected: {backgroundColor: c.primary, borderColor: c.primary},
    taskFilterText: {fontSize: 10, color: c.muted, fontWeight: '800'},
    taskFilterTextSelected: {color: '#FFFFFF'},
    taskCard: {backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 17, padding: 13, gap: 9},
    taskCardCompleted: {opacity: 0.72},
    taskCardMain: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
    taskCheckLarge: {width: 23, height: 23, borderRadius: 8, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginTop: 1},
    taskCheckLargeDone: {backgroundColor: c.primary, borderColor: c.primary},
    taskCheckLargeText: {fontSize: 13, color: '#FFFFFF', fontWeight: '900'},
    taskCardInfo: {flex: 1, gap: 5},
    taskCardTitle: {fontSize: 13, color: c.text, fontWeight: '800', lineHeight: 18},
    taskCardDescription: {fontSize: 10, color: c.muted, lineHeight: 15},
    taskMetaRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 2},
    taskCategoryText: {fontSize: 9, color: c.primary, fontWeight: '800'},
    taskDueText: {fontSize: 9, color: c.muted, fontWeight: '600'},
    taskRemove: {width: 26, height: 26, borderRadius: 9, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center'},
    taskRemoveText: {fontSize: 19, lineHeight: 22, color: c.muted},
    taskPriorityTag: {alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5},
    taskPriorityText: {fontSize: 8, fontWeight: '900', letterSpacing: 0.5},
    priorityHigh: {backgroundColor: '#F7E0DB'},
    priorityMedium: {backgroundColor: '#F2E8D0'},
    priorityLow: {backgroundColor: c.accent + '55'},
    priorityTextHigh: {color: '#9E4636'},
    priorityTextMedium: {color: '#8D6A2E'},
    priorityTextLow: {color: c.primary},
    budgetHero: {backgroundColor: c.primary, borderRadius: 24, padding: 20, gap: 8},
    budgetHeroLabel: {fontSize: 9, color: '#E4EDE1', letterSpacing: 1.4, fontWeight: '800'},
    budgetHeroValue: {fontSize: 31, color: '#FFFFFF', fontWeight: '900', letterSpacing: -0.7, marginTop: 7},
    budgetHeroSubtitle: {fontSize: 11, color: '#E4EDE1'},
    budgetHeroTrack: {height: 9, backgroundColor: '#FFFFFF35', borderRadius: 6, overflow: 'hidden', marginTop: 9},
    budgetHeroFill: {height: 9, backgroundColor: '#FFFFFF', borderRadius: 6},
    budgetHeroFoot: {fontSize: 9, color: '#E4EDE1', fontWeight: '700'},
    budgetCategoryRow: {gap: 7, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border},
    budgetCategoryTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    budgetCategoryName: {fontSize: 12, color: c.text, fontWeight: '800'},
    budgetCategoryAmount: {fontSize: 10, color: c.muted, fontWeight: '700'},
    budgetOverLimit: {fontSize: 9, color: '#A64D3B', fontWeight: '800'},
    savingsGoalCard: {gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border},
    savingsGoalTop: {flexDirection: 'row', alignItems: 'center', gap: 10},
    savingsGoalTitle: {fontSize: 13, color: c.text, fontWeight: '800'},
    savingsGoalAmounts: {fontSize: 10, color: c.muted, marginTop: 4},
    savingsGoalBottom: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    savingsGoalProgress: {fontSize: 9, color: c.muted, fontWeight: '700'},
    savingsGoalAction: {fontSize: 10, color: c.primary, fontWeight: '900'},
    noteHero: {backgroundColor: c.primary, borderRadius: 23, padding: 18, gap: 13},
    noteHeroTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    noteHeroEyebrow: {fontSize: 9, color: '#E4EDE1', letterSpacing: 1.4, fontWeight: '800'},
    noteHeroTitle: {fontSize: 22, color: '#FFFFFF', fontWeight: '900', marginTop: 6},
    noteCountBubble: {width: 55, height: 55, borderRadius: 18, backgroundColor: '#FFFFFF24', alignItems: 'center', justifyContent: 'center'},
    noteCountValue: {fontSize: 20, color: '#FFFFFF', fontWeight: '900'},
    noteCountLabel: {fontSize: 7, color: '#E4EDE1', fontWeight: '900', letterSpacing: 1},
    noteHeroCaption: {fontSize: 10, color: '#E4EDE1', fontWeight: '700'},
    noteCategoryStrip: {gap: 7, paddingRight: 8},
    noteGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
    noteCard: {width: '48%', flexGrow: 1, minWidth: 140, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderTopWidth: 4, borderRadius: 16, padding: 11, gap: 9},
    noteCardContent: {gap: 8, flex: 1},
    noteCardTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4},
    noteCategoryTag: {fontSize: 8, color: c.primary, fontWeight: '900', backgroundColor: c.accent + '55', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4},
    notePinned: {fontSize: 7, color: '#A66A3B', fontWeight: '900', letterSpacing: 0.4},
    noteCardTitle: {fontSize: 12, color: c.text, fontWeight: '900', lineHeight: 17},
    noteCardBody: {fontSize: 10, color: c.muted, lineHeight: 15, minHeight: 45},
    noteCardSubject: {fontSize: 8, color: c.primary, fontWeight: '800'},
    noteCardActions: {flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: 8},
    noteActionButton: {paddingVertical: 3, paddingHorizontal: 5},
    noteActionText: {fontSize: 9, color: c.primary, fontWeight: '900'},
    noteDeleteText: {fontSize: 9, color: c.muted, fontWeight: '800'},
    noteEditor: {minHeight: 170, lineHeight: 20},
  });
}
