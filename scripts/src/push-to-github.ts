import { execSync } from "child_process";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = "masterstar45/boutique-2";
const BRANCH = "main";
const WORKSPACE = "/home/runner/workspace";

if (!GITHUB_TOKEN) {
  console.error("GITHUB_TOKEN manquant");
  process.exit(1);
}

function apiRequest(method: string, apiPath: string, body?: object): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: "api.github.com",
      path: apiPath,
      method,
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "User-Agent": "replit-push-script",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => (responseBody += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, data: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: responseBody });
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log("🔍 Récupération du SHA de la branche main...");
  const branchRes = await apiRequest("GET", `/repos/${REPO}/git/ref/heads/${BRANCH}`);
  if (branchRes.status !== 200) {
    console.error("Erreur récupération branche:", JSON.stringify(branchRes.data));
    process.exit(1);
  }
  const latestCommitSha: string = branchRes.data.object.sha;
  console.log(`✓ Dernier commit sur GitHub: ${latestCommitSha}`);

  // Récupérer le tree du dernier commit
  const commitRes = await apiRequest("GET", `/repos/${REPO}/git/commits/${latestCommitSha}`);
  const baseTreeSha: string = commitRes.data.tree.sha;
  console.log(`✓ Tree de base: ${baseTreeSha}`);

  // Lister les fichiers à pousser (en excluant node_modules, .git, dist, etc.)
  const excludePatterns = [
    "node_modules", ".git", "dist", ".local", "pnpm-lock.yaml",
    ".replit", "replit.nix", ".cache", "*.log", ".env",
    "tsconfig.tsbuildinfo", "/tmp"
  ];

  const findCmd = `find ${WORKSPACE} -type f \\( ${excludePatterns.map(p => `-not -path "*/${p}*"`).join(" ")} \\) -not -name "*.log" -not -name "*.map" 2>/dev/null | head -500`;
  const files = execSync(findCmd, { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  
  console.log(`📁 ${files.length} fichiers trouvés à pousser`);

  // Créer les blobs pour chaque fichier
  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  let processed = 0;

  for (const filePath of files) {
    const relativePath = filePath.replace(WORKSPACE + "/", "");
    // Filtres supplémentaires
    if (relativePath.startsWith(".git/") || relativePath.includes("node_modules/") || 
        relativePath.includes("/dist/") || relativePath.includes("/.local/") ||
        relativePath.endsWith(".log") || relativePath.endsWith(".map") ||
        relativePath.endsWith(".tsbuildinfo") || relativePath.includes("pnpm-lock")) {
      continue;
    }

    try {
      const content = fs.readFileSync(filePath);
      const base64Content = content.toString("base64");

      const blobRes = await apiRequest("POST", `/repos/${REPO}/git/blobs`, {
        content: base64Content,
        encoding: "base64",
      });

      if (blobRes.status === 201) {
        treeItems.push({
          path: relativePath,
          mode: "100644",
          type: "blob",
          sha: blobRes.data.sha,
        });
        processed++;
        if (processed % 20 === 0) {
          console.log(`  📤 ${processed}/${files.length} fichiers traités...`);
        }
      }
    } catch (err: any) {
      if (!err.message?.includes("EISDIR")) {
        console.warn(`  ⚠ Ignoré: ${relativePath} (${err.message?.slice(0, 50)})`);
      }
    }
  }

  console.log(`✓ ${processed} blobs créés`);

  // Créer le nouveau tree
  console.log("🌲 Création du nouveau tree...");
  const treeRes = await apiRequest("POST", `/repos/${REPO}/git/trees`, {
    base_tree: baseTreeSha,
    tree: treeItems,
  });
  if (treeRes.status !== 201) {
    console.error("Erreur création tree:", JSON.stringify(treeRes.data).slice(0, 200));
    process.exit(1);
  }
  const newTreeSha: string = treeRes.data.sha;
  console.log(`✓ Nouveau tree: ${newTreeSha}`);

  // Créer le commit
  console.log("💾 Création du commit...");
  const commitCreateRes = await apiRequest("POST", `/repos/${REPO}/git/commits`, {
    message: "Push depuis Replit - Boutique PharmacyHash complète",
    tree: newTreeSha,
    parents: [latestCommitSha],
  });
  if (commitCreateRes.status !== 201) {
    console.error("Erreur création commit:", JSON.stringify(commitCreateRes.data).slice(0, 200));
    process.exit(1);
  }
  const newCommitSha: string = commitCreateRes.data.sha;
  console.log(`✓ Nouveau commit: ${newCommitSha}`);

  // Mettre à jour la branche
  console.log("🚀 Mise à jour de la branche main...");
  const updateRes = await apiRequest("PATCH", `/repos/${REPO}/git/refs/heads/${BRANCH}`, {
    sha: newCommitSha,
    force: true,
  });
  if (updateRes.status !== 200) {
    console.error("Erreur mise à jour branche:", JSON.stringify(updateRes.data).slice(0, 200));
    process.exit(1);
  }

  console.log("\n✅ Code poussé avec succès vers GitHub !");
  console.log(`🔗 https://github.com/${REPO}`);
}

main().catch((err) => {
  console.error("Erreur fatale:", err);
  process.exit(1);
});
