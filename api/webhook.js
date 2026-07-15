const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
          const listingName = listings[0].name || 'LodgeLink Property';
          const hostPhone = listings[0].host_phone || 'N/A';
          
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

          // 4. Send Automated Email Receipt
          const guestEmail = updatedReservations[0].guest_email;
          const guestName = updatedReservations[0].guest_name || 'Guest';
          const checkin = updatedReservations[0].checkin;
          const checkout = updatedReservations[0].checkout;
          const nights = updatedReservations[0].nights;

          if (guestEmail && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                  user: process.env.EMAIL_USER,
                  pass: process.env.EMAIL_PASS
                }
              });

              const emailHTML = `
                <div style="font-family: 'Inter', sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                  <div style="background-color: #0B1F3A; padding: 32px 24px; text-align: center;">
                    <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Lodge<span style="color: #E8A020;">Link</span></h1>
                  </div>
                  <div style="padding: 32px 24px;">
                    <h2 style="color: #0B1F3A; margin-top: 0;">Reservation Confirmed! 🎉</h2>
                    <p>Hi ${guestName},</p>
                    <p>Your ₦2,000 reservation fee has been successfully processed. Your room is locked in and waiting for you.</p>
                    
                    <div style="background-color: #F8FAFC; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
                      <h3 style="margin-top: 0; color: #0B1F3A; font-size: 18px;">${listingName}</h3>
                      <p style="margin: 8px 0; font-size: 15px;"><strong>Check-in:</strong> ${checkin} (After 2:00 PM)</p>
                      <p style="margin: 8px 0; font-size: 15px;"><strong>Check-out:</strong> ${checkout} (Before 12:00 PM)</p>
                      <p style="margin: 8px 0; font-size: 15px;"><strong>Stay length:</strong> ${nights} night${nights > 1 ? 's' : ''}</p>
                    </div>

                    <h3 style="color: #0B1F3A; margin-bottom: 12px;">Next Steps: Contact Your Host</h3>
                    <p>Please contact your host immediately to coordinate your exact arrival time. You will pay the remaining accommodation balance directly to the host upon arrival.</p>
                    <div style="background-color: rgba(232, 160, 32, 0.1); border-left: 4px solid #E8A020; padding: 16px; margin: 16px 0;">
                      <p style="margin: 0; font-size: 16px;"><strong>Host Phone / WhatsApp:</strong> <a href="tel:${hostPhone}" style="color: #0B1F3A; font-weight: bold; text-decoration: none;">${hostPhone}</a></p>
                    </div>

                    <p style="color: #64748B; font-size: 14px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                      If you have any issues, reply to this email or contact LodgeLink support. Safe travels!
                    </p>
                  </div>
                </div>
              `;

              await transporter.sendMail({
                from: '"LodgeLink Bookings" <' + process.env.EMAIL_USER + '>',
                to: guestEmail,
                subject: `Confirmed: Your stay at ${listingName}`,
                html: emailHTML
              });
              
              console.log(`Receipt email sent to ${guestEmail}`);
            } catch (emailErr) {
              console.error('Failed to send receipt email:', emailErr);
            }
          } else {
            console.warn('Skipping email receipt: Missing EMAIL_USER, EMAIL_PASS, or guest_email');
          }
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
