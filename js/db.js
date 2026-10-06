// GymTracker IndexedDB Layer (matches Android Room schema v5)

const DB_NAME = 'GymTrackerDB';
const DB_VERSION = 1;

let dbInstance = null;
let extendedCatalogCache = null;

const INITIAL_EXERCISES = [
  // CHEST
  { name: 'Жим штанги лёжа', muscleGroup: 'CHEST', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Лопатки сведены, стопы плотно упираются в пол, хват чуть шире плеч.', executionTip: 'Опускайте гриф к низу груди на вдохе, выжимайте на выдохе по дуге к глазам.', mistakeTip: 'Отрыв таза от скамьи, разведение локтей перпендикулярно корпусу.', imagePath: 'Barbell_Bench_Press_-_Medium_Grip' },
  { name: 'Жим гантелей на наклонной скамье', muscleGroup: 'CHEST', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Наклон скамьи 30–45 градусов. Гантели у плеч, предплечья вертикальны.', executionTip: 'Жмите вверх по плавной дуге, сводя гантели в верхней точке без соударения.', mistakeTip: 'Слишком крутой наклон скамьи (включает переднюю дельту).', imagePath: 'Incline_Dumbbell_Press' },
  { name: 'Отжимания на брусьях (грудной акцент)', muscleGroup: 'CHEST', exerciseType: 'WEIGHTED_BODYWEIGHT', setupTip: 'Наклоните корпус вперёд примерно на 30 градусов, локти слегка разведены.', executionTip: 'Опускайтесь до параллели плеча с полом, мощно выжимайте себя вверх.', mistakeTip: 'Слишком глубокое опускание (перегрузка плечевых связок).', imagePath: 'Dips_-_Chest_Version' },
  { name: 'Сведение рук в кроссовере', muscleGroup: 'CHEST', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Тросы на уровне плеч или выше, шаг вперёд для устойчивости.', executionTip: 'Сводите ладони перед грудью на выдохе, фиксируя пиковое сокращение.', mistakeTip: 'Использование инерции корпуса, сгибание рук в локтях под острым углом.', imagePath: 'Cable_Crossover' },
  { name: 'Отжимания от пола', muscleGroup: 'CHEST', exerciseType: 'BODYWEIGHT_ONLY', setupTip: 'Упор лёжа, ладони шире плеч, корпус и ноги на одной прямой.', executionTip: 'Опускайтесь грудью почти до пола на вдохе, выжимайте на выдохе.', mistakeTip: 'Провисание поясницы или поднятый вверх таз.', imagePath: 'Pushups' },

  // BACK
  { name: 'Становая тяга', muscleGroup: 'BACK', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Гриф над серединой стопы, спина прямая, лопатки сведены, хват на ширине плеч.', executionTip: 'Начинайте срыв ногами, плавно выпрямляясь и фиксируя таз вверху.', mistakeTip: 'Круглая спина («горб»), резкий рывок со старта.', imagePath: 'Barbell_Deadlift' },
  { name: 'Подтягивания широким хватом', muscleGroup: 'BACK', exerciseType: 'WEIGHTED_BODYWEIGHT', setupTip: 'Хват шире плеч, вис на прямых руках, грудь направлена к перекладине.', executionTip: 'Тянитесь грудью к перекладине за счёт широчайших, сводя лопатки.', mistakeTip: 'Раскачивание ногами (киппинг), неполная амплитуда.', imagePath: 'Pullups' },
  { name: 'Тяга штанги в наклоне', muscleGroup: 'BACK', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Наклон корпуса 45–60 градусов, колени чуть согнуты, спина прямая.', executionTip: 'Тяните гриф к низу живота, ведя локти вдоль корпуса назад.', mistakeTip: 'Округление поясницы, рывки корпусом.', imagePath: 'Bent_Over_Barbell_Row' },
  { name: 'Тяга верхнего блока к груди', muscleGroup: 'BACK', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Сядьте плотно под валики, хват широкий, грудь подана вперёд.', executionTip: 'Тяните рукоять к верхней части груди, сводя лопатки назад-вниз.', mistakeTip: 'Чрезмерное отклонение корпуса назад.', imagePath: 'Wide-Grip_Lat_Pulldown' },
  { name: 'Тяга горизонтального блока к поясу', muscleGroup: 'BACK', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Колени слегка согнуты, спина прямая, плечи опущены.', executionTip: 'Тяните V-рукоять к поясу, сводя лопатки в финальной точке.', mistakeTip: 'Раскачивание поясницей назад-вперёд.', imagePath: 'Seated_Cable_Rows' },
  { name: 'Гиперэкстензия', muscleGroup: 'BACK', exerciseType: 'BODYWEIGHT_ONLY', setupTip: 'Таз упирается в подушку ниже линии сгиба бёдер.', executionTip: 'Плавно опускайтесь и разгибайтесь до прямой линии корпуса.', mistakeTip: 'Чрезмерный переразгиб поясницы назад.', imagePath: 'Hyperextensions_Back_Extensions' },

  // LEGS
  { name: 'Приседания со штангой на плечах', muscleGroup: 'LEGS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Штанга на трапециях, стопы на ширине плеч, носки чуть врозь.', executionTip: 'Отводите таз назад, приседайте до параллели бёдер с полом, колени по направлению носков.', mistakeTip: 'Завал коленей внутрь, отрыв пяток от пола.', imagePath: 'Barbell_Squat' },
  { name: 'Жим ногами в тренажёре', muscleGroup: 'LEGS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Поясница и крестец плотно прижаты к спинке, стопы на платформе на ширине плеч.', executionTip: 'Опускайте платформу до угла 90 градусов в коленях, выжимайте пятками.', mistakeTip: 'Полное «защелкивание» коленей вверху, отрыв таза от спинки.', imagePath: 'Leg_Press' },
  { name: 'Выпады с гантелями', muscleGroup: 'LEGS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Корпус вертикален, шаг вперёд средней ширины.', executionTip: 'Опускайтесь до угла 90 градусов в обоих коленях, толчок передней пяткой.', mistakeTip: 'Удар задним коленом о пол, наклон корпуса вперёд.', imagePath: 'Dumbbell_Lunges' },
  { name: 'Сгибания ног лёжа в тренажёре', muscleGroup: 'LEGS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Колени на одной оси с шарниром тренажёра, валик на ахилловых сухожилиях.', executionTip: 'Сгибайте голени к ягодицам, задержите на 1 сек, плавно возвращайте.', mistakeTip: 'Отрыв таза от скамьи при подъёме веса.', imagePath: 'Lying_Leg_Curls' },
  { name: 'Разгибания ног сидя в тренажёре', muscleGroup: 'LEGS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Спина прижата к спинке, валик на нижней части голени.', executionTip: 'Разгибайте колени до горизонтали, напрягая квадрицепсы.', mistakeTip: 'Резкие рывки по инерции.', imagePath: 'Leg_Extensions' },
  { name: 'Подъём на носки стоя (икры)', muscleGroup: 'LEGS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Подушечки стоп на ступени, пятки свободно опущены.', executionTip: 'Поднимайтесь максимально высоко на носки, пауза 1 сек.', mistakeTip: 'Сгибание коленей, быстрая пружинящая работа без амплитуды.', imagePath: 'Standing_Calf_Raises' },

  // SHOULDERS
  { name: 'Армейский жим стоя', muscleGroup: 'SHOULDERS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Стопы на ширине плеч, пресс и ягодицы напряжены, гриф у ключиц.', executionTip: 'Выжимайте штангу строго вверх над головой, слегка подавая корпус вперёд.', mistakeTip: 'Сильный прогиб в пояснице назад.', imagePath: 'Standing_Military_Press' },
  { name: 'Жим гантелей сидя', muscleGroup: 'SHOULDERS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Спинка тренажёра вертикальна (или 80 градусов), гантели на уровне ушей.', executionTip: 'Выжимайте гантели вверх до лёгкого сближения над головой.', mistakeTip: 'Соударение гантелей в верхней точке.', imagePath: 'Dumbbell_Shoulder_Press' },
  { name: 'Махи гантелями через стороны', muscleGroup: 'SHOULDERS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Корпус слегка наклонен вперёд, локти чуть согнуты.', executionTip: 'Поднимайте локти через стороны до уровня плеч, ведя мизинцы чуть выше больших пальцев.', mistakeTip: 'Подъём кистей выше локтей, раскачка корпусом.', imagePath: 'Side_Lateral_Raise' },
  { name: 'Тяга штанги к подбородку', muscleGroup: 'SHOULDERS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Хват на ширине плеч, спина прямая.', executionTip: 'Тяните гриф вдоль корпуса вверх за счёт подъёма локтей.', mistakeTip: 'Слишком узкий хват (перегрузка лучезапястных суставов).', imagePath: 'Upright_Barbell_Row' },
  { name: 'Разведение гантелей в наклоне', muscleGroup: 'SHOULDERS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Наклон корпуса параллельно полу, спина прямая.', executionTip: 'Разводите гантели в стороны за счёт задних дельт, не сводя трапеции.', mistakeTip: 'Подъём корпуса во время движения.', imagePath: 'Seated_Bent-Over_Rear_Delt_Raise' },

  // ARMS
  { name: 'Подъём штанги на бицепс стоя', muscleGroup: 'ARMS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Локти прижаты к бокам, хват снизу на ширине плеч.', executionTip: 'Сгибайте руки до пикового сокращения бицепса, не выдвигая локти вперёд.', mistakeTip: 'Раскачивание корпусом («читинг»), заброс веса инерцией.', imagePath: 'Barbell_Curl' },
  { name: 'Молотковые сгибания с гантелями', muscleGroup: 'ARMS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Гантели в опущенных руках нейтральным хватом (ладони внутрь).', executionTip: 'Поднимайте гантели, сохраняя нейтральный хват, акцентируя брахиалис.', mistakeTip: 'Вращение кисти во время подъёма.', imagePath: 'Hammer_Curls' },
  { name: 'Французский жим со штангой лёжа', muscleGroup: 'ARMS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Гриф EZ-штанги на прямых руках, локти зафиксированы.', executionTip: 'Сгибайте руки в локтях, опуская гриф ко лбу, затем мощно разгибайте.', mistakeTip: 'Разведение локтей в стороны при подъёме.', imagePath: 'EZ-Bar_Skullcrusher' },
  { name: 'Разгибания рук на верхнем блоке', muscleGroup: 'ARMS', exerciseType: 'WEIGHT_AND_REPS', setupTip: 'Локти строго прижаты к корпусу, хват за рукоять или канат.', executionTip: 'Полностью разгибайте руки вниз на выдохе, разводя кисти внизу.', mistakeTip: 'Отрыв локтей от туловища, навал всем телом.', imagePath: 'Triceps_Pushdown' },

  // ABS
  { name: 'Скручивания на полу', muscleGroup: 'ABS', exerciseType: 'BODYWEIGHT_ONLY', setupTip: 'Лёжа на спине, колени согнуты, стопы на полу, руки у висков.', executionTip: 'Скручивайте корпус за счёт сокращения пресса, прижимая поясницу к полу.', mistakeTip: 'Тяга головы руками за шею.', imagePath: 'Crunches' },
  { name: 'Подъём ног в висе на турнике', muscleGroup: 'ABS', exerciseType: 'BODYWEIGHT_ONLY', setupTip: 'Прямой вис на перекладине, плечи зафиксированы.', executionTip: 'Поднимайте согнутые или прямые ноги к груди, подкручивая таз.', mistakeTip: 'Раскачивание телом, подъём только за счёт сгибателей бедра.', imagePath: 'Hanging_Leg_Raise' },
  { name: 'Планка', muscleGroup: 'ABS', exerciseType: 'BODYWEIGHT_ONLY', setupTip: 'Упор на предплечья и носки, тело натянуто как струна.', executionTip: 'Удерживайте статическое положение, напрягая пресс и ягодицы.', mistakeTip: 'Провисание поясницы или подъём таза выше плеч.', imagePath: 'Plank' }
];

export const DB = {
  async open() {
    if (dbInstance) return dbInstance;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Exercises
        if (!db.objectStoreNames.contains('exercises')) {
          const exStore = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
          exStore.createIndex('name', 'name', { unique: false });
          exStore.createIndex('muscleGroup', 'muscleGroup', { unique: false });
        }

        // Workouts
        if (!db.objectStoreNames.contains('workouts')) {
          const wStore = db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
          wStore.createIndex('dateEpochMillis', 'dateEpochMillis', { unique: false });
        }

        // Workout exercises
        if (!db.objectStoreNames.contains('workout_exercises')) {
          const weStore = db.createObjectStore('workout_exercises', { keyPath: 'id', autoIncrement: true });
          weStore.createIndex('workoutId', 'workoutId', { unique: false });
          weStore.createIndex('exerciseId', 'exerciseId', { unique: false });
        }

        // Sets
        if (!db.objectStoreNames.contains('sets')) {
          const sStore = db.createObjectStore('sets', { keyPath: 'id', autoIncrement: true });
          sStore.createIndex('workoutExerciseId', 'workoutExerciseId', { unique: false });
        }

        // Programs
        if (!db.objectStoreNames.contains('programs')) {
          db.createObjectStore('programs', { keyPath: 'id', autoIncrement: true });
        }

        // Program Days
        if (!db.objectStoreNames.contains('program_days')) {
          const pdStore = db.createObjectStore('program_days', { keyPath: 'id', autoIncrement: true });
          pdStore.createIndex('programId', 'programId', { unique: false });
        }

        // Program Day Exercises
        if (!db.objectStoreNames.contains('program_day_exercises')) {
          const pdeStore = db.createObjectStore('program_day_exercises', { keyPath: 'id', autoIncrement: true });
          pdeStore.createIndex('dayId', 'dayId', { unique: false });
        }
      };

      request.onsuccess = async (e) => {
        dbInstance = e.target.result;
        await DB.prepopulateIfEmpty();
        resolve(dbInstance);
      };

      request.onerror = (e) => reject(e.target.error);
    });
  },

  async prepopulateIfEmpty() {
    const db = dbInstance;
    const tx = db.transaction(['exercises', 'programs', 'program_days', 'program_day_exercises'], 'readwrite');
    const exStore = tx.objectStore('exercises');

    const countReq = exStore.count();
    countReq.onsuccess = async () => {
      if (countReq.result === 0) {
        // Заполняем начальными упражнениями
        for (const ex of INITIAL_EXERCISES) {
          exStore.add({ ...ex, isCustom: false });
        }

        // Создаем стартовые программы
        const progStore = tx.objectStore('programs');
        const dayStore = tx.objectStore('program_days');
        const planExStore = tx.objectStore('program_day_exercises');

        const p1Req = progStore.add({
          title: 'Классический сплит (3 дня)',
          description: 'Грудь/Трицепс, Спина/Бицепс, Ноги/Плечи',
          isActive: true
        });

        p1Req.onsuccess = () => {
          const pId = p1Req.result;
          const d1 = dayStore.add({ programId: pId, name: 'День 1: Грудь и Трицепс', orderIndex: 0 });
          d1.onsuccess = () => {
            planExStore.add({ dayId: d1.result, exerciseId: 1, orderIndex: 0, targetSets: 4, targetReps: '8-10', targetWeightKg: 80, supersetLabel: null });
            planExStore.add({ dayId: d1.result, exerciseId: 2, orderIndex: 1, targetSets: 3, targetReps: '10-12', targetWeightKg: 26, supersetLabel: null });
            planExStore.add({ dayId: d1.result, exerciseId: 24, orderIndex: 2, targetSets: 3, targetReps: '10-12', targetWeightKg: 35, supersetLabel: null });
          };

          const d2 = dayStore.add({ programId: pId, name: 'День 2: Спина и Бицепс', orderIndex: 1 });
          d2.onsuccess = () => {
            planExStore.add({ dayId: d2.result, exerciseId: 7, orderIndex: 0, targetSets: 4, targetReps: '8-10', targetWeightKg: null, supersetLabel: null });
            planExStore.add({ dayId: d2.result, exerciseId: 8, orderIndex: 1, targetSets: 3, targetReps: '8-10', targetWeightKg: 70, supersetLabel: null });
            planExStore.add({ dayId: d2.result, exerciseId: 22, orderIndex: 2, targetSets: 3, targetReps: '10-12', targetWeightKg: 35, supersetLabel: null });
          };

          const d3 = dayStore.add({ programId: pId, name: 'День 3: Ноги и Плечи', orderIndex: 2 });
          d3.onsuccess = () => {
            planExStore.add({ dayId: d3.result, exerciseId: 12, orderIndex: 0, targetSets: 4, targetReps: '8-10', targetWeightKg: 100, supersetLabel: null });
            planExStore.add({ dayId: d3.result, exerciseId: 13, orderIndex: 1, targetSets: 3, targetReps: '10-12', targetWeightKg: 180, supersetLabel: null });
            planExStore.add({ dayId: d3.result, exerciseId: 18, orderIndex: 2, targetSets: 3, targetReps: '8-10', targetWeightKg: 50, supersetLabel: null });
          };
        };
      }
    };
  },

  // Загрузка расширенного каталога (970+ упражнений)
  async loadExtendedCatalog() {
    if (extendedCatalogCache) return extendedCatalogCache;
    try {
      const res = await fetch('./data/extended_exercises.json');
      extendedCatalogCache = await res.json();
      return extendedCatalogCache;
    } catch (e) {
      console.error('Failed to load extended catalog', e);
      return [];
    }
  },

  async searchCatalog(query, muscleGroup = null) {
    const catalog = await DB.loadExtendedCatalog();
    const q = (query || '').toLowerCase().trim();
    return catalog.filter(ex => {
      const matchQuery = !q || ex.name.toLowerCase().includes(q) || (ex.nameEn && ex.nameEn.toLowerCase().includes(q));
      const matchGroup = !muscleGroup || ex.muscleGroup === muscleGroup;
      return matchQuery && matchGroup;
    });
  },

  // Импорт всех 970+ упражнений в локальную БД IndexedDB
  async importFullCatalog() {
    const catalog = await DB.loadExtendedCatalog();
    const db = await DB.open();
    const tx = db.transaction('exercises', 'readwrite');
    const store = tx.objectStore('exercises');

    const existingNames = new Set();
    const getAllReq = store.getAll();

    return new Promise((resolve) => {
      getAllReq.onsuccess = () => {
        for (const ex of getAllReq.result) {
          existingNames.add(ex.name.toLowerCase().trim());
        }

        let imported = 0;
        for (const item of catalog) {
          if (!existingNames.has(item.name.toLowerCase().trim())) {
            store.add({
              name: item.name,
              muscleGroup: item.muscleGroup,
              exerciseType: item.exerciseType || 'WEIGHT_AND_REPS',
              isCustom: false,
              setupTip: item.setupTip || '',
              executionTip: item.executionTip || '',
              mistakeTip: item.mistakeTip || '',
              imagePath: item.imagePath || ''
            });
            existingNames.add(item.name.toLowerCase().trim());
            imported++;
          }
        }

        tx.oncomplete = () => resolve(imported);
      };
    });
  },

  // Упражнения
  async getExercises() {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction('exercises', 'readonly');
      const req = tx.objectStore('exercises').getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => a.name.localeCompare(b.name, 'ru')));
    });
  },

  async getExerciseById(id) {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction('exercises', 'readonly');
      const req = tx.objectStore('exercises').get(Number(id));
      req.onsuccess = () => resolve(req.result || null);
    });
  },

  async addExercise(exercise) {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction('exercises', 'readwrite');
      const req = tx.objectStore('exercises').add(exercise);
      req.onsuccess = () => resolve(req.result);
    });
  },

  // Программы
  async getPrograms() {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction(['programs', 'program_days', 'program_day_exercises', 'exercises'], 'readonly');
      const pStore = tx.objectStore('programs');
      const dStore = tx.objectStore('program_days');
      const peStore = tx.objectStore('program_day_exercises');
      const exStore = tx.objectStore('exercises');

      pStore.getAll().onsuccess = (e) => {
        const programs = e.target.result;
        dStore.getAll().onsuccess = (e2) => {
          const days = e2.target.result;
          peStore.getAll().onsuccess = (e3) => {
            const planExercises = e3.target.result;
            exStore.getAll().onsuccess = (e4) => {
              const exercisesMap = new Map(e4.target.result.map(x => [x.id, x]));

              const res = programs.map(p => {
                const pDays = days
                  .filter(d => d.programId === p.id)
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map(d => {
                    const dExercises = planExercises
                      .filter(pe => pe.dayId === d.id)
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map(pe => ({
                        planExercise: pe,
                        exercise: exercisesMap.get(pe.exerciseId) || { name: 'Упражнение', muscleGroup: 'CHEST' }
                      }));
                    return { day: d, exercises: dExercises };
                  });
                return { program: p, days: pDays };
              });
              resolve(res);
            };
          };
        };
      };
    });
  },

  async createProgram(title, description = '') {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction(['programs', 'program_days'], 'readwrite');
      const pReq = tx.objectStore('programs').add({ title, description, isActive: false });
      pReq.onsuccess = () => {
        const pId = pReq.result;
        tx.objectStore('program_days').add({ programId: pId, name: 'День 1', orderIndex: 0 });
        tx.oncomplete = () => resolve(pId);
      };
    });
  },

  async deleteProgram(programId) {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction(['programs', 'program_days', 'program_day_exercises'], 'readwrite');
      tx.objectStore('programs').delete(Number(programId));
      
      const dStore = tx.objectStore('program_days');
      const peStore = tx.objectStore('program_day_exercises');
      const dIndex = dStore.index('programId');

      dIndex.getAllKeys(Number(programId)).onsuccess = (e) => {
        const dayIds = e.target.result;
        dayIds.forEach(id => {
          dStore.delete(id);
          const peIndex = peStore.index('dayId');
          peIndex.getAllKeys(id).onsuccess = (e2) => {
            e2.target.result.forEach(peId => peStore.delete(peId));
          };
        });
      };

      tx.oncomplete = () => resolve(true);
    });
  },

  async setActiveProgram(programId) {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction('programs', 'readwrite');
      const store = tx.objectStore('programs');
      store.getAll().onsuccess = (e) => {
        e.target.result.forEach(p => {
          p.isActive = (p.id === Number(programId));
          store.put(p);
        });
        tx.oncomplete = () => resolve(true);
      };
    });
  },

  async addDayToProgram(programId, name) {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction('program_days', 'readwrite');
      const store = tx.objectStore('program_days');
      const index = store.index('programId');
      index.getAll(Number(programId)).onsuccess = (e) => {
        const count = e.target.result.length;
        store.add({ programId: Number(programId), name, orderIndex: count });
        tx.oncomplete = () => resolve(true);
      };
    });
  },

  async deleteProgramDay(dayId) {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction(['program_days', 'program_day_exercises'], 'readwrite');
      tx.objectStore('program_days').delete(Number(dayId));
      const peIndex = tx.objectStore('program_day_exercises').index('dayId');
      peIndex.getAllKeys(Number(dayId)).onsuccess = (e) => {
        e.target.result.forEach(peId => tx.objectStore('program_day_exercises').delete(peId));
        tx.oncomplete = () => resolve(true);
      };
    });
  },

  async addExerciseToDay(dayId, exerciseId, targetSets = 3, targetReps = '8-12', targetWeightKg = null) {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction('program_day_exercises', 'readwrite');
      const store = tx.objectStore('program_day_exercises');
      const index = store.index('dayId');
      index.getAll(Number(dayId)).onsuccess = (e) => {
        const count = e.target.result.length;
        store.add({
          dayId: Number(dayId),
          exerciseId: Number(exerciseId),
          orderIndex: count,
          targetSets: Number(targetSets),
          targetReps: String(targetReps),
          targetWeightKg: targetWeightKg ? Number(targetWeightKg) : null,
          supersetLabel: null
        });
        tx.oncomplete = () => resolve(true);
      };
    });
  },

  async removeExerciseFromDay(planExerciseId) {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction('program_day_exercises', 'readwrite');
      tx.objectStore('program_day_exercises').delete(Number(planExerciseId));
      tx.oncomplete = () => resolve(true);
    });
  },

  async reorderProgramDayExercises(dayId, fromIndex, toIndex) {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction('program_day_exercises', 'readwrite');
      const store = tx.objectStore('program_day_exercises');
      const index = store.index('dayId');
      index.getAll(Number(dayId)).onsuccess = (e) => {
        const list = e.target.result.sort((a, b) => a.orderIndex - b.orderIndex);
        if (fromIndex in list && toIndex in list && fromIndex !== toIndex) {
          const [moved] = list.splice(fromIndex, 1);
          list.splice(toIndex, 0, moved);
          list.forEach((item, idx) => {
            item.orderIndex = idx;
            store.put(item);
          });
        }
        tx.oncomplete = () => resolve(true);
      };
    });
  },

  async setProgramSuperset(dayId, planExId1, planExId2) {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction('program_day_exercises', 'readwrite');
      const store = tx.objectStore('program_day_exercises');
      const index = store.index('dayId');
      index.getAll(Number(dayId)).onsuccess = (e) => {
        const list = e.target.result;
        const existingLabels = new Set(list.map(x => x.supersetLabel).filter(Boolean));
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let nextLabel = 'A';
        for (const char of alphabet) {
          if (!existingLabels.has(char)) { nextLabel = char; break; }
        }

        list.forEach(item => {
          if (item.id === Number(planExId1) || item.id === Number(planExId2)) {
            item.supersetLabel = nextLabel;
            store.put(item);
          }
        });
        tx.oncomplete = () => resolve(true);
      };
    });
  },

  async removeProgramSuperset(dayId, planExId) {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction('program_day_exercises', 'readwrite');
      const store = tx.objectStore('program_day_exercises');
      const index = store.index('dayId');
      index.getAll(Number(dayId)).onsuccess = (e) => {
        const list = e.target.result;
        const target = list.find(x => x.id === Number(planExId));
        if (target && target.supersetLabel) {
          const lbl = target.supersetLabel;
          list.filter(x => x.supersetLabel === lbl).forEach(x => {
            x.supersetLabel = null;
            store.put(x);
          });
        }
        tx.oncomplete = () => resolve(true);
      };
    });
  },

  // Тренировки и история
  async saveWorkout({ dateEpochMillis, durationMinutes, note, startTimeEpochMillis, endTimeEpochMillis, exercises }) {
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['workouts', 'workout_exercises', 'sets'], 'readwrite');
      const wStore = tx.objectStore('workouts');
      const weStore = tx.objectStore('workout_exercises');
      const sStore = tx.objectStore('sets');

      // Проверка на дубликат: не сохранена ли тренировка пару секунд назад
      const wIndex = wStore.index('dateEpochMillis');
      wIndex.openCursor(null, 'prev').onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const last = cursor.value;
          if (last.startTimeEpochMillis === startTimeEpochMillis && startTimeEpochMillis > 0) {
            console.warn('Duplicate workout detected and skipped');
            resolve(last.id);
            return;
          }
        }

        const wReq = wStore.add({
          dateEpochMillis: dateEpochMillis || Date.now(),
          durationMinutes: durationMinutes || 0,
          note: note || '',
          startTimeEpochMillis: startTimeEpochMillis || Date.now(),
          endTimeEpochMillis: endTimeEpochMillis || Date.now(),
          avgHeartRate: null,
          maxHeartRate: null,
          activeCalories: null
        });

        wReq.onsuccess = () => {
          const workoutId = wReq.result;
          exercises.forEach((exItem, exIdx) => {
            const weReq = weStore.add({
              workoutId,
              exerciseId: Number(exItem.exercise.id),
              orderIndex: exIdx,
              supersetLabel: exItem.supersetLabel || null
            });

            weReq.onsuccess = () => {
              const weId = weReq.result;
              exItem.sets.forEach((set, setIdx) => {
                const wKg = parseFloat(set.weight) || 0;
                const r = parseInt(set.reps) || 0;
                sStore.add({
                  workoutExerciseId: weId,
                  weightKg: wKg,
                  reps: r,
                  orderIndex: setIdx,
                  isCompleted: Boolean(set.isCompleted || wKg > 0 || r > 0),
                  setType: set.setType || 'NORMAL'
                });
              });
            };
          });
        };

        tx.oncomplete = () => resolve(true);
        tx.onerror = (err) => reject(err);
      };
    });
  },

  async getAllWorkouts() {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction(['workouts', 'workout_exercises', 'sets', 'exercises'], 'readonly');
      const wStore = tx.objectStore('workouts');
      const weStore = tx.objectStore('workout_exercises');
      const sStore = tx.objectStore('sets');
      const exStore = tx.objectStore('exercises');

      wStore.getAll().onsuccess = (e1) => {
        const workouts = e1.target.result.sort((a, b) => b.dateEpochMillis - a.dateEpochMillis);
        weStore.getAll().onsuccess = (e2) => {
          const workoutExercises = e2.target.result;
          sStore.getAll().onsuccess = (e3) => {
            const sets = e3.target.result;
            exStore.getAll().onsuccess = (e4) => {
              const exMap = new Map(e4.target.result.map(x => [x.id, x]));

              const res = workouts.map(w => {
                const wExercises = workoutExercises
                  .filter(we => we.workoutId === w.id)
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map(we => {
                    const weSets = sets
                      .filter(s => s.workoutExerciseId === we.id)
                      .sort((a, b) => a.orderIndex - b.orderIndex);
                    return {
                      workoutExercise: we,
                      exercise: exMap.get(we.exerciseId) || { name: 'Упражнение', muscleGroup: 'CHEST' },
                      sets: weSets
                    };
                  });
                return { workout: w, exercises: wExercises };
              });
              resolve(res);
            };
          };
        };
      };
    });
  },

  async deleteWorkout(workoutId) {
    const db = await DB.open();
    return new Promise((resolve) => {
      const tx = db.transaction(['workouts', 'workout_exercises', 'sets'], 'readwrite');
      tx.objectStore('workouts').delete(Number(workoutId));
      const weIndex = tx.objectStore('workout_exercises').index('workoutId');
      weIndex.getAll(Number(workoutId)).onsuccess = (e) => {
        const weList = e.target.result;
        weList.forEach(we => {
          tx.objectStore('workout_exercises').delete(we.id);
          const sIndex = tx.objectStore('sets').index('workoutExerciseId');
          sIndex.getAllKeys(we.id).onsuccess = (e2) => {
            e2.target.result.forEach(sId => tx.objectStore('sets').delete(sId));
          };
        });
      };
      tx.oncomplete = () => resolve(true);
    });
  },

  async getExerciseHistory(exerciseId) {
    const workouts = await DB.getAllWorkouts();
    const history = [];
    // workouts отсортированы по убыванию даты, нам для графика нужен хронологический порядок (ASC)
    const reversed = [...workouts].reverse();

    for (const w of reversed) {
      for (const ex of w.exercises) {
        if (Number(ex.exercise.id) === Number(exerciseId)) {
          for (const s of ex.sets) {
            if (s.isCompleted || s.reps > 0 || s.weightKg > 0) {
              history.push({
                date: w.workout.dateEpochMillis,
                weightKg: s.weightKg,
                reps: s.reps,
                setType: s.setType || 'NORMAL'
              });
            }
          }
        }
      }
    }
    return history;
  },

  // Экспорт бэкапа в JSON (1-в-1 совместим с Android версией)
  async exportBackup() {
    const db = await DB.open();
    const exercises = await DB.getExercises();
    const programs = await DB.getPrograms();
    const workouts = await DB.getAllWorkouts();

    const backup = {
      version: 2,
      exportedAt: Date.now(),
      exercises: exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        isCustom: ex.isCustom,
        exerciseType: ex.exerciseType,
        setupTip: ex.setupTip || '',
        executionTip: ex.executionTip || '',
        mistakeTip: ex.mistakeTip || '',
        imagePath: ex.imagePath || ''
      })),
      programs: programs.map(p => ({
        title: p.program.title,
        description: p.program.description || '',
        isActive: p.program.isActive,
        days: p.days.map(d => ({
          name: d.day.name,
          orderIndex: d.day.orderIndex,
          exercises: d.exercises.map(pe => ({
            exerciseName: pe.exercise.name,
            orderIndex: pe.planExercise.orderIndex,
            targetSets: pe.planExercise.targetSets,
            targetReps: pe.planExercise.targetReps,
            targetWeightKg: pe.planExercise.targetWeightKg,
            supersetLabel: pe.planExercise.supersetLabel || null
          }))
        }))
      })),
      workouts: workouts.map(w => ({
        dateEpochMillis: w.workout.dateEpochMillis,
        durationMinutes: w.workout.durationMinutes,
        note: w.workout.note || '',
        startTimeEpochMillis: w.workout.startTimeEpochMillis,
        endTimeEpochMillis: w.workout.endTimeEpochMillis,
        avgHeartRate: w.workout.avgHeartRate || null,
        maxHeartRate: w.workout.maxHeartRate || null,
        activeCalories: w.workout.activeCalories || null,
        exercises: w.exercises.map(ex => ({
          exerciseName: ex.exercise.name,
          muscleGroup: ex.exercise.muscleGroup,
          orderIndex: ex.workoutExercise.orderIndex,
          supersetLabel: ex.workoutExercise.supersetLabel || null,
          sets: ex.sets.map(s => ({
            weightKg: s.weightKg,
            reps: s.reps,
            orderIndex: s.orderIndex,
            isCompleted: s.isCompleted,
            setType: s.setType || 'NORMAL'
          }))
        }))
      }))
    };

    return JSON.stringify(backup, null, 2);
  },

  // Импорт бэкапа из JSON
  async importBackup(jsonString) {
    const data = JSON.parse(jsonString);
    const db = await DB.open();

    // 1. Упражнения
    const existingExercises = await DB.getExercises();
    const exMap = new Map(existingExercises.map(x => [x.name.toLowerCase().trim(), x]));

    if (Array.isArray(data.exercises)) {
      for (const ex of data.exercises) {
        const key = ex.name.toLowerCase().trim();
        if (!exMap.has(key)) {
          const id = await DB.addExercise({
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            isCustom: true,
            exerciseType: ex.exerciseType || 'WEIGHT_AND_REPS',
            setupTip: ex.setupTip || '',
            executionTip: ex.executionTip || '',
            mistakeTip: ex.mistakeTip || '',
            imagePath: ex.imagePath || ''
          });
          exMap.set(key, { ...ex, id });
        }
      }
    }

    // 2. Программы
    if (Array.isArray(data.programs)) {
      for (const p of data.programs) {
        const pId = await DB.createProgram(p.title, p.description || '');
        if (p.isActive) await DB.setActiveProgram(pId);

        if (Array.isArray(p.days)) {
          for (const d of p.days) {
            await DB.addDayToProgram(pId, d.name);
            // Получаем только что добавленный день
            const currentProgs = await DB.getPrograms();
            const createdProg = currentProgs.find(x => x.program.id === pId);
            const createdDay = createdProg.days.find(x => x.day.name === d.name);

            if (createdDay && Array.isArray(d.exercises)) {
              for (const pe of d.exercises) {
                const ex = exMap.get((pe.exerciseName || '').toLowerCase().trim());
                if (ex) {
                  await DB.addExerciseToDay(
                    createdDay.day.id,
                    ex.id,
                    pe.targetSets || 3,
                    pe.targetReps || '8-12',
                    pe.targetWeightKg || null
                  );
                }
              }
            }
          }
        }
      }
    }

    // 3. Тренировки
    let importedWorkoutsCount = 0;
    if (Array.isArray(data.workouts)) {
      for (const w of data.workouts) {
        const exercisesFormatted = (w.exercises || []).map(ex => {
          let exerciseEntity = exMap.get((ex.exerciseName || '').toLowerCase().trim());
          if (!exerciseEntity) {
            exerciseEntity = { id: 1, name: ex.exerciseName, muscleGroup: ex.muscleGroup || 'CHEST' };
          }
          return {
            exercise: exerciseEntity,
            supersetLabel: ex.supersetLabel || null,
            sets: (ex.sets || []).map(s => ({
              weight: s.weightKg,
              reps: s.reps,
              isCompleted: s.isCompleted,
              setType: s.setType || 'NORMAL'
            }))
          };
        });

        await DB.saveWorkout({
          dateEpochMillis: w.dateEpochMillis,
          durationMinutes: w.durationMinutes,
          note: w.note || '',
          startTimeEpochMillis: w.startTimeEpochMillis,
          endTimeEpochMillis: w.endTimeEpochMillis,
          exercises: exercisesFormatted
        });
        importedWorkoutsCount++;
      }
    }

    return importedWorkoutsCount;
  }
};
