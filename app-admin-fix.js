// Thay thế hàm setupAdminModal trong app.js bằng đoạn này
function setupAdminModal(){
  const modal = document.getElementById('adminModal');
  const closeBtn = document.getElementById('closeAdminBtn');
  const saveBtn = document.getElementById('saveAdminBtn');

  closeBtn.onclick = () => modal.classList.add('hidden');

  saveBtn.onclick = () => {
    const entered = (document.getElementById('adminPasswordInput').value || '').trim();
    if(!entered){
      alert('Vui lòng nhập mật khẩu (hoặc thiết lập mới nếu chưa có).');
      return;
    }

    const stored = localStorage.getItem('admin_pwd');
    if(!stored){
      // Nếu chưa có password nào lưu, cho phép thiết lập mới (yêu cầu xác nhận)
      const confirmPwd = prompt('Chưa có mật khẩu admin. Xin nhập lại để xác nhận mật khẩu mới:');
      if(confirmPwd === null) return; // hủy
      if(entered !== confirmPwd.trim()){
        alert('Mật khẩu xác nhận không khớp.');
        return;
      }
      localStorage.setItem('admin_pwd', entered);
      // lưu thời gian nếu có
      const open = (document.getElementById('openTimeInput').value || '').trim();
      const close = (document.getElementById('closeTimeInput').value || '').trim();
      if(open) localStorage.setItem('quiz_open', open);
      if(close) localStorage.setItem('quiz_close', close);
      alert('Đã thiết lập mật khẩu admin và lưu cấu hình (local).');
      modal.classList.add('hidden');
      return;
    }

    // Nếu đã có password, kiểm tra
    if(entered !== stored){
      alert('Sai mật khẩu admin.');
      return;
    }

    // Nếu đúng, lưu thời gian mở/đóng (cấu hình local) — có thể mở rộng để gửi lên server
    const open = (document.getElementById('openTimeInput').value || '').trim();
    const close = (document.getElementById('closeTimeInput').value || '').trim();
    if(open) localStorage.setItem('quiz_open', open);
    if(close) localStorage.setItem('quiz_close', close);

    // Tùy chọn: hỏi đổi mật khẩu
    if(confirm('Bạn đã đăng nhập admin. Muốn đổi mật khẩu không?')){
      const newPwd = prompt('Nhập mật khẩu mới (để đổi):');
      if(newPwd && newPwd.trim()){
        localStorage.setItem('admin_pwd', newPwd.trim());
        alert('Đã đổi mật khẩu.');
      }
    }

    alert('Đã lưu (local). Để lưu cấu hình an toàn nên lưu trên server/GAS.');
    modal.classList.add('hidden');
  };
}