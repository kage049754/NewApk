function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function validDateKey(value) {
  const key = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return key;
}

function getDashboardTaskSummary(tasks = [], now = new Date()) {
  const safeNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const today = new Date(safeNow.getFullYear(), safeNow.getMonth(), safeNow.getDate());
  const todayKey = localDateKey(today);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + ((7 - weekEnd.getDay()) % 7));
  const weekEndKey = localDateKey(weekEnd);
  const rows = Array.isArray(tasks) ? tasks : [];
  const pendingTasks = rows.filter(task => !Number(task && task.completed || 0));
  const overdueTasks = pendingTasks.filter(task => {
    const dueKey = validDateKey(task && task.due_at);
    return dueKey !== null && dueKey < todayKey;
  });
  const dueThisWeek = pendingTasks.filter(task => {
    const dueKey = validDateKey(task && task.due_at);
    return dueKey !== null && dueKey >= todayKey && dueKey <= weekEndKey;
  });
  return {pendingTasks, dueThisWeek, overdueTasks, todayKey, weekEndKey};
}

function getNextClassSummary(classes = [], now = new Date()) {
  const safeNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const currentMinutes = safeNow.getHours() * 60 + safeNow.getMinutes();
  const rows = (Array.isArray(classes) ? classes : [])
    .map(item => {
      const startMatch = /^(?:([01]\\d|2[0-3])):([0-5]\\d)$/.exec(String(item && item.start_time || ''));
      const endMatch = /^(?:([01]\\d|2[0-3])):([0-5]\\d)$/.exec(String(item && item.end_time || ''));
      if (!startMatch || !endMatch) return null;
      const startMinutes = Number(startMatch[1]) * 60 + Number(startMatch[2]);
      const endMinutes = Number(endMatch[1]) * 60 + Number(endMatch[2]);
      if (endMinutes <= startMinutes) return null;
      return {item, startMinutes, endMinutes};
    })
    .filter(Boolean)
    .sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes);

  const ongoing = rows.find(row => row.startMinutes <= currentMinutes && row.endMinutes > currentMinutes);
  if (ongoing) return {state: 'ongoing', item: ongoing.item, minutesUntilEnd: ongoing.endMinutes - currentMinutes};

  const upcoming = rows.find(row => row.startMinutes > currentMinutes);
  if (upcoming) return {state: 'upcoming', item: upcoming.item, minutesUntilStart: upcoming.startMinutes - currentMinutes};

  return {state: rows.length ? 'finished' : 'empty', item: null, minutesUntilStart: null, minutesUntilEnd: null};
}

function getSavingsSummary(goals = []) {
  const rows = Array.isArray(goals) ? goals : [];
  const normalizedGoals = rows.map(goal => {
    const targetValue = Number(goal && goal.target_amount);
    const savedValue = Number(goal && goal.saved_amount);
    const targetAmount = Number.isFinite(targetValue) ? Math.max(0, targetValue) : 0;
    const savedAmount = Number.isFinite(savedValue) ? Math.max(0, savedValue) : 0;
    const progressPercent = targetAmount > 0 ? Math.min(100, savedAmount / targetAmount * 100) : 0;
    return {...goal, targetAmount, savedAmount, progressPercent};
  });
  const targetTotal = normalizedGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const currentTotal = normalizedGoals.reduce((sum, goal) => sum + goal.savedAmount, 0);
  return {
    goals: normalizedGoals,
    targetTotal,
    currentTotal,
    progressPercent: targetTotal > 0 ? Math.min(100, currentTotal / targetTotal * 100) : 0,
  };
}

module.exports = {getDashboardTaskSummary, getNextClassSummary, getSavingsSummary};
