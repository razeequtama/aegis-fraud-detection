export interface RiskSignalLike {
  name: string;
  description: string;
}

export interface LocalizedSignal {
  name: string;
  title: string;
  description: string;
}

const SIGNAL_TITLES_ID: Record<string, string> = {
  high_fraud_probability: 'PROBABILITAS PENIPUAN SANGAT TINGGI',
  moderate_risk_pattern: 'POLA INDIKASI RISIKO SEDANG',
  critical_account_drain: 'PENGURASAN SALDO AKUN KRITIS',
  elevated_account_drain: 'PENGURASAN SALDO AKUN TINGGI',
  moderate_account_drain: 'PENGURASAN SALDO AKUN SEDANG',
  balance_discrepancy: 'KETIDAKSESUAIAN SALDO PENGIRIM',
  dest_balance_discrepancy: 'KETIDAKSESUAIAN SALDO PENERIMA',
  ultra_high_value: 'NILAI TRANSAKSI SANGAT TINGGI',
  high_value_transaction: 'TRANSAKSI NILAI TINGGI',
  high_payment_attempts: 'PERCOBAAN PEMBAYARAN BERULANG TINGGI',
  repeated_payment_attempt: 'PERCOBAAN PEMBAYARAN BERULANG',
  high_velocity_burst: 'LONJAKAN FREKUENSI TRANSAKSI TINGGI',
  shared_device_detected: 'PERANGKAT BERSAMA TERDETEKSI',
  high_network_degree: 'KONEKSI JARINGAN GRAF TINGGI',
  velocity: 'LONJAKAN KECEPATAN TRANSAKSI',
};

const SIGNAL_TITLES_EN: Record<string, string> = {
  high_fraud_probability: 'HIGH FRAUD PROBABILITY',
  moderate_risk_pattern: 'MODERATE RISK PATTERN',
  critical_account_drain: 'CRITICAL ACCOUNT DRAIN',
  elevated_account_drain: 'ELEVATED ACCOUNT DRAIN',
  moderate_account_drain: 'MODERATE ACCOUNT DRAIN',
  balance_discrepancy: 'ORIGIN BALANCE DISCREPANCY',
  dest_balance_discrepancy: 'DESTINATION BALANCE DISCREPANCY',
  ultra_high_value: 'ULTRA HIGH VALUE',
  high_value_transaction: 'HIGH VALUE TRANSACTION',
  high_payment_attempts: 'HIGH PAYMENT ATTEMPTS',
  repeated_payment_attempt: 'REPEATED PAYMENT ATTEMPT',
  high_velocity_burst: 'HIGH VELOCITY BURST',
  shared_device_detected: 'SHARED DEVICE DETECTED',
  high_network_degree: 'HIGH NETWORK DEGREE',
  velocity: 'TRANSACTION VELOCITY BURST',
};

export function translateSignalTitle(name: string, language: 'en' | 'id'): string {
  const normalizedKey = name.trim().toLowerCase().replace(/\s+/g, '_');
  if (language === 'id') {
    if (SIGNAL_TITLES_ID[normalizedKey]) {
      return SIGNAL_TITLES_ID[normalizedKey];
    }
  } else {
    if (SIGNAL_TITLES_EN[normalizedKey]) {
      return SIGNAL_TITLES_EN[normalizedKey];
    }
  }
  return name.replace(/_/g, ' ').toUpperCase();
}

export function translateSignalDescription(
  name: string,
  rawDescription: string,
  language: 'en' | 'id'
): string {
  if (!rawDescription) return '';
  const desc = rawDescription.trim();
  const normalizedKey = name.trim().toLowerCase().replace(/\s+/g, '_');

  if (language === 'id') {
    // If it's already in Indonesian, return as is
    if (
      desc.includes('Pengurasan') ||
      desc.includes('Ketidakcocokan') ||
      desc.includes('terdeteksi') ||
      desc.includes('melampaui') ||
      desc.includes('penipuan')
    ) {
      return desc;
    }

    // 1. Critical Account Drain
    // "Near-total account drain detected: 100.0% of balance withdrawn (305,627.00 from 305,627.00)."
    const mCrit = desc.match(
      /Near-total account drain detected:\s*([\d.]+)%\s*of balance withdrawn\s*\(([^)]+)\s+from\s+([^)]+)\)/i
    );
    if (mCrit) {
      return `Pengurasan saldo akun hampir total terdeteksi: ${mCrit[1]}% saldo ditarik (Rp ${mCrit[2]} dari Rp ${mCrit[3]}).`;
    }
    const mCritSimple = desc.match(/Near-total account drain detected:\s*([\d.]+)%/i);
    if (mCritSimple) {
      return `Pengurasan saldo akun hampir total terdeteksi: ${mCritSimple[1]}% saldo ditarik.`;
    }

    // 2. Elevated Account Drain
    // "High account depletion detected: 85.0% of balance withdrawn."
    const mElev = desc.match(
      /High account depletion detected:\s*([\d.]+)%\s*of balance withdrawn/i
    );
    if (mElev) {
      return `Pengurasan saldo akun tingkat tinggi terdeteksi: ${mElev[1]}% saldo ditarik.`;
    }

    // 3. Moderate Account Drain
    // "Moderate account depletion: 50.0% of balance withdrawn."
    const mMod = desc.match(
      /Moderate account depletion:\s*([\d.]+)%\s*of balance withdrawn/i
    );
    if (mMod) {
      return `Pengurasan saldo akun tingkat sedang: ${mMod[1]}% saldo ditarik.`;
    }

    // 4. Origin Balance Discrepancy
    // "Origin balance mismatch (+10,000.00) indicates an anomalous ledger state."
    const mOrigDisc = desc.match(
      /Origin balance mismatch\s*\(([^)]+)\)\s*indicates an anomalous ledger state/i
    );
    if (mOrigDisc) {
      return `Ketidakcocokan saldo rekening pengirim (${mOrigDisc[1]}) menunjukkan status pembukuan buku besar yang anomali.`;
    }

    // 5. Destination Balance Discrepancy
    // "Destination balance mismatch (+5,000.00) indicates irregular settlement tracking."
    const mDestDisc = desc.match(
      /Destination balance mismatch\s*\(([^)]+)\)\s*indicates irregular settlement tracking/i
    );
    if (mDestDisc) {
      return `Ketidakcocokan saldo rekening penerima (${mDestDisc[1]}) menunjukkan pencatatan penyelesaian yang tidak teratur.`;
    }

    // 6. Ultra High Value
    // "Transaction amount (Rp 1,500,000.00) exceeds ultra-high risk threshold."
    const mUltra = desc.match(
      /Transaction amount\s*\(([^)]+)\)\s*exceeds ultra-high risk threshold/i
    );
    if (mUltra) {
      return `Jumlah transaksi (${mUltra[1]}) melampaui ambang batas risiko sangat tinggi.`;
    }

    // 7. High Value Transaction
    // "Transaction amount (Rp 250,000.00) exceeds standard operational threshold."
    const mHighVal = desc.match(
      /Transaction amount\s*\(([^)]+)\)\s*exceeds standard operational threshold/i
    );
    if (mHighVal) {
      return `Jumlah transaksi (${mHighVal[1]}) melampaui batas ambang operasional standar.`;
    }

    // 8. High Payment Attempts
    // "Multiple repeated payment attempts detected (3 attempts)."
    const mAttempts = desc.match(
      /Multiple repeated payment attempts detected\s*\((\d+)\s*attempts\)/i
    );
    if (mAttempts) {
      return `Terdeteksi beberapa kali percobaan pembayaran berulang (${mAttempts[1]} percobaan).`;
    }

    // 9. Repeated Payment Attempt
    // "Secondary payment attempt detected after initial failure."
    if (/Secondary payment attempt detected after initial failure/i.test(desc)) {
      return 'Percobaan pembayaran kedua terdeteksi setelah kegagalan transaksi awal.';
    }

    // 10. High Velocity Burst
    // "Unusual velocity burst detected: account initiated 5 transactions within 60 seconds."
    const mVel = desc.match(
      /Unusual velocity burst detected:\s*account initiated\s*(\d+)\s*transactions within\s*(\d+)\s*seconds/i
    );
    if (mVel) {
      return `Lonjakan frekuensi transaksi tidak wajar terdeteksi: akun melakukan ${mVel[1]} transaksi dalam ${mVel[2]} detik.`;
    }

    // 11. Shared Device Detected
    // "Account shares devices with other entities (shared count: 3)."
    const mDev = desc.match(
      /Account shares devices with other entities\s*\(shared count:\s*(\d+)\)/i
    );
    if (mDev) {
      return `Akun terdeteksi menggunakan perangkat yang sama dengan entitas lain (jumlah entitas bersama: ${mDev[1]}).`;
    }

    // 12. High Network Degree
    // "Account exhibits high connection degree (4) in transaction graph."
    const mDeg = desc.match(
      /Account exhibits high connection degree\s*\((\d+)\)\s*in transaction graph/i
    );
    if (mDeg) {
      return `Akun menunjukkan derajat koneksi tinggi (${mDeg[1]}) dalam graf jaringan transaksi.`;
    }

    // 13. High Fraud Probability
    if (/Composite risk model predicts a critical probability/i.test(desc)) {
      return 'Model risiko komposit memprediksi probabilitas kritis dari aktivitas transaksi penipuan.';
    }

    // 14. Moderate Risk Pattern
    if (
      /Transaction exhibits elevated anomaly signals exceeding review threshold/i.test(
        desc
      )
    ) {
      return 'Transaksi menunjukkan peningkatan sinyal anomali melebihi ambang batas peninjauan; ditandai untuk pemeriksaan analis.';
    }

    // Key-based fallback if text didn't match regex exactly
    switch (normalizedKey) {
      case 'high_fraud_probability':
        return 'Model risiko komposit memprediksi probabilitas kritis dari aktivitas transaksi penipuan.';
      case 'moderate_risk_pattern':
        return 'Transaksi menunjukkan peningkatan sinyal anomali melebihi ambang batas peninjauan; ditandai untuk pemeriksaan analis.';
      case 'critical_account_drain':
        return 'Pengurasan saldo akun hampir total terdeteksi: penarikan saldo dalam jumlah masif.';
      case 'elevated_account_drain':
        return 'Pengurasan saldo akun tingkat tinggi terdeteksi.';
      case 'moderate_account_drain':
        return 'Pengurasan saldo akun tingkat sedang.';
      case 'balance_discrepancy':
        return 'Ketidakcocokan saldo rekening pengirim menunjukkan status pembukuan buku besar anomali.';
      case 'dest_balance_discrepancy':
        return 'Ketidakcocokan saldo rekening penerima menunjukkan pencatatan penyelesaian yang tidak teratur.';
      case 'ultra_high_value':
        return 'Jumlah transaksi melampaui batas ambang risiko sangat tinggi.';
      case 'high_value_transaction':
        return 'Jumlah transaksi melampaui batas ambang operasional standar.';
      case 'high_payment_attempts':
        return 'Terdeteksi beberapa kali percobaan pembayaran berulang.';
      case 'repeated_payment_attempt':
        return 'Percobaan pembayaran kedua terdeteksi setelah kegagalan transaksi awal.';
      case 'high_velocity_burst':
        return 'Lonjakan frekuensi transaksi tidak wajar terdeteksi dalam jendela waktu singkat.';
      case 'shared_device_detected':
        return 'Akun terdeteksi menggunakan perangkat yang sama dengan entitas lain.';
      case 'high_network_degree':
        return 'Akun menunjukkan derajat koneksi tinggi dalam graf jaringan transaksi.';
    }

    return desc;
  } else {
    // Target is English: if the text is in Indonesian, convert back to English
    if (
      !desc.includes('Pengurasan') &&
      !desc.includes('Ketidakcocokan') &&
      !desc.includes('terdeteksi') &&
      !desc.includes('melampaui') &&
      !desc.includes('penipuan')
    ) {
      return desc;
    }

    // 1. Critical Account Drain
    const mCritId = desc.match(
      /Pengurasan saldo akun hampir total terdeteksi:\s*([\d.]+)%\s*saldo ditarik\s*\((?:Rp\s*)?([^)]+)\s+dari\s+(?:Rp\s*)?([^)]+)\)/i
    );
    if (mCritId) {
      return `Near-total account drain detected: ${mCritId[1]}% of balance withdrawn (${mCritId[2]} from ${mCritId[3]}).`;
    }

    // 2. Elevated / Moderate Account Drain
    const mElevId = desc.match(
      /Pengurasan saldo akun tingkat (tinggi|sedang) terdeteksi:\s*([\d.]+)%\s*saldo ditarik/i
    );
    if (mElevId) {
      const isHigh = mElevId[1].toLowerCase() === 'tinggi';
      return isHigh
        ? `High account depletion detected: ${mElevId[2]}% of balance withdrawn.`
        : `Moderate account depletion: ${mElevId[2]}% of balance withdrawn.`;
    }

    // 4. Origin Balance
    const mOrigId = desc.match(
      /Ketidakcocokan saldo rekening pengirim\s*\(([^)]+)\)/i
    );
    if (mOrigId) {
      return `Origin balance mismatch (${mOrigId[1]}) indicates an anomalous ledger state.`;
    }

    // 5. Dest Balance
    const mDestId = desc.match(
      /Ketidakcocokan saldo rekening penerima\s*\(([^)]+)\)/i
    );
    if (mDestId) {
      return `Destination balance mismatch (${mDestId[1]}) indicates irregular settlement tracking.`;
    }

    // 6. Ultra / High Value
    const mValId = desc.match(
      /Jumlah transaksi\s*\(([^)]+)\)\s*melampaui.*(sangat tinggi|standar)/i
    );
    if (mValId) {
      const isUltra = mValId[2].toLowerCase() === 'sangat tinggi';
      return isUltra
        ? `Transaction amount (${mValId[1]}) exceeds ultra-high risk threshold.`
        : `Transaction amount (${mValId[1]}) exceeds standard operational threshold.`;
    }

    // 8. Payment Attempts
    const mAttId = desc.match(
      /Terdeteksi beberapa kali percobaan pembayaran berulang\s*\((\d+)\s*percobaan\)/i
    );
    if (mAttId) {
      return `Multiple repeated payment attempts detected (${mAttId[1]} attempts).`;
    }

    // 9. Repeated Payment
    if (/Percobaan pembayaran kedua terdeteksi/i.test(desc)) {
      return 'Secondary payment attempt detected after initial failure.';
    }

    // 10. Velocity
    const mVelId = desc.match(
      /Lonjakan frekuensi transaksi tidak wajar terdeteksi:.*melakukan (\d+) transaksi dalam (\d+) detik/i
    );
    if (mVelId) {
      return `Unusual velocity burst detected: account initiated ${mVelId[1]} transactions within ${mVelId[2]} seconds.`;
    }

    // 11. Shared Device
    const mDevId = desc.match(/jumlah entitas bersama:\s*(\d+)/i);
    if (mDevId) {
      return `Account shares devices with other entities (shared count: ${mDevId[1]}).`;
    }

    // 12. Network degree
    const mDegId = desc.match(/derajat koneksi tinggi\s*\((\d+)\)/i);
    if (mDegId) {
      return `Account exhibits high connection degree (${mDegId[1]}) in transaction graph.`;
    }

    // 13. High Fraud
    if (/aktivitas transaksi penipuan/i.test(desc)) {
      return 'Composite risk model predicts a critical probability of fraudulent transaction activity.';
    }

    // 14. Moderate Pattern
    if (/peningkatan sinyal anomali melebihi ambang batas/i.test(desc)) {
      return 'Transaction exhibits elevated anomaly signals exceeding review threshold; flagged for analyst inspection.';
    }

    return desc;
  }
}

export function translateRiskSignal(
  sig: RiskSignalLike,
  language: 'en' | 'id'
): LocalizedSignal {
  return {
    name: sig.name,
    title: translateSignalTitle(sig.name, language),
    description: translateSignalDescription(sig.name, sig.description, language),
  };
}

