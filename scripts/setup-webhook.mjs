import https from 'https';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const RAILWAY_URL = 'https://boutique-2-production.up.railway.app';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: 'api.telegram.org',
      path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? {'Content-Length': Buffer.byteLength(data)} : {})
      }
    };
    const r = https.request(opts, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve({status: res.statusCode, data: JSON.parse(b)}));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

// Supprimer l'ancien webhook
await request('POST', `/bot${BOT_TOKEN}/deleteWebhook`);

// Configurer le nouveau webhook
const res = await request('POST', `/bot${BOT_TOKEN}/setWebhook`, {
  url: `${RAILWAY_URL}/api/telegram/webhook`,
  allowed_updates: ['message'],
  drop_pending_updates: true
});

console.log('Status:', res.status);
console.log('Résultat:', res.data.description ?? JSON.stringify(res.data));

// Vérifier le webhook
const info = await request('GET', `/bot${BOT_TOKEN}/getWebhookInfo`);
console.log('Webhook URL:', info.data.result?.url);
console.log('Pending updates:', info.data.result?.pending_update_count);

// Info du bot
const botInfo = await request('GET', `/bot${BOT_TOKEN}/getMe`);
console.log('Bot:', '@' + botInfo.data.result?.username, '-', botInfo.data.result?.first_name);
