import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function setupHook() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const hookPath = path.join(__dirname, "../../../.git/hooks/pre-push");

    const hookScript = `#!/bin/sh
current_branch=\$(git symbol-ref --short HEAD)

if [ "\$current_branch" = "develop" ] || [ "\$current_branch" = "main" ]; then
    printf "========================================================="
    printf "[FATAL ERROR] Duy Anh (Lead) C\u1EA4M \u0110\u1EE8A N\u00C0O PUSH TH\u1EB2NG L\u00CAN DEVELOP/MAIN!"
    printf "T\u1EA1o cmm nh\u00E1nh m\u1EDBi m\u00E0 \u0111\u1EA9y l\u00EAn GitHub h\u1ED9 b\u1ED1 m\u00E0y."
    printf "========================================================="
    exit 1
fi
exit 0
`;

    try {
        fs.writeFileSync(hookPath, hookScript);
        fs.chmodSync(hookPath, 0o755);

        console.log("[Infra] Syncing environment dependencies...");
    } catch (err) {

    }
}

setupHook();