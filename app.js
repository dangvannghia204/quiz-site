// app.js - Fallback version: try CSV, if fail use embedded questions so site still works
const GAS_ENDPOINT = ''; // keep empty for now

let questions = [];
let quizQuestions = [];
let state = { current:0, answers:{}, timeLeft:0, timerInterval:null };

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  loadQuestionsWithFallback();
});

/* ---------- Load questions with fallback ---------- */
async function loadQuestionsWithFallback(){
  try{
    await loadQuestions(); // try fetching questions.csv (normal)
    if(Array.isArray(questions) && questions.length>0){
      console.log('[Quiz] questions loaded from CSV:', questions.length);
      return;
    }
    console.warn('[Quiz] CSV loaded but empty -> using fallback');
  }catch(e){
    console.warn('[Quiz] loadQuestions error (will use fallback):', e);
  }

  // fallback embedded questions (so site usable immediately)
  questions = [
    { id:'q1', question:'Thủ đô Việt Nam là?', A:'Hà Nội', B:'TP HCM', C:'Đà Nẵng', D:'Hải Phòng', answer:'A' },
    { id:'q2', question:'Ngôn ngữ lập trình phổ biến trên web là?', A:'Python', B:'JavaScript', C:'Go', D:'Rust', answer:'B' },
    { id:'q3', question:'HTML dùng để làm gì?', A:'Tạo cấu trúc trang web', B:'Kiểm soát cơ sở dữ liệu', C:'Thiết kế hệ điều hành', D:'Quản lý mạng', answer:'A' }
  ];
  updateStatus(`Đã load ${questions.length} câu hỏi (fallback).`);
  console.log('[Quiz] Using fallback questions. Replace questions.csv or fix path to restore CSV load.');
}

function updateStatus(txt){
  const s = document.getElementById('status');
  if(s) s.textContent = txt;
}

/* Try loading questions.csv (throws if fetch or parse fails) */
async function loadQuestions(){
  const tries = ['questions.csv?v='+Date.now(), './questions.csv?v='+Date.now(), '/questions.csv?v='+Date.now()];
  let text = null;
  let lastErr = null;
  for(const url of tries){
    try{
      const resp = await fetch(url, { cache:'no-store' });
      console.log('[Quiz] fetch', url, 'status', resp.status);
      if(!resp.ok) { lastErr = new Error('Status ' + resp.status); continue; }
      text = await resp.text();
      if(text && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      break;
    }catch(e){
      console.warn('[Quiz] fetch error', url, e);
      lastErr = e;
    }
  }
  if(!text) throw lastErr || new Error('Cannot fetch questions.csv');
  const parsed = parseCSV(text);
  questions = parsed;
  updateStatus(`Đã load ${questions.length} câu hỏi.`);
  return;
}

/* Simple CSV parser (expects header id,question,A,B,C,D,answer) */
function parseCSV(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(lines.length<=1) return [];
  const header = csvLineToArray(lines.shift()).map(h=>h.trim());
  const rows = lines.map(line => {
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
  return rows.filter(r => r.question && r.question.length>0);
}

function csvLineToArray(line){
  const res = []; let cur=''; let inQ=false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"'){
      if(inQ && i+1 < line.length && line[i+1] === '"'){ cur += '"'; i++; }
      else inQ = !inQ;
    } else if(ch === ',' && !inQ){ res.push(cur); cur = ''; }
    else cur += ch;
  }
  res.push(cur);
  return res;
}

/* ---------- UI & Quiz lifecycle (same as before) ---------- */
function initUI(){
  document.getElementById('startBtn')?.addEventListener('click', () => {
    const n = Number(document.getElementById('numQuestions').value) || 10;
    const t = Number(document.getElementById('timeLimit').value) || 15;
    startQuiz(n,t);
  });
  document.getElementById('prevBtn')?.addEventListener('click', ()=>{ if(state.current>0){ state.current--; renderQuestion(); } });
  document.getElementById('nextBtn')?.addEventListener('click', ()=>{ if(state.current < quizQuestions.length-1){ state.current++; renderQuestion(); } });
  document.getElementById('submitBtn')?.addEventListener('click', submitQuiz);
  document.getElementById('restartBtn')?.addEventListener('click', ()=> {
    document.getElementById('result').classList.add('hidden');
    document.getElementById('setup').classList.remove('hidden');
  });
}

function startQuiz(numQuestions, timeMinutes){
  if(!Array.isArray(questions) || questions.length===0){
    alert('Chưa có câu hỏi. Kiểm tra file questions.csv');
    return;
  }
  quizQuestions = shuffleArray(questions.slice()).slice(0, Math.min(numQuestions, questions.length));
  state = { current:0, answers:{}, timeLeft: Math.max(1, Math.floor(timeMinutes))*60, timerInterval:null };
  document.getElementById('setup').classList.add('hidden');
  document.getElementById('quiz').classList.remove('hidden');
  renderQuestion();
  document.getElementById('timeRemaining').textContent = formatTime(state.timeLeft);
  startTimer();
}

function renderQuestion(){
  const q = quizQuestions[state.current];
  const qa = document.getElementById('questionArea');
  qa.innerHTML = '';
  if(!q){ qa.innerHTML = '<p>Không tìm thấy câu hỏi.</p>'; return; }
  qa.innerHTML = `<h3>Câu ${state.current+1} / ${quizQuestions.length}</h3><p>${escapeHtml(q.question)}</p>`;
  const opts = document.createElement('div'); opts.className='options';
  ['A','B','C','D'].forEach(letter=>{
    const label = document.createElement('label');
    label.innerHTML = `<input type="radio" name="opt" value="${letter}"/> <strong>${letter}</strong>. ${escapeHtml(q[letter]||'')}`;
    label.querySelector('input').addEventListener('change', ()=> state.answers[q.id]=letter);
    opts.appendChild(label);
  });
  qa.appendChild(opts);
  document.getElementById('prevBtn').disabled = state.current === 0;
  document.getElementById('nextBtn').disabled = state.current >= quizQuestions.length - 1;
}

function startTimer(){
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(()=> {
    if(state.timeLeft<=0){ clearInterval(state.timerInterval); alert('Hết giờ'); submitQuiz(); return; }
    state.timeLeft--; document.getElementById('timeRemaining').textContent = formatTime(state.timeLeft);
  },1000);
}

function submitQuiz(){
  clearInterval(state.timerInterval);
  document.getElementById('submitBtn').disabled = true;
  let correct = 0; const answersArray=[];
  quizQuestions.forEach(q => { const sel = state.answers[q.id] || ''; if(sel && sel === q.answer) correct++; answersArray.push({id:q.id, selected: sel}); });
  document.getElementById('quiz').classList.add('hidden');
  document.getElementById('result').classList.remove('hidden');
  document.getElementById('score').textContent = `Bạn được ${correct} / ${quizQuestions.length}`;
  // (optional) send to GAS if configured
}

function shuffleArray(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function formatTime(sec){ const m=Math.floor(sec/60); const s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* debug helpers */
window.quizDebug = {
  loadQuestionsNow: () => loadQuestionsWithFallback(),
  injectDemoQuestions: () => { questions = [{id:'q1',question:'Demo?',A:'1',B:'2',C:'3',D:'4',answer:'A'}]; console.log('demo injected'); }
};
console.log('Fallback app.js loaded');
