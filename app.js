// app.js - Robust CSV loading + debug helpers
// Replace GAS_ENDPOINT if you have a Google Apps Script endpoint to receive results
const GAS_ENDPOINT = 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOY_ID/exec';

let questions = [];
let quizQuestions = [];
let state = { current: 0, answers: {}, timeLeft: 0, timerInterval: null };

document.addEventListener('DOMContentLoaded', () => {
  // set year if element exists
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  initUI();
  // Try load questions immediately
  quizDebug.loadQuestionsNow();
});

function updateStatus(text){
  const s = document.getElementById('status');
  if(s) s.textContent = text;
}

/* ---------- Robust CSV loading ---------- */
async function loadQuestions() {
  updateStatus('Đang load câu hỏi...');
  const tries = [
    'questions.csv?v=' + Date.now(),
    './questions.csv?v=' + Date.now(),
    '/questions.csv?v=' + Date.now()
  ];

  let csvText = null;
  let lastErr = null;
  for(const url of tries){
    try{
      console.log('[Quiz] fetch', url);
      const resp = await fetch(url, { cache: 'no-store' });
      console.log('[Quiz] status', url, resp.status);
      if(!resp.ok){
        lastErr = new Error('Fetch failed ' + resp.status + ' for ' + url);
        continue;
      }
      csvText = await resp.text();
      // strip BOM
      if(csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);
      break;
    } catch(e){
      console.warn('[Quiz] fetch error', url, e);
      lastErr = e;
    }
  }

  if(!csvText){
    console.error('[Quiz] Không load được questions.csv:', lastErr);
    updateStatus('Đã load 0 câu hỏi. (Không tìm thấy questions.csv — xem Console)');
    questions = [];
    return;
  }

  // parse CSV to objects
  try{
    const parsed = parseCSVtoObjects(csvText);
    if(!Array.isArray(parsed) || parsed.length === 0){
      console.warn('[Quiz] CSV parsed but empty or bad header');
      updateStatus('Đã load 0 câu hỏi. File CSV rỗng hoặc header sai.');
      console.log('[Quiz] CSV preview:', csvText.slice(0,800));
      questions = [];
      return;
    }
    questions = parsed;
    updateStatus(`Đã load ${questions.length} câu hỏi.`);
    console.log('[Quiz] questions loaded', questions.length, questions.slice(0,5));
  }catch(e){
    console.error('[Quiz] Lỗi parse CSV', e);
    updateStatus('Đã load 0 câu hỏi. Lỗi khi phân tích CSV (xem Console).');
    console.log('[Quiz] CSV raw preview:', csvText.slice(0,800));
    questions = [];
  }
}

// tries to map CSV into objects using header row; tolerant to header name case/order
function parseCSVtoObjects(text){
  const lines = text.split(/\r?\n/).map(l => l.replace(/\u00A0/g,' ').trim()).filter(Boolean);
  if(lines.length === 0) return [];
  const headerParts = csvLineToArray(lines.shift()).map(h => h.trim());
  const rows = lines.map(line => {
    const cols = csvLineToArray(line);
    const obj = {};
    for(let i=0;i<cols.length;i++){
      const key = headerParts[i] || `col${i}`;
      obj[key] = cols[i] || '';
    }
    // normalize into expected shape
    return {
      id: obj['id'] || obj['ID'] || obj['col0'] || ('q' + Math.random().toString(36).slice(2,8)),
      question: obj['question'] || obj['Question'] || obj['col1'] || '',
      A: obj['A'] || obj['a'] || obj['col2'] || '',
      B: obj['B'] || obj['b'] || obj['col3'] || '',
      C: obj['C'] || obj['c'] || obj['col4'] || '',
      D: obj['D'] || obj['d'] || obj['col5'] || '',
      answer: (obj['answer'] || obj['ANSWER'] || obj['col6'] || '').toString().trim()
    };
  });
  // filter out rows with empty question text
  return rows.filter(r => r.question && r.question.length > 0);
}

// parse one CSV line supporting quotes and escaped quotes
function csvLineToArray(line){
  const res = [];
  let cur = '';
  let inQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"'){
      if(inQuotes && i+1 < line.length && line[i+1] === '"'){
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if(ch === ',' && !inQuotes){
      res.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  res.push(cur);
  return res;
}

/* ---------- UI & Quiz lifecycle ---------- */
function initUI(){
  document.getElementById('startBtn')?.addEventListener('click', () => {
    const n = Number(document.getElementById('numQuestions').value) || 10;
    const t = Number(document.getElementById('timeLimit').value) || 15;
    startQuiz(n,t);
  });
  document.getElementById('demoBtn')?.addEventListener('click', () => {
    quizDebug.injectDemoQuestions();
    startQuiz(3,5);
  });
  document.getElementById('prevBtn')?.addEventListener('click', () => { if(state.current>0){ state.current--; renderQuestion(); updateProgress(); } });
  document.getElementById('nextBtn')?.addEventListener('click', () => { if(state.current < quizQuestions.length-1){ state.current++; renderQuestion(); updateProgress(); } });
  document.getElementById('submitBtn')?.addEventListener('click', submitQuiz);
  document.getElementById('restartBtn')?.addEventListener('click', ()=> {
    document.getElementById('result').classList.add('hidden');
    document.getElementById('setup').classList.remove('hidden');
  });
}

function startQuiz(numQuestions, timeMinutes){
  if(!Array.isArray(questions) || questions.length === 0){
    alert('Chưa có câu hỏi. Kiểm tra file questions.csv hoặc mở Console.');
    console.warn('[Quiz] startQuiz aborted, questions empty');
    return;
  }
  quizQuestions = shuffleArray(questions.slice()).slice(0, Math.min(numQuestions, questions.length));
  state = { current:0, answers:{}, timeLeft: Math.max(1, Math.floor(timeMinutes))*60, timerInterval:null };
  document.getElementById('setup').classList.add('hidden');
  document.getElementById('quiz').classList.remove('hidden');
  document.getElementById('result').classList.add('hidden');
  updateProgress();
  renderQuestion();
  document.getElementById('timeRemaining').textContent = formatTime(state.timeLeft);
  startTimer();
}

function renderQuestion(){
  const q = quizQuestions[state.current];
  const qa = document.getElementById('questionArea');
  qa.innerHTML = '';
  if(!q){
    qa.innerHTML = '<p>Không tìm thấy câu hỏi.</p>';
    return;
  }
  const qdiv = document.createElement('div');
  qdiv.className = 'question';
  qdiv.innerHTML = `<h3>Câu ${state.current+1} / ${quizQuestions.length}</h3><p>${escapeHtml(q.question)}</p>`;
  qa.appendChild(qdiv);

  const opts = document.createElement('div');
  opts.className = 'options';
  ['A','B','C','D'].forEach(letter => {
    const label = document.createElement('label');
    const checked = state.answers[q.id] === letter ? 'checked' : '';
    label.innerHTML = `<input type="radio" name="opt" value="${letter}" ${checked}/> <strong>${letter}</strong>. ${escapeHtml(q[letter] || '')}`;
    label.querySelector('input').addEventListener('change', () => { state.answers[q.id] = letter; });
    opts.appendChild(label);
  });
  qa.appendChild(opts);
  document.getElementById('prevBtn').disabled = state.current === 0;
  document.getElementById('nextBtn').disabled = state.current >= quizQuestions.length - 1;
}

function updateProgress(){
  const idx = state.current + 1;
  const total = quizQuestions.length || 1;
  const pct = Math.round((idx / total) * 100);
  const pt = document.getElementById('progressText');
  if(pt) pt.textContent = `Câu ${idx}/${total}`;
  const bar = document.getElementById('progressBar');
  if(bar) bar.style.width = `${pct}%`;
}

function startTimer(){
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(()=> {
    if(state.timeLeft <= 0){ clearInterval(state.timerInterval); alert('Hết giờ — tự động nộp bài'); submitQuiz(); return; }
    state.timeLeft--;
    const te = document.getElementById('timeRemaining');
    if(te) te.textContent = formatTime(state.timeLeft);
  }, 1000);
}

function submitQuiz(){
  clearInterval(state.timerInterval);
  const submitBtn = document.getElementById('submitBtn');
  if(submitBtn) submitBtn.disabled = true;

  let correct = 0; const answersArray = [];
  quizQuestions.forEach(q => {
    const selected = state.answers[q.id] || '';
    if(selected && selected === q.answer) correct++;
    answersArray.push({ id: q.id, selected });
  });

  const name = (document.getElementById('candidateName')?.value || 'Anonymous').trim();
  const email = (document.getElementById('candidateEmail')?.value || '').trim();
  document.getElementById('quiz').classList.add('hidden');
  document.getElementById('result').classList.remove('hidden');
  document.getElementById('score').textContent = `Bạn được ${correct} / ${quizQuestions.length}`;

  const payload = { timestamp: new Date().toISOString(), name, email, score: correct, total: quizQuestions.length, answers: answersArray };
  if(GAS_ENDPOINT && GAS_ENDPOINT.indexOf('REPLACE_WITH') === -1){
    fetch(GAS_ENDPOINT, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
      .then(r => r.json()).then(res => console.log('[Quiz] GAS response', res)).catch(e => console.warn('[Quiz] GAS send failed', e));
  } else {
    console.warn('[Quiz] GAS_ENDPOINT not configured; result shown locally.');
  }
}

/* ---------- Utilities ---------- */
function shuffleArray(a){ for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function formatTime(sec){ const m=Math.floor(sec/60); const s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- Debug helpers ---------- */
const quizDebug = {
  loadQuestionsNow: () => loadQuestions(),
  injectDemoQuestions: () => {
    window.questions = [
      { id:'q1', question:'Thủ đô Việt Nam là?', A:'Hà Nội', B:'TP HCM', C:'Đà Nẵng', D:'Hải Phòng', answer:'A' },
      { id:'q2', question:'Ngôn ngữ web chính?', A:'Python', B:'JavaScript', C:'Go', D:'Rust', answer:'B' },
      { id:'q3', question:'HTML dùng để?', A:'Cấu trúc', B:'DB', C:'OS', D:'Mạng', answer:'A' }
    ];
    console.log('Demo questions injected. Gọi startQuiz(3,15) để test.');
  },
  startQuiz, questions, quizQuestions, state
};
window.quizDebug = quizDebug;
console.log('[Quiz] app.js loaded. Dùng quizDebug.loadQuestionsNow() để thử load; quizDebug.injectDemoQuestions() để test UI.');
