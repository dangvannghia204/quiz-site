// Thay thế chỉ phần setupAdminModal bằng đoạn này để modal có thể đóng bằng click ngoài và Esc
function setupAdminModal(){
  const modal = document.getElementById('adminModal');
  const closeBtn = document.getElementById('closeAdminBtn');
  const saveBtn = document.getElementById('saveAdminBtn');

  // close on explicit button
  closeBtn.onclick = () => modal.classList.add('hidden');

  // close when clicking overlay (chỉ khi click ngoài modal-content)
  modal.addEventListener('click', (ev) => {
    if(ev.target === modal) modal.classList.add('hidden');
  });

  // close on Escape key
  document.addEventListener('keydown', (ev) => {
    if(ev.key === 'Escape') modal.classList.add('hidden');
  });

  saveBtn.onclick = () => {
    const entered = (document.getElementById('adminPasswordInput').value || '').trim();
    if(!entered){
      alert('Vui lòng nhập mật khẩu.');
      return;
    }
    const stored = localStorage.getItem('admin_pwd');
    if(!stored){
      const confirmPwd = prompt('Chưa có mật khẩu admin. Nhập lại để xác nhận mật khẩu mới:');
      if(confirmPwd === null) return;
      if(entered !== confirmPwd.trim()){
        alert('Mật khẩu xác nhận không khớp.');
        return;
      }
      localStorage.setItem('admin_pwd', entered);
      saveOpenCloseFromModal();
      alert('Đã thiết lập mật khẩu admin và lưu cấu hình (local).');
      modal.classList.add('hidden');
      return;
    }
    if(entered !== stored){
      alert('Sai mật khẩu admin.');
      return;
    }
    saveOpenCloseFromModal();
    if(confirm('Bạn đã đăng nhập admin. Muốn đổi mật khẩu không?')){
      const newPwd = prompt('Nhập mật khẩu mới:');
      if(newPwd && newPwd.trim()){
        localStorage.setItem('admin_pwd', newPwd.trim());
        alert('Đã đổi mật khẩu.');
      }
    }
    alert('Đã lưu (local). Nên lưu cấu hình an toàn trên server (GAS).');
    modal.classList.add('hidden');
  };
}