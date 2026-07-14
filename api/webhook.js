const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error('LodgeLink Error: PAYSTACK_SECRET_KEY is missing from environment variables');
    return res.status(500).json({ message: 'Server configuration error' });
  }

  // Validate Paystack signature
  const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(400).json({ message: 'Invalid signature' });
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    const data = event.data;
    
    // Extract reservation_id from metadata
    let reservationId = null;
    if (data.metadata && data.metadata.custom_fields) {
      const field = data.metadata.custom_fields.find(f => f.variable_name === 'reservation_id');
      if (field) reservationId = field.value;
    }

    if (!reservationId) {
      return res.status(200).json({ message: 'No reservation_id found, ignoring event' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    try {
      // 1. Mark reservation as paid
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/reservations?id=eq.${reservationId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ status: 'paid' })
      });

      const updatedReservations = await updateRes.json();
      
      if (updatedReservations && updatedReservations.length > 0) {
        const listingId = updatedReservations[0].listing_id;

        // 2. Fetch current listing to get rooms_available
        const getListingRes = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const listings = await getListingRes.json();

        if (listings && listings.length > 0) {
          const currentRooms = listings[0].rooms_available ?? 1;
          const newRooms = Math.max(0, currentRooms - 1);
          
          // 3. Decrement rooms_available
          await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rooms_available: newRooms, available: newRooms > 0 })
          });
          
          console.log(`Successfully processed payment for reservation ${reservationId} and decremented listing ${listingId} to ${newRooms} rooms.`);
        }
      }

      return res.status(200).json({ message: 'Webhook processed successfully' });

    } catch (err) {
      console.error('Supabase update failed during webhook:', err);
      return res.status(500).json({ message: 'Database update failed' });
    }
  }

  // Acknowledge other event types quietly
  return res.status(200).json({ message: 'Event ignored' });
};
