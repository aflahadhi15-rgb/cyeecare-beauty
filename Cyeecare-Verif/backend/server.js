const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const axios = require('axios');

const app = express();
app.disable('x-powered-by');
const PORT = 5000;

app.use(cors({
  origin: (origin, callback) => {
    // Configure production frontend origins with CORS_ORIGINS (comma-separated).
    const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    // Requests without an Origin header (for example, server-to-server calls)
    // are not subject to browser CORS restrictions.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// CONFIG KREDENSIAL MASTER VENDOR (TOEWIN)
require('dotenv').config();

const VENDOR_CONFIG = {
  apiUrl: 'https://web.mark.toewin.com/webapi1/channel/api/codeStatusInfo/tCheckCode',
  brandId: 80,       // Masukkan Brand ID Master dari Vendor di sini[cite: 1]
  account: 'www',    // Account Master[cite: 1]
  password: 'bbb'    // Password Master untuk MD5 Sign[cite: 1]
};

// Pembuat 32-bit Uppercase MD5 Sign[cite: 1]
function generateToewinSign(brandId, account, password, type, fwm) {
  const rawString = `brandId=${brandId}&account=${account}&password=${password}&type=${type}&fwm=${fwm}`;
  // The vendor protocol requires an uppercase MD5 value; this is not used for
  // password storage, encryption, or any security-sensitive integrity check.
  return crypto.createHash('md5').update(rawString).digest('hex').toUpperCase(); // NOSONAR
}

// Endpoint API Verifikasi Universal
app.post('/api/verify', async (req, res) => {
  // brandName dikirim dari frontend sesuai web pemanggil
  const { code, type, vCode, brandName } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Kode produk wajib diisi."
    });
  }

  try {
    const selectedType = Number.parseInt(type) || 1;

    // 1. Generate Signature[cite: 1]
    const sign = generateToewinSign(
      VENDOR_CONFIG.brandId,
      VENDOR_CONFIG.account,
      VENDOR_CONFIG.password,
      selectedType,
      code
    );

    // 2. Payload Request[cite: 1]
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

    // 3. Tembak API Vendor[cite: 1]
    const vendorResponse = await axios.post(VENDOR_CONFIG.apiUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    const resData = vendorResponse.data;

    // 4. Response ke Frontend[cite: 1]
    if (resData._code === 0 && resData._success) {
      return res.status(200).json({
        success: true,
        message: resData._message || "Produk Terverifikasi Asli",
        data: {
          // Jika brandName dikirim frontend, pakai itu. Jika tidak, fallback ke default "Cyeecare"
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

app.listen(PORT, () => {
  console.log(`Master Verification Backend running at http://127.0.0.1:${PORT}`);
});