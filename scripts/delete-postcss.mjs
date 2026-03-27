import https from 'https';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: 'api.github.com',
      path, method,
      headers: {
        'Authorization': 'token ' + process.env.GITHUB_TOKEN,
        'User-Agent': 'replit-agent',
        'Accept': 'application/vnd.github.v3+json',
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

const getRes = await request('GET', '/repos/masterstar45/boutique-2/contents/postcss.config.js');
const fileSha = getRes.data.sha;
console.log('SHA:', fileSha);

const delRes = await request('DELETE', '/repos/masterstar45/boutique-2/contents/postcss.config.js', {
  message: 'Supprimer postcss.config.js (incompatible avec @tailwindcss/vite)',
  sha: fileSha,
  branch: 'main'
});
console.log('Status:', delRes.status);
if (delRes.data.commit) {
  console.log('✅ Fichier supprimé, commit:', delRes.data.commit.sha.slice(0, 10));
} else {
  console.log('Réponse:', JSON.stringify(delRes.data).slice(0, 300));
}
