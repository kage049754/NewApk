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

module.exports = {getDashboardTaskSummary, getSavingsSummary};
