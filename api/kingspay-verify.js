// api/kingspay-verify.js
// Secure serverless function - verifies a KingsPay payment status.

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KINGSPAY_SECRET = process.env.KINGSPAY_SECRET_KEY;
  if (!KINGSPAY_SECRET) {
    return res.status(500).json({ success: false, message: 'Server configuration error' });
  }

  const { payment_id } = req.query;
  if (!payment_id) {
    return res.status(400).json({ success: false, message: 'payment_id is required' });
  }

  try {
    const kpRes = await fetch('https://api.kingspay-gs.com/api/payment/' + payment_id, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + KINGSPAY_SECRET,
        'Content-Type': 'application/json',
      },
    });

    const data = await kpRes.json();
    
    // KingsPay typically returns the status inside the payload. 
    // Wait, the status could be data.status or data.payment.status depending on their JSON structure.
    // We'll check both and require it to be 'SUCCESS'.
    const status = (data.status || (data.payment && data.payment.status) || '').toUpperCase();

    if (kpRes.ok && status === 'SUCCESS') {
      return res.status(200).json({ success: true, status: status, data: data });
    } else {
      return res.status(400).json({ success: false, status: status, data: data, message: 'Payment not successful' });
    }
  } catch (err) {
    console.error('KingsPay verify error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
};
