// Строки интерфейса. Язык один — русский; механика data-t осталась, чтобы
// все подписи лежали в одном месте на все страницы: аквариум, съёмка,
// раскраски, управление и правила.
//
//   I18N.t('menu.feed.title')            — строка
//   I18N.t('home.fish', {n: 3})          — с подстановкой
//   I18N.plural(3, 'fish')               — рыбка / рыбки / рыбок
//   I18N.apply(root)                     — раскладывает переводы по data-t
//
// В разметке:
//   <b data-t="menu.feed.title"></b>     — текст
//   <input data-t-ph="home.code.hint">   — placeholder
//   <button data-t-title="menu.close">   — подсказка title
//   <img data-t-alt="cap.photo">         — подпись alt
(function () {
  'use strict';

  var KEY = 'aqua.lang';
  var LANGS = ['ru'];

  var DICT = {
    ru: {
      'lang.name': 'Русский',

      // ── главная ──
      'home.title': 'Мои аквариумы',
      'home.lead': 'Распечатай шаблон, раскрась фломастерами, сфотографируй — и фигура оживёт. У каждого ребёнка может быть свой аквариум.',
      'home.empty': 'Пока ни одного аквариума. Создай первый — это займёт секунду.',
      'home.new': 'Новый аквариум',
      'home.bycode.title': 'Открыть аквариум по коду',
      'home.bycode.hint': 'Код нужен только на новом устройстве — на этом аквариумы запоминаются сами. Подойдут и пять цифр из «Открыть на другом экране».',
      'home.pin.bad.title': 'Эти цифры не подошли',
      'home.pin.bad.text': 'Код из пяти цифр живёт 5 минут — возможно, он истёк. Попроси показать его заново: на телефоне «Открыть на другом экране» → «Код для телевизора».',
      'home.pin.many.title': 'Слишком много попыток',
      'home.pin.many.text': 'Подожди немного и попробуй ещё раз.',
      'home.bycode.placeholder': 'например, mk4dp7wq2f',
      'home.bycode.open': 'Открыть',
      // Четыре шага для того, кто пришёл впервые: увидел рилс — а дальше что?
      'home.how.title': 'Как это работает',
      'home.how.s0': 'Создай аквариум',
      'home.how.s1': 'Распечатай раскраску',
      'home.how.s2': 'Раскрась фломастерами',
      'home.how.s3': 'Сфотографируй телефоном',
      'home.how.s4': 'Открой на большом экране по коду',
      'home.how.demo': '⭐ Посмотреть живой аквариум',
      'home.how.demo.sub': 'общая витрина — фигуры уже двигаются',
      'home.card.kill': 'Убрать аквариум',
      'home.card.empty': 'тут пока пусто',
      'home.terms': 'Правила и данные ↗',
      'terms.back': '← к аквариумам',
      'home.footer.important': 'Важно.',
      'home.footer.text': ' Аккаунтов нет: по коду аквариум смотрят, по паролю управляют, оба хранит этот браузер. Подробности — в правилах.',

      'home.create.title': 'Новый аквариум',
      'home.create.text': 'Назови, чтобы отличать в списке — например, по имени ребёнка.',
      'home.create.value': 'Аквариум',
      'home.create.ok': 'Создать',
      'home.created.title': 'Аквариум создан',
      'home.created.text': 'По коду аквариум открывают и смотрят, по паролю им управляют. На этом устройстве оба уже сохранены — они всегда под рукой в меню аквариума, записывать их прямо сейчас не обязательно. Но где-то сохранить стоит: почты и аккаунта тут нет, восстановить их будет негде.',
      'home.created.code': 'Код аквариума',
      'home.created.pass': 'Пароль',
      'home.created.ok': 'Сохранил, поехали',
      'home.create.fail.title': 'Аквариум не создался',
      'home.create.fail.text': 'Похоже, сервер не отвечает. Проверь, запущен ли node server.js.',
      'home.remove.title': 'Убрать «{name}»?',
      'home.remove.text': 'Из списка — аквариум останется на сервере, вернёшь его по коду {code}. Совсем — {what} уедут в корзину на сервере, и по коду он больше не откроется.',
      'home.remove.whatEmpty': 'аквариум уедет',
      'home.remove.cancel': 'Отмена',
      'home.remove.forget': 'Убрать из моего списка',
      'home.remove.delete': 'Удалить аквариум совсем',
      'home.remove.pass.title': 'Пароль от «{name}»',
      'home.remove.pass.text': 'Удалить аквариум совсем можно только с паролем. Если пароля нет — убери аквариум из своего списка, он останется у хозяина.',
      'home.badcode.title': 'Код не подходит',
      'home.badcode.text': 'Код аквариума — это ровно 10 символов, буквы и цифры. Проверь, не потерялся ли знак.',

      // ── меню аквариума ──
      'menu.tank': 'Аквариум',
      'menu.copied': 'ссылка скопирована',
      'menu.pass': '🔑 пароль',
      'menu.pass.set': '🔓 задать пароль',
      'menu.pass.title': 'Пароль аквариума',
      'menu.rename.hint': 'Переименовать аквариум',
      'menu.close': 'Закрыть меню',
      'menu.back': '← назад',
      'menu.hint': 'нажми в любом месте — покажу меню',
      'menu.capture.title': 'Сфотографировать фигуру',
      'menu.capture.sub': 'раскрашенный лист оживает в аквариуме',
      'menu.pack.title': 'Запустить готовую фигуру',
      'menu.pack.sub': 'из набора, без раскрашивания',
      'menu.feed.title': 'Подзарядить',
      'menu.feed.sub': 'фигуры соберутся на подзарядку',
      'menu.print.title': 'Раскраски для печати',
      'menu.print.sub': 'шаблоны фигур на обычном листе A4',
      'menu.bg.title': 'Сменить фон',
      'menu.bg.sub': 'картинка, на фоне которой двигаются фигуры',
      'menu.fish.title': 'Убрать фигуры',
      'menu.fish.sub': 'удалить лишних из аквариума',
      'menu.fish.sub.pass': 'удалить лишних — нужен пароль',
      'menu.home.title': 'Мои аквариумы',
      'menu.home.sub': 'другие аквариумы — и завести новый',
      'menu.picker.title': 'Кого запустить?',
      'menu.picker.sub': 'Фигура из набора появится в аквариуме сразу',
      'menu.picker.drawing': 'рисую…',
      'menu.picker.failed': 'не вышло',
      'menu.picker.nopack': 'Набор не собран',
      'menu.rename.title': 'Название аквариума',
      'menu.rename.text': 'Видно только тебе — в списке аквариумов и в заголовке этой страницы.',
      'menu.rename.ok': 'Сохранить',
      'menu.rename.fail': 'Не переименовалось',
      'menu.access.title': 'Доступ к аквариуму',
      'menu.access.text': 'По коду аквариум смотрят, по паролю им управляют. Оба сохранены в этом браузере — если почистить его данные, восстановить их будет негде.',
      'menu.access.done': 'Готово',
      'menu.access.change': 'Сменить пароль',
      'menu.newpass.title': 'Новый пароль аквариума',
      'menu.newpass.first': 'Пароль для аквариума',
      'menu.newpass.text': 'От 4 знаков. Цифры удобнее: их диктуют по телефону и набирают на пульте. Старый пароль перестанет работать на всех устройствах.',
      'menu.newpass.ph': 'новый пароль',
      'menu.newpass.short.title': 'Слишком короткий',
      'menu.newpass.short.text': 'Нужно хотя бы четыре знака.',
      'menu.newpass.saved.title': 'Пароль сохранён',
      'menu.newpass.saved.text': 'Запиши его: восстановить пароль негде. Код аквариума не менялся — по нему по-прежнему смотрят.',
      'menu.newpass.saved.field': 'Новый пароль',
      'menu.newpass.saved.ok': 'Записал',
      'menu.oldpass.title': 'Старый пароль',
      'menu.oldpass.text': 'Сменить пароль может тот, кто знает нынешний.',
      'menu.fail.title': 'Не вышло',
      'menu.fail.server': 'Сервер не отвечает.',
      'menu.fail.pass': 'Сервер не принял пароль.',
      'menu.link.title': 'Ссылка на аквариум',
      'tank.doctitle': 'Аквариум',
      'tank.frame.print': 'Раскраски для печати',
      'tank.frame.bg': 'Фон аквариума',
      'tank.frame.fish': 'Фигуры аквариума',
      'tank.frame.capture': 'Съёмка фигуры',
      'tank.crash': '<b>Сцена не запустилась</b><br>{msg}',
      'menu.link.text': 'Скопировать сам не смог — забери отсюда. По ней аквариум откроется на любом устройстве.',
      'menu.link.ok': 'Готово',
      // «Открыть на другом экране»: телефон снимает, большой экран показывает —
      // весь перенос между устройствами собран в одном пункте.
      'menu.share.title': 'Открыть на другом экране',
      'menu.share.sub': 'QR и ссылка: телевизор, планшет, второй телефон',
      'menu.share.hint': 'Наведи камеру телефона — аквариум откроется там',
      'menu.share.copy': 'Скопировать ссылку',
      'menu.share.copy.sub': 'отправь её в мессенджер — и открой где угодно',
      'menu.share.send': 'Отправить ссылку…',
      'menu.share.send.sub': 'через то, чем ты обычно делишься',
      'menu.share.pin': 'Код для телевизора',
      'menu.share.pin.sub': 'пять цифр — их легко набрать пультом',
      'menu.share.pin.text': 'Набери эти цифры на телевизоре — на главной странице, в поле «Открыть аквариум по коду». Код живёт 5 минут.',
      'menu.share.pin.fail': 'Код не выдался — попробуй ещё раз',
      // Витрина: общий аквариум для знакомства. Меню здесь урезано, чтобы
      // гость не отправил рыбку ребёнка в чужой аквариум.
      'demo.title': '🫧 Это витрина',
      'demo.text': 'Общий аквариум для знакомства — фигуры тут ничьи. Свои живут в собственном аквариуме: завести его — секунда, раскраски и съёмка будут там.',
      'demo.own': 'Завести свой аквариум',
      'demo.own.sub': 'печать, съёмка и свои фигуры — там',

      'tank.loading': 'Наполняю аквариум…',
      'tank.nofish': 'фигур пока нет',
      'tank.notank': 'Аквариум не найден — возможно, его удалили или в коде опечатка.',
      'tank.tolist': 'К моим аквариумам →',
      'tank.noserver': 'Сервер недоступен. Запусти <code>node server.js</code> и обнови страницу.',
      'tank.nopick': 'Не выбран аквариум.',
      'tank.home': 'На главную →',

      // ── съёмка ──
      'cap.title': '⭐ Оживи свою фигуру!',
      'cap.sub': 'Раскрась фигуру на листе, сфотографируй — и она появится в аквариуме',
      'cap.back': '← в аквариум',
      'cap.shoot': 'Сфотографировать лист',
      'cap.hint': 'Положи лист на стол, чтобы все четыре чёрных квадрата попали в кадр',
      'cap.qr': 'Удобнее с телефона: наведи камеру на код — съёмка откроется там',
      'cap.searching': 'Ищу фигуру на фото…',
      'cap.reviving': 'фигура оживает…',
      'cap.release': 'Выпустить в аквариум! 🌊',
      'cap.retake': 'Переснять',
      'cap.boost': 'Ярче цвета',
      'cap.done': 'Фигура отправилась в аквариум!',
      'cap.done.sub': 'Посмотри на большой экран — она уже там',
      'cap.done.sub.embed': 'Закрой окно — она уже двигается',
      'cap.again': 'Сфотографировать ещё одну',
      'cap.retry': 'Попробовать ещё раз',
      'cap.sending': 'Фигура отправляется в аквариум…',
      'cap.err.manifest': 'Не загрузился manifest.json — проверь, что сервер запущен.',
      'cap.err.photo': 'Не удалось открыть фото, попробуй ещё раз.',
      'cap.itis': 'Это {name}!',
      'cap.photo': 'Твоя фигура',
      'cap.err.nofish': 'Фигура потерялась — сфотографируй лист заново.',
      'cap.err.status': 'Сервер ответил {code}',
      'cap.err.markers': 'Нашёл меток: {n} из 4. Сфотографируй весь лист целиком, при хорошем свете и без бликов — все четыре чёрных квадрата должны быть в кадре.',
      'cap.err.send': 'Не получилось отправить: {msg}',
      'cap.draw': 'Нарисовать вместо фото',
      'cap.draw.size': 'Толщина',
      'cap.draw.fill': '🪣 Залить',
      'cap.draw.erase': '⬜ Ластик',
      'cap.draw.clear': 'Как было',
      'cap.draw.hint': 'Раскрась фигуру, придумай ей лицо и знаки — всё это окажется на ней в аквариуме',
      'cap.draw.done': 'Предпросмотр →',
      'cap.draw.back': '← Назад',

      // ── управление ──
      'adm.doctitle': 'Аквариум — управление фигурами',
      'adm.title': 'управление',
      'adm.tank': 'Аквариум',
      'adm.capture': 'Съёмка',
      'adm.print': 'Раскраски',
      'adm.home': 'Мои аквариумы',
      'adm.pass': 'Пароль:',
      'adm.pass.change': 'Сменить пароль',
      'adm.pass.show': 'Показать пароль',
      'adm.bg': 'Фон аквариума',
      'adm.bg.one': 'Фон {n}',
      'adm.bg.own': 'Свой фон',
      'adm.bg.add': 'свой фон',
      'adm.bg.busy': 'загружаю…',
      'adm.bg.del': 'Удалить этот фон',
      'adm.bg.del.title': 'Удалить фон?',
      'adm.bg.del.text': 'Файл будет стёрт безвозвратно — в отличие от фигур, копии не остаётся.',
      'adm.bg.fail': 'Фон не загрузился',
      'adm.bg.err.read': 'не удалось прочитать файл',
      'adm.bg.err.img': 'это не картинка',
      'adm.fish.count': 'фигур: {n}',
      'adm.fish.pack': 'из набора · ',
      'adm.fish.del': 'Удалить',
      'adm.fish.del.title': 'Удалить фигуру?',
      'adm.fish.del.pack': 'Она уйдёт из аквариума. Запустить такую же можно снова в любой момент.',
      'adm.fish.del.painted': 'Рисунок переедет в корзину на сервере — если что, его можно вернуть.',
      'adm.empty': 'В аквариуме пока нет нарисованных фигур.',
      'adm.empty.sub': 'Раскрась лист и сфотографируй его с телефона — ссылка «Съёмка» наверху.',
      'adm.clear': 'Удалить все фигуры',
      'adm.clear.title': 'Очистить аквариум?',
      'adm.clear.text': 'Из аквариума уйдут все фигуры — {n} шт. Рисунки переедут в корзину на сервере, вернуть их можно, но из списка они пропадут.',
      'adm.noserver': 'сервер недоступен — запусти node server.js',
      'adm.gate.title': '🔒 Управление под паролем',
      'adm.gate.text': 'Смотреть аквариум можно и без него — пароль нужен, чтобы менять фон, переименовывать и удалять фигуры.',
      'adm.gate.ph': 'пароль',
      'adm.gate.enter': 'Войти',
      'adm.gate.back': '← в аквариум',
      'adm.gate.bad': 'Пароль не подошёл.',
      'adm.gate.old': 'Пароль устарел — введи новый.',
      'adm.gate.many': 'Слишком много попыток, подожди минуту.',
      'adm.gate.wait': 'Слишком много попыток. Подожди {n} с.',
      'adm.gate.noserver': 'Сервер не отвечает.',
      'adm.gate.need': 'Нужен пароль аквариума.',

      // ── раскраски ──
      'print.title': 'Раскраски — шаблоны для печати',
      'print.home': '← мои аквариумы',
      'print.all': 'Печать всех',
      'print.pdf': 'Скачать PDF',
      'print.pdf.file': 'раскраски-аквариум.pdf',
      'print.one': 'Печать этого листа',
      'print.note': 'Печатай на обычной А4 в альбомной ориентации, масштаб 100% (без «вписать в страницу») — размеры меток важны для распознавания. Чёрные квадраты в углах не закрашивать!',
      'print.note2': 'Принтера рядом нет? Скачай все листы одним PDF (кнопка вверху) и отправь туда, где принтер найдётся. А пока запусти в аквариум готовую фигуру из меню.',
      'print.nomanifest': 'Не загрузился manifest.json — проверь, что сервер запущен.',

      // ── общее ──
      'pass.ask.title': 'Пароль аквариума',
      'pass.ask.text': 'Пароль спрашивают только на управление. Смотреть аквариум можно и без него.',
      'pass.ask.ph': 'например, 481902',
      'pass.ask.ok': 'Войти',
      'pass.bad.title': 'Пароль не подошёл',
      'pass.bad.text': 'Проверь пароль — тот, что показали при создании аквариума.',
      'pass.many.title': 'Слишком много попыток',
      'pass.many.text': 'Подожди {n} с и попробуй снова.',
      'modal.cancel': 'Отмена',
      'modal.delete': 'Удалить',
      'modal.ok': 'Понятно',
      'modal.save': 'Сохранить',
      'modal.copyHint': 'Нажми, чтобы скопировать',
      'modal.copied': 'скопировано'
    },
  };

  // Множественное число. В русском и польском три формы, в английском две.
  // Считаем сами: Intl.PluralRules есть не везде, где эта игра запускается,
  // а правил тут всего два языка.
  var PLURALS = {
    ru: { fish: ['фигура', 'фигуры', 'фигур'] }
  };

  function pluralIndex(lang, n) {
    // 1 — один, 2–4 — два, остальное — много
    var t = n % 10, h = n % 100;
    if (t === 1 && h !== 11) return 0;
    if (t >= 2 && t <= 4 && (h < 12 || h > 14)) return 1;
    return 2;
  }

  // Сайт русский. Сохранённый выбор из прежних версий с переключателем
  // языков не читаем: других словарей больше нет.
  function pick() { return 'ru'; }

  var lang = pick();

  function t(key, vars) {
    var s = (DICT[lang] && DICT[lang][key]) || DICT.ru[key] || key;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, name) {
      return vars[name] === undefined ? m : vars[name];
    });
  }

  function plural(n, what) {
    var forms = (PLURALS[lang] || PLURALS.ru)[what];
    return n + ' ' + forms[pluralIndex(lang, n)];
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll('[data-t]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-t'));
    });
    root.querySelectorAll('[data-t-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-t-html'));
    });
    root.querySelectorAll('[data-t-ph]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-t-ph'));
    });
    root.querySelectorAll('[data-t-title]').forEach(function (el) {
      el.title = t(el.getAttribute('data-t-title'));
    });
    root.querySelectorAll('[data-t-alt]').forEach(function (el) {
      el.alt = t(el.getAttribute('data-t-alt'));
    });
    if (document.documentElement) document.documentElement.lang = lang;
  }

  function set(next) {
    if (!DICT[next] || next === lang) return;
    lang = next;
    try { localStorage.setItem(KEY, next); } catch (e) { /* приватный режим */ }
    apply(document);
    window.dispatchEvent(new CustomEvent('aqua:lang', { detail: next }));
  }

  // Переключателя языков нет: страницы ещё зовут mount() на старом месте,
  // просто прячем пустой элемент.
  function mount(host) {
    if (host) host.hidden = true;
    return null;
  }

  // Соседние вкладки и врезки внутри меню аквариума: язык поменяли в одном
  // месте — меняется везде, где открыт тот же сайт.
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY || !e.newValue || e.newValue === lang) return;
    lang = e.newValue;
    apply(document);
    window.dispatchEvent(new CustomEvent('aqua:lang', { detail: lang }));
  });

  window.I18N = {
    get lang() { return lang; },
    t: t,
    plural: plural,
    apply: apply,
    set: set,
    mount: mount,
    langs: LANGS
  };

  // Раскладываем переводы, как только разметка готова.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { apply(document); });
  } else {
    apply(document);
  }
})();
