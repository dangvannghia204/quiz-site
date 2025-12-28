// app.js - frontend logic
// CONFIG: set GAS_ENDPOINT to your deployed Google Apps Script web app URL
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
  // UI elements
  const startBtn = document.getElementById('startBtn');
  const adminBtn = document.getElementById('adminBtn');
  const numQInput = document.getElementById('numQuestions');
  const timeLimitInput = document.getElementById('timeLimit');

  loadCSV('questions.csv').then(data => {
    questions = data;
    document.getElementById('status').textContent = `Đã load ${questions.length} câu hỏi.`;
  }).catch(err => {
    document.getElementById('status').textContent = 'Lỗi load câu hỏi: ' + err;
  });

  startBtn.addEventListener('click', () => startQuiz(Number(numQInput.value), Number(timeLimitInput.value)));
  adminBtn.addEventListener('click', () => showAdmin());

  setupAdminModal();
});

function loadCSV(url){
  return fetch(url).then(r => {
    if(!r.ok) throw new Error('Không thể fetch CSV');
    return r.text();
  }).then(parseCSV);
}

function parseCSV(text){
  // CSV expected header: id,question,A,B,C,D,answer
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l);
  const header = lines.shift().split(',');
  return lines.map(line => {
    const cols = splitCSVLine(line);
    return {
      id: cols[0],
      question: cols[1],
      A: cols[2],
      B: cols[3],
      C: cols[4],
      D: cols[5],
      answer: (cols[6] || '').trim()
    };
  });
}

function splitCSVLine(line){
  // simple CSV split by comma, assumes no embedded commas/quotes. For more robust parsing use library.
  return line.split(',');
}

function startQuiz(numQuestions, timeMinutes){
  if(questions.length === 0) { alert('No questions loaded'); return; }
  // check open/close times from localStorage (admin may have set)
  const now = new Date();
  const openISO = localStorage.getItem('quiz_open');
  const closeISO = localStorage.getItem('quiz_close');
  if(openISO && closeISO){
    const open = new Date(openISO);
    const close = new Date(closeISO);
    if(now < open){ alert('Bài chưa mở: ' + open.toLocaleString()); return; }
    if(now > close){ alert('Bài đã đóng: ' + close.toLocaleString()); return; }
  }

  quizQuestions = shuffleArray(questions.slice()).slice(0, Math.min(numQuestions, questions.length));
  state = { current: 0, answers: {}, timeLeft: timeMinutes * 60, timerInterval: null };
  document.getElementById('setup').classList.add('hidden');
  document.getElementById('quiz').classList.remove('hidden');
  renderQuestion();
  startTimer();
}

function renderQuestion(){
  const q = quizQuestions[state.current];
  const qa = document.getElementById('questionArea');
  qa.innerHTML = '';
  const qdiv = document.createElement('div');
  qdiv.className = 'question';
  qdiv.innerHTML = `<h3>Câu ${state.current+1} / ${quizQuestions.length}</h3><p>${escapeHtml(q.question)}</p>`;
  qa.appendChild(qdiv);

  const opts = document.createElement('div');
  opts.className = 'options';
  ['A','B','C','D'].forEach(letter => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="radio" name="opt" value="${letter}" ${state.answers[q.id]===letter?'checked':''}/> <strong>${letter}</strong>. ${escapeHtml(q[letter])}`;
    label.addEventListener('click', () => {
      state.answers[q.id] = letter;
    });
    opts.appendChild(label);
  });
  qa.appendChild(opts);

  document.getElementById('prevBtn').onclick = () => {
    if(state.current > 0) { state.current--; renderQuestion(); }
  };
  document.getElementById('nextBtn').onclick = () => {
    if(state.current < quizQuestions.length - 1) { state.current++; renderQuestion(); }
  };
  document.getElementById('submitBtn').onclick = submitQuiz;
}

function startTimer(){
  const timeEl = document.getElementById('timeRemaining');
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    if(state.timeLeft <= 0){
      clearInterval(state.timerInterval);
      submitQuiz();
      return;
    }
    state.timeLeft--;
    timeEl.textContent = formatTime(state.timeLeft);
  }, 1000);
}

function submitQuiz(){
  clearInterval(state.timerInterval);
  // calculate score
  let correct = 0;
  const answersArray = [];
  quizQuestions.forEach(q => {
    const selected = state.answers[q.id] || '';
    if(selected && selected === q.answer) correct++;
    answersArray.push({id: q.id, selected});
  });
  const score = correct;
  const candidateName = document.getElementById('candidateName').value || 'Anonymous';
  const candidateEmail = document.getElementById('candidateEmail').value || '';

  document.getElementById('quiz').classList.add('hidden');
  const resultDiv = document.getElementById('result');
  resultDiv.classList.remove('hidden');
  document.getElementById('score').innerHTML = `Bạn được ${score} / ${quizQuestions.length}`;

  // send to backend (GAS)
  const payload = {
    timestamp: new Date().toISOString(),
    name: candidateName,
    email: candidateEmail,
    score,
    total: quizQuestions.length,
    answers: answersArray
  };

  fetch(GAS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json()).then(resp => {
    console.log('GAS response', resp);
    alert('Kết quả đã được lưu.');
  }).catch(err => {
    console.error(err);
    alert('Không lưu được kết quả: ' + err);
  });
}

function showAdmin(){
  document.getElementById('adminModal').classList.remove('hidden');
}

function setupAdminModal(){
  const modal = document.getElementById('adminModal');
  const closeBtn = document.getElementById('closeAdminBtn');
  const saveBtn = document.getElementById('saveAdminBtn');
  closeBtn.onclick = () => modal.classList.add('hidden');
  saveBtn.onclick = () => {
    const pwd = document.getElementById('adminPasswordInput').value;
    // basic client-side "auth" demo: check against stored password in localStorage (NOT SECURE)
    const adminPwd = localStorage.getItem('admin_pwd') || 'admin123';
    if(pwd !== adminPwd){
      alert('Sai mật khẩu admin');
      return;
    }
    const open = document.getElementById('openTimeInput').value;
    const close = document.getElementById('closeTimeInput').value;
    if(open) localStorage.setItem('quiz_open', open);
    if(close) localStorage.setItem('quiz_close', close);
    alert('Đã lưu (local). Để lưu cấu hình trên server, dùng Admin panel của GAS.');
    modal.classList.add('hidden');
  };
}

// util
function shuffleArray(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function formatTime(sec){ const m = Math.floor(sec/60); const s = sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }