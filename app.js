// app.js - UI-enhanced version (no admin modal)
// Update GAS_ENDPOINT to your Google Apps Script Web App if needed
const GAS_ENDPOINT = 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOY_ID/exec';

let questions = [];
let quizQuestions = [];
let state = { current:0, answers:{}, timeLeft:0, timerInterval:null };

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  initUI();
  loadCSV('questions.csv').then(data=>{
    questions = data;
    document.getElementById('status').textContent = `Đã load ${questions.length} câu hỏi.`;
  }).catch(err=>{
    console.error('Failed to load CSV', err);
    document.getElementById('status').textContent = 'Lỗi load câu hỏi (Console).';
  });
});

function initUI(){
  const startBtn = document.getElementById('startBtn');
  const demoBtn = document.getElementById('demoBtn');
  const restartBtn = document.getElementById('restartBtn');

  startBtn?.addEventListener('click', () => {
    const n = Number(document.getElementById('numQuestions').value) || 10;
    const t = Number(document.getElementById('timeLimit').value) || 15;
    startQuiz(n, t);
  });

  demoBtn?.addEventListener('click', () => {
    // quick demo: 3 questions 5 minutes
    startQuiz(3, 5);
  });

  restartBtn?.addEventListener('click', () => {
    document.getElementById('result').classList.add('hidden');
    document.getElementById('setup').classList.remove('hidden');
  });
}

/* CSV loader (robust for quoted fields) */
function loadCSV(url){
  return fetch(url).then(r => {
    if(!r.ok) throw new Error('Fetch failed: ' + r.status);
    return r.text();
  }).then(parseCSV);
}

function parseCSV(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(lines.length===0) return [];
  // assume header row present
  lines.shift();
  return lines.map(line => {
    const cols = csvLineToArray(line);
    return {
      id: (cols[0]||'').trim(),
      question: (cols[1]||'').trim(),
      A: (cols[2]||'').trim(),
      B: (cols[3]||'').trim(),
      C: (cols[4]||'').trim(),
      D: (cols[5]||'').trim(),
      answer: (cols[6]||'').trim()
    };
  });
}

function csvLineToArray(line){
  const out = []; let cur=''; let inQ=false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"'){
      if(inQ && i+1<line.length && line[i+1]==='"'){ cur+='"'; i++; }
      else inQ = !inQ;
    } else if(ch === ',' && !inQ){ out.push(cur); cur=''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/* Quiz lifecycle with improved UI updates */
function startQuiz(numQuestions, timeMinutes){
  if(!Array.isArray(questions) || questions.length===0){ alert('Chưa có câu hỏi. Kiểm tra file questions.csv'); return; }
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
  const area = document.getElementById('questionArea');
  area.innerHTML = '';
  if(!q){ area.innerHTML = '<p>Không tìm thấy câu hỏi.</p>'; return; }

  const qWrap = document.createElement('div'); qWrap.className='question';
  qWrap.innerHTML = `<p class="qtext">${escapeHtml(q.question)}</p>`;
  area.appendChild(qWrap);

  const opts = document.createElement('div'); opts.className='options';
  ['A','B','C','D'].forEach(letter=>{
    const lbl = document.createElement('label');
    const checked = state.answers[q.id] === letter ? 'checked' : '';
    lbl.innerHTML = `<input type="radio" name="opt" value="${letter}" ${checked} aria-label="Đáp án ${letter}"> <strong>${letter}.</strong> ${escapeHtml(q[letter] || '')}`;
    lbl.addEventListener('click', ()=> {
      state.answers[q.id] = letter;
      // smooth visual feedback: add selected class
      // remove selected class from siblings
      Array.from(opts.querySelectorAll('label')).forEach(l=>l.classList.remove('selected'));
      lbl.classList.add('selected');
    });
    opts.appendChild(lbl);
  });
  area.appendChild(opts);

  // nav handlers
  document.getElementById('prevBtn').onclick = () => { if(state.current>0){ state.current--; renderQuestion(); updateProgress(); } };
  document.getElementById('nextBtn').onclick = () => { if(state.current < quizQuestions.length-1){ state.current++; renderQuestion(); updateProgress(); } };
  document.getElementById('submitBtn').onclick = submitQuiz;
  updateProgress();
}

function updateProgress(){
  const idx = state.current + 1;
  const total = quizQuestions.length || 1;
  const pct = Math.round((idx-1)/(total) * 100);
  document.getElementById('progressText').textContent = `Câu ${idx}/${total}`;
  document.getElementById('progressBar').style.width = `${Math.min(100, Math.round((idx/total)*100))}%`;
}

/* Timer and submit */
function startTimer(){
  clearInterval(state.timerInterval);
  const timeEl = document.getElementById('timeRemaining');
  state.timerInterval = setInterval(()=>{
    if(state.timeLeft <= 0){ clearInterval(state.timerInterval); alert('Hết giờ, tự động nộp bài.'); submitQuiz(); return; }
    state.timeLeft--;
    if(timeEl) timeEl.textContent = formatTime(state.timeLeft);
  },1000);
}

function submitQuiz(){
  clearInterval(state.timerInterval);
  const submitBtn = document.getElementById('submitBtn'); if(submitBtn) submitBtn.disabled = true;

  let correct = 0;
  const answersArr = [];
  quizQuestions.forEach(q=>{
    const sel = state.answers[q.id] || '';
    if(sel && sel === q.answer) correct++;
    answersArr.push({id:q.id, selected:sel});
  });

  const score = correct;
  const name = document.getElementById('candidateName')?.value || 'Anonymous';
  const email = document.getElementById('candidateEmail')?.value || '';

  document.getElementById('quiz').classList.add('hidden');
  document.getElementById('result').classList.remove('hidden');
  document.getElementById('score').textContent = `Bạn được ${score} / ${quizQuestions.length}`;

  const payload = { timestamp: new Date().toISOString(), name, email, score, total: quizQuestions.length, answers: answersArr };

  if(GAS_ENDPOINT && GAS_ENDPOINT.indexOf('REPLACE_WITH') === -1){
    fetch(GAS_ENDPOINT, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    }).then(r=>r.json()).then(res=>{
      console.log('GAS response', res);
      // optionally show download link if server returns file url
    }).catch(err=>{
      console.warn('GAS send failed', err);
    });
  } else {
    console.log('GAS_ENDPOINT not configured, skipping send.', payload);
  }
}

/* Utilities */
function shuffleArray(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function formatTime(sec){ const m = Math.floor(sec/60); const s = sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

window.quizDebug = { startQuiz, questions, quizQuestions, state };
console.log('Quiz UI-enhanced loaded');
