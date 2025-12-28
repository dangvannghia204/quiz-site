// app.js - Phiên bản BỎ kiểm tra thời gian (open/close)
// Ghi đè file app.js hiện tại bằng nội dung này để tắt hoàn toàn chức năng kiểm tra thời gian.
// Thay GAS_ENDPOINT nếu bạn muốn gửi kết quả lên Google Apps Script.
const GAS_ENDPOINT = 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOY_ID/exec';

let questions = []; // {id, question, A,B,C,D,answer}
let quizQuestions = [];
let state = {
  current: 0,
  answers: {},
  timeLeft: 0,
  timerInterval: null
};

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  loadCSV('questions.csv')
    .then(data => {
      questions = data;
      const statusEl = document.getElementById('status');
      if(statusEl) statusEl.textContent = `Đã load ${questions.length} câu hỏi.`;
      console.log('[Quiz] Loaded questions:', questions.length);
    })
    .catch(err => {
      console.error('[Quiz] Lỗi load questions.csv', err);
      const statusEl = document.getElementById('status');
      if(statusEl) statusEl.textContent = 'Lỗi load câu hỏi. Mở Console để xem chi tiết.';
    });
});

function initUI(){
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  if(startBtn){
    startBtn.addEventListener('click', () => {
      const numQ = Number(document.getElementById('numQuestions').value) || 10;
      const timeMin = Number(document.getElementById('timeLimit').value) || 15;
      startQuiz(numQ, timeMin);
    });
  }
  if(restartBtn){
    restartBtn.addEventListener('click', () => {
      document.getElementById('result').classList.add('hidden');
      document.getElementById('setup').classList.remove('hidden');
      const statusEl = document.getElementById('status');
      if(statusEl) statusEl.textContent = `Đã load ${questions.length} câu hỏi.`;
    });
  }
}

/* ================= CSV loading & parsing ================= */
function loadCSV(url){
  return fetch(url).then(r => {
    if(!r.ok) throw new Error('Fetch CSV failed: ' + r.status);
    return r.text();
  }).then(parseCSV);
}

function parseCSV(text){
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if(lines.length === 0) return [];
  // assume header present
  lines.shift();
  return lines.map(line => {
    const cols = csvLineToArray(line);
    return {
      id: (cols[0] || '').trim(),
      question: (cols[1] || '').trim(),
      A: (cols[2] || '').trim(),
      B: (cols[3] || '').trim(),
      C: (cols[4] || '').trim(),
      D: (cols[5] || '').trim(),
      answer: (cols[6] || '').trim()
    };
  });
}

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

/* ================= Quiz lifecycle (KHÔNG có kiểm tra thời gian) ================= */
function startQuiz(numQuestions, timeMinutes){
  if(!Array.isArray(questions) || questions.length === 0){
    alert('Chưa có câu hỏi. Kiểm tra file questions.csv');
    return;
  }

  // TẮT kiểm tra open/close: bắt đầu luôn khi người dùng nhấn Start
  quizQuestions = shuffleArray(questions.slice()).slice(0, Math.min(numQuestions, questions.length));
  state = { current: 0, answers: {}, timeLeft: Math.max(1, Math.floor(timeMinutes)) * 60, timerInterval: null };

  document.getElementById('setup').classList.add('hidden');
  document.getElementById('quiz').classList.remove('hidden');
  renderQuestion();
  const tr = document.getElementById('timeRemaining');
  if(tr) tr.textContent = formatTime(state.timeLeft);
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
    const input = label.querySelector('input');
    input.addEventListener('change', () => {
      state.answers[q.id] = letter;
    });
    opts.appendChild(label);
  });
  qa.appendChild(opts);

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const submitBtn = document.getElementById('submitBtn');

  if(prevBtn) prevBtn.onclick = () => { if(state.current > 0){ state.current--; renderQuestion(); } };
  if(nextBtn) nextBtn.onclick = () => { if(state.current < quizQuestions.length - 1){ state.current++; renderQuestion(); } };
  if(submitBtn){
    submitBtn.disabled = false;
    submitBtn.onclick = submitQuiz;
  }
}

/* ================= Timer & submit ================= */
function startTimer(){
  const timeEl = document.getElementById('timeRemaining');
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    if(state.timeLeft <= 0){
      clearInterval(state.timerInterval);
      alert('Hết giờ, hệ thống sẽ tự động nộp bài.');
      submitQuiz();
      return;
    }
    state.timeLeft--;
    if(timeEl) timeEl.textContent = formatTime(state.timeLeft);
  }, 1000);
}

function submitQuiz(){
  clearInterval(state.timerInterval);
  const submitBtn = document.getElementById('submitBtn');
  if(submitBtn) submitBtn.disabled = true;

  let correct = 0;
  const answersArray = [];
  quizQuestions.forEach(q => {
    const selected = state.answers[q.id] || '';
    if(selected && selected === q.answer) correct++;
    answersArray.push({id: q.id, selected});
  });

  const score = correct;
  const candidateName = document.getElementById('candidateName')?.value || 'Anonymous';
  const candidateEmail = document.getElementById('candidateEmail')?.value || '';

  document.getElementById('quiz').classList.add('hidden');
  const resultDiv = document.getElementById('result');
  resultDiv.classList.remove('hidden');
  const scoreEl = document.getElementById('score');
  if(scoreEl) scoreEl.innerHTML = `Bạn được ${score} / ${quizQuestions.length}`;

  const payload = {
    timestamp: new Date().toISOString(),
    name: candidateName,
    email: candidateEmail,
    score,
    total: quizQuestions.length,
    answers: answersArray
  };

  if(GAS_ENDPOINT && GAS_ENDPOINT.indexOf('REPLACE_WITH') === -1){
    fetch(GAS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => {
      if(!r.ok) throw new Error('GAS response ' + r.status);
      return r.json();
    }).then(resp => {
      console.log('[Quiz] GAS response', resp);
      alert('Kết quả đã được lưu.');
    }).catch(err => {
      console.error('[Quiz] Không lưu được kết quả:', err);
      alert('Không lưu được kết quả lên server: ' + err + '\n(Xem Console để biết chi tiết)');
    });
  } else {
    console.warn('[Quiz] GAS_ENDPOINT chưa đặt - kết quả không gửi.');
    alert('Kết quả hiển thị cục bộ (GAS_ENDPOINT chưa được cấu hình).');
  }
}

/* ================= Utility ================= */
function shuffleArray(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function formatTime(sec){ const m = Math.floor(sec/60); const s = sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

// Debug helpers
window.quizDebug = {
  startQuiz,
  questions,
  quizQuestions,
  state
};
console.log('[Quiz] app.js loaded (NO time checks).');
