import { DB } from './db.js';

// Global state
let currentTab = 'home';
let activeWorkout = null; // { startTimeEpochMillis, programDayTitle, note, exercises: [] }
let wakeLock = null;
let expandedStatsMuscleGroup = null;

export const MUSCLE_NAMES_RU = {
  CHEST: 'Грудь',
  BACK: 'Спина',
  LEGS: 'Ноги',
  SHOULDERS: 'Плечи',
  ARMS: 'Руки',
  ABS: 'Пресс'
};

export function getMuscleNameRu(group) {
  return MUSCLE_NAMES_RU[group] || group || 'Другое';
}


// Formulas
const Formulas = {
  calculate1RM(weight, reps) {
    if (!weight || weight <= 0 || !reps || reps <= 0) return 0;
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
  },

  calculateStreak(datesEpochDays) {
    if (!datesEpochDays || datesEpochDays.length === 0) return 0;
    const sorted = [...new Set(datesEpochDays)].sort((a, b) => b - a);
    let streak = 0;
    let expected = sorted[0];

    for (const d of sorted) {
      if (d === expected || d === expected - 1) {
        streak++;
        expected = d;
      } else {
        break;
      }
    }
    return streak;
  }
};

// Wake Lock
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) {
    console.log('WakeLock not supported or denied');
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

// Navigation
window.switchTab = function(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tabName);
  });

  const content = document.getElementById('mainContent');
  if (tabName === 'home') renderHomeScreen(content);
  else if (tabName === 'programs') renderProgramsScreen(content);
  else if (tabName === 'workout') renderWorkoutScreen(content);
  else if (tabName === 'history') renderHistoryScreen(content);
  else if (tabName === 'stats') renderStatsScreen(content);
  else if (tabName === 'settings') renderSettingsScreen(content);
};

// Haptic feedback
function haptic() {
  if (navigator.vibrate) navigator.vibrate(15);
}

// ==========================================
// 1. HOME SCREEN
// ==========================================
async function renderHomeScreen(container) {
  const programs = await DB.getPrograms();
  const activeProg = programs.find(p => p.program.isActive) || programs[0];
  const workouts = await DB.getAllWorkouts();

  const totalWorkouts = workouts.length;
  const days = workouts.map(w => Math.floor(w.workout.dateEpochMillis / 86400000));
  const streak = Formulas.calculateStreak(days);

  container.innerHTML = `
    <div class="screen-fade" style="padding-top: 20px;">
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="width: 72px; height: 72px; margin: 0 auto 14px auto; background: linear-gradient(135deg, var(--primary), var(--secondary)); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(255, 111, 0, 0.35);">
          <span style="font-size: 36px;">🏋️‍♂️</span>
        </div>
        <h1 style="font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">GymTracker</h1>
        <p style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">Твой дневник тренировок для зала</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
        <div class="card" style="padding: 14px; text-align: center; margin-bottom: 0;">
          <div style="font-size: 12px; color: var(--text-secondary);">Тренировок</div>
          <div style="font-size: 24px; font-weight: 800; color: var(--text-primary); margin-top: 4px;">${totalWorkouts}</div>
        </div>
        <div class="card" style="padding: 14px; text-align: center; margin-bottom: 0; background: var(--primary-container);">
          <div style="font-size: 12px; color: var(--on-primary-container);">Стрик</div>
          <div style="font-size: 24px; font-weight: 800; color: var(--primary); margin-top: 4px;">🔥 ${streak} дн.</div>
        </div>
      </div>

      <button class="btn btn-primary" style="width: 100%; height: 58px; font-size: 17px; margin-bottom: 12px;" onclick="startFreeWorkout()">
        ⚡ Свободная тренировка
      </button>

      ${activeProg && activeProg.days.length > 0 ? `
        <div class="card" style="margin-top: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase;">Активный план</div>
            <button class="btn-icon" onclick="switchTab('programs')">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
            </button>
          </div>
          <div style="font-size: 18px; font-weight: 800; margin-bottom: 6px;">${activeProg.program.title}</div>
          <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">${activeProg.days[0].day.name} (${activeProg.days[0].exercises.length} упр.)</div>
          <button class="btn btn-secondary" style="width: 100%;" onclick="startProgramDayWorkout(${activeProg.days[0].day.id})">
            Начать ${activeProg.days[0].day.name}
          </button>
        </div>
      ` : ''}

      <div style="text-align: center; margin-top: 24px;">
        <button class="btn btn-outline" style="width: 100%;" onclick="switchTab('settings')">
          ⚙️ Настройки и бэкапы
        </button>
      </div>
    </div>
  `;
}

// ==========================================
// 2. PROGRAMS SCREEN
// ==========================================
let selectedProgId = null;
let selectedDayIdx = 0;

async function renderProgramsScreen(container) {
  const programs = await DB.getPrograms();
  if (programs.length === 0) {
    container.innerHTML = `
      <div class="screen-fade" style="text-align: center; padding-top: 40px;">
        <p style="color: var(--text-secondary); margin-bottom: 16px;">Нет созданных программ</p>
        <button class="btn btn-primary" onclick="showCreateProgramDialog()">Создать программу</button>
      </div>
    `;
    return;
  }

  if (!selectedProgId || !programs.some(p => p.program.id === selectedProgId)) {
    const active = programs.find(p => p.program.isActive);
    selectedProgId = active ? active.program.id : programs[0].program.id;
  }

  const currentProg = programs.find(p => p.program.id === selectedProgId) || programs[0];
  const days = currentProg.days || [];
  if (selectedDayIdx >= days.length) selectedDayIdx = 0;
  const currentDay = days[selectedDayIdx];

  container.innerHTML = `
    <div class="screen-fade">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="font-size: 22px; font-weight: 800;">Планы тренировок</h2>
        <button class="btn btn-sm btn-outline" onclick="showCreateProgramDialog()">+ Программа</button>
      </div>

      <!-- Вкладки программ -->
      <div class="chip-row">
        ${programs.map(p => `
          <div class="filter-chip ${p.program.id === selectedProgId ? 'active' : ''}" onclick="selectProgram(${p.program.id})">
            ${p.program.title} ${p.program.isActive ? '★' : ''}
          </div>
        `).join('')}
      </div>

      <!-- Карточка выбранной программы -->
      <div class="card" style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h3 style="font-size: 18px; font-weight: 800;">${currentProg.program.title}</h3>
            <p style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">${currentProg.program.description || 'Без описания'}</p>
          </div>
          <div style="display: flex; gap: 4px;">
            ${!currentProg.program.isActive ? `
              <button class="btn-icon" title="Сделать активной" onclick="makeProgramActive(${currentProg.program.id})">
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="var(--text-secondary)" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
              </button>
            ` : '<span class="badge badge-primary" style="margin-top: 4px;">Активна</span>'}
            <button class="btn-icon" title="Удалить программу" onclick="confirmDeleteProgram(${currentProg.program.id})">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="var(--error)" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; margin-bottom: 8px;">
          <div style="font-size: 13px; font-weight: 700; color: var(--text-secondary);">Дни программы (${days.length})</div>
          <button class="btn-icon" title="Добавить день" onclick="showAddDayDialog(${currentProg.program.id})">
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="var(--primary)" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
        </div>

        <!-- Вкладки дней -->
        <div class="chip-row" style="padding-bottom: 0;">
          ${days.map((d, idx) => `
            <div class="filter-chip ${idx === selectedDayIdx ? 'active' : ''}" style="background-color: ${idx === selectedDayIdx ? 'var(--primary-container)' : 'var(--bg-card-highest)'}; color: ${idx === selectedDayIdx ? 'var(--on-primary-container)' : 'var(--text-secondary)'}; border: ${idx === selectedDayIdx ? '1px solid var(--primary)' : 'none'};" onclick="selectDay(${idx})">
              ${d.day.name}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Упражнения текущего дня -->
      ${currentDay ? `
        <button class="btn btn-primary" style="width: 100%; height: 52px; font-size: 16px; margin-bottom: 14px;" onclick="startProgramDayWorkout(${currentDay.day.id})">
          🏋️‍♂️ Начать тренировку (${currentDay.day.name})
        </button>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h4 style="font-size: 16px; font-weight: 800;">Упражнения (${currentDay.exercises.length})</h4>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm btn-outline" onclick="showAddExerciseToPlanDialog(${currentDay.day.id})">+ Добавить</button>
            <button class="btn-icon" title="Удалить день" onclick="confirmDeleteDay(${currentDay.day.id})">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="var(--error)" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>
        </div>

        ${currentDay.exercises.length === 0 ? `
          <div class="card" style="text-align: center; color: var(--text-secondary); padding: 30px;">
            В этом дне ещё нет упражнений
          </div>
        ` : `
          <div id="planExercisesList">
            ${currentDay.exercises.map((pe, idx) => `
              <div class="card" style="padding: 14px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-size: 15px; font-weight: 700;">${pe.exercise.name}</span>
                      <button class="btn-icon" style="padding: 2px;" onclick="showTechniqueModal(${pe.exercise.id})">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="var(--primary)" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                      </button>
                    </div>

                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                      <span class="badge badge-primary">${getMuscleNameRu(pe.exercise.muscleGroup)}</span>
                      ${pe.planExercise.supersetLabel ? `
                        <span class="badge badge-superset">🔗 Суперсет ${pe.planExercise.supersetLabel}</span>
                        <button class="btn-icon" style="padding: 0; margin-left: 2px;" onclick="removePlanSuperset(${currentDay.day.id}, ${pe.planExercise.id})">
                          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="var(--text-secondary)" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                      ` : `
                        <button class="btn-icon" style="padding: 2px;" title="Объединить в суперсет" onclick="showPlanSupersetPairModal(${currentDay.day.id}, ${pe.planExercise.id})">
                          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="var(--secondary)" d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
                        </button>
                      `}
                    </div>
                  </div>

                  <!-- Управление очередностью (вверх, вниз) и удаление -->
                  <div style="display: flex; align-items: center; gap: 2px;">
                    ${idx > 0 ? `
                      <button class="btn-icon" onclick="movePlanExercise(${currentDay.day.id}, ${idx}, ${idx - 1})">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
                      </button>
                    ` : ''}
                    ${idx < currentDay.exercises.length - 1 ? `
                      <button class="btn-icon" onclick="movePlanExercise(${currentDay.day.id}, ${idx}, ${idx + 1})">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
                      </button>
                    ` : ''}
                    <button class="btn-icon" onclick="deletePlanExercise(${pe.planExercise.id})">
                      <svg viewBox="0 0 24 24" width="16" height="16"><path fill="var(--text-muted)" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                  </div>
                </div>

                <div style="background-color: var(--bg-card-highest); border-radius: var(--radius-sm); padding: 8px 12px; margin-top: 8px; display: flex; justify-content: space-between; font-size: 13px;">
                  <span>🎯 План: <b>${pe.planExercise.targetSets}</b> подх. × <b>${pe.planExercise.targetReps}</b> повт.</span>
                  ${pe.planExercise.targetWeightKg ? `<span>Вес: <b>${pe.planExercise.targetWeightKg} кг</b></span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      ` : ''}
    </div>
  `;
}

window.selectProgram = function(pId) {
  selectedProgId = pId;
  selectedDayIdx = 0;
  switchTab('programs');
};

window.selectDay = function(dIdx) {
  selectedDayIdx = dIdx;
  switchTab('programs');
};

window.makeProgramActive = async function(pId) {
  await DB.setActiveProgram(pId);
  haptic();
  switchTab('programs');
};

window.confirmDeleteProgram = async function(pId) {
  if (confirm('Удалить эту программу и все её дни?')) {
    await DB.deleteProgram(pId);
    selectedProgId = null;
    haptic();
    switchTab('programs');
  }
};

window.confirmDeleteDay = async function(dId) {
  if (confirm('Удалить этот день тренировки?')) {
    await DB.deleteProgramDay(dId);
    selectedDayIdx = 0;
    haptic();
    switchTab('programs');
  }
};

window.movePlanExercise = async function(dayId, fromIdx, toIdx) {
  await DB.reorderProgramDayExercises(dayId, fromIdx, toIdx);
  haptic();
  switchTab('programs');
};

window.deletePlanExercise = async function(peId) {
  await DB.removeExerciseFromDay(peId);
  haptic();
  switchTab('programs');
};

window.removePlanSuperset = async function(dayId, peId) {
  await DB.removeProgramSuperset(dayId, peId);
  haptic();
  switchTab('programs');
};

// ==========================================
// 3. WORKOUT SCREEN
// ==========================================
window.startFreeWorkout = function() {
  activeWorkout = {
    startTimeEpochMillis: Date.now(),
    programDayTitle: null,
    note: '',
    exercises: [],
    isSaving: false
  };
  requestWakeLock();
  switchTab('workout');
};

window.startProgramDayWorkout = async function(dayId) {
  const programs = await DB.getPrograms();
  let targetDay = null;
  for (const p of programs) {
    const found = p.days.find(d => d.day.id === Number(dayId));
    if (found) { targetDay = found; break; }
  }

  if (!targetDay) return;

  const exercises = [];
  for (const pe of targetDay.exercises) {
    const history = await DB.getExerciseHistory(pe.exercise.id);
    const maxHistWeight = history.length > 0 ? Math.max(...history.map(h => h.weightKg || 0)) : 0;
    const lastSets = history.slice(-pe.planExercise.targetSets);

    const sets = [];
    const count = pe.planExercise.targetSets || 3;
    for (let i = 0; i < count; i++) {
      const last = lastSets[i] || lastSets[0];
      sets.push({
        weight: pe.planExercise.targetWeightKg ? String(pe.planExercise.targetWeightKg) : (last ? String(last.weightKg || '') : ''),
        reps: pe.planExercise.targetReps ? String(parseInt(pe.planExercise.targetReps) || 10) : (last ? String(last.reps || 10) : '10'),
        isCompleted: false,
        setType: 'NORMAL',
        prevWeight: last ? last.weightKg : null,
        prevReps: last ? last.reps : null,
        historicalMax: maxHistWeight
      });
    }

    exercises.push({
      exercise: pe.exercise,
      sets,
      isWeighted: pe.exercise.exerciseType === 'WEIGHTED_BODYWEIGHT',
      supersetLabel: pe.planExercise.supersetLabel || null,
      allTimeMaxWeight: maxHistWeight
    });
  }

  activeWorkout = {
    startTimeEpochMillis: Date.now(),
    programDayTitle: targetDay.day.name,
    note: '',
    exercises,
    isSaving: false
  };

  requestWakeLock();
  switchTab('workout');
};

function renderWorkoutScreen(container) {
  if (!activeWorkout) {
    container.innerHTML = `
      <div class="screen-fade" style="text-align: center; padding-top: 60px;">
        <span style="font-size: 48px;">🏋️‍♂️</span>
        <h3 style="font-size: 20px; font-weight: 800; margin: 14px 0 6px 0;">Тренировка не начата</h3>
        <p style="color: var(--text-secondary); margin-bottom: 24px;">Выберите день плана или начните свободную</p>
        <button class="btn btn-primary" style="margin-right: 8px;" onclick="startFreeWorkout()">Свободная тренировка</button>
        <button class="btn btn-outline" onclick="switchTab('programs')">Выбрать план</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="screen-fade">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800;">${activeWorkout.programDayTitle || 'Запись тренировки'}</h2>
          <span style="font-size: 12px; color: var(--primary); font-weight: 600;">В процессе</span>
        </div>
        <button class="btn btn-primary btn-sm" id="finishWorkoutBtn" ${activeWorkout.isSaving || activeWorkout.exercises.length === 0 ? 'disabled' : ''} onclick="finishWorkout()">
          ${activeWorkout.isSaving ? 'Сохранение...' : 'Завершить'}
        </button>
      </div>

      ${activeWorkout.exercises.length === 0 ? `
        <div class="card" style="text-align: center; padding: 40px 20px;">
          <p style="color: var(--text-secondary); margin-bottom: 16px;">Упражнения ещё не добавлены</p>
          <button class="btn btn-primary" onclick="showAddExerciseModal()">+ Добавить упражнение</button>
        </div>
      ` : `
        <div id="workoutExercisesList">
          ${activeWorkout.exercises.map((exItem, exIdx) => {
            const ex = exItem.exercise;
            const isBodyweight = ex.exerciseType === 'BODYWEIGHT_ONLY';
            const showWeight = !isBodyweight || exItem.isWeighted;

            return `
              <div class="card" style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-size: 16px; font-weight: 800;">${ex.name}</span>
                      <button class="btn-icon" style="padding: 2px;" onclick="showTechniqueModal(${ex.id})">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="var(--primary)" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                      </button>
                    </div>

                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                      <span class="badge badge-primary">${getMuscleNameRu(ex.muscleGroup)}</span>

                      ${ex.exerciseType === 'WEIGHTED_BODYWEIGHT' ? `
                        <button class="badge ${exItem.isWeighted ? 'badge-primary' : 'badge-secondary'}" style="cursor: pointer;" onclick="toggleWeighted(${exIdx})">
                          ${exItem.isWeighted ? '+ Доп. вес' : 'Свой вес'}
                        </button>
                      ` : ''}

                      ${exItem.supersetLabel ? `
                        <span class="badge badge-superset">🔗 Суперсет ${exItem.supersetLabel}</span>
                        <button class="btn-icon" style="padding: 0;" onclick="removeWorkoutSuperset(${exIdx})">
                          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="var(--text-secondary)" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                      ` : `
                        <button class="btn-icon" style="padding: 2px;" title="Связать в суперсет" onclick="showWorkoutSupersetModal(${exIdx})">
                          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="var(--secondary)" d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
                        </button>
                      `}
                    </div>

                    ${exItem.supersetLabel ? `
                      <div style="font-size: 11px; color: var(--secondary); margin-top: 3px;">
                        ${(() => {
                          const partner = activeWorkout.exercises.find((x, i) => i !== exIdx && x.supersetLabel === exItem.supersetLabel);
                          return partner ? `В связке с: ${partner.exercise.name}` : '';
                        })()}
                      </div>
                    ` : ''}
                  </div>

                  <button class="btn-icon" onclick="removeExerciseFromWorkout(${exIdx})">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="var(--text-muted)" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                  </button>
                </div>

                <!-- Таблица сетов -->
                <div style="display: grid; grid-template-columns: 40px 1fr ${showWeight ? '1fr' : ''} 1fr 34px; gap: 6px; font-size: 11px; color: var(--text-muted); font-weight: 700; margin-bottom: 4px; text-align: center;">
                  <div>СЕТ</div>
                  <div>ПРОШЛЫЙ</div>
                  ${showWeight ? '<div>ВЕС (КГ)</div>' : ''}
                  <div>ПОВТ.</div>
                  <div></div>
                </div>

                ${exItem.sets.map((set, sIdx) => {
                  const setType = set.setType || 'NORMAL';
                  const badgeClass = setType === 'WARMUP' ? 'set-warmup' : (setType === 'DROP' ? 'set-drop' : (setType === 'FAILURE' ? 'set-failure' : 'set-normal'));
                  const badgeText = setType === 'NORMAL' ? String(sIdx + 1) : (setType === 'WARMUP' ? 'W' : (setType === 'DROP' ? 'D' : 'F'));

                  const currW = parseFloat(set.weight) || 0;
                  const currR = parseInt(set.reps) || 0;
                  const prevW = set.prevWeight;
                  const isPR = showWeight && setType !== 'WARMUP' && currW > 0 && currW > (exItem.allTimeMaxWeight || 0);

                  return `
                    <div class="set-row" style="display: grid; grid-template-columns: 40px 1fr ${showWeight ? '1fr' : ''} 1fr 34px; gap: 6px; align-items: center;">
                      <button class="set-badge ${badgeClass}" onclick="showSetTypePicker(${exIdx}, ${sIdx})">
                        ${badgeText}
                      </button>

                      <div style="font-size: 12px; color: var(--text-secondary); text-align: center;">
                        ${prevW ? `${prevW}×${set.prevReps || 0}` : '—'}
                        ${isPR ? '<div style="font-size: 10px; color: var(--primary); font-weight: 800;">🏆 Рекорд</div>' : ''}
                      </div>

                      ${showWeight ? `
                        <input type="number" step="0.5" class="num-input" value="${set.weight}" placeholder="0" oninput="updateSetWeight(${exIdx}, ${sIdx}, this.value)" />
                      ` : ''}

                      <input type="number" class="num-input" value="${set.reps}" placeholder="0" oninput="updateSetReps(${exIdx}, ${sIdx}, this.value)" />

                      <button class="btn-icon" style="padding: 4px;" onclick="removeSet(${exIdx}, ${sIdx})">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="var(--text-muted)" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                      </button>
                    </div>
                  `;
                }).join('')}

                <button class="btn btn-outline btn-sm" style="width: 100%; margin-top: 10px;" onclick="addSetToWorkout(${exIdx})">
                  + Добавить подход
                </button>
              </div>
            `;
          }).join('')}

          <button class="btn btn-secondary" style="width: 100%; height: 50px; font-size: 15px;" onclick="showAddExerciseModal()">
            + Добавить упражнение
          </button>
        </div>
      `}
    </div>
  `;
}

window.toggleWeighted = function(exIdx) {
  if (activeWorkout) {
    activeWorkout.exercises[exIdx].isWeighted = !activeWorkout.exercises[exIdx].isWeighted;
    haptic();
    switchTab('workout');
  }
};

window.addSetToWorkout = function(exIdx) {
  const ex = activeWorkout.exercises[exIdx];
  const last = ex.sets[ex.sets.length - 1];
  ex.sets.push({
    weight: last ? last.weight : '',
    reps: last ? last.reps : '10',
    isCompleted: false,
    setType: 'NORMAL',
    prevWeight: last ? last.prevWeight : null,
    prevReps: last ? last.prevReps : null
  });
  haptic();
  switchTab('workout');
};

window.removeSet = function(exIdx, sIdx) {
  activeWorkout.exercises[exIdx].sets.splice(sIdx, 1);
  haptic();
  switchTab('workout');
};

window.updateSetWeight = function(exIdx, sIdx, val) {
  activeWorkout.exercises[exIdx].sets[sIdx].weight = val;
};

window.updateSetReps = function(exIdx, sIdx, val) {
  activeWorkout.exercises[exIdx].sets[sIdx].reps = val;
};

window.removeExerciseFromWorkout = function(exIdx) {
  activeWorkout.exercises.splice(exIdx, 1);
  haptic();
  switchTab('workout');
};

// Выбор типа подхода (Dropdown / Modal)
window.showSetTypePicker = function(exIdx, sIdx) {
  const set = activeWorkout.exercises[exIdx].sets[sIdx];
  const types = [
    { type: 'NORMAL', name: 'Обычный подход (1, 2...)' },
    { type: 'WARMUP', name: 'W — Разминочный (Warmup)' },
    { type: 'DROP', name: 'D — Дропсет (Drop-set)' },
    { type: 'FAILURE', name: 'F — До отказа (Failure)' }
  ];

  showActionSheet('Тип подхода', types.map(t => ({
    label: t.name,
    selected: set.setType === t.type,
    onClick: () => {
      set.setType = t.type;
      haptic();
      switchTab('workout');
    }
  })));
};

// Завершение тренировки с атомарной защитой
window.finishWorkout = async function() {
  if (!activeWorkout || activeWorkout.isSaving || activeWorkout.exercises.length === 0) return;

  activeWorkout.isSaving = true;
  haptic();
  switchTab('workout');

  const durationMin = Math.max(1, Math.round((Date.now() - activeWorkout.startTimeEpochMillis) / 60000));
  try {
    await DB.saveWorkout({
      dateEpochMillis: Date.now(),
      durationMinutes: durationMin,
      note: activeWorkout.note || '',
      startTimeEpochMillis: activeWorkout.startTimeEpochMillis,
      endTimeEpochMillis: Date.now(),
      exercises: activeWorkout.exercises
    });

    activeWorkout = null;
    releaseWakeLock();
    switchTab('history');
  } catch (e) {
    console.error('Failed to save workout', e);
    activeWorkout.isSaving = false;
    switchTab('workout');
  }
};

// ==========================================
// 4. HISTORY SCREEN
// ==========================================
async function renderHistoryScreen(container) {
  const workouts = await DB.getAllWorkouts();

  container.innerHTML = `
    <div class="screen-fade">
      <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 16px;">История тренировок</h2>

      ${workouts.length === 0 ? `
        <div class="card" style="text-align: center; color: var(--text-secondary); padding: 40px 20px;">
          История пуста.<br>Завершите тренировку, чтобы она появилась здесь.
        </div>
      ` : `
        ${workouts.map(w => {
          const dateStr = new Date(w.workout.dateEpochMillis).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
          const totalTonnage = Math.round(w.exercises.reduce((sum, ex) => {
            return sum + ex.sets.filter(s => s.setType !== 'WARMUP').reduce((sSum, s) => sSum + (s.weightKg * s.reps), 0);
          }, 0));

          return `
            <div class="card" style="margin-bottom: 14px;" id="workoutCard_${w.workout.id}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; cursor: pointer;" onclick="toggleHistoryCard(${w.workout.id})">
                <div>
                  <div style="font-size: 16px; font-weight: 800;">${dateStr}</div>
                  <div style="font-size: 13px; color: var(--primary); font-weight: 600; margin-top: 2px;">
                    ${w.exercises.length} упр. • Тоннаж: ${totalTonnage} кг
                  </div>
                </div>
                <div style="display: flex; gap: 4px;">
                  <button class="btn-icon" onclick="event.stopPropagation(); deleteHistoryWorkout(${w.workout.id})">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="var(--error)" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  </button>
                </div>
              </div>

              <!-- Развернутые упражнения -->
              <div class="history-details" id="historyDetails_${w.workout.id}" style="margin-top: 14px; border-top: 1px solid var(--border); padding-top: 12px;">
                ${w.exercises.map(ex => `
                  <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 4px 0;" onclick="showProgressChart(${ex.exercise.id})">
                      <span style="font-size: 14px; font-weight: 700; color: var(--text-primary); text-decoration: underline dotted;">
                        ${ex.exercise.name} 📈
                      </span>
                      <span class="badge badge-primary">${getMuscleNameRu(ex.exercise.muscleGroup)}</span>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
                      ${ex.sets.map((s, idx) => {
                        const setType = s.setType || 'NORMAL';
                        const badgeText = setType === 'NORMAL' ? String(idx + 1) : (setType === 'WARMUP' ? 'W' : (setType === 'DROP' ? 'D' : 'F'));
                        const badgeClass = setType === 'WARMUP' ? 'set-warmup' : (setType === 'DROP' ? 'set-drop' : (setType === 'FAILURE' ? 'set-failure' : 'set-normal'));

                        return `
                          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-card-highest); border-radius: var(--radius-sm); padding: 6px 10px; font-size: 13px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                              <span class="set-badge ${badgeClass}" style="width: 22px; height: 22px; font-size: 11px;">${badgeText}</span>
                              <b>${s.weightKg} кг × ${s.reps} повт.</b>
                            </div>
                            <span style="color: ${setType === 'WARMUP' ? 'var(--text-muted)' : 'var(--primary)'}; font-size: 12px;">
                              ${Math.round(s.weightKg * s.reps)} кг
                            </span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      `}
    </div>
  `;
}

window.toggleHistoryCard = function(wId) {
  const el = document.getElementById(`historyDetails_${wId}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.deleteHistoryWorkout = async function(wId) {
  if (confirm('Удалить эту тренировку из истории?')) {
    await DB.deleteWorkout(wId);
    haptic();
    switchTab('history');
  }
};

// ==========================================
// 5. STATS SCREEN
// ==========================================
let statsPeriodDays = 30;

async function renderStatsScreen(container) {
  const workouts = await DB.getAllWorkouts();
  const minTime = statsPeriodDays === Infinity ? 0 : Date.now() - (statsPeriodDays * 86400000);
  const filtered = workouts.filter(w => w.workout.dateEpochMillis >= minTime);

  let totalSets = 0;
  let maxWeight = 0;
  let max1RM = 0;
  let max1RMEx = '';

  const muscleGroupsData = {
    CHEST: { count: 0, exercises: {} },
    BACK: { count: 0, exercises: {} },
    LEGS: { count: 0, exercises: {} },
    SHOULDERS: { count: 0, exercises: {} },
    ARMS: { count: 0, exercises: {} },
    ABS: { count: 0, exercises: {} }
  };

  filtered.forEach(w => {
    w.exercises.forEach(ex => {
      const g = ex.exercise.muscleGroup || 'CHEST';
      if (!muscleGroupsData[g]) {
        muscleGroupsData[g] = { count: 0, exercises: {} };
      }

      const exId = ex.exercise.id;
      if (!muscleGroupsData[g].exercises[exId]) {
        muscleGroupsData[g].exercises[exId] = {
          id: ex.exercise.id,
          name: ex.exercise.name,
          setsCount: 0,
          maxWeight: 0,
          repsAtMax: 0,
          max1RM: 0
        };
      }

      const agg = muscleGroupsData[g].exercises[exId];

      ex.sets.forEach(s => {
        totalSets++;
        muscleGroupsData[g].count++;
        agg.setsCount++;

        if (s.setType !== 'WARMUP' && s.weightKg > 0 && s.reps > 0) {
          const oneRm = Formulas.calculate1RM(s.weightKg, s.reps);
          if (oneRm > agg.max1RM || (oneRm === agg.max1RM && s.weightKg > agg.maxWeight)) {
            agg.max1RM = oneRm;
            agg.maxWeight = s.weightKg;
            agg.repsAtMax = s.reps;
          }
          if (oneRm > max1RM) {
            max1RM = oneRm;
            max1RMEx = ex.exercise.name;
          }
          if (s.weightKg > maxWeight) maxWeight = s.weightKg;
        }
      });
    });
  });

  const allDays = workouts.map(w => Math.floor(w.workout.dateEpochMillis / 86400000));
  const streak = Formulas.calculateStreak(allDays);

  const sortedGroups = Object.entries(muscleGroupsData)
    .filter(([_, data]) => data.count > 0 || statsPeriodDays === Infinity)
    .sort((a, b) => b[1].count - a[1].count);

  container.innerHTML = `
    <div class="screen-fade">
      <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 12px;">Статистика</h2>

      <!-- Фильтры периодов -->
      <div class="chip-row">
        <div class="filter-chip ${statsPeriodDays === 1 ? 'active' : ''}" onclick="selectStatsPeriod(1)">День</div>
        <div class="filter-chip ${statsPeriodDays === 7 ? 'active' : ''}" onclick="selectStatsPeriod(7)">Неделя</div>
        <div class="filter-chip ${statsPeriodDays === 30 ? 'active' : ''}" onclick="selectStatsPeriod(30)">Месяц</div>
        <div class="filter-chip ${statsPeriodDays === 365 ? 'active' : ''}" onclick="selectStatsPeriod(365)">Год</div>
        <div class="filter-chip ${statsPeriodDays === Infinity ? 'active' : ''}" onclick="selectStatsPeriod(Infinity)">Всё</div>
      </div>

      <!-- Метрики -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
        <div class="card" style="padding: 14px; text-align: center; margin-bottom: 0;">
          <div style="font-size: 11px; color: var(--text-secondary);">Тренировок</div>
          <div style="font-size: 22px; font-weight: 800; margin-top: 4px;">${filtered.length}</div>
        </div>
        <div class="card" style="padding: 14px; text-align: center; margin-bottom: 0; background: var(--primary-container);">
          <div style="font-size: 11px; color: var(--on-primary-container);">Стрик</div>
          <div style="font-size: 22px; font-weight: 800; color: var(--primary); margin-top: 4px;">🔥 ${streak} дн.</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
        <div class="card" style="padding: 14px; text-align: center; margin-bottom: 0;">
          <div style="font-size: 11px; color: var(--text-secondary);">Макс. 1ПМ</div>
          <div style="font-size: 20px; font-weight: 800; color: var(--primary); margin-top: 4px;">${max1RM > 0 ? `${max1RM} кг` : '—'}</div>
          <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${max1RMEx}</div>
        </div>
        <div class="card" style="padding: 14px; text-align: center; margin-bottom: 0;">
          <div style="font-size: 11px; color: var(--text-secondary);">Макс. рабочий вес</div>
          <div style="font-size: 20px; font-weight: 800; margin-top: 4px;">${maxWeight > 0 ? `${maxWeight} кг` : '—'}</div>
        </div>
      </div>

      <!-- Группы мышц на русском с раскрывающимися упражнениями -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="font-size: 16px; font-weight: 800;">Группы мышц (нажмите для деталей)</h3>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${sortedGroups.length === 0 ? `
          <div class="card" style="color: var(--text-muted); text-align: center; font-size: 13px; padding: 24px;">
            Нет подходов за этот период
          </div>
        ` : sortedGroups.map(([group, data]) => {
          const count = data.count;
          const percent = Math.round((count / (totalSets || 1)) * 100);
          const isExpanded = (expandedStatsMuscleGroup === group);
          const exList = Object.values(data.exercises).sort((a, b) => b.max1RM - a.max1RM);

          return `
            <div class="card" style="padding: 14px; margin-bottom: 0; cursor: pointer; transition: all 0.2s ease;" onclick="toggleStatsMuscleGroup('${group}')">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 15px; font-weight: 800;">${getMuscleNameRu(group)}</span>
                  <span style="font-size: 11px; color: var(--text-muted);">${isExpanded ? '▲' : '▼'}</span>
                </div>
                <div style="font-size: 13px; font-weight: 700; color: var(--primary);">
                  ${count} подх. (${percent}%)
                </div>
              </div>

              <!-- Прогресс-бар -->
              <div style="height: 6px; background: var(--bg-card-highest); border-radius: 3px; overflow: hidden; margin-top: 8px;">
                <div style="width: ${percent}%; height: 100%; background: var(--primary); border-radius: 3px;"></div>
              </div>

              <!-- Развёрнутый список упражнений при тапе -->
              ${isExpanded ? `
                <div style="margin-top: 14px; border-top: 1px solid var(--border); padding-top: 10px; display: flex; flex-direction: column; gap: 8px;">
                  ${exList.length === 0 ? `
                    <div style="font-size: 12px; color: var(--text-muted); padding: 4px 0;">В этой группе нет подходов</div>
                  ` : exList.map(ex => `
                    <div style="background: var(--bg-card-highest); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="event.stopPropagation(); showProgressChart(${ex.id})">
                      <div style="flex: 1; padding-right: 8px;">
                        <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                          <span>${ex.name}</span>
                          <span style="font-size: 11px; color: var(--primary);">📈</span>
                        </div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                          Рабочий: <b>${ex.maxWeight} кг × ${ex.repsAtMax} повт.</b> • ${ex.setsCount} подх.
                        </div>
                      </div>

                      <div style="display: flex; align-items: center; gap: 6px;">
                        ${ex.max1RM > 0 ? `
                          <span class="badge badge-primary" style="font-size: 11px;">1ПМ: ${ex.max1RM} кг</span>
                        ` : ''}
                        <button class="btn-icon" style="padding: 4px;" title="Техника" onclick="event.stopPropagation(); showTechniqueModal(${ex.id})">
                          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="var(--primary)" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

window.selectStatsPeriod = function(days) {
  statsPeriodDays = days;
  switchTab('stats');
};

window.toggleStatsMuscleGroup = function(groupKey) {
  expandedStatsMuscleGroup = (expandedStatsMuscleGroup === groupKey) ? null : groupKey;
  haptic();
  switchTab('stats');
};

// ==========================================
// 6. SETTINGS SCREEN
// ==========================================
async function renderSettingsScreen(container) {
  const exercises = await DB.getExercises();

  container.innerHTML = `
    <div class="screen-fade">
      <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 16px;">Настройки и Данные</h2>

      <div class="card">
        <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">📚 База упражнений</h3>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">В локальной базе доступно: <b>${exercises.length}</b> упр.</p>
        <button class="btn btn-secondary" style="width: 100%;" id="importCatalogBtn" onclick="importFullCatalog()">
          Загрузить полную базу (970+ упражнений)
        </button>
      </div>

      <div class="card">
        <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">💾 Резервное копирование</h3>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">Файлы бэкапа полностью совместимы с Android версией GymTracker.</p>
        <button class="btn btn-primary" style="width: 100%; margin-bottom: 8px;" onclick="exportJSONBackup()">
          Экспорт резервной копии (.json)
        </button>
        <input type="file" id="jsonFileInput" accept=".json" style="display: none;" onchange="handleImportJSON(event)" />
        <button class="btn btn-outline" style="width: 100%;" onclick="document.getElementById('jsonFileInput').click()">
          Импорт из файла (.json)
        </button>
      </div>

      <div class="card">
        <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">📱 Установка на iPhone</h3>
        <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
          1. Нажмите иконку <b>«Поделиться»</b> (квадрат со стрелкой вверх) внизу Safari.<br>
          2. Выберите <b>«На экран „Домой“»</b>.<br>
          3. Приложение появится на рабочем столе и будет работать офлайн без рамок браузера.
        </p>
      </div>
    </div>
  `;
}

window.importFullCatalog = async function() {
  const btn = document.getElementById('importCatalogBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Загрузка...';
  }
  const count = await DB.importFullCatalog();
  alert(`Успешно добавлено ${count} новых упражнений!`);
  haptic();
  switchTab('settings');
};

window.exportJSONBackup = async function() {
  const json = await DB.exportBackup();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const dateStr = `${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}_${String(d.getDate()).padStart(2, '0')}`;
  a.href = url;
  a.download = `gym_tracker_backup_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
  haptic();
};

window.handleImportJSON = async function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const count = await DB.importBackup(e.target.result);
      alert(`Импорт завершён! Восстановлено тренировок: ${count}`);
      haptic();
      switchTab('home');
    } catch (err) {
      alert('Ошибка чтения файла бэкапа: ' + err.message);
    }
  };
  reader.readAsText(file);
};

// ==========================================
// 7. MODALS (Техника, График прогресса, Суперсет)
// ==========================================
let animInterval = null;

window.showTechniqueModal = async function(exerciseId) {
  const ex = await DB.getExerciseById(exerciseId);
  if (!ex) return;

  const baseUrl = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises';
  const frame0 = ex.imagePath ? `${baseUrl}/${ex.imagePath}/0.jpg` : null;
  const frame1 = ex.imagePath ? `${baseUrl}/${ex.imagePath}/1.jpg` : null;

  const modal = document.getElementById('techniqueModal');
  const body = document.getElementById('techniqueModalBody');

  body.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
      <div>
        <h3 style="font-size: 18px; font-weight: 800;">${ex.name}</h3>
        <span class="badge badge-primary" style="margin-top: 4px;">${getMuscleNameRu(ex.muscleGroup)}</span>
      </div>
      <button class="btn-icon" onclick="closeTechniqueModal()">
        <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    </div>

    <!-- Режимы просмотра фото -->
    ${frame0 && frame1 ? `
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <button class="filter-chip active" id="btnModeSide" onclick="setTechniqueMode('side', '${frame0}', '${frame1}')">Сравнение фаз</button>
        <button class="filter-chip" id="btnModeLoop" onclick="setTechniqueMode('loop', '${frame0}', '${frame1}')">Анимация (1 ↔ 2)</button>
      </div>

      <div id="techniquePhotoBox" style="width: 100%; height: 210px; background: #000; border-radius: var(--radius-lg); overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
        <img id="techImg0" src="${frame0}" style="width: 50%; height: 100%; object-fit: contain;" />
        <img id="techImg1" src="${frame1}" style="width: 50%; height: 100%; object-fit: contain;" />
      </div>
    ` : `
      <div style="width: 100%; height: 160px; background: var(--bg-card-highest); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 13px;">
        Векторная схема техники
      </div>
    `}

    <!-- Чек-лист техники -->
    <div style="margin-top: 16px;">
      ${ex.setupTip ? `
        <div style="margin-bottom: 10px;">
          <div style="font-size: 12px; font-weight: 700; color: var(--success); margin-bottom: 2px;">🟢 Исходное положение:</div>
          <div style="font-size: 13px; color: var(--text-secondary);">${ex.setupTip}</div>
        </div>
      ` : ''}
      ${ex.executionTip ? `
        <div style="margin-bottom: 10px;">
          <div style="font-size: 12px; font-weight: 700; color: var(--primary); margin-bottom: 2px;">⚡ Движение и дыхание:</div>
          <div style="font-size: 13px; color: var(--text-secondary);">${ex.executionTip}</div>
        </div>
      ` : ''}
      ${ex.mistakeTip ? `
        <div style="margin-bottom: 10px;">
          <div style="font-size: 12px; font-weight: 700; color: var(--error); margin-bottom: 2px;">🔴 Частые ошибки:</div>
          <div style="font-size: 13px; color: var(--text-secondary);">${ex.mistakeTip}</div>
        </div>
      ` : ''}
    </div>
  `;

  modal.classList.add('open');
};

window.setTechniqueMode = function(mode, frame0, frame1) {
  if (animInterval) { clearInterval(animInterval); animInterval = null; }
  const box = document.getElementById('techniquePhotoBox');
  const btnSide = document.getElementById('btnModeSide');
  const btnLoop = document.getElementById('btnModeLoop');

  if (mode === 'side') {
    btnSide.classList.add('active');
    btnLoop.classList.remove('active');
    box.innerHTML = `
      <img src="${frame0}" style="width: 50%; height: 100%; object-fit: contain;" />
      <img src="${frame1}" style="width: 50%; height: 100%; object-fit: contain;" />
    `;
  } else {
    btnLoop.classList.add('active');
    btnSide.classList.remove('active');
    box.innerHTML = `<img id="loopImg" src="${frame0}" style="width: 100%; height: 100%; object-fit: contain;" />`;
    let isFrame0 = true;
    animInterval = setInterval(() => {
      isFrame0 = !isFrame0;
      const el = document.getElementById('loopImg');
      if (el) el.src = isFrame0 ? frame0 : frame1;
    }, 1100);
  }
};

window.closeTechniqueModal = function() {
  if (animInterval) { clearInterval(animInterval); animInterval = null; }
  document.getElementById('techniqueModal').classList.remove('open');
};

// График прогресса (Canvas)
window.showProgressChart = async function(exerciseId) {
  const ex = await DB.getExerciseById(exerciseId);
  if (!ex) return;

  const history = await DB.getExerciseHistory(exerciseId);
  const modal = document.getElementById('progressModal');
  const body = document.getElementById('progressModalBody');

  // Группируем по датам
  const points = [];
  const grouped = {};
  history.forEach(h => {
    const dStr = new Date(h.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    if (!grouped[dStr]) grouped[dStr] = [];
    grouped[dStr].push(h);
  });

  Object.entries(grouped).forEach(([dStr, sets]) => {
    const working = sets.filter(s => s.setType !== 'WARMUP');
    const cand = working.length > 0 ? working : sets;
    let maxW = 0, max1RM = 0;
    cand.forEach(s => {
      const oneRm = Formulas.calculate1RM(s.weightKg, s.reps);
      if (oneRm > max1RM) max1RM = oneRm;
      if (s.weightKg > maxW) maxW = s.weightKg;
    });
    points.push({ date: dStr, maxWeight: maxW, max1RM: max1RM });
  });

  const best1RM = points.length > 0 ? Math.max(...points.map(p => p.max1RM)) : 0;
  const bestWeight = points.length > 0 ? Math.max(...points.map(p => p.maxWeight)) : 0;

  body.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
      <div>
        <h3 style="font-size: 18px; font-weight: 800;">${ex.name}</h3>
        <span class="badge badge-primary" style="margin-top: 4px;">${getMuscleNameRu(ex.muscleGroup)}</span>
      </div>
      <button class="btn-icon" onclick="document.getElementById('progressModal').classList.remove('open')">
        <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
      <div class="card" style="padding: 12px; margin-bottom: 0; background: var(--primary-container);">
        <div style="font-size: 11px; color: var(--on-primary-container);">🏆 Рекордный 1ПМ</div>
        <div style="font-size: 20px; font-weight: 800; color: var(--primary); margin-top: 2px;">${best1RM > 0 ? `${best1RM} кг` : '—'}</div>
      </div>
      <div class="card" style="padding: 12px; margin-bottom: 0;">
        <div style="font-size: 11px; color: var(--text-secondary);">⚡ Лучший рабочий</div>
        <div style="font-size: 20px; font-weight: 800; margin-top: 2px;">${bestWeight > 0 ? `${bestWeight} кг` : '—'}</div>
      </div>
    </div>

    <!-- Canvas График -->
    <div class="card" style="padding: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; font-weight: 700;">
        <span>Динамика 1ПМ</span>
        <div style="display: flex; gap: 10px; font-size: 11px; color: var(--text-secondary);">
          <span style="color: var(--primary);">● 1ПМ</span>
          <span style="color: var(--secondary);">● Вес</span>
        </div>
      </div>

      ${points.length < 2 ? `
        <div style="height: 160px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 13px; text-align: center;">
          ${points.length === 0 ? 'Нет данных о тренировках' : 'Нужно минимум 2 тренировки для построения графика'}
        </div>
      ` : `
        <canvas id="progressCanvas" width="400" height="180" style="width: 100%; height: 180px;"></canvas>
      `}
    </div>
  `;

  modal.classList.add('open');

  if (points.length >= 2) {
    setTimeout(() => drawCanvasProgress(points), 50);
  }
};

function drawCanvasProgress(points) {
  const canvas = document.getElementById('progressCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height - 25;

  ctx.clearRect(0, 0, w, canvas.height);

  const maxVal = Math.max(...points.map(p => p.max1RM)) * 1.15;
  const minVal = 0;

  // Grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (let i = 0; i <= 3; i++) {
    const y = h - (h * i / 3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Curves
  const stepX = w / (points.length - 1);

  // Line 1: Weight (Secondary Purple)
  ctx.strokeStyle = 'rgba(187, 134, 252, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, idx) => {
    const x = idx * stepX;
    const y = h - ((p.maxWeight - minVal) / (maxVal - minVal) * h);
    if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Line 2: 1RM (Primary Orange)
  ctx.strokeStyle = '#FF6F00';
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((p, idx) => {
    const x = idx * stepX;
    const y = h - ((p.max1RM - minVal) / (maxVal - minVal) * h);
    if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Points & Labels
  points.forEach((p, idx) => {
    const x = idx * stepX;
    const y = h - ((p.max1RM - minVal) / (maxVal - minVal) * h);
    ctx.fillStyle = '#FF6F00';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Bottom Date text
    if (idx === 0 || idx === points.length - 1 || idx === Math.floor(points.length / 2)) {
      ctx.fillStyle = '#B0B4C1';
      ctx.font = '10px sans-serif';
      ctx.textAlign = idx === 0 ? 'left' : (idx === points.length - 1 ? 'right' : 'center');
      ctx.fillText(p.date, x, canvas.height - 4);
    }
  });
}

// Action sheet helper
function showActionSheet(title, items) {
  const modal = document.getElementById('actionSheetModal');
  const body = document.getElementById('actionSheetBody');
  body.innerHTML = `
    <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 12px; text-align: center;">${title}</h3>
    <div style="display: flex; flex-direction: column; gap: 6px;">
      ${items.map(it => `
        <button class="btn btn-outline" style="justify-content: flex-start; text-align: left; background: ${it.selected ? 'var(--primary-container)' : 'var(--bg-card-highest)'}; color: ${it.selected ? 'var(--on-primary-container)' : 'var(--text-primary)'}; border-color: ${it.selected ? 'var(--primary)' : 'transparent'};" onclick="(${it.onClick})(); closeActionSheet();">
          ${it.label}
        </button>
      `).join('')}
    </div>
  `;
  modal.classList.add('open');
}

window.closeActionSheet = function() {
  document.getElementById('actionSheetModal').classList.remove('open');
};

// Generic Dialog helpers
window.showCreateProgramDialog = function() {
  const title = prompt('Название новой программы:', 'Трёхдневный сплит');
  if (title && title.trim()) {
    DB.createProgram(title.trim()).then(id => {
      haptic();
      selectedProgId = id;
      switchTab('programs');
    });
  }
};

window.showAddDayDialog = function(programId) {
  const name = prompt('Название тренировочного дня:', 'День ' + ((document.querySelectorAll('#planExercisesList').length) + 1));
  if (name && name.trim()) {
    DB.addDayToProgram(programId, name.trim()).then(() => {
      haptic();
      switchTab('programs');
    });
  }
};

// Добавление упражнения в план
window.showAddExerciseToPlanDialog = async function(dayId) {
  const exercises = await DB.getExercises();
  const modal = document.getElementById('actionSheetModal');
  const body = document.getElementById('actionSheetBody');

  body.innerHTML = `
    <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 8px;">Добавить упражнение в план</h3>
    <input type="text" id="planExSearch" class="num-input" style="text-align: left; margin-bottom: 10px;" placeholder="Поиск по 970+ упражнениям..." oninput="filterPlanExercisesList(${dayId})" />
    <div id="planExListContainer" style="max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
      ${exercises.map(ex => `
        <div class="card" style="padding: 10px 14px; margin-bottom: 0; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="addExerciseToPlanConfirmed(${dayId}, ${ex.id})">
          <div>
            <div style="font-size: 14px; font-weight: 700;">${ex.name}</div>
            <div style="font-size: 11px; color: var(--primary);">${getMuscleNameRu(ex.muscleGroup)}</div>
          </div>
          <span style="color: var(--primary); font-size: 18px; font-weight: 800;">+</span>
        </div>
      `).join('')}
    </div>
  `;
  modal.classList.add('open');
};

window.filterPlanExercisesList = async function(dayId) {
  const q = document.getElementById('planExSearch').value.toLowerCase().trim();
  const container = document.getElementById('planExListContainer');
  const localExercises = await DB.getExercises();
  const catalogMatches = await DB.searchCatalog(q);

  let html = '';
  // Сначала локальные
  const matchedLocal = localExercises.filter(ex => ex.name.toLowerCase().includes(q));
  matchedLocal.forEach(ex => {
    html += `
      <div class="card" style="padding: 10px 14px; margin-bottom: 0; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="addExerciseToPlanConfirmed(${dayId}, ${ex.id})">
        <div>
          <div style="font-size: 14px; font-weight: 700;">${ex.name}</div>
          <div style="font-size: 11px; color: var(--primary);">${getMuscleNameRu(ex.muscleGroup)}</div>
        </div>
        <span style="color: var(--primary); font-size: 18px; font-weight: 800;">+</span>
      </div>
    `;
  });

  // Если из каталога
  if (q.length >= 2 && catalogMatches.length > 0) {
    html += `<div style="font-size: 11px; color: var(--text-muted); margin: 6px 0;">Найдено в полной энциклопедии (${catalogMatches.length}):</div>`;
    catalogMatches.slice(0, 15).forEach(ex => {
      html += `
        <div class="card" style="padding: 10px 14px; margin-bottom: 0; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border: 1px dashed var(--border);" onclick="importAndAddPlanEx(${dayId}, '${encodeURIComponent(JSON.stringify(ex))}')">
          <div>
            <div style="font-size: 14px; font-weight: 700;">${ex.name}</div>
            <div style="font-size: 11px; color: var(--secondary);">${getMuscleNameRu(ex.muscleGroup)} (из энциклопедии)</div>
          </div>
          <span style="color: var(--secondary); font-size: 12px; font-weight: 700;">[+] В план</span>
        </div>
      `;
    });
  }

  container.innerHTML = html;
};

window.importAndAddPlanEx = async function(dayId, encodedEx) {
  const ex = JSON.parse(decodeURIComponent(encodedEx));
  const newId = await DB.addExercise(ex);
  await DB.addExerciseToDay(dayId, newId, 3, '8-12', null);
  closeActionSheet();
  haptic();
  switchTab('programs');
};

window.addExerciseToPlanConfirmed = async function(dayId, exerciseId) {
  await DB.addExerciseToDay(dayId, exerciseId, 3, '8-12', null);
  closeActionSheet();
  haptic();
  switchTab('programs');
};

// Добавление упражнения в активную тренировку
window.showAddExerciseModal = async function() {
  const exercises = await DB.getExercises();
  const modal = document.getElementById('actionSheetModal');
  const body = document.getElementById('actionSheetBody');

  body.innerHTML = `
    <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 8px;">Добавить в тренировку</h3>
    <input type="text" id="workoutExSearch" class="num-input" style="text-align: left; margin-bottom: 10px;" placeholder="Поиск упражнения..." oninput="filterWorkoutExercisesList()" />
    <div id="workoutExListContainer" style="max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
      ${exercises.map(ex => `
        <div class="card" style="padding: 10px 14px; margin-bottom: 0; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="addExerciseToWorkoutConfirmed(${ex.id})">
          <div>
            <div style="font-size: 14px; font-weight: 700;">${ex.name}</div>
            <div style="font-size: 11px; color: var(--primary);">${getMuscleNameRu(ex.muscleGroup)}</div>
          </div>
          <span style="color: var(--primary); font-size: 18px; font-weight: 800;">+</span>
        </div>
      `).join('')}
    </div>
  `;
  modal.classList.add('open');
};

window.filterWorkoutExercisesList = async function() {
  const q = document.getElementById('workoutExSearch').value.toLowerCase().trim();
  const container = document.getElementById('workoutExListContainer');
  const localExercises = await DB.getExercises();
  const catalogMatches = await DB.searchCatalog(q);

  let html = '';
  localExercises.filter(ex => ex.name.toLowerCase().includes(q)).forEach(ex => {
    html += `
      <div class="card" style="padding: 10px 14px; margin-bottom: 0; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="addExerciseToWorkoutConfirmed(${ex.id})">
        <div>
          <div style="font-size: 14px; font-weight: 700;">${ex.name}</div>
          <div style="font-size: 11px; color: var(--primary);">${getMuscleNameRu(ex.muscleGroup)}</div>
        </div>
        <span style="color: var(--primary); font-size: 18px; font-weight: 800;">+</span>
      </div>
    `;
  });

  if (q.length >= 2 && catalogMatches.length > 0) {
    html += `<div style="font-size: 11px; color: var(--text-muted); margin: 6px 0;">Найдено в полной энциклопедии (${catalogMatches.length}):</div>`;
    catalogMatches.slice(0, 15).forEach(ex => {
      html += `
        <div class="card" style="padding: 10px 14px; margin-bottom: 0; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border: 1px dashed var(--border);" onclick="importAndAddWorkoutEx('${encodeURIComponent(JSON.stringify(ex))}')">
          <div>
            <div style="font-size: 14px; font-weight: 700;">${ex.name}</div>
            <div style="font-size: 11px; color: var(--secondary);">${getMuscleNameRu(ex.muscleGroup)} (из энциклопедии)</div>
          </div>
          <span style="color: var(--secondary); font-size: 12px; font-weight: 700;">[+] В тренировку</span>
        </div>
      `;
    });
  }

  container.innerHTML = html;
};

window.importAndAddWorkoutEx = async function(encodedEx) {
  const ex = JSON.parse(decodeURIComponent(encodedEx));
  const newId = await DB.addExercise(ex);
  await addExerciseToWorkoutConfirmed(newId);
};

window.addExerciseToWorkoutConfirmed = async function(exerciseId) {
  const ex = await DB.getExerciseById(exerciseId);
  if (!ex) return;

  const history = await DB.getExerciseHistory(exerciseId);
  const maxHistWeight = history.length > 0 ? Math.max(...history.map(h => h.weightKg || 0)) : 0;
  const lastSet = history[history.length - 1];

  activeWorkout.exercises.push({
    exercise: ex,
    sets: [{
      weight: lastSet ? String(lastSet.weightKg || '') : '',
      reps: lastSet ? String(lastSet.reps || 10) : '10',
      isCompleted: false,
      setType: 'NORMAL',
      prevWeight: lastSet ? lastSet.weightKg : null,
      prevReps: lastSet ? lastSet.reps : null,
      historicalMax: maxHistWeight
    }],
    isWeighted: ex.exerciseType === 'WEIGHTED_BODYWEIGHT',
    supersetLabel: null,
    allTimeMaxWeight: maxHistWeight
  });

  closeActionSheet();
  haptic();
  switchTab('workout');
};

// Суперсеты в тренировке
window.showWorkoutSupersetModal = function(exIdx) {
  const currentEx = activeWorkout.exercises[exIdx];
  const others = activeWorkout.exercises.map((x, i) => ({ ex: x, idx: i })).filter(x => x.idx !== exIdx);

  if (others.length === 0) {
    alert('В тренировке нет других упражнений для связки.');
    return;
  }

  showActionSheet('Объединить в суперсет', others.map(o => ({
    label: `${o.ex.exercise.name} (${getMuscleNameRu(o.ex.exercise.muscleGroup)})`,
    onClick: () => {
      const existing = new Set(activeWorkout.exercises.map(x => x.supersetLabel).filter(Boolean));
      let lbl = 'A';
      for (const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        if (!existing.has(char)) { lbl = char; break; }
      }
      activeWorkout.exercises[exIdx].supersetLabel = lbl;
      activeWorkout.exercises[o.idx].supersetLabel = lbl;
      haptic();
      switchTab('workout');
    }
  })));
};

window.removeWorkoutSuperset = function(exIdx) {
  const lbl = activeWorkout.exercises[exIdx].supersetLabel;
  activeWorkout.exercises.forEach(x => {
    if (x.supersetLabel === lbl) x.supersetLabel = null;
  });
  haptic();
  switchTab('workout');
};

// Суперсеты в планах
window.showPlanSupersetPairModal = async function(dayId, planExId) {
  const programs = await DB.getPrograms();
  let currentDay = null;
  for (const p of programs) {
    const found = p.days.find(d => d.day.id === Number(dayId));
    if (found) { currentDay = found; break; }
  }

  const others = currentDay.exercises.filter(pe => pe.planExercise.id !== Number(planExId));
  if (others.length === 0) {
    alert('В плане этого дня нет других упражнений.');
    return;
  }

  showActionSheet('Объединить в суперсет', others.map(o => ({
    label: `${o.exercise.name} (${getMuscleNameRu(o.exercise.muscleGroup)})`,
    onClick: async () => {
      await DB.setProgramSuperset(dayId, planExId, o.planExercise.id);
      haptic();
      switchTab('programs');
    }
  })));
};

// Init app
window.addEventListener('DOMContentLoaded', async () => {
  await DB.open();
  switchTab('home');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(e => console.log('SW reg error', e));
  }
});
