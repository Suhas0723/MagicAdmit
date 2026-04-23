const { google } = require('googleapis');

// Creates a tentative 30-min consultation request event on the owner's calendar.
// The owner can later confirm a time and send an invite to the client.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, grade, service, message } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8')
    );

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // Default to tomorrow at 10:00 AM — owner adjusts the actual time before sending invite
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const end = new Date(tomorrow.getTime() + 30 * 60 * 1000);

    const event = {
      summary: `📋 Consultation Request — ${name}`,
      description: [
        `Client: ${name}`,
        `Email: ${email}`,
        `Grade: ${grade || 'Not specified'}`,
        `Service Interest: ${service || 'Not specified'}`,
        '',
        `Goals / Timeline:`,
        message || 'Not provided',
        '',
        '— Adjust this event to your preferred time, then send the invite to the client.',
      ].join('\n'),
      start: { dateTime: tomorrow.toISOString(), timeZone: 'America/New_York' },
      end: { dateTime: end.toISOString(), timeZone: 'America/New_York' },
      status: 'tentative',
      colorId: '5', // banana yellow — stands out as a pending item
    };

    await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      resource: event,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Calendar error:', err);
    return res.status(500).json({ error: 'Failed to create calendar event' });
  }
};
