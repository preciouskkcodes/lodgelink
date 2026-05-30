export default function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const { password } = req.body;
    const correctPassword = process.env.ADMIN_PASSWORD;
  
    if (!correctPassword) {
      return res.status(500).json({ error: 'Server configuration error' });
    }
  
    if (password === correctPassword) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(401).json({ success: false });
    }
  }