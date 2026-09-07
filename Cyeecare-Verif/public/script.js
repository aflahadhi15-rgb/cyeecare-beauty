let html5QrCode = null;

// Modal Verification Controls
function openVerifyModal() {
  document.getElementById('verifyModal').classList.remove('hidden');
}

function closeVerifyModal() {
  document.getElementById('verifyModal').classList.add('hidden');
  closeCameraArea();
  
  // Auto-reset form input saat modal ditutup
  const form = document.getElementById('verifyForm');
  if (form) form.reset();
  
  // Sembunyikan kembali input PIN jika sebelumnya terbuka
  const vCodeGroup = document.getElementById('vCodeGroup');
  if (vCodeGroup) vCodeGroup.classList.add('hidden');
}

// Modal Result Controls
function openResultModal(isSuccess, title, message, data = null) {
  closeVerifyModal();
  
  const resultModal = document.getElementById('resultModal');
  const statusIcon = document.getElementById('statusIcon');
  const resultStatus = document.getElementById('resultStatus');
  const resultMessage = document.getElementById('resultMessage');
  const detailBox = document.getElementById('resultDetailBox');

  resultStatus.innerText = title;
  resultMessage.innerText = message;

  if (isSuccess && data) {
    statusIcon.className = "status-icon-box status-success";
    statusIcon.innerText = "✓";
    
    document.getElementById('resBrand').innerText = data.brand || '-';
    document.getElementById('resProduct').innerText = data.productName || '-';
    document.getElementById('resBatch').innerText = data.batchNumber || '-';
    
    detailBox.classList.remove('hidden');
  } else {
    statusIcon.className = "status-icon-box status-fail";
    statusIcon.innerText = "✕";
    detailBox.classList.add('hidden');
  }

  resultModal.classList.remove('hidden');
}

function closeResultModal() {
  document.getElementById('resultModal').classList.add('hidden');
}

// Fitur Kamera Scanner
async function openCameraArea() {
  const cameraBox = document.getElementById('cameraArea');
  const scanBtn = document.getElementById('scanCamBtn');
  const errorMsg = document.getElementById('cameraError');
  
  errorMsg.classList.add('hidden');
  
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  try {
    cameraBox.classList.remove('hidden');
    scanBtn.classList.add('hidden');

    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 200, height: 200 } },
      onScanSuccess
    );
  } catch (err) {
    console.error("Camera access error:", err);
    errorMsg.classList.remove('hidden');
  }
}

async function closeCameraArea() {
  const cameraBox = document.getElementById('cameraArea');
  const scanBtn = document.getElementById('scanCamBtn');
  const errorMsg = document.getElementById('cameraError');

  if (html5QrCode?.isScanning) {
    try {
      await html5QrCode.stop();
    } catch (err) {
      console.error(err);
    }
  }

  cameraBox.classList.add('hidden');
  errorMsg.classList.add('hidden');
  scanBtn.classList.remove('hidden');
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  html5QrCode.scanFile(file, true)
    .then(decodedText => onScanSuccess(decodedText))
    .catch(() => alert("Kode tidak terdeteksi pada gambar. Coba gambar lain."));
}

function onScanSuccess(decodedText) {
  document.getElementById('fwmCode').value = decodedText;
  closeCameraArea();
}

function toggleVCodeInput(val) {
  const vCodeGroup = document.getElementById('vCodeGroup');
  if (val === "2") {
    vCodeGroup.classList.remove('hidden');
  } else {
    vCodeGroup.classList.add('hidden');
  }
}

// Integrasi API Backend
async function handleVerify(e) {
  e.preventDefault();
  
  const submitBtn = document.querySelector('.submit-pink-btn');
  const code = document.getElementById('fwmCode').value.trim();
  const type = document.getElementById('verifyType').value;
  const vCode = document.getElementById('vCode').value.trim();

  // Aktifkan animasi loading spinner pada tombol
  submitBtn.disabled = true;
  submitBtn.classList.add('btn-loading');

  try {
    const response = await fetch('https://cyeecare-beauty.online/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        code, 
        type, 
        vCode, 
        brandName: 'Cyeecare' 
      })
    });

    const result = await response.json();

    if (result.success) {
      openResultModal(true, "AUTHENTIC PRODUCT", "Produk Anda terverifikasi 100% asli buatan Cyeecare Beauty.", result.data);
    } else {
      openResultModal(false, "VERIFICATION FAILED", result.message);
    }
  } catch (err) {
    console.error("Backend request failed:", err);
    openResultModal(false, "CONNECTION ERROR", "Gagal terhubung ke server verifikasi.");
  } finally {
    // Matikan animasi loading spinner
    submitBtn.disabled = false;
    submitBtn.classList.remove('btn-loading');
  }
}

// Close Modal dengan klik di luar area modal (Backdrop Click)
window.onclick = function(event) {
  const verifyModal = document.getElementById('verifyModal');
  const resultModal = document.getElementById('resultModal');
  
  if (event.target === verifyModal) {
    closeVerifyModal();
  }
  if (event.target === resultModal) {
    closeResultModal();
  }
};