const {getDashboardTaskSummary, getSavingsSummary} = require('../src/data/dashboardSummary');

describe('Home dashboard task summary', () => {
  test('separates overdue tasks from tasks due today through Sunday', () => {
    const tasks = [
      {id: 1, due_at: '2026-11-18', completed: 0},
      {id: 2, due_at: '2026-11-19 09:30:00', completed: 0},
      {id: 3, due_at: '2026-11-22', completed: 0},
      {id: 4, due_at: '2026-11-23', completed: 0},
      {id: 5, due_at: '2026-11-20', completed: 1},
      {id: 6, due_at: null, completed: 0},
      {id: 7, due_at: '2026-02-31', completed: 0},
    ];
    const result = getDashboardTaskSummary(tasks, new Date(2026, 10, 19, 12, 0, 0));
    expect(result.todayKey).toBe('2026-11-19');
    expect(result.weekEndKey).toBe('2026-11-22');
    expect(result.pendingTasks.map(task => task.id)).toEqual([1, 2, 3, 4, 6, 7]);
    expect(result.overdueTasks.map(task => task.id)).toEqual([1]);
    expect(result.dueThisWeek.map(task => task.id)).toEqual([2, 3]);
  });

  test('uses the current Sunday as the end of the week rather than extending seven days', () => {
    const result = getDashboardTaskSummary([
      {id: 'today', due_at: '2026-11-22', completed: 0},
      {id: 'next-week', due_at: '2026-11-23', completed: 0},
    ], new Date(2026, 10, 22, 18, 0, 0));
    expect(result.weekEndKey).toBe('2026-11-22');
    expect(result.dueThisWeek.map(task => task.id)).toEqual(['today']);
  });

  test('handles empty or invalid task input', () => {
    expect(getDashboardTaskSummary(null, new Date(2026, 10, 19)).pendingTasks).toEqual([]);
    const result = getDashboardTaskSummary([{id: 1, due_at: 'not-a-date'}], new Date(2026, 10, 19));
    expect(result.dueThisWeek).toEqual([]);
    expect(result.overdueTasks).toEqual([]);
  });
});

describe('Home dashboard next-class summary', () => {
  const monday = new Date(2026, 10, 23);

  test('returns the class currently in progress', () => {
    const classes = [
      {id: 1, start_time: '08:00', end_time: '09:30', subject_name: 'ITEC 80'},
      {id: 2, start_time: '10:00', end_time: '11:00', subject_name: 'MATH'},
    ];
    expect(getNextClassSummary(classes, new Date(2026, 10, 23, 8, 30))).toMatchObject({
      state: 'ongoing',
      item: {id: 1, subject_name: 'ITEC 80'},
      minutesUntilEnd: 60,
    });
  });

  test('selects the earliest future class and ignores invalid time rows', () => {
    const classes = [
      {id: 3, start_time: '13:00', end_time: '14:00'},
      {id: 2, start_time: '10:00', end_time: '11:00'},
      {id: 1, start_time: '29:00', end_time: '30:00'},
      {id: 4, start_time: '08:00', end_time: '07:00'},
    ];
    expect(getNextClassSummary(classes, new Date(2026, 10, 23, 9, 15))).toMatchObject({
      state: 'upcoming',
      item: {id: 2},
      minutesUntilStart: 45,
    });
  });

  test('distinguishes a finished day from an empty timetable', () => {
    expect(getNextClassSummary([
      {id: 1, start_time: '08:00', end_time: '09:00'},
    ], new Date(2026, 10, 23, 10, 0))).toMatchObject({state: 'finished', item: null});
    expect(getNextClassSummary([], monday)).toMatchObject({state: 'empty', item: null});
  });
});

describe('Home dashboard savings summary', () => {
  test('combines targets and savings across goals and caps displayed progress', () => {
    const result = getSavingsSummary([
      {id: 1, target_amount: 100, saved_amount: 25},
      {id: 2, target_amount: 400, saved_amount: 500},
    ]);
    expect(result.targetTotal).toBe(500);
    expect(result.currentTotal).toBe(525);
    expect(result.progressPercent).toBe(100);
    expect(result.goals.map(goal => goal.progressPercent)).toEqual([25, 100]);
  });

  test('normalizes invalid or negative amounts and handles no goals', () => {
    const result = getSavingsSummary([
      {id: 1, target_amount: -100, saved_amount: 'invalid'},
      {id: 2, target_amount: 0, saved_amount: 50},
    ]);
    expect(result.targetTotal).toBe(0);
    expect(result.currentTotal).toBe(50);
    expect(result.progressPercent).toBe(0);
    expect(result.goals[0]).toMatchObject({targetAmount: 0, savedAmount: 0, progressPercent: 0});
    expect(getSavingsSummary([])).toMatchObject({targetTotal: 0, currentTotal: 0, progressPercent: 0});
  });
});
