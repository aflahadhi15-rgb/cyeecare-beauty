const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const axios = require('axios');
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');

// CORS Config untuk lokal & domain live Hostinger
app.use(cors({
  origin: (origin, callback) => {
    const defaultAllowed = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://cyeecare-beauty.online',
    ];

    const envOrigins = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((val) => val.trim())
      .filter(Boolean);

    const allowedOrigins = [...defaultAllowed, ...envOrigins];

    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Tentukan lokasi pasti folder public
const possiblePublicPaths = [
  path.join(__dirname, '../public'),
  path.join(__dirname, 'public'),
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'Cyeecare-Verif/public')
];

let publicPath = possiblePublicPaths.find((p) => fs.existsSync(path.join(p, 'index.html'))) || possiblePublicPaths[0];

app.use(express.static(publicPath));

// CONFIG KREDENSIAL MASTER VENDOR (TOEWIN)
const VENDOR_CONFIG = {
  apiUrl: process.env.VENDOR_API_URL || 'https://web.mark.toewin.com/webapi1/channel/api/codeStatusInfo/tCheckCode',
  brandId: process.env.CYEECARE_BRAND_ID || 80,
  account: process.env.CYEECARE_ACCOUNT || 'www',
  password: process.env.CYEECARE_PASSWORD || 'bbb'
};

// Pembuat 32-bit Uppercase MD5 Sign
function generateToewinSign(brandId, account, password, type, fwm) {
  const rawString = `brandId=${brandId}&account=${account}&password=${password}&type=${type}&fwm=${fwm}`;
  // Required by the vendor's signing protocol; this is not used for password storage or data integrity.
  return crypto.createHash('md5').update(rawString).digest('hex').toUpperCase(); // NOSONAR
}

// Route penanganan halaman utama (Fallback ke index.html)
app.get('/', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(404).send(`File index.html tidak ditemukan. Path terdeteksi: ${publicPath}`);
});

// Endpoint status kesehatan API
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'active', message: 'Cyeecare API Backend Running Successfully' });
});

// Endpoint API Verifikasi Universal
app.post('/api/verify', async (req, res) => {
  const { code, type, vCode, brandName } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Kode produk wajib diisi."
    });
  }

  try {
    const selectedType = Number.parseInt(type) || 1;

    // 1. Generate Signature
    const sign = generateToewinSign(
      VENDOR_CONFIG.brandId,
      VENDOR_CONFIG.account,
      VENDOR_CONFIG.password,
      selectedType,
      code
    );

    // 2. Payload Request
    const payload = {
      brandId: VENDOR_CONFIG.brandId,
      account: VENDOR_CONFIG.account,
      fwm: code,
      type: selectedType,
      sign: sign
    };

    if (selectedType === 2 && vCode) {
      payload.vCode = vCode;
    }

    // 3. Tembak API Vendor
    const vendorResponse = await axios.post(VENDOR_CONFIG.apiUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    const resData = vendorResponse.data;

    // 4. Response ke Frontend
    if (resData._code === 0 && resData._success) {
      return res.status(200).json({
        success: true,
        message: resData._message || "Produk Terverifikasi Asli",
        data: {
          brand: brandName || "Cyeecare",
          productName: "Official Authentic Product",
          firstCheckTime: resData._data?.E || "-",
          totalCheckCount: resData._data?.C || 1,
          currentCheckCount: resData._data?.D || 1
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: resData._message || "Kode tidak valid atau produk palsu."
      });
    }

  } catch (error) {
    console.error("Vendor Connection Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Gagal terhubung ke server verifikasi vendor."
    });
  }
});

// Port otomatis mengikuti ketersediaan Hostinger / default 5000
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server Express berjalan di port ${PORT}`);
});