import { generateKeyPairSync } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const getKeys = () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const certsDir = path.join(__dirname, "../../certs");

    if (!fs.existsSync(certsDir)) {
        fs.mkdirSync(certsDir, { recursive: true });
    }

    const privateKeyPath = path.join(certsDir, "private.pem");
    const publicKeyPath = path.join(certsDir, "public.pem");

    if (fs.existsSync(privateKeyPath)) {
        return {
            privateKey: fs.readFileSync(privateKeyPath, "utf8"),
            publicKey: fs.readFileSync(publicKeyPath, "utf8"),
        };
    }

    const { privateKey, publicKey } = generateKeyPairSync("ec", {
        namedCurve: "prime256v1",
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey);

    console.log("Initialized new ES256 key pair.");

    return { privateKey, publicKey };
};
