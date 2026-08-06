// api/kingspay-init.js
// Secure serverless function - initializes a KingsPay Espees payment.
// The secret key never touches the browser.

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const KINGSPAY_SECRET = process.env.KINGSPAY_SECRET_KEY;
  if (!KINGSPAY_SECRET) {
    console.error('LodgeLink: KINGSPAY_SECRET_KEY missing from env vars');
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { reservationId, guestName } = req.body || {};
  if (!reservationId) {
    return res.status(400).json({ message: 'reservationId is required' });
  }

  const callbackUrl =
    'https://lodgelink-ng.vercel.app/success.html?provider=kingspay&reservation_id=' + reservationId;

  try {
    const kpRes = await fetch('https://api.kingspay-gs.com/api/payment/initialize', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KINGSPAY_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: 1,
        currency: 'ESP',
        payment_type: 'espees',
        description: 'LodgeLink Room Reservation - ' + (guestName || 'Guest'),
        merchant_callback_url: callbackUrl,
      }),
    });

    const data = await kpRes.json();

    if (!kpRes.ok) {
      console.error('KingsPay error:', data);
      const kpErrorMsg = data.message || data.error || JSON.stringify(data);
      return res.status(502).json({ message: 'KingsPay API says: ' + kpErrorMsg, detail: data });
    }

    // KingsPay returns payment URL in various possible fields
    const paymentUrl =
      data.payment_url || data.checkout_url || data.url ||
      (data.data && (data.data.payment_url || data.data.checkout_url || data.data.url));

    if (!paymentUrl) {
      console.error('KingsPay missing payment URL:', data);
      return res.status(502).json({ message: 'No payment URL returned. Raw response: ' + JSON.stringify(data), raw: data });
    }

    return res.status(200).json({ paymentUrl });

  } catch (err) {
    console.error('KingsPay init error:', err.message);
    return res.status(500).json({ message: 'Internal error', detail: err.message });
  }
};
