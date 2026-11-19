import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator, Alert, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, Pressable, View,
} from 'react-native';
import {execute, getDashboardSummary, openDatabase, query} from './src/data/database';
import {palettes} from './src/theme/palettes';

const tabs = [
  {id: 'Home', icon: '⌂'}, {id: 'Schedule', icon: '▦'},
  {id: 'Tasks', icon: '✓'}, {id: 'Budget', icon: '₱'},
  {id: 'Notes', icon: '✎'}, {id: 'Files', icon: '▧'},
  {id: 'Settings', icon: '⚙'},
];

export default function App() {
  const [active, setActive] = useState('Home');
  const [paletteName, setPaletteName] = useState('Forest');
  const [summary, setSummary] = useState({subjects: 0, pendingTasks: 0, notes: 0, classes: 0});
  const [subjects, setSubjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [monthlyLimit, setMonthlyLimit] = useState(0);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [budgetLimitDraft, setBudgetLimitDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [detail, setDetail] = useState('');
  const [showForm, setShowForm] = useState(false);
  const colors = palettes[paletteName] || palettes.Forest;

  const refresh = async () => {
    const [stats, subjectRows, taskRows, noteRows] = await Promise.all([
      getDashboardSummary(),
      query('SELECT * FROM subjects ORDER BY name'),
      query('SELECT * FROM tasks ORDER BY completed, id DESC'),
      query('SELECT * FROM notes ORDER BY pinned DESC, id DESC'),
    ]);
    setSummary(stats);
    setSubjects(subjectRows);
    setTasks(taskRows);
    setNotes(noteRows);
    setTransactions(await query("SELECT * FROM budget_transactions WHERE strftime('%Y-%m', occurred_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime') ORDER BY occurred_at DESC, id DESC"));
    const limits = await query("SELECT limit_amount FROM monthly_budgets WHERE month = strftime('%Y-%m', 'now', 'localtime') LIMIT 1");
    setMonthlyLimit(limits[0]?.limit_amount || 0);
  };

  useEffect(() => {
    openDatabase()
      .then(refresh)
      .catch(error => Alert.alert('Storage unavailable', String(error)))
      .finally(() => setLoading(false));
  }, []);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const addItem = async () => {
    const value = draft.trim();
    if (!value) return;
    try {
      if (active === 'Tasks') {
        await execute('INSERT INTO tasks (title, details) VALUES (?, ?)', [value, detail.trim()]);
      } else if (active === 'Notes') {
        await execute('INSERT INTO notes (title, body) VALUES (?, ?)', [value, detail.trim()]);
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
    await execute(
      "INSERT INTO monthly_budgets (month, limit_amount) VALUES (strftime('%Y-%m', 'now', 'localtime'), ?) ON CONFLICT(month) DO UPDATE SET limit_amount = excluded.limit_amount, updated_at = CURRENT_TIMESTAMP",
      [value],
    );
    setBudgetLimitDraft('');
    await refresh();
  };

  const [budgetType, setBudgetType] = useState('expense');

  const toggleTask = async task => {
    await execute('UPDATE tasks SET completed = ? WHERE id = ?', [task.completed ? 0 : 1, task.id]);
    await refresh();
  };

  const Card = ({children, style}) => <View style={[styles.card, style]}>{children}</View>;
  const Heading = ({children, muted = false}) => <Text style={muted ? styles.muted : styles.heading}>{children}</Text>;
  const Action = ({label, onPress, secondary = false}) => (
    <Pressable onPress={onPress} style={[styles.action, secondary && styles.secondaryAction]}>
      <Text style={[styles.actionText, secondary && styles.secondaryActionText]}>{label}</Text>
    </Pressable>
  );
  const Empty = ({label}) => <Text style={styles.empty}>{label}</Text>;

  const renderHome = () => (
    <>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>YOUR STUDENT SPACE</Text>
        <Text style={styles.heroTitle}>Make today count.</Text>
        <Text style={styles.heroSub}>Your classes, notes and tasks in one place.</Text>
      </View>
      <View style={styles.statsGrid}>
        {[
          ['Classes', summary.classes], ['Subjects', summary.subjects],
          ['To do', summary.pendingTasks], ['Notes', summary.notes],
        ].map(([label, value]) => (
          <Card key={label} style={styles.statCard}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </Card>
        ))}
      </View>
      <Card>
        <Heading>Upcoming tasks</Heading>
        {tasks.filter(t => !t.completed).slice(0, 3).map(task => (
          <Pressable key={task.id} onPress={() => toggleTask(task)} style={styles.listRow}>
            <View style={styles.dot} />
            <Text style={styles.rowTitle}>{task.title}</Text>
            <Text style={styles.rowHint}>○</Text>
          </Pressable>
        ))}
        {!tasks.some(t => !t.completed) && <Empty>No pending tasks yet.</Empty>}
        <Action label="View tasks" secondary onPress={() => setActive('Tasks')} />
      </Card>
      <Card>
        <Heading>Your subjects</Heading>
        {subjects.slice(0, 4).map(subject => (
          <View key={subject.id} style={styles.listRow}>
            <View style={styles.subjectMark} />
            <View style={{flex: 1}}>
              <Text style={styles.rowTitle}>{subject.name}</Text>
              {!!subject.code && <Text style={styles.rowHint}>{subject.code}</Text>}
            </View>
          </View>
        ))}
        {!subjects.length && <Empty>Add subjects from the Schedule module.</Empty>}
        <Action label="Manage subjects" secondary onPress={() => setActive('Schedule')} />
      </Card>
    </>
  );

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
      {!items.length && <Empty>No {type.toLowerCase()} added yet.</Empty>}
    </Card>
  );

  const renderContent = () => {
    if (active === 'Home') return renderHome();
    if (active === 'Tasks') return <>{renderList(tasks, 'Tasks')}<Action label="＋ Add task" onPress={() => setShowForm(true)} /></>;
    if (active === 'Notes') return <>{renderList(notes, 'Notes')}<Action label="＋ New note" onPress={() => setShowForm(true)} /></>;
    if (active === 'Budget') {
      const income = transactions.filter(item => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
      const expenses = transactions.filter(item => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0);
      const remaining = monthlyLimit - expenses;
      return <>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}><Text style={styles.statValue}>₱{income.toFixed(2)}</Text><Text style={styles.statLabel}>Income</Text></Card>
          <Card style={styles.statCard}><Text style={styles.statValue}>₱{expenses.toFixed(2)}</Text><Text style={styles.statLabel}>Expenses</Text></Card>
          <Card style={styles.statCard}><Text style={styles.statValue}>₱{(income - expenses).toFixed(2)}</Text><Text style={styles.statLabel}>Balance</Text></Card>
          <Card style={styles.statCard}><Text style={[styles.statValue, remaining < 0 && {color: '#B84D4D'}]}>₱{remaining.toFixed(2)}</Text><Text style={styles.statLabel}>Budget remaining</Text></Card>
        </View>
        <Card>
          <Heading>Monthly spending limit</Heading>
          <Text style={styles.bodyText}>{monthlyLimit > 0 ? `₱${expenses.toFixed(2)} spent of ₱${monthlyLimit.toFixed(2)}` : 'Set a monthly limit to track your spending.'}</Text>
          <TextInput value={budgetLimitDraft} onChangeText={setBudgetLimitDraft} keyboardType="decimal-pad" placeholder="Monthly limit (₱)" placeholderTextColor={colors.muted} style={styles.input} />
          <Action label="Save monthly limit" onPress={saveMonthlyLimit} />
        </Card>
        <Card>
          <Heading>Recent transactions</Heading>
          {transactions.slice(0, 20).map(item => <View key={item.id} style={styles.listRow}>
            <View style={{flex: 1}}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowHint}>{item.category} · {item.type}</Text>
            </View>
            <Text style={[styles.rowTitle, {color: item.type === 'income' ? colors.primary : colors.text}]}>{item.type === 'income' ? '+' : '−'}₱{Number(item.amount).toFixed(2)}</Text>
          </View>)}
          {!transactions.length && <Empty>No income or expenses recorded yet.</Empty>}
        </Card>
        <View style={styles.formActions}>
          <Action label="＋ Add expense" onPress={() => {setBudgetType('expense'); setShowForm(true);}} />
          <Action label="＋ Add income" secondary onPress={() => {setBudgetType('income'); setShowForm(true);}} />
        </View>
      </>;
    }
    if (active === 'Schedule') return <Card><Heading>Class schedule</Heading><Empty>Your weekly timetable will appear here when schedule management is implemented.</Empty><Action label="＋ Add class" onPress={() => Alert.alert('Schedule setup', 'Class editor is the next schedule implementation step.')} /></Card>;
    if (active === 'Files') return <Card><Heading>Lecture files</Heading><Empty>Organize your learning materials by subject. File importing and offline document viewing are scheduled for the next implementation phase.</Empty></Card>;
    return (
      <>
        <Card><Heading>Appearance</Heading><Text style={styles.bodyText}>Choose a color combination for the entire app.</Text>
          {Object.keys(palettes).map(name => <Pressable key={name} onPress={() => setPaletteName(name)} style={styles.listRow}>
            <View style={[styles.paletteDot, {backgroundColor: palettes[name].primary}]} />
            <Text style={styles.rowTitle}>{name}</Text>
            <Text style={styles.rowHint}>{paletteName === name ? 'Selected ✓' : 'Select'}</Text>
          </Pressable>)}
        </Card>
        <Card><Heading>Data and privacy</Heading><Text style={styles.bodyText}>Your planner data is stored locally on this device. NewApk does not require an account or cloud database.</Text></Card>
        <Card><Heading>About NewApk</Heading><Text style={styles.bodyText}>React Native student productivity app · Offline-first</Text></Card>
      </>
    );
  };

  if (loading) return <SafeAreaView style={[styles.loading, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Preparing your workspace…</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle={paletteName === 'Night' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.topBar}>
        <View><Text style={styles.brand}>NewApk</Text><Text style={styles.topCaption}>STUDENT WORKSPACE</Text></View>
        <View style={styles.avatar}><Text style={styles.avatarText}>N</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>{active}</Text>
        {renderContent()}
      </ScrollView>
      {showForm && (
        <View style={styles.formOverlay}>
          <View style={styles.formCard}>
            <Text style={styles.heading}>{active === 'Budget' ? (budgetType === 'income' ? 'Add income' : 'Add expense') : active === 'Tasks' ? 'New task' : 'New note'}</Text>
            <TextInput value={draft} onChangeText={setDraft} placeholder={active === 'Budget' ? 'Transaction name' : 'Title'} placeholderTextColor={colors.muted} style={styles.input} />
            {active === 'Budget' && <>
              <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount (₱)" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={category} onChangeText={setCategory} placeholder="Category (e.g. Food, Transport, School)" placeholderTextColor={colors.muted} style={styles.input} />
            </>}
            <TextInput value={detail} onChangeText={setDetail} placeholder="Details (optional)" placeholderTextColor={colors.muted} style={styles.input} />
            <View style={styles.formActions}><Action label="Cancel" secondary onPress={() => setShowForm(false)} /><Action label="Save" onPress={addItem} /></View>
          </View>
        </View>
      )}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
          {tabs.map(tab => <Pressable key={tab.id} onPress={() => {setActive(tab.id); setShowForm(false);}} style={[styles.tab, active === tab.id && styles.activeTab]}>
            <Text style={[styles.tabIcon, active === tab.id && styles.activeTabText]}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, active === tab.id && styles.activeTabText]}>{tab.id}</Text>
          </Pressable>)}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    screen: {flex: 1, backgroundColor: c.background},
    loading: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12},
    topBar: {paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    brand: {fontSize: 22, fontWeight: '800', color: c.text, letterSpacing: -0.5},
    topCaption: {fontSize: 9, color: c.muted, letterSpacing: 1.5, marginTop: 2, fontWeight: '700'},
    avatar: {width: 38, height: 38, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center'},
    avatarText: {color: c.primary, fontWeight: '800', fontSize: 16},
    content: {paddingHorizontal: 18, paddingBottom: 24, gap: 14},
    pageTitle: {fontSize: 27, fontWeight: '800', color: c.text, letterSpacing: -0.7, marginTop: 4},
    hero: {backgroundColor: c.primary, borderRadius: 24, padding: 22, minHeight: 155, justifyContent: 'center'},
    eyebrow: {color: '#DCE8D8', fontSize: 9, letterSpacing: 1.8, fontWeight: '800'},
    heroTitle: {color: '#FFFFFF', fontSize: 27, fontWeight: '800', marginTop: 10, letterSpacing: -0.7},
    heroSub: {color: '#E4EDE1', fontSize: 13, marginTop: 6},
    statsGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
    statCard: {width: '48%', flexGrow: 1, paddingVertical: 16},
    card: {backgroundColor: c.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: c.border, gap: 10},
    statValue: {fontSize: 25, fontWeight: '800', color: c.primary},
    statLabel: {fontSize: 12, color: c.muted, fontWeight: '600'},
    heading: {fontSize: 16, fontWeight: '800', color: c.text},
    muted: {fontSize: 12, color: c.muted},
    bodyText: {fontSize: 13, color: c.muted, lineHeight: 20},
    listRow: {flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border},
    rowTitle: {fontSize: 13, color: c.text, fontWeight: '650', flex: 1},
    rowHint: {fontSize: 11, color: c.muted},
    dot: {width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary},
    subjectMark: {width: 9, height: 28, borderRadius: 5, backgroundColor: c.accent},
    empty: {fontSize: 12, color: c.muted, paddingVertical: 12, lineHeight: 18},
    action: {backgroundColor: c.primary, borderRadius: 13, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center'},
    actionText: {color: '#FFFFFF', fontSize: 12, fontWeight: '800'},
    secondaryAction: {backgroundColor: c.background, borderWidth: 1, borderColor: c.border},
    secondaryActionText: {color: c.text},
    check: {width: 22, height: 22, borderWidth: 1.5, borderColor: c.border, borderRadius: 7, alignItems: 'center', justifyContent: 'center'},
    checked: {backgroundColor: c.primary, borderColor: c.primary},
    checkText: {color: '#FFFFFF', fontSize: 13, fontWeight: '800'},
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
  });
}